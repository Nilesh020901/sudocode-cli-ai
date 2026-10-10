import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Try to load local .env (for dev/workspace testing)
try {
  dotenv.config({ path: path.join(__dirname, '../.env') });
} catch { /* ignore */ }
try {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
} catch { /* ignore */ }

// Config file stored in user's home directory: ~/.sudocode/config.json
const CONFIG_DIR = path.join(os.homedir(), '.sudocode');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface StoredConfig {
  apiKey?: string;
  model?: string;
}

export function readStoredConfig(): StoredConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch { /* ignore read error */ }
  return {};
}

export function saveStoredConfig(updates: Partial<StoredConfig>) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const current = readStoredConfig();
    const next = { ...current, ...updates };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
  } catch (err: any) {
    console.error(chalk.yellow(`Warning: Could not save config to ${CONFIG_FILE}: ${err.message}`));
  }
}

export function openBrowser(url: string) {
  const platform = process.platform;
  let cmd = '';
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log(chalk.dim(`  Could not auto-open browser. Please visit: ${url}`));
    }
  });
}

// ─── Environment & Global Variables ──────────────────────────────────────────

const stored = readStoredConfig();

export let OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || stored.apiKey || '';
export let DEFAULT_MODEL = process.env.DEFAULT_MODEL || stored.model || 'poolside/laguna-s-2.1:free';
export const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';

// Agent limits
export const MAX_TOOL_OUTPUT = 12_000;
export const MAX_CONTEXT_CHARS = 100_000;
export const API_MAX_RETRIES = 3;

export function setModel(model: string) {
  DEFAULT_MODEL = model;
  saveStoredConfig({ model });
}

export let openai = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: OPENROUTER_API_KEY || 'unconfigured',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/sudocode-agent',
    'X-Title': 'SudoCode',
  }
});

export function reinitOpenAI(key: string) {
  OPENROUTER_API_KEY = key;
  openai = new OpenAI({
    baseURL: LLM_BASE_URL,
    apiKey: key,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/sudocode-agent',
      'X-Title': 'SudoCode',
    }
  });
}

// ─── Interactive API Key Prompt (Claude-Style Onboarding) ────────────────────

export async function ensureApiKey(rl: any): Promise<string> {
  // If already configured and not placeholder, return immediately
  if (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here') {
    return OPENROUTER_API_KEY;
  }

  const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys';
  const boxWidth = 68;

  console.log();
  console.log(chalk.hex('#F25B46')(`  ╭─ 🔑 OpenRouter API Key Setup ${'─'.repeat(boxWidth - 31)}╮`));
  console.log(chalk.hex('#F25B46')('  │') + chalk.bold.white(' SudoCode requires a free OpenRouter API key to power AI models.  ') + chalk.hex('#F25B46')('│'));
  console.log(chalk.hex('#F25B46')('  │') + ' '.repeat(boxWidth - 2) + chalk.hex('#F25B46')('│'));
  console.log(chalk.hex('#F25B46')('  │') + chalk.white('  🔗 Get your free key here:                                       ') + chalk.hex('#F25B46')('│'));
  console.log(chalk.hex('#F25B46')('  │') + chalk.cyan.underline(`     ${OPENROUTER_KEYS_URL.padEnd(boxWidth - 7)}`) + chalk.hex('#F25B46')('│'));
  console.log(chalk.hex('#F25B46')('  │') + ' '.repeat(boxWidth - 2) + chalk.hex('#F25B46')('│'));
  console.log(chalk.hex('#F25B46')('  │') + chalk.dim('  • Type ') + chalk.yellow.bold('open') + chalk.dim(' or ') + chalk.yellow.bold('o') + chalk.dim(' to open the link directly in your browser.   ') + chalk.hex('#F25B46')('│'));
  console.log(chalk.hex('#F25B46')('  │') + chalk.dim('  • Or paste your existing OpenRouter API key below.             ') + chalk.hex('#F25B46')('│'));
  console.log(chalk.hex('#F25B46')(`  ╰${'─'.repeat(boxWidth - 2)}╯`));
  console.log();

  while (true) {
    const answer = (await rl.question(chalk.bold('  Paste API Key (or type ') + chalk.yellow.bold('o') + chalk.bold(' to open link): '))).trim();

    if (answer.toLowerCase() === 'o' || answer.toLowerCase() === 'open') {
      console.log(chalk.dim(`\n  🌐 Opening ${OPENROUTER_KEYS_URL} in your browser...`));
      openBrowser(OPENROUTER_KEYS_URL);
      console.log(chalk.dim('  Copy your key from OpenRouter, then paste it below:\n'));
      continue;
    }

    if (answer.length > 10) {
      // Save for future runs
      saveStoredConfig({ apiKey: answer });
      reinitOpenAI(answer);
      console.log(`  ${chalk.green('✔')} Key saved securely to ${chalk.dim(CONFIG_FILE)}\n`);
      return answer;
    }

    console.log(chalk.red('  ❌ Invalid API key. Please paste a valid OpenRouter key (e.g. sk-or-v1-...)'));
  }
}
