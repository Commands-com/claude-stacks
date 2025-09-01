/**
 * MCP Configuration Converters
 *
 * Utilities for converting Claude MCP server configurations to other formats
 * like Codex TOML and Gemini JSON.
 *
 * @since 1.4.9
 * @public
 */

import type { StackMcpServer } from '../types/index.js';

/**
 * Codex MCP server configuration structure for TOML
 */
export interface CodexMcpServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Codex configuration structure
 */
export interface CodexConfig {
  mcp_servers?: Record<string, CodexMcpServer>;
}

/**
 * Gemini MCP server configuration structure for JSON
 */
export interface GeminiMcpServer {
  type?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
  trust?: boolean;
}

/**
 * Gemini configuration structure
 */
export interface GeminiConfig {
  mcpServers?: Record<string, GeminiMcpServer>;
  [key: string]: unknown;
}

/**
 * Convert Claude MCP servers to Codex TOML format
 *
 * @param mcpServers - Array of MCP servers from Claude configuration
 * @returns Record of server configurations in Codex format
 *
 * @example
 * ```typescript
 * const claudeServers = [
 *   { name: 'filesystem', type: 'stdio', command: 'npx', args: ['@modelcontextprotocol/server-filesystem'] }
 * ];
 * const codexServers = convertToCodexFormat(claudeServers);
 * // Returns: { filesystem: { command: 'npx', args: ['@modelcontextprotocol/server-filesystem'] } }
 * ```
 */
export function convertToCodexFormat(mcpServers: StackMcpServer[]): Record<string, CodexMcpServer> {
  const codexServers: Record<string, CodexMcpServer> = {};

  for (const server of mcpServers) {
    // Codex only supports stdio type, so we only convert those
    if (server.type === 'stdio' && server.command) {
      codexServers[server.name] = {
        command: server.command,
        ...(server.args && { args: server.args }),
        ...(server.env && { env: server.env }),
      };
    }
  }

  return codexServers;
}

/**
 * Convert Claude MCP servers to Gemini JSON format
 *
 * @param mcpServers - Array of MCP servers from Claude configuration
 * @returns Record of server configurations in Gemini format
 *
 * @example
 * ```typescript
 * const claudeServers = [
 *   { name: 'discord', type: 'stdio', command: 'docker', args: ['run', '-i', '--rm'] }
 * ];
 * const geminiServers = convertToGeminiFormat(claudeServers);
 * // Returns: { discord: { type: 'stdio', command: 'docker', args: ['run', '-i', '--rm'] } }
 * ```
 */
export function convertToGeminiFormat(
  mcpServers: StackMcpServer[]
): Record<string, GeminiMcpServer> {
  const geminiServers: Record<string, GeminiMcpServer> = {};

  for (const server of mcpServers) {
    const geminiServer: GeminiMcpServer = {
      type: server.type,
      command: server.command ?? '',
    };

    if (server.args) {
      geminiServer.args = server.args;
    }

    if (server.env) {
      geminiServer.env = server.env;
    }

    if (server.url) {
      // For HTTP/SSE servers, we might need special handling
      // For now, we'll put the URL in the command field if no command exists
      if (!geminiServer.command) {
        geminiServer.command = server.url;
      }
    }

    geminiServers[server.name] = geminiServer;
  }

  return geminiServers;
}

/**
 * Generate TOML string for Codex configuration
 *
 * @param servers - Codex MCP server configurations
 * @returns TOML string representation
 *
 * @example
 * ```typescript
 * const servers = { filesystem: { command: 'npx', args: ['server'] } };
 * const toml = generateCodexToml(servers);
 * // Returns: "[mcp_servers.filesystem]\ncommand = \"npx\"\nargs = [\"server\"]\n"
 * ```
 */
export function generateCodexToml(servers: Record<string, CodexMcpServer>): string {
  let toml = '';

  for (const [name, config] of Object.entries(servers)) {
    toml += `[mcp_servers.${name}]\n`;
    toml += `command = "${config.command}"\n`;

    if (config.args && config.args.length > 0) {
      const argsStr = config.args.map(arg => `"${arg}"`).join(', ');
      toml += `args = [${argsStr}]\n`;
    }

    if (config.env && Object.keys(config.env).length > 0) {
      const envEntries = Object.entries(config.env).map(([key, value]) => `"${key}" = "${value}"`);
      toml += `env = { ${envEntries.join(', ')} }\n`;
    }

    toml += '\n';
  }

  return toml;
}
