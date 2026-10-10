import path from 'path';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import chalk from 'chalk';
import { PersistentTerminal } from './terminal.js';
import { Tool, createBuiltinTools } from './tools.js';
import { McpManager } from './mcp.js';
import { runAgent, getSystemPrompt, compactMessages, ChatMessage, AgentConfig } from './agent.js';
import { OPENROUTER_API_KEY, DEFAULT_MODEL, setModel } from './config.js';

// ─── Banner ──────────────────────────────────────────────────────────────────

function printBanner() {
  console.log(chalk.hex('#6366F1')(`
 ____            _          ____          _      
/ ___| _   _  __| | ___    / ___|___   __| | ___ 
\\___ \\| | | |/ _\` |/ _ \\  | |   / _ \\ / _\` |/ _ \\
 ___) | |_| | (_| | (_) | | |__| (_) | (_| |  __/
|____/ \\__,_|\\__,_|\\___/   \\____\\___/ \\__,_|\\___|
`));
  console.log(chalk.bold.hex('#6366F1')('  🚀 SudoCode — Terminal Coding Agent'));
  console.log(chalk.dim(`  Model: ${DEFAULT_MODEL}`));
  console.log(chalk.dim('  /help for commands · /plan for safety mode · Ctrl+C to exit\n'));
}

// ─── Help ────────────────────────────────────────────────────────────────────

function printHelp(tools: Tool[]) {
  console.log(chalk.bold('\n  Commands:'));
  const cmds = [
    ['/plan',    'Toggle Plan Mode (blocks write tools for safe planning)'],
    ['/auto',    'Toggle Auto-Approve (skip confirmation for write tools)'],
    ['/compact', 'Manually compact context to free token space'],
    ['/model',   'Switch LLM model (e.g. /model google/gemini-2.5-pro)'],
    ['/mcp',     'List connected MCP servers and their tools'],
    ['/reset',   'Clear conversation history'],
    ['/help',    'Show this help'],
    ['/exit',    'Quit SudoCode'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log(`    ${chalk.hex('#6366F1')(cmd.padEnd(12))} ${chalk.dim(desc)}`);
  }

  console.log(chalk.bold('\n  Tools:'));
  for (const t of tools) {
    console.log(`    ${chalk.yellow(t.name.padEnd(20))} ${chalk.dim(t.description.substring(0, 70))}`);
  }
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
    console.error(chalk.red('\n❌ OPENROUTER_API_KEY is not configured.'));
    console.log(chalk.dim('  Set it in .env and restart.\n'));
    process.exit(1);
  }

  printBanner();

  // Create single persistent readline interface
  const rl = readline.createInterface({ input, output });

  // Initialize services
  const terminal = new PersistentTerminal();
  const mcpManager = McpManager.getInstance();
  const mcpCount = await mcpManager.initialize();
  if (mcpCount > 0) {
    console.log(chalk.dim(`  ${mcpCount} MCP server(s) connected.\n`));
  }

  // Build tool registry
  const builtInTools = createBuiltinTools(terminal);
  const allTools = [...builtInTools, ...mcpManager.getTools()];

  // Session state
  let planMode = false;
  let autoApprove = false;
  let messages: ChatMessage[] = [
    { role: 'system', content: getSystemPrompt() }
  ];

  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(chalk.dim('\nShutting down...'));
    rl.close();
    terminal.shutdown();
    await mcpManager.shutdown();
    console.log(chalk.green('Goodbye!'));
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // ─── REPL Loop ───────────────────────────────────────────────────────────

  while (true) {
    const cwd = terminal.getCwd();
    const displayPath = path.basename(cwd);
    const modeTag = planMode ? chalk.red(' (plan)') : '';
    const autoTag = autoApprove ? chalk.yellow(' (auto)') : '';
    const promptStr = `${chalk.dim(displayPath)}${modeTag}${autoTag} ${chalk.hex('#6366F1')('❯')} `;

    let userInput = '';
    try {
      userInput = await rl.question(promptStr);
    } catch {
      // Stream closed or Ctrl+D / Ctrl+C
      await shutdown();
      break;
    }

    const trimmed = userInput.trim();
    if (!trimmed) continue;

    // ── Slash commands ─────────────────────────────────────────────────────

    if (trimmed === '/exit' || trimmed === '/quit') {
      await shutdown();
      break;
    }

    if (trimmed === '/help') {
      printHelp(allTools);
      continue;
    }

    if (trimmed === '/plan') {
      planMode = !planMode;
      console.log(chalk.magenta(`Plan Mode: ${planMode ? 'ON (write tools blocked)' : 'OFF'}`));
      continue;
    }

    if (trimmed === '/auto') {
      autoApprove = !autoApprove;
      console.log(chalk.yellow(`Auto-Approve: ${autoApprove ? 'ON ⚡ (all tools run without confirmation)' : 'OFF (write tools require confirmation)'}`));
      continue;
    }

    if (trimmed === '/reset') {
      messages = [{ role: 'system', content: getSystemPrompt() }];
      console.log(chalk.green('Session history cleared.'));
      continue;
    }

    if (trimmed === '/compact') {
      const before = messages.length;
      const compacted = compactMessages(messages);
      messages.length = 0;
      messages.push(...compacted);
      console.log(chalk.green(`Compacted: ${before} → ${messages.length} messages.`));
      continue;
    }

    if (trimmed.startsWith('/model')) {
      const newModel = trimmed.substring(6).trim();
      if (!newModel) {
        console.log(chalk.dim(`Current model: ${DEFAULT_MODEL}`));
        console.log(chalk.dim('Usage: /model <model-name>'));
      } else {
        setModel(newModel);
        console.log(chalk.green(`Model switched to: ${newModel}`));
      }
      continue;
    }

    if (trimmed === '/mcp') {
      const mcpTools = mcpManager.getTools();
      if (mcpTools.length === 0) {
        console.log(chalk.dim('\n  No MCP tools loaded. Configure servers in mcp_config.json.\n'));
      } else {
        console.log(chalk.bold('\n  MCP Tools:'));
        for (const t of mcpTools) {
          console.log(`    ${chalk.cyan(t.name.padEnd(25))} ${chalk.dim(t.description.substring(0, 60))}`);
        }
        console.log();
      }
      continue;
    }

    if (trimmed.startsWith('/')) {
      console.log(chalk.red(`Unknown command: ${trimmed}. Type /help for available commands.`));
      continue;
    }

    // ── Agent execution ────────────────────────────────────────────────────

    messages.push({ role: 'user', content: trimmed });

    const config: AgentConfig = {
      autoApprove,
      planMode,
      maxIterations: 40,
    };

    try {
      await runAgent(messages, allTools, config, rl);
    } catch (err: any) {
      console.error(chalk.red(`\n❌ Error: ${err.message}`));
    }
  }
}

main();
