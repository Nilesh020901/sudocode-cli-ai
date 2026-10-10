import fs from 'fs';
import path from 'path';
import { PersistentTerminal } from './terminal.js';
import { MAX_TOOL_OUTPUT } from './config.js';

// ─── Shared Types ────────────────────────────────────────────────────────────

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: Record<string, any>;
  abstract isReadOnly: boolean;

  abstract execute(args: any): Promise<string>;

  public toSchema(): ToolSchema {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters
      }
    };
  }
}

// ─── Utility: Truncate long tool output ──────────────────────────────────────

export function truncateOutput(text: string, maxLen: number = MAX_TOOL_OUTPUT): string {
  if (text.length <= maxLen) return text;
  const half = Math.floor(maxLen / 2) - 40;
  const head = text.substring(0, half);
  const tail = text.substring(text.length - half);
  const skipped = text.length - half * 2;
  return `${head}\n\n[... ${skipped} characters truncated ...]\n\n${tail}`;
}

// ─── Ignored directories (shared constant) ───────────────────────────────────

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', '__pycache__', '.venv', 'venv', '.next']);
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.py', '.env',
  '.html', '.css', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.sh',
  '.sql', '.graphql', '.xml', '.csv', '.log', '.gitignore', '.dockerignore',
]);

function isTextFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '') {
    // Files with no extension: Makefile, Dockerfile, etc.
    const base = path.basename(filename);
    return ['Makefile', 'Dockerfile', 'Procfile', '.gitignore', '.env'].includes(base);
  }
  return TEXT_EXTENSIONS.has(ext);
}

// ─── Built-in Tools ──────────────────────────────────────────────────────────

export class ReadFileTool extends Tool {
  name = 'read_file';
  description = 'Read the contents of a file from disk. Output is automatically truncated for very large files.';
  isReadOnly = true;
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read.' }
    },
    required: ['path']
  };

  async execute(args: { path: string }): Promise<string> {
    try {
      const resolved = path.resolve(args.path);
      if (!fs.existsSync(resolved)) {
        return `Error: File not found: ${args.path}`;
      }
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) {
        return `Error: Path is not a file: ${args.path}`;
      }
      const content = fs.readFileSync(resolved, 'utf-8');
      return truncateOutput(content);
    } catch (e: any) {
      return `Error reading file: ${e.message}`;
    }
  }
}

export class WriteFileTool extends Tool {
  name = 'write_file';
  description = 'Write content to a file, creating parent directories as needed. Overwrites existing content.';
  isReadOnly = false;
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write.' },
      content: { type: 'string', description: 'Complete content to write.' }
    },
    required: ['path', 'content']
  };

  async execute(args: { path: string; content: string }): Promise<string> {
    try {
      const resolved = path.resolve(args.path);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, args.content, 'utf-8');
      return `Successfully wrote ${args.content.length} chars to ${args.path}`;
    } catch (e: any) {
      return `Error writing file: ${e.message}`;
    }
  }
}

export class EditFileTool extends Tool {
  name = 'edit_file';
  description = 'Replace an exact unique string in a file with new content. The old_string must match exactly (including whitespace). If multiple matches exist, provide more surrounding context to make it unique.';
  isReadOnly = false;
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to edit.' },
      old_string: { type: 'string', description: 'The exact string to find and replace. Must be unique in the file.' },
      new_string: { type: 'string', description: 'The replacement string.' }
    },
    required: ['path', 'old_string', 'new_string']
  };

  async execute(args: { path: string; old_string: string; new_string: string }): Promise<string> {
    try {
      const resolved = path.resolve(args.path);
      if (!fs.existsSync(resolved)) {
        return `Error: File not found: ${args.path}`;
      }
      const content = fs.readFileSync(resolved, 'utf-8');
      if (!content.includes(args.old_string)) {
        return `Error: old_string not found in ${args.path}. Verify exact whitespace and content.`;
      }

      const occurrences = content.split(args.old_string).length - 1;
      if (occurrences > 1) {
        return `Error: Found ${occurrences} occurrences of old_string in ${args.path}. Provide more surrounding lines to make it unique.`;
      }

      const updated = content.replace(args.old_string, args.new_string);
      fs.writeFileSync(resolved, updated, 'utf-8');
      return `Successfully edited ${args.path}`;
    } catch (e: any) {
      return `Error editing file: ${e.message}`;
    }
  }
}

