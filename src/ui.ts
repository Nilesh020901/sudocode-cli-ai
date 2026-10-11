import chalk from 'chalk';
import readline from 'readline';
import { execSync } from 'child_process';
import path from 'path';

// ─── Claude Theme Color Palette ───────────────────────────────────────────────

export const CLAUDE_CORAL = '#b82be2';       // SudoCode signature purple
export const CLAUDE_TERRACOTTA = '#b82be2';  // SudoCode signature purple
export const CLAUDE_CREAM = '#F8FAFC';       // Crisp primary text
export const CLAUDE_MUTED = '#94A3B8';       // Soft gray meta info
export const CLAUDE_DARK = '#151515';        // Mascot eye / dark contrast
export const CLAUDE_BORDER = '#334155';      // Border lines
export const CLAUDE_SUCCESS = '#34D399';     // Emerald green
export const CLAUDE_WARN = '#FBBF24';        // Amber warning
export const CLAUDE_ERROR = '#F87171';       // Crimson error

// ─── Git Branch Helper ────────────────────────────────────────────────────────

export function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000
    }).toString().trim();
  } catch {
    return '';
  }
}

// ─── Mascot Art (Claude 8-Bit Pixel Mascot) ───────────────────────────────────

export function getMascotLines(): string[] {
  const C = chalk.hex(CLAUDE_CORAL)('██');
  const _ = '  ';

  return [
    `${_}${_}${C}${C}${C}${C}${C}${C}${C}${C}${_}${_}`,
    `${_}${_}${C}${_}${C}${C}${C}${C}${_}${C}${_}${_}`,
    `${C}${C}${C}${C}${C}${C}${C}${C}${C}${C}${C}${C}`,
    `${C}${C}${C}${C}${C}${C}${C}${C}${C}${C}${C}${C}`,
    `${_}${_}${C}${C}${C}${C}${C}${C}${C}${C}${_}${_}`,
    `${_}${_}${C}${_}${C}${_}${_}${C}${_}${C}${_}${_}`,
    `${_}${_}${C}${_}${C}${_}${_}${C}${_}${C}${_}${_}`,
  ];
}

// ─── Startup Banner ──────────────────────────────────────────────────────────

export function printBanner(modelName: string, cwd: string) {
  // Clear screen and reset cursor so the full mascot starts cleanly at top row
  try {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1Bc');
    } else {
      console.clear();
    }
  } catch {
    console.clear();
  }

  const mascot = getMascotLines();
  const folderName = path.basename(cwd) || cwd;
  const branch = getGitBranch();
  const branchInfo = branch ? ` ${chalk.dim('(')}${chalk.bold.hex(CLAUDE_TERRACOTTA)(branch)}${chalk.dim(')')}` : '';

  const sideInfo = [
    chalk.bold.hex(CLAUDE_CORAL)('  ⚡ SudoCode') + chalk.dim(' v1.1.3') + chalk.hex(CLAUDE_MUTED)(' — Terminal Coding Agent (Claude-Mode)'),
    chalk.dim('  ──────────────────────────────────────────────────────────────'),
    chalk.white('  Model:     ') + chalk.hex(CLAUDE_TERRACOTTA)(modelName),
    chalk.white('  Workspace: ') + chalk.cyan(folderName) + branchInfo + chalk.dim(` · ${cwd}`),
    chalk.white('  Status:    ') + chalk.hex(CLAUDE_SUCCESS)('● Ready to code'),
    chalk.dim('  Commands:  ') + chalk.hex(CLAUDE_CORAL)('/help') + chalk.dim(' · ') + chalk.hex(CLAUDE_CORAL)('/plan') + chalk.dim(' · ') + chalk.hex(CLAUDE_CORAL)('/auto') + chalk.dim(' · ') + chalk.hex(CLAUDE_CORAL)('/compact'),
    chalk.dim('  Controls:  ') + chalk.dim('Ctrl+C to quit · /reset to clear history'),
  ];

  for (let i = 0; i < mascot.length; i++) {
    const left = mascot[i];
    const right = sideInfo[i] || '';
    console.log(`${left}${right}`);
  }
}

// ─── Claude Starburst Animated Spinner ───────────────────────────────────────

export const STARBURST_FRAMES = [
  '·', // tiny dot
  '⋄', // small diamond
  '◇', // medium hollow diamond
  '◈', // double diamond box
  '◆', // filled heavy diamond (peak pop-up)
  '◈', // double diamond box
  '◇', // medium hollow diamond
  '⋄', // small diamond
];

