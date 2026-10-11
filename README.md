# ⚡ SudoCode (`sudocode-ai`)

<div align="center">

```
    ████████████████      ⚡ SudoCode v1.1.1
    ██  ████████  ██      Terminal AI Coding Agent (Claude-Mode)
████████████████████████  Built for developers who live in the terminal
████████████████████████  Native MCP · 8-Bit UI · Context Compaction
    ████████████████      
    ██  ██    ██  ██      🌐 Website: https://nilesh020901.github.io/sudocode-cli-ai/
    ██  ██    ██  ██      📦 NPM: https://www.npmjs.com/package/sudocode-ai
```

[![NPM Version](https://img.shields.io/npm/v/sudocode-ai?color=b82be2&logo=npm)](https://www.npmjs.com/package/sudocode-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-34D399.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-38BDF8?logo=node.js)](https://nodejs.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-Native%20Protocol-b82be2)](https://modelcontextprotocol.io)

**An open-source, terminal-native AI coding agent engineered for flow, speed, and clean output.**  
Inspired by Claude Code with retro 8-bit pixel art, real-time starburst thinking loaders, tree-node execution trees, and native Model Context Protocol (MCP) support.

[🌐 Live Documentation & Demo](https://nilesh020901.github.io/sudocode-cli-ai/) • [📦 NPM Package](https://www.npmjs.com/package/sudocode-ai) • [🐛 Report Bug](https://github.com/Nilesh020901/sudocode-cli-ai/issues)

</div>

---

## ⚡ Quick Start

You don't even need to install it globally. Run instantly with `npx`:

```bash
npx sudocode-ai
```

Or install globally via npm:

```bash
npm install -g sudocode-ai
```

Then run in any project directory:

```bash
sudocode
```

> **🔑 First Run:** SudoCode will ask for your [OpenRouter API Key](https://openrouter.ai/keys) and securely save it to `~/.sudocode/config.json`. Any model (Claude 3.5 Sonnet, GPT-4o, Gemini 2.5, DeepSeek, etc.) is supported!

---

## ✨ Key Features

- **👾 Retro 8-Bit Pixel Mascot**: Iconic ASCII brand header with high-contrast coral/purple terminal palette.
- **✨ Claude Starburst Thinking Loader**: Real-time geometric diamond animation (`·` → `⋄` → `◇` → `◈` → `◆`) with live duration timers.
- **🌲 Tree-Node Execution Logging**: Clean hierarchical tool output (`● Tool(...) ⎿ Result`) keeping your workspace uncluttered.
- **🛡️ Plan Mode (`/plan`)**: Safe read-only architectural planning mode that blocks write tools until you are ready.
- **⚡ Auto-Approve Mode (`/auto`)**: Toggle session-wide automatic execution for trusted rapid tasks.
- **🧠 Context Compaction (`/compact`)**: Automatic context summarization when conversation token limits are approached.
- **🔌 Native MCP Support (`mcp_config.json`)**: Connect external MCP servers (PostgreSQL, GitHub, Brave Search, FileSystems) directly into the agent.
- **🔀 Multi-Model Flexibility (`/model`)**: Switch LLMs on the fly with a single command.

---

## 🕹️ Interactive Commands

Inside the SudoCode prompt, type `/` to access commands:

| Command | Description |
| :--- | :--- |
| `/help` | Display interactive command palette and available tool definitions |
| `/plan` | Toggle **Plan Mode** (disables write tools for safe architectural planning) |
| `/auto` | Toggle **Auto-Approve** (executes write tools without asking for confirmation) |
| `/status` | View current LLM model, git branch, active workspace, and token usage |
| `/compact` | Manually compress conversation history to free context tokens |
| `/model <id>` | Switch the active model (e.g. `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`) |
| `/mcp` | List all connected Model Context Protocol servers and their exposed tools |
| `/clear` | Clear the current conversation history (alias: `/reset`) |
| `/exit` | Exit the CLI session (alias: `/quit` or `Ctrl+C`) |

---

## 🛠️ Built-in Tool Ecosystem

SudoCode autonomously inspects, reasons, and executes changes using precision developer tools:

* **`execute_command`**: Runs terminal shell commands (builds, tests, git commits, package installs) with live stdout streaming.
* **`read_file`**: Reads source code files with line numbering and slice windowing.
* **`write_file`**: Creates new files and directories atomically.
* **`edit_file`**: Surgical string matching and replacement to preserve existing code structure and comments.
* **`list_files`**: Recursively inspects file trees and workspace directories.
* **`grep`**: Ripgrep-powered exact and regex pattern matching across the repository.
* **`workspace_search`**: High-level semantic file and identifier lookup.
* **`todo_write`**: Manages interactive task checklists for multi-step feature implementation.

---

## 🔌 Model Context Protocol (MCP)

To connect custom MCP tools, create an `mcp_config.json` file in your project or home directory:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token_here"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}
```

SudoCode will automatically discover the servers on startup and expose their tools to the model.

---

## ⚙️ Configuration

SudoCode stores settings in `~/.sudocode/config.json`:

```json
{
  "apiKey": "sk-or-v1-...",
  "defaultModel": "anthropic/claude-3.5-sonnet"
}
```

You can also provide the key using an environment variable:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

---

## 🌐 Official Links

- **Documentation & Live Web Simulator**: [https://nilesh020901.github.io/sudocode-cli-ai/](https://nilesh020901.github.io/sudocode-cli-ai/)
- **GitHub Repository**: [https://github.com/Nilesh020901/sudocode-cli-ai](https://github.com/Nilesh020901/sudocode-cli-ai)
- **NPM Package**: [https://www.npmjs.com/package/sudocode-ai](https://www.npmjs.com/package/sudocode-ai)
- **Issue Tracker**: [https://github.com/Nilesh020901/sudocode-cli-ai/issues](https://github.com/Nilesh020901/sudocode-cli-ai/issues)

---

## 📄 License

Released under the **MIT License**. Created with ❤️ by [Nilesh](https://github.com/Nilesh020901).
