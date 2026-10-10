import fs from 'fs';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Tool, ToolSchema } from './tools.js';

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  servers?: Record<string, McpServerConfig>;
}

class McpToolWrapper extends Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  isReadOnly: boolean;

  constructor(
    private clientName: string,
    private originalName: string,
    toolDef: { name: string; description?: string; inputSchema: Record<string, any> }
  ) {
    super();
    // Prefix tool names with server name to avoid conflicts (e.g. weather_get_forecast)
    this.name = `${clientName}_${originalName}`.replace(/[^a-zA-Z0-9_]/g, '_');
    this.description = toolDef.description || `MCP Tool from server ${clientName}`;
    this.parameters = toolDef.inputSchema || { type: 'object', properties: {} };
    // Heuristic: standard read-only tool detection based on name patterns
    const readOnlyPatterns = ['get', 'read', 'list', 'show', 'fetch', 'query', 'search'];
    this.isReadOnly = readOnlyPatterns.some((pat) => originalName.toLowerCase().includes(pat));
  }

  async execute(args: any): Promise<string> {
    try {
      const manager = McpManager.getInstance();
      const client = manager.getClient(this.clientName);
      if (!client) {
        return `Error: MCP client ${this.clientName} is not connected.`;
      }
      
      const response = await client.callTool({
        name: this.originalName,
        arguments: args
      });
      
      if (response && response.content) {
        return (response.content as any[])
          .map((item: any) => {
            if (item.type === 'text') return item.text;
            return JSON.stringify(item);
          })
          .join('\n');
      }
      
      return 'Tool completed successfully with empty output.';
    } catch (e: any) {
      return `Error executing MCP tool ${this.name}: ${e.message}`;
    }
  }
}

export class McpManager {
  private static instance: McpManager | null = null;
  private clients: Map<string, Client> = new Map();
  private transports: StdioClientTransport[] = [];
  private mcpTools: Tool[] = [];

  private constructor() {}

  public static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  public getClient(name: string): Client | undefined {
    return this.clients.get(name);
  }

  public getTools(): Tool[] {
    return this.mcpTools;
  }

  /**
   * Load and connect to all MCP servers defined in mcp_config.json
   */
  public async initialize(): Promise<number> {
    const configPath = path.resolve('mcp_config.json');
    if (!fs.existsSync(configPath)) {
      // Create empty config if not existing for template reference
      fs.writeFileSync(configPath, JSON.stringify({ servers: {} }, null, 2), 'utf-8');
      return 0;
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config: McpConfig = JSON.parse(configContent);
      if (!config.servers || Object.keys(config.servers).length === 0) {
        return 0;
      }

      console.log('Initializing Model Context Protocol (MCP) servers...');
      let connectedCount = 0;

      for (const [serverName, serverCfg] of Object.entries(config.servers)) {
        try {
          const transport = new StdioClientTransport({
            command: serverCfg.command,
            args: serverCfg.args || [],
            env: { ...process.env, ...(serverCfg.env || {}) } as any
          });

          const client = new Client(
            { name: 'SudoCode-Client', version: '1.0.0' },
            { capabilities: { tools: {} } }
          );

          await client.connect(transport);
          this.clients.set(serverName, client);
          this.transports.push(transport);

          // Retrieve tools from server
          const response = await client.listTools();
          if (response && response.tools) {
            for (const t of response.tools) {
              const wrapper = new McpToolWrapper(serverName, t.name, t);
              this.mcpTools.push(wrapper);
            }
            console.log(`Connected to MCP server "${serverName}" (${response.tools.length} tools loaded).`);
            connectedCount++;
          }
        } catch (serverErr: any) {
          console.error(`Failed to connect to MCP server "${serverName}":`, serverErr.message);
        }
      }

      return connectedCount;
    } catch (e: any) {
      console.error('Error reading mcp_config.json:', e.message);
      return 0;
    }
  }

  /**
   * Gracefully close all MCP client connections
   */
  public async shutdown(): Promise<void> {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
      } catch (e) {}
    }
    this.clients.clear();
    this.transports = [];
    this.mcpTools = [];
  }
}
