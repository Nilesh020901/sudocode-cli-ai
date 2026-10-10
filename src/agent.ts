import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import { openai, DEFAULT_MODEL, MAX_TOOL_OUTPUT, MAX_CONTEXT_CHARS, API_MAX_RETRIES } from './config.js';
import { Tool, ToolSchema, truncateOutput, ExecuteCommandTool } from './tools.js';
import {
  createSpinner,
  CLAUDE_CORAL,
  CLAUDE_WARN,
  CLAUDE_ERROR,
  askClaudePermission,
  renderToolResult,
  renderTurnFooter,
  formatToolSignature
} from './ui.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentConfig {
  autoApprove: boolean;
  planMode: boolean;
  maxIterations: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

// ─── System Prompt ───────────────────────────────────────────────────────────

export function getSystemPrompt(): string {
  const cwd = process.cwd();
  let filesList = '';
  try {
    filesList = fs.readdirSync(cwd)
      .filter(f => f !== '.git' && f !== 'node_modules' && f !== 'dist')
      .join(', ');
  } catch { filesList = 'unknown'; }

  let projectInstructions = '';
  const instructionFile = fs.existsSync(path.join(cwd, 'SUDOCODE.md'))
    ? path.join(cwd, 'SUDOCODE.md')
    : path.join(cwd, 'AEROCODE.md');
  if (fs.existsSync(instructionFile)) {
    try {
      const raw = fs.readFileSync(instructionFile, 'utf-8');
      projectInstructions = `\n\nProject Instructions (${path.basename(instructionFile)}):\n${raw.substring(0, 4000)}`;
    } catch { /* ignore read errors */ }
  }

  return `You are SudoCode, a fast and precise terminal coding agent.

## Core Principles
- Be concise and direct. Avoid unnecessary prose.
- ALWAYS use tools to read files before editing them. Never guess file contents.
- Use workspace_search before large edits to find relevant code.
- Use todo_write for any task requiring more than 2 steps.
- After completing work, verify changes by reading the file or running tests.

## Tool Usage Strategy
- Prefer edit_file over write_file when modifying existing files (preserves untouched code).
- The old_string in edit_file must be an EXACT match including whitespace and indentation.
- If edit_file fails with "not found", re-read the file to get the current content.
- If edit_file fails with "multiple occurrences", include more surrounding lines.
- For shell commands, prefer specific commands over broad ones (e.g. \`grep -n "pattern" file\` over \`cat file\`).

## Error Recovery
- If a tool call fails, read the error message, adjust parameters, and retry once.
- If an API or network error occurs, inform the user and suggest next steps.
- Never silently ignore errors.

## Output Format
- When explaining code changes, be brief. Show what changed and why.
- For multi-step tasks, update the todo list as you complete each step.
- When done, provide a concise summary of what was accomplished.

## Environment
- Working Directory: ${cwd}
- OS: ${process.platform}
- Files: ${filesList}${projectInstructions}
`;
}

// ─── Stream Parser ───────────────────────────────────────────────────────────

async function parseStream(
  stream: any,
  onTextChunk: (text: string) => void
): Promise<{ content: string; toolCalls: any[] }> {
  let content = '';
  const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};

  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    if (!choice) continue;

    if (choice.delta?.content) {
      content += choice.delta.content;
      onTextChunk(choice.delta.content);
    }

    if (choice.delta?.tool_calls) {
      for (const tc of choice.delta.tool_calls) {
        if (!toolCallsMap[tc.index]) {
          toolCallsMap[tc.index] = { id: '', name: '', arguments: '' };
        }
        const entry = toolCallsMap[tc.index];
        if (tc.id) entry.id += tc.id;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) entry.arguments += tc.function.arguments;
      }
    }
  }

  const toolCalls = Object.values(toolCallsMap).map(tc => ({
    id: tc.id,
    type: 'function',
    function: { name: tc.name, arguments: tc.arguments }
  }));

  return { content, toolCalls };
}

// ─── API Call with Retry ─────────────────────────────────────────────────────

async function callLLMWithRetry(
  messages: ChatMessage[],
  toolSchemas: ToolSchema[]
): Promise<any> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= API_MAX_RETRIES; attempt++) {
    try {
      return await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: messages as any,
        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
        stream: true,
      });
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode;
      const retryable = !status || status === 429 || status === 500 || status === 502 || status === 503;

      if (!retryable || attempt === API_MAX_RETRIES) {
        throw err;
      }

      const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
      console.log(chalk.yellow(`⏳ API error (${status || err.message}). Retrying in ${delay / 1000}s... (${attempt}/${API_MAX_RETRIES})`));
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}

// ─── Context Compaction ──────────────────────────────────────────────────────

function estimateContextSize(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => {
    let size = (m.content?.length || 0);
    if (m.tool_calls) size += JSON.stringify(m.tool_calls).length;
    return sum + size;
  }, 0);
}

export function compactMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= 4) return messages;

  const system = messages[0]; // Always keep system prompt
  const compacted: ChatMessage[] = [system];

  // Keep the last 6 messages as-is (recent context)
  const recentCutoff = Math.max(1, messages.length - 6);

  // Summarize old tool results
  for (let i = 1; i < recentCutoff; i++) {
    const msg = messages[i];
    if (msg.role === 'tool' && msg.content && msg.content.length > 200) {
      // Compress old tool outputs to a brief summary
      const firstLine = msg.content.split('\n')[0].substring(0, 120);
      compacted.push({
        ...msg,
        content: `[Compacted] ${firstLine}...`
      });
    } else if (msg.role === 'assistant' && msg.content && msg.content.length > 500) {
      compacted.push({
        ...msg,
        content: msg.content.substring(0, 300) + '\n[... response compacted ...]'
      });
    } else {
      compacted.push(msg);
    }
  }

  // Append recent messages unchanged
  for (let i = recentCutoff; i < messages.length; i++) {
    compacted.push(messages[i]);
  }

  return compacted;
}