export const POPUP_FRAMES = [
  chalk.dim.hex('#7a1db0')('·'),
  chalk.hex('#8a1cb5')('⋄'),
  chalk.hex('#a824db')('◇'),
  chalk.bold.hex('#b82be2')('◈'),
  chalk.bold.hex('#e27bff')('◆'),
  chalk.bold.hex('#b82be2')('◈'),
  chalk.hex('#a824db')('◇'),
  chalk.hex('#8a1cb5')('⋄'),
];

export class ClaudeSpinner {
  private timer: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private message: string;
  private isSpinning = false;
  private colorHex: string;
  private startTime = 0;

  constructor(message: string = 'Thinking...', colorHex: string = CLAUDE_CORAL) {
    this.message = message;
    this.colorHex = colorHex;
  }

  public start(message?: string): this {
    if (message) this.message = message;
    if (this.isSpinning) return this;

    this.isSpinning = true;
    this.frameIndex = 0;
    this.startTime = Date.now();

    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?25l');
    }

    this.render();
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % POPUP_FRAMES.length;
      this.render();
    }, 90);

    return this;
  }

  public update(message: string): this {
    this.message = message;
    if (this.isSpinning) this.render();
    return this;
  }

  private render() {
    const elapsedSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const frameSymbol = POPUP_FRAMES[this.frameIndex % POPUP_FRAMES.length];
    const text = chalk.hex(CLAUDE_CREAM)(this.message);
    const elapsed = chalk.dim(`(${elapsedSec}s)`);
    const line = `  ${frameSymbol}  ${text} ${elapsed}`;

    if (process.stdout.isTTY) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(line);
    }
  }

  public stop(): this {
    if (!this.isSpinning) return this;
    this.isSpinning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (process.stdout.isTTY) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write('\x1b[?25h');
    }

    return this;
  }

  public succeed(message?: string): this {
    const elapsedSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
    this.stop();
    const finalMsg = message || this.message;
    console.log(`  ${chalk.hex(CLAUDE_SUCCESS)('✔')} ${chalk.hex(CLAUDE_CREAM)(finalMsg)} ${chalk.dim(`(${elapsedSec}s)`)}`);
    return this;
  }

  public fail(message?: string): this {
    const elapsedSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
    this.stop();
    const finalMsg = message || this.message;
    console.log(`  ${chalk.hex(CLAUDE_ERROR)('✖')} ${chalk.hex(CLAUDE_ERROR)(finalMsg)} ${chalk.dim(`(${elapsedSec}s)`)}`);
    return this;
  }
}

export function createSpinner(message: string = 'Thinking...'): ClaudeSpinner {
  return new ClaudeSpinner(message);
}

// ─── Tool Call Formatting (Claude Code Tree-Node Style) ──────────────────────

export function formatToolSignature(toolName: string, args: any): string {
  switch (toolName) {
    case 'execute_command':
      return `Bash(${chalk.bold(args.command || '')})`;
    case 'read_file':
      return `Read(${chalk.cyan(args.path || '')})`;
    case 'edit_file':
      return `Edit(${chalk.cyan(args.path || '')})`;
    case 'write_file':
      return `Write(${chalk.cyan(args.path || '')})`;
    case 'list_files':
      return `List(${chalk.cyan(args.path || '.')})`;
    case 'grep':
      return `Grep("${chalk.yellow(args.pattern || '')}")`;
    case 'workspace_search':
      return `Search("${chalk.yellow(args.query || '')}")`;
    case 'todo_write':
      return `Todo(${args.items?.length || 0} items)`;
    default:
      return `${toolName}(${JSON.stringify(args).substring(0, 40)})`;
  }
}

export function renderToolStart(toolName: string, args: any): string {
  const signature = formatToolSignature(toolName, args);
  return `${chalk.hex(CLAUDE_CORAL)('●')} ${chalk.hex(CLAUDE_CREAM)(signature)}`;
}

