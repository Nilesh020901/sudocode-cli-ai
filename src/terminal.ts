import { spawn as childSpawn } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';

// Dynamic import of node-pty to support graceful fallback if compilation failed
let pty: any = null;
try {
  const module = await import('node-pty');
  pty = module.default || module;
} catch (e) {
  // Gracefully ignore loading errors
}

export interface TerminalResult {
  stdout: string;
  exitCode: number;
}

export class PersistentTerminal {
  private ptyProcess: any = null;
  private isWindows = os.platform() === 'win32';
  private currentCwd: string = process.cwd();
  private outputBuffer: string = '';
  private onDataListener: ((data: string) => void) | null = null;
  private isReady: Promise<void>;

  constructor() {
    this.isReady = this.initializeShell();
  }

  private async initializeShell(): Promise<void> {
    const isWindowsNonTTY = this.isWindows && !process.stdout.isTTY;
    if (!pty || process.env.FORCE_STATELESS === 'true' || isWindowsNonTTY) {
      return;
    }

    const shell = this.isWindows ? 'powershell.exe' : 'bash';
    try {
      this.ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 120,
        rows: 40,
        cwd: this.currentCwd,
        env: process.env as any
      });

      // Hook up PTY stream reader
      this.ptyProcess.onData((data: string) => {
        this.outputBuffer += data;
        if (this.onDataListener) {
          this.onDataListener(data);
        }
      });

