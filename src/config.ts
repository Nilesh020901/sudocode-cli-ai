import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
export let DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'poolside/laguna-s-2.1:free';
export const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';

// Agent limits
export const MAX_TOOL_OUTPUT = 12_000;     // Truncate tool results beyond this character count
export const MAX_CONTEXT_CHARS = 100_000;  // Approximate threshold to trigger context compaction
export const API_MAX_RETRIES = 3;          // Retries on transient API failures

export function setModel(model: string) {
  DEFAULT_MODEL = model;
}

export const openai = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/sudocode-agent',
    'X-Title': 'SudoCode',
  }
});
