# SudoCode

![](https://img.shields.io/badge/Node.js-18%2B-38BDF8?style=flat-square&logo=node.js) [![npm](https://img.shields.io/npm/v/sudocode-ai.svg?style=flat-square&color=b82be2&logo=npm)](https://www.npmjs.com/package/sudocode-ai) [![License](https://img.shields.io/badge/License-MIT-34D399?style=flat-square)](LICENSE) [![MCP](https://img.shields.io/badge/MCP-Protocol%20Native-b82be2?style=flat-square)](https://modelcontextprotocol.io)

SudoCode is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex architectures, editing files, and running commands — all through natural language commands and an iconic retro 8-bit terminal interface.

**Learn more in the [official documentation and live web demo](https://nilesh020901.github.io/sudocode-cli-ai/)**.

<p align="center">
  <a href="https://nilesh020901.github.io/sudocode-cli-ai/">
    <img src="https://raw.githubusercontent.com/Nilesh020901/sudocode-cli-ai/main/assets/banner.svg" alt="SudoCode Terminal" width="100%">
  </a>
</p>

---

## Get started

### 1. Run instantly with npx (Recommended)
Zero installation required. Runs directly in any repository:

```bash
npx sudocode-ai
```

### 2. Global Installation (Optional)
If you prefer having the `sudocode` command available globally in your shell:

```bash
npm install -g sudocode-ai
```

Then launch it in any project directory:

```bash
sudocode
```

### 3. Authentication
On your first run, SudoCode will ask for your [OpenRouter API Key](https://openrouter.ai/keys) and securely save it to `~/.sudocode/config.json`.

Alternatively, export the environment variable:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

---

## What SudoCode can do

* **Explore and Understand Codebases**: Ask questions about system architecture, trace control flows, search symbols, and locate relevant files across large repositories.
* **Edit Files and Fix Bugs**: Autonomously read, write, and apply surgical edits across multiple files while preserving code style and comments.
* **Run Commands and Tests**: Execute shell commands, linters, and test suites with real-time stdout streaming and smart error recovery.
* **Plan Mode (`/plan`)**: Safely plan complex multi-step refactors without touching disk until you approve.
* **Auto-Approve (`/auto`)**: Enable hands-free autonomous workflows for trusted sessions.
* **Context Compaction (`/compact`)**: Automatically summarize and trim conversation history when approaching model token limits.
* **Native MCP Integration**: Connect third-party Model Context Protocol servers (databases, GitHub, web search, custom APIs) via `mcp_config.json`.

---

## Interactive Slash Commands

Inside the SudoCode terminal session, use slash commands to control execution:

| Command | Description |
| :--- | :--- |
| `/help` | View full command palette and tool descriptions |
| `/plan` | Toggle **Plan Mode** (blocks write tools for safe, risk-free planning) |
| `/auto` | Toggle **Auto-Approve** (skip manual confirmation prompts for write tools) |
| `/status` | Display active session info, model, git branch, and context status |
| `/compact` | Manually compress conversation history to free context tokens |
| `/model <id>` | Switch LLM model on the fly (e.g. `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`) |
| `/mcp` | List all connected Model Context Protocol servers and their tools |
| `/clear` | Clear the current conversation history (alias: `/reset`) |
| `/exit` | Exit SudoCode session (alias: `/quit` or `Ctrl+C`) |

---

## Built-in Developer Tools

SudoCode interacts with your local environment through a specialized set of developer tools:

* **`read_file`**: Reads file content with precise line slicing and offsets.
* **`edit_file`**: Applies surgical, non-destructive string replacements to existing files.
* **`write_file`**: Creates new source files or overwrites existing content.
* **`list_files`**: Explores directory hierarchies and workspace trees.
* **`execute_command`**: Runs persistent terminal commands with live streaming output.
* **`grep`**: Fast pattern matching across your entire workspace.
* **`workspace_search`**: Semantic discovery for functions, classes, and components.
* **`todo_write`**: Manages interactive multi-phase execution checklists.

---

## Model Context Protocol (MCP)

Extend SudoCode with custom external tools by creating an `mcp_config.json` in your project or home directory:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}
```

SudoCode automatically connects to your servers on startup and exposes their tools directly to the model.

---

## Links & Community

- **Official Website & Interactive Simulator**: [https://nilesh020901.github.io/sudocode-cli-ai/](https://nilesh020901.github.io/sudocode-cli-ai/)
- **GitHub Repository**: [https://github.com/Nilesh020901/sudocode-cli-ai](https://github.com/Nilesh020901/sudocode-cli-ai)
- **NPM Package**: [https://www.npmjs.com/package/sudocode-ai](https://www.npmjs.com/package/sudocode-ai)
- **Issue Tracker & Feature Requests**: [https://github.com/Nilesh020901/sudocode-cli-ai/issues](https://github.com/Nilesh020901/sudocode-cli-ai/issues)

---

## License

MIT © [Nilesh](https://github.com/Nilesh020901)
