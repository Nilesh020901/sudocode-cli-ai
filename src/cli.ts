#!/usr/bin/env node

import path from 'path';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import chalk from 'chalk';
import { PersistentTerminal } from './terminal.js';
import { Tool, createBuiltinTools } from './tools.js';
import { McpManager } from './mcp.js';
import { runAgent, getSystemPrompt, compactMessages, ChatMessage, AgentConfig } from './agent.js';
import { DEFAULT_MODEL, setModel, ensureApiKey } from './config.js';
import { printBanner as printClaudeBanner, CLAUDE_CORAL, CLAUDE_TERRACOTTA, renderPromptString } from './ui.js';

// ─── Help ────────────────────────────────────────────────────────────────────

function printHelp(tools: Tool[]) {
  console.log(chalk.bold('\n  Commands:'));
  const cmds = [
    ['/plan',    'Toggle Plan Mode (blocks write tools for safe planning)'],
    ['/auto',    'Toggle Auto-Approve (skip confirmation for write tools)'],
    ['/status',  'Show current session status, model, and git branch'],
    ['/compact', 'Manually compact context to free token space'],
    ['/model',   'Switch LLM model (e.g. /model poolside/laguna-s-2.1:free)'],
    ['/mcp',     'List connected MCP servers and their tools'],
    ['/clear',   'Clear conversation history (alias: /reset)'],
    ['/help',    'Show this help'],
    ['/exit',    'Quit SudoCode (alias: /quit)'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log(`    ${chalk.hex(CLAUDE_CORAL)(cmd.padEnd(12))} ${chalk.dim(desc)}`);
  }

  console.log(chalk.bold('\n  Tools:'));
  for (const t of tools) {
    console.log(`    ${chalk.hex(CLAUDE_TERRACOTTA)(t.name.padEnd(20))} ${chalk.dim(t.description.substring(0, 70))}`);
  }
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  printClaudeBanner(DEFAULT_MODEL, process.cwd());

  // Create single persistent readline interface
  const rl = readline.createInterface({ input, output });

  // Ensure user has an API key configured (prompts with link to openrouter.ai/keys if missing)
  await ensureApiKey(rl);

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
    console.log(chalk.dim('\n  Shutting down...'));
    rl.close();
    terminal.shutdown();
    await mcpManager.shutdown();
    console.log(chalk.green('  Goodbye!'));
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // ─── REPL Loop ───────────────────────────────────────────────────────────

  while (true) {
    const cwd = terminal.getCwd();
    const promptStr = renderPromptString(cwd, planMode, autoApprove);

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
      console.log(chalk.magenta(`  Plan Mode: ${planMode ? 'ON (write tools blocked)' : 'OFF'}`));
      continue;
    }

    if (trimmed === '/auto') {
      autoApprove = !autoApprove;
      console.log(chalk.yellow(`  Auto-Approve: ${autoApprove ? 'ON ⚡ (tools execute without confirmation)' : 'OFF'}`));
      continue;
    }

    if (trimmed === '/status') {
      const folder = path.basename(cwd) || cwd;
      console.log();
      console.log(chalk.bold.hex(CLAUDE_CORAL)('  ⚡ SudoCode Session Status'));
      console.log(`  ${chalk.dim('Model:')}        ${chalk.hex(CLAUDE_TERRACOTTA)(DEFAULT_MODEL)}`);
      console.log(`  ${chalk.dim('Workspace:')}    ${chalk.cyan(folder)} (${cwd})`);
      console.log(`  ${chalk.dim('Messages:')}     ${messages.length} messages in context`);
      console.log(`  ${chalk.dim('Plan Mode:')}    ${planMode ? chalk.green('ON') : chalk.dim('OFF')}`);
      console.log(`  ${chalk.dim('Auto-Approve:')} ${autoApprove ? chalk.yellow('ON ⚡') : chalk.dim('OFF')}`);
      console.log(`  ${chalk.dim('MCP Servers:')}  ${mcpCount} connected`);
      console.log();
      continue;
    }

    if (trimmed === '/reset' || trimmed === '/clear') {
      messages = [{ role: 'system', content: getSystemPrompt() }];
      console.log(chalk.green('  ✔ Conversation history cleared.'));
      continue;
    }

    if (trimmed === '/compact') {
      const before = messages.length;
      const compacted = compactMessages(messages);
      messages.length = 0;
      messages.push(...compacted);
      console.log(chalk.green(`  ✔ Compacted: ${before} → ${messages.length} messages.`));
      continue;
    }

    if (trimmed.startsWith('/model')) {
      const newModel = trimmed.substring(6).trim();
      if (!newModel) {
        console.log(chalk.dim(`  Current model: ${DEFAULT_MODEL}`));
        console.log(chalk.dim('  Usage: /model <model-name>'));
      } else {
        setModel(newModel);
        console.log(chalk.green(`  ✔ Model switched to: ${newModel}`));
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
      console.log(chalk.red(`  Unknown command: ${trimmed}. Type /help for available commands.`));
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
      // Persist auto-approval if granted via permission dialog
      autoApprove = config.autoApprove;
    } catch (err: any) {
      console.error(chalk.red(`\n  ❌ Error: ${err.message}`));
    }
  }
}

main();