// ─── Main Agent Loop ─────────────────────────────────────────────────────────

export async function runAgent(
  messages: ChatMessage[],
  tools: Tool[],
  config: AgentConfig,
  rl?: any
): Promise<string> {
  const toolsByName = new Map<string, Tool>();
  tools.forEach(t => toolsByName.set(t.name, t));

  const toolSchemas: ToolSchema[] = tools.map(t => t.toSchema());
  let lastContent = '';
  const turnStartTime = Date.now();
  let totalToolsRun = 0;

  for (let turn = 1; turn <= config.maxIterations; turn++) {
    // Auto-compact if context is getting large
    const contextSize = estimateContextSize(messages);
    if (contextSize > MAX_CONTEXT_CHARS) {
      const before = messages.length;
      const compacted = compactMessages(messages);
      messages.length = 0;
      messages.push(...compacted);
      const saved = contextSize - estimateContextSize(messages);
      console.log(chalk.dim(`  📦 Context compacted: ${before} → ${messages.length} messages (~${Math.round(saved / 1000)}K chars freed)`));
    }

    // Refresh system prompt each turn to reflect current cwd
    if (messages[0]?.role === 'system') {
      messages[0].content = getSystemPrompt();
    }

    if (turn > 1) {
      console.log(chalk.dim(`\n  Turn ${turn}/${config.maxIterations}`));
    }

    const thinkSpinner = createSpinner('Thinking...');
    thinkSpinner.start();

    let stream;
    try {
      stream = await callLLMWithRetry(messages, toolSchemas);
    } catch (err: any) {
      thinkSpinner.fail(`API Error: ${err.message}`);
      return `Error: ${err.message}`;
    }

    let hasStoppedSpinner = false;
    process.stdout.write(chalk.hex('#F1F5F9')(''));
    const { content, toolCalls } = await parseStream(stream, (chunk) => {
      if (!hasStoppedSpinner) {
        thinkSpinner.stop();
        hasStoppedSpinner = true;
      }
      process.stdout.write(chalk.hex('#F1F5F9')(chunk));
    });
    if (!hasStoppedSpinner) {
      thinkSpinner.stop();
    }
    if (content) console.log();

    lastContent = content;

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: content || null
    };

    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls;
      messages.push(assistantMessage);

      for (const tc of toolCalls) {
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch (e: any) {
          messages.push({
            role: 'tool', tool_call_id: tc.id, name: tc.function.name,
            content: `Error parsing arguments: ${e.message}`
          });
          continue;
        }

        const tool = toolsByName.get(tc.function.name);
        if (!tool) {
          messages.push({
            role: 'tool', tool_call_id: tc.id, name: tc.function.name,
            content: `Error: Unknown tool "${tc.function.name}".`
          });
          continue;
        }

        // Plan Mode: block write tools
        if (config.planMode && !tool.isReadOnly) {
          console.log(`  ${chalk.hex(CLAUDE_WARN)('⚠️')}  Blocked ${chalk.bold(tool.name)} (Plan Mode active)`);
          messages.push({
            role: 'tool', tool_call_id: tc.id, name: tool.name,
            content: 'Plan Mode is active. Write tools are disabled. Present your plan to the user.'
          });
          continue;
        }

        // Approval logic — skip for read-only tools and read-only commands
        let needsApproval = !tool.isReadOnly && !config.autoApprove;
        if (needsApproval && tool instanceof ExecuteCommandTool) {
          if (tool.isCommandReadOnly(args.command || '')) {
            needsApproval = false;
          }
        }

        if (needsApproval) {
          if (rl) {
            const { approved, alwaysAllow } = await askClaudePermission(rl, tool.name, args);
            if (alwaysAllow) {
              config.autoApprove = true;
              console.log(chalk.hex(CLAUDE_WARN)('  ⚡ Auto-approval enabled for this session.'));
            }
            if (!approved) {
              console.log(`  ${chalk.hex(CLAUDE_ERROR)('✖')} Execution denied by user.`);
              messages.push({
                role: 'tool', tool_call_id: tc.id, name: tool.name,
                content: 'Execution denied by user.'
              });
              continue;
            }
          }
        }

        const sig = formatToolSignature(tool.name, args);
        const toolSpinner = createSpinner(`Running ${sig}...`);
        toolSpinner.start();

        const t0 = Date.now();
        let result = '';
        let success = true;
        try {
          result = await tool.execute(args);
          toolSpinner.stop();
        } catch (execErr: any) {
          toolSpinner.stop();
          success = false;
          result = `Error executing ${tool.name}: ${execErr.message}`;
        }
        const toolDuration = Date.now() - t0;
        totalToolsRun++;

        renderToolResult(tool.name, args, result, toolDuration, success);

        // Truncate tool output before adding to context
        result = truncateOutput(result, MAX_TOOL_OUTPUT);

        messages.push({
          role: 'tool', tool_call_id: tc.id, name: tool.name,
          content: result
        });
      }
    } else {
      // No tool calls — agent completed turn
      messages.push(assistantMessage);
      renderTurnFooter(Date.now() - turnStartTime, totalToolsRun);
      return content;
    }
  }

  renderTurnFooter(Date.now() - turnStartTime, totalToolsRun);
  return lastContent || 'Execution limit reached.';
}