export class ListFilesTool extends Tool {
  name = 'list_files';
  description = 'List files and directories recursively from a path. Skips .git, node_modules, dist.';
  isReadOnly = true;
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list. Defaults to current directory.', default: '.' }
    }
  };

  async execute(args: { path?: string }): Promise<string> {
    const targetDir = args.path || '.';
    try {
      const resolved = path.resolve(targetDir);
      if (!fs.existsSync(resolved)) {
        return `Error: Directory not found: ${targetDir}`;
      }

      const entries: string[] = [];
      const traverse = (dir: string, depth = 0) => {
        if (depth > 5) return; // Prevent extremely deep traversals
        const files = fs.readdirSync(dir);
        files.sort();

        for (const file of files) {
          if (IGNORED_DIRS.has(file)) continue;

          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          const indent = '  '.repeat(depth);

          if (stat.isDirectory()) {
            entries.push(`${indent}${file}/`);
            traverse(fullPath, depth + 1);
          } else {
            entries.push(`${indent}${file}`);
          }
        }
      };

      traverse(resolved);
      return entries.length > 0 ? truncateOutput(entries.join('\n')) : `Directory is empty: ${targetDir}`;
    } catch (e: any) {
      return `Error listing files: ${e.message}`;
    }
  }
}

export class GrepTool extends Tool {
  name = 'grep';
  description = 'Search for a regex pattern across text files under a directory. Returns matching lines with file paths and line numbers.';
  isReadOnly = true;
  parameters = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regular expression pattern to search for.' },
      path: { type: 'string', description: 'Directory to search in. Defaults to current directory.', default: '.' }
    },
    required: ['pattern']
  };

  async execute(args: { pattern: string; path?: string }): Promise<string> {
    const targetDir = args.path || '.';
    try {
      const resolved = path.resolve(targetDir);
      const regex = new RegExp(args.pattern, 'i');
      const matches: string[] = [];

      const searchDir = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (IGNORED_DIRS.has(file)) continue;

          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            searchDir(fullPath);
          } else if (isTextFile(file)) {
            try {
              const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
              lines.forEach((line, index) => {
                if (regex.test(line)) {
                  matches.push(`${path.relative(resolved, fullPath)}:${index + 1}: ${line.trim()}`);
                }
              });
            } catch { /* skip unreadable files */ }
          }
        }
      };

      searchDir(resolved);
      if (matches.length === 0) return 'No matching patterns found.';
      const result = matches.slice(0, 100).join('\n');
      if (matches.length > 100) {
        return result + `\n\n[... ${matches.length - 100} more matches omitted]`;
      }
      return result;
    } catch (e: any) {
      return `Error running grep: ${e.message}`;
    }
  }
}

// ─── Workspace Search (inspired by nanocode1) ────────────────────────────────