      // Wait 1200ms to let the shell print welcome banners and prompts, then clear the buffer
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          this.outputBuffer = '';
          resolve();
        }, 1200);
      });
    } catch (err) {
      console.warn('Failed to initialize PTY shell. Falling back to stateless execution.', err);
      this.ptyProcess = null;
    }
  }

  /**
   * Execute a command in the persistent terminal.
   */
  public async execute(command: string, timeoutMs: number = 60000): Promise<TerminalResult> {
    // Wait until warm-up is done
    await this.isReady;

    if (!this.ptyProcess) {
      return this.executeFallback(command, timeoutMs);
    }

    return new Promise((resolve) => {
      const marker = `__AERO_DONE_${Math.random().toString(36).substring(7).toUpperCase()}__`;
      const exitCodePrefix = '__AERO_EXIT_CODE__';
      
      // PowerShell vs Bash/Unix prompt command formatting
      let fullCommand = '';
      if (this.isWindows) {
        fullCommand = `${command}; echo "${exitCodePrefix}:$LASTEXITCODE"; echo "${marker}"\r\n`;
      } else {
        fullCommand = `${command}; echo "${exitCodePrefix}:$?"; echo "${marker}"\n`;
      }

      this.outputBuffer = '';
      let timer: NodeJS.Timeout | null = null;
      let isResolved = false;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.onDataListener = null;
      };

      // Set timeout in case command hangs
      timer = setTimeout(() => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        
        try {
          if (this.ptyProcess) {
            this.ptyProcess.write('\x03'); // Send Ctrl+C
          }
        } catch (err) {}
        
        resolve({
          stdout: this.cleanPtyOutput(this.outputBuffer) + '\n[Command timed out]',
          exitCode: -1
        });
      }, timeoutMs);

      // Listen for shell output
      this.onDataListener = (data: string) => {
        if (isResolved) return;

        if (this.outputBuffer.includes(marker)) {
          isResolved = true;
          cleanup();

          const rawOutput = this.outputBuffer;
          const cleaned = this.cleanPtyOutput(rawOutput);
          
          // Extract exit code
          const exitCodeMatch = rawOutput.match(new RegExp(`${exitCodePrefix}:(-?\\d+)`));
          const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 0;
          
          const lines = cleaned.split('\n');
          const exitCodeIdx = lines.findIndex(line => line.includes(exitCodePrefix));
          
          // Calculate the number of echoed input lines to skip them
          const inputLineCount = fullCommand.split('\n').filter(line => line.length > 0).length;
          
          // Slice between command echo and exit code marker
          let outputLines = lines.slice(inputLineCount, exitCodeIdx >= 0 ? exitCodeIdx : undefined);
          
          // Clean empty or prompt-only trailing/leading artifacts
          let stdout = outputLines.join('\n').trim();

          // Simple "cd" detection to keep cached working directory updated
          const trimmedCommand = command.trim();
          if (trimmedCommand.startsWith('cd ') || trimmedCommand === 'cd') {
            this.updateCwdAfterCd();
          }

          resolve({
            stdout,
            exitCode
          });
        }
      };

      // Write command to PTY input stream
      try {
        this.ptyProcess.write(fullCommand);
      } catch (writeErr: any) {
        cleanup();
        resolve({
          stdout: `Error writing to terminal shell: ${writeErr.message}`,
          exitCode: -1
        });
      }
    });
  }

  private cleanPtyOutput(raw: string): string {
    // Remove ANSI escape codes
    let clean = raw.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    // Remove carriage returns
    clean = clean.replace(/\r/g, '');
    return clean;
  }

  /**
   * Stateless fallback if node-pty is unavailable or disabled.
   */
  private async executeFallback(command: string, timeoutMs: number): Promise<TerminalResult> {
    return new Promise((resolve) => {
      const cdMatch = command.trim().match(/^cd\s+(.+)$/i);
      if (cdMatch) {
        const targetDir = cdMatch[1].replace(/['"]/g, '').trim();
        try {
          const resolvedPath = path.resolve(this.currentCwd, targetDir);
          if (fs.existsSync(resolvedPath)) {
            this.currentCwd = resolvedPath;
            resolve({ stdout: `Changed directory to ${this.currentCwd}`, exitCode: 0 });
            return;
          } else {
            resolve({ stdout: `Error: Directory not found: ${targetDir}`, exitCode: 1 });
            return;
          }
        } catch (e: any) {
          resolve({ stdout: `Error changing directory: ${e.message}`, exitCode: 1 });
          return;
        }
      }

      const shell = this.isWindows ? 'powershell.exe' : '/bin/sh';
      const args = this.isWindows ? ['-Command', command] : ['-c', command];

      let stdout = '';
      let stderr = '';
      
      const child = childSpawn(shell, args, {
        cwd: this.currentCwd,
        env: process.env,
        timeout: timeoutMs
      });

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          stdout: (stdout + stderr).trim(),
          exitCode: code ?? 0
        });
      });

      child.on('error', (err) => {
        resolve({
          stdout: `Error running command: ${err.message}`,
          exitCode: -1
        });
      });
    });
  }

  /**
   * Quietly update the internal CWD path reference.
   */
  private async updateCwdAfterCd() {
    if (!this.ptyProcess) return;
    
    const getPwdCmd = 'pwd';
    const marker = `__AERO_PWD_${Math.random().toString(36).substring(7).toUpperCase()}__`;
    const fullCommand = this.isWindows 
      ? `${getPwdCmd}; echo "${marker}"\r\n`
      : `${getPwdCmd}; echo "${marker}"\n`;

    return new Promise<void>((resolve) => {
      let buffer = '';
      
      const onData = (data: string) => {
        buffer += data;
        if (buffer.includes(marker)) {
          const cleaned = this.cleanPtyOutput(buffer);
          const lines = cleaned.split('\n');
          const markerIndex = lines.findIndex(l => l.includes(marker));
          if (markerIndex > 0) {
            const potentialPath = lines[markerIndex - 1].trim();
            if (path.isAbsolute(potentialPath)) {
              this.currentCwd = potentialPath;
            }
          }
          this.onDataListener = null;
          resolve();
        }
      };

      this.onDataListener = onData;
      this.ptyProcess.write(fullCommand);
    });
  }

  public getCwd(): string {
    return this.currentCwd;
  }

  public shutdown(): void {
    if (this.ptyProcess) {
      try {
        // Kill the shell process directly to avoid conpty list agent errors
        if (typeof this.ptyProcess.kill === 'function') {
          this.ptyProcess.kill();
        }
      } catch (e) {
        // Suppress shutdown platform errors
      }
      this.ptyProcess = null;
    }
  }
}