export function renderToolResult(toolName: string, args: any, result: string, durationMs: number, success = true) {
  const signature = formatToolSignature(toolName, args);
  const bullet = success ? chalk.hex(CLAUDE_CORAL)('●') : chalk.hex(CLAUDE_ERROR)('✖');
  const elapsed = chalk.dim(`(${(durationMs / 1000).toFixed(1)}s)`);

  console.log(`  ${bullet} ${chalk.hex(CLAUDE_CREAM)(signature)} ${elapsed}`);

  // Claude Code tree branch connector: ⎿
  let summary = '';
  if (!success) {
    summary = chalk.hex(CLAUDE_ERROR)(result.split('\n')[0].substring(0, 90));
  } else if (toolName === 'execute_command') {
    const firstLine = result.split('\n').filter(l => l.trim().length > 0)[0] || 'Done';
    summary = chalk.dim(firstLine.substring(0, 90));
  } else if (toolName === 'read_file') {
    const lines = result.split('\n').length;
    summary = chalk.dim(`Read ${lines} lines (${result.length} chars)`);
  } else if (toolName === 'edit_file') {
    summary = chalk.hex(CLAUDE_SUCCESS)(`Changes applied successfully`);
  } else if (toolName === 'write_file') {
    summary = chalk.hex(CLAUDE_SUCCESS)(`Wrote file (${result.length} chars)`);
  } else if (toolName === 'grep' || toolName === 'workspace_search') {
    const matches = result.split('\n').filter(l => l.trim().length > 0).length;
    summary = chalk.dim(`Found ${matches} match lines`);
  } else if (toolName === 'todo_write') {
    summary = chalk.hex(CLAUDE_TERRACOTTA)('Todo checklist updated');
  } else {
    summary = chalk.dim(result.split('\n')[0].substring(0, 80));
  }

  console.log(`    ${chalk.dim('⎿')}  ${summary}`);
}

// ─── Claude Code Permission Request Dialog ───────────────────────────────────

export async function askClaudePermission(
  rl: any,
  toolName: string,
  args: any
): Promise<{ approved: boolean; alwaysAllow: boolean }> {
  console.log();
  const signature = formatToolSignature(toolName, args);
  const boxWidth = 65;
  const top = `  ╭─ ${chalk.bold.hex(CLAUDE_CORAL)('Permission Request')} ${'─'.repeat(boxWidth - 23)}╮`;
  const bottom = `  ╰${'─'.repeat(boxWidth)}╯`;

  console.log(top);
  console.log(`  │  ${chalk.dim('Tool:')}    ${chalk.hex(CLAUDE_CREAM)(toolName.padEnd(boxWidth - 14))}│`);
  console.log(`  │  ${chalk.dim('Action:')}  ${chalk.hex(CLAUDE_TERRACOTTA)(signature.substring(0, boxWidth - 14).padEnd(boxWidth - 14))}│`);

  if (toolName === 'execute_command') {
    const cmdStr = (args.command || '').substring(0, boxWidth - 16);
    console.log(`  │  ${chalk.dim('Command:')} ${chalk.yellow(cmdStr.padEnd(boxWidth - 14))}│`);
  } else if (toolName === 'edit_file' || toolName === 'write_file') {
    const p = (args.path || '').substring(0, boxWidth - 16);
    console.log(`  │  ${chalk.dim('Target:')}  ${chalk.cyan(p.padEnd(boxWidth - 14))}│`);
  }

  console.log(bottom);

  const promptText = `  ${chalk.bold('Allow this action?')} [${chalk.green('y')}es / ${chalk.red('n')}o / ${chalk.yellow('a')}lways allow session]: `;

  try {
    const answer = (await rl.question(promptText)).trim().toLowerCase();
    if (answer === 'a' || answer === 'always') {
      return { approved: true, alwaysAllow: true };
    }
    if (answer === 'y' || answer === 'yes') {
      return { approved: true, alwaysAllow: false };
    }
    return { approved: false, alwaysAllow: false };
  } catch {
    return { approved: false, alwaysAllow: false };
  }
}

// ─── Claude Turn Footer ──────────────────────────────────────────────────────

export function renderTurnFooter(durationMs: number, toolCount: number) {
  const durationSec = (durationMs / 1000).toFixed(1);
  const star = chalk.bold.hex(CLAUDE_CORAL)('◈');
  const durationText = `${durationSec}s`;
  const toolsText = toolCount === 1 ? '1 tool' : `${toolCount} tools`;

  console.log(
    `\n  ${star}  ${chalk.dim(`SudoCode completed in ${chalk.hex(CLAUDE_CREAM)(durationText)} · ${chalk.hex(CLAUDE_TERRACOTTA)(toolsText)} executed`)}\n`
  );
}

// ─── Claude Code Interactive Prompt ──────────────────────────────────────────

export function renderPromptString(cwd: string, planMode: boolean, autoApprove: boolean): string {
  const folder = path.basename(cwd) || cwd;
  const branch = getGitBranch();
  const branchTag = branch ? ` ${chalk.dim('(')}${chalk.bold.hex(CLAUDE_TERRACOTTA)(branch)}${chalk.dim(')')}` : '';
  const planTag = planMode ? chalk.hex(CLAUDE_ERROR)(' [plan]') : '';
  const autoTag = autoApprove ? chalk.hex(CLAUDE_WARN)(' [auto]') : '';
  const chevron = chalk.bold.hex(CLAUDE_CORAL)('❯');

  return `${chalk.dim(folder)}${branchTag}${planTag}${autoTag} ${chevron} `;
}