export class WorkspaceSearchTool extends Tool {
  name = 'workspace_search';
  description = 'Search workspace files by keyword relevance. Returns ranked excerpts from the most relevant files. Use this before large edits to understand the codebase.';
  isReadOnly = true;
  parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query — keywords or phrases to find.' }
    },
    required: ['query']
  };

  async execute(args: { query: string }): Promise<string> {
    const rawQuery = args.query.trim();
    const terms = new Set(
      rawQuery.toLowerCase().match(/[a-zA-Z_][a-zA-Z0-9_]{1,}/g) || []
    );
    if (terms.size === 0) return 'Error: query must contain searchable terms.';

    const matches: { score: number; filepath: string; snippet: string }[] = [];

    const walk = (dir: string) => {
      let entries: string[];
      try { entries = fs.readdirSync(dir); } catch { return; }
      for (const name of entries) {
        if (IGNORED_DIRS.has(name)) continue;
        const fullPath = path.join(dir, name);
        let stat;
        try { stat = fs.statSync(fullPath); } catch { continue; }
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (isTextFile(name) && stat.size < 500_000) {
          let text: string;
          try { text = fs.readFileSync(fullPath, 'utf-8'); } catch { continue; }

          const lowerText = text.toLowerCase();
          let score = 0;
          for (const term of terms) {
            // Count occurrences in file content
            let idx = -1;
            while ((idx = lowerText.indexOf(term, idx + 1)) !== -1) score++;
            // Bonus for filename match
            if (fullPath.toLowerCase().includes(term)) score += 4;
          }
          // Bonus for exact phrase match
          if (lowerText.includes(rawQuery.toLowerCase())) score += 8;

          if (score > 0) {
            const firstTerm = [...terms].find(t => lowerText.includes(t)) || '';
            const start = Math.max(0, lowerText.indexOf(firstTerm) - 200);
            const snippet = text.substring(start, start + 800).trim();
            matches.push({ score, filepath: fullPath, snippet });
          }
        }
      }
    };

    walk('.');

    if (matches.length === 0) return 'No relevant workspace files found.';

    matches.sort((a, b) => b.score - a.score);
    const lines = [`Workspace context for: ${rawQuery}`];
    for (const m of matches.slice(0, 5)) {
      lines.push(`\n[score ${m.score}] ${m.filepath}\n${m.snippet}`);
    }
    return truncateOutput(lines.join('\n'));
  }
}

// ─── Todo/Task Tracking (inspired by nanocode1) ──────────────────────────────

export class TodoWriteTool extends Tool {
  name = 'todo_write';
  description = 'Write or update the current task list. Use this to plan multi-step work. Replaces the entire list each call. Returns the formatted list.';
  isReadOnly = true; // Conceptually read-only: only tracks agent's own internal state
  parameters = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'done'] }
          },
          required: ['content', 'status']
        }
      }
    },
    required: ['items']
  };

  async execute(args: { items: { content: string; status: string }[] }): Promise<string> {
    const marks: Record<string, string> = { pending: ' ', in_progress: '~', done: 'x' };
    return args.items
      .map(item => `[${marks[item.status] || ' '}] ${item.content}`)
      .join('\n');
  }
}

// ─── Execute Command (with read-only command detection) ──────────────────────

const READ_ONLY_COMMAND_PREFIXES = [
  'ls', 'dir', 'pwd', 'cat', 'head', 'tail', 'wc', 'file', 'which', 'where',
  'echo', 'date', 'whoami', 'hostname', 'uname', 'env', 'printenv', 'type',
  'git status', 'git log', 'git diff', 'git show', 'git branch', 'git remote',
  'git tag', 'git stash list', 'node --version', 'npm --version', 'npm list',
  'python --version', 'pip list', 'pip show', 'cargo --version', 'rustc --version',
  'go version', 'java -version', 'javac -version',
];

function isReadOnlyCommand(command: string): boolean {
  const trimmed = command.trim();
  return READ_ONLY_COMMAND_PREFIXES.some(prefix =>
    trimmed === prefix || trimmed.startsWith(prefix + ' ')
  );
}

export class ExecuteCommandTool extends Tool {
  name = 'execute_command';
  description = 'Run a shell command in the terminal. Read-only commands (ls, cat, git status, etc.) are auto-approved. Write commands require user confirmation.';
  isReadOnly = false; // Default; overridden dynamically per call
  parameters = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to run.' }
    },
    required: ['command']
  };

  constructor(private terminal: PersistentTerminal) {
    super();
  }

  /** Dynamic read-only detection — called by agent before approval check */
  public isCommandReadOnly(command: string): boolean {
    return isReadOnlyCommand(command);
  }

  async execute(args: { command: string }): Promise<string> {
    const res = await this.terminal.execute(args.command);
    const output = `Exit Code: ${res.exitCode}\n${res.stdout}`;
    return truncateOutput(output);
  }
}

// ─── Tool Registry ───────────────────────────────────────────────────────────

export function createBuiltinTools(terminal: PersistentTerminal): Tool[] {
  return [
    new ReadFileTool(),
    new WriteFileTool(),
    new EditFileTool(),
    new ListFilesTool(),
    new GrepTool(),
    new WorkspaceSearchTool(),
    new TodoWriteTool(),
    new ExecuteCommandTool(terminal),
  ];
}
