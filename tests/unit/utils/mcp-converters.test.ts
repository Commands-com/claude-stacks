/**
 * @jest-environment node
 */

import type { CodexMcpServer } from '../../../src/utils/mcp-converters.js';
import {
  convertToCodexFormat,
  convertToGeminiFormat,
  generateCodexToml,
  GeminiMcpServer,
} from '../../../src/utils/mcp-converters.js';
import type { StackMcpServer } from '../../../src/types/index.js';

describe('MCP Converters', () => {
  describe('convertToCodexFormat', () => {
    it('should convert stdio MCP servers to Codex format', () => {
      const claudeServers: StackMcpServer[] = [
        {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '/path/to/root'],
          env: { PATH: '/usr/local/bin', DEBUG: 'true' },
        },
        {
          name: 'github',
          type: 'stdio',
          command: 'node',
          args: ['github-server.js'],
        },
      ];

      const result = convertToCodexFormat(claudeServers);

      expect(result).toEqual({
        filesystem: {
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '/path/to/root'],
          env: { PATH: '/usr/local/bin', DEBUG: 'true' },
        },
        github: {
          command: 'node',
          args: ['github-server.js'],
        },
      });
    });

    it('should skip non-stdio servers', () => {
      const claudeServers: StackMcpServer[] = [
        {
          name: 'http-server',
          type: 'http',
          url: 'http://localhost:3000',
        },
        {
          name: 'sse-server',
          type: 'sse',
          url: 'http://localhost:3001/stream',
        },
        {
          name: 'stdio-server',
          type: 'stdio',
          command: 'npx',
          args: ['stdio-server'],
        },
      ];

      const result = convertToCodexFormat(claudeServers);

      expect(result).toEqual({
        'stdio-server': {
          command: 'npx',
          args: ['stdio-server'],
        },
      });
    });

    it('should skip servers without command', () => {
      const claudeServers: StackMcpServer[] = [
        {
          name: 'incomplete-server',
          type: 'stdio',
          // No command provided
        },
      ];

      const result = convertToCodexFormat(claudeServers);

      expect(result).toEqual({});
    });

    it('should handle servers with only command (no args or env)', () => {
      const claudeServers: StackMcpServer[] = [
        {
          name: 'simple-server',
          type: 'stdio',
          command: 'simple-command',
        },
      ];

      const result = convertToCodexFormat(claudeServers);

      expect(result).toEqual({
        'simple-server': {
          command: 'simple-command',
        },
      });
    });
  });

  describe('convertToGeminiFormat', () => {
    it('should convert all types of MCP servers to Gemini format', () => {
      const claudeServers: StackMcpServer[] = [
        {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
          env: { PATH: '/usr/local/bin' },
        },
        {
          name: 'api-server',
          type: 'http',
          url: 'http://localhost:3000/api',
        },
        {
          name: 'stream-server',
          type: 'sse',
          url: 'http://localhost:3001/stream',
          env: { API_KEY: 'secret' },
        },
      ];

      const result = convertToGeminiFormat(claudeServers);

      expect(result).toEqual({
        filesystem: {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
          env: { PATH: '/usr/local/bin' },
        },
        'api-server': {
          type: 'http',
          command: 'http://localhost:3000/api',
        },
        'stream-server': {
          type: 'sse',
          command: 'http://localhost:3001/stream',
          env: { API_KEY: 'secret' },
        },
      });
    });

    it('should handle servers without command by using URL', () => {
      const claudeServers: StackMcpServer[] = [
        {
          name: 'url-only-server',
          type: 'http',
          url: 'http://example.com/mcp',
        },
      ];

      const result = convertToGeminiFormat(claudeServers);

      expect(result['url-only-server']).toEqual({
        type: 'http',
        command: 'http://example.com/mcp',
      });
    });

    it('should handle servers with empty command', () => {
      const claudeServers: StackMcpServer[] = [
        {
          name: 'empty-command',
          type: 'stdio',
        },
      ];

      const result = convertToGeminiFormat(claudeServers);

      expect(result['empty-command']).toEqual({
        type: 'stdio',
        command: '',
      });
    });
  });

  describe('generateCodexToml', () => {
    it('should generate valid TOML for Codex servers', () => {
      const servers: Record<string, CodexMcpServer> = {
        filesystem: {
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '/path'],
          env: { PATH: '/usr/local/bin', DEBUG: 'true' },
        },
        simple: {
          command: 'simple-command',
        },
      };

      const result = generateCodexToml(servers);

      expect(result).toContain('[mcp_servers.filesystem]');
      expect(result).toContain('command = "npx"');
      expect(result).toContain('args = ["@modelcontextprotocol/server-filesystem", "/path"]');
      expect(result).toContain('env = { "PATH" = "/usr/local/bin", "DEBUG" = "true" }');

      expect(result).toContain('[mcp_servers.simple]');
      expect(result).toContain('command = "simple-command"');

      // Should not contain args or env for simple server
      const simpleSection = result.split('[mcp_servers.simple]')[1];
      expect(simpleSection).not.toContain('args =');
      expect(simpleSection).not.toContain('env =');
    });

    it('should handle servers with no args or env', () => {
      const servers: Record<string, CodexMcpServer> = {
        basic: {
          command: 'basic-command',
        },
      };

      const result = generateCodexToml(servers);

      expect(result).toBe('[mcp_servers.basic]\ncommand = "basic-command"\n\n');
    });

    it('should handle servers with empty args array', () => {
      const servers: Record<string, CodexMcpServer> = {
        noargs: {
          command: 'command',
          args: [],
        },
      };

      const result = generateCodexToml(servers);

      expect(result).not.toContain('args =');
      expect(result).toContain('command = "command"');
    });

    it('should handle servers with empty env object', () => {
      const servers: Record<string, CodexMcpServer> = {
        noenv: {
          command: 'command',
          env: {},
        },
      };

      const result = generateCodexToml(servers);

      expect(result).not.toContain('env =');
      expect(result).toContain('command = "command"');
    });

    it('should properly escape quotes in TOML values', () => {
      const servers: Record<string, CodexMcpServer> = {
        quotes: {
          command: 'command-with-"quotes"',
          args: ['arg-with-"quotes"'],
          env: { KEY: 'value-with-"quotes"' },
        },
      };

      const result = generateCodexToml(servers);

      expect(result).toContain('command = "command-with-"quotes""');
      expect(result).toContain('"arg-with-"quotes""');
      expect(result).toContain('"KEY" = "value-with-"quotes""');
    });

    it('should generate multiple server sections', () => {
      const servers: Record<string, CodexMcpServer> = {
        first: { command: 'first-command' },
        second: { command: 'second-command' },
        third: { command: 'third-command' },
      };

      const result = generateCodexToml(servers);

      expect(result).toContain('[mcp_servers.first]');
      expect(result).toContain('[mcp_servers.second]');
      expect(result).toContain('[mcp_servers.third]');

      // Should have proper spacing between sections
      const sections = result.split('\n\n');
      expect(sections.length).toBeGreaterThan(3);
    });
  });

  describe('integration tests', () => {
    it('should convert Claude servers through full pipeline to Codex TOML', () => {
      const claudeServers: StackMcpServer[] = [
        {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
          env: { PATH: '/usr/local/bin' },
        },
        {
          name: 'http-server',
          type: 'http', // Should be skipped for Codex
          url: 'http://localhost:3000',
        },
      ];

      const codexServers = convertToCodexFormat(claudeServers);
      const toml = generateCodexToml(codexServers);

      expect(toml).toContain('[mcp_servers.filesystem]');
      expect(toml).toContain('command = "npx"');
      expect(toml).not.toContain('http-server');
    });

    it('should convert Claude servers to Gemini JSON format', () => {
      const claudeServers: StackMcpServer[] = [
        {
          name: 'discord',
          type: 'stdio',
          command: 'docker',
          args: ['run', '-i', '--rm', '-e', 'DISCORD_TOKEN', 'mcp/mcp-discord:latest'],
          env: { DISCORD_TOKEN: 'mock-token' },
        },
      ];

      const geminiServers = convertToGeminiFormat(claudeServers);

      expect(geminiServers.discord).toEqual({
        type: 'stdio',
        command: 'docker',
        args: ['run', '-i', '--rm', '-e', 'DISCORD_TOKEN', 'mcp/mcp-discord:latest'],
        env: { DISCORD_TOKEN: 'mock-token' },
      });

      // Should be valid JSON when stringified
      expect(() => JSON.stringify({ mcpServers: geminiServers })).not.toThrow();
    });
  });
});
