/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as os from 'os';

// Mock os module
jest.mock('os', () => ({
  homedir: jest.fn(() => '/test/home'),
}));

// Mock all services to prevent initialization issues
jest.mock('../../../src/services/index.js', () => ({
  UIService: jest.fn().mockImplementation(() => ({
    info: jest.fn((message: string) => console.log(message)),
    error: jest.fn((message: string, details?: string) => {
      if (details) {
        console.error(message, details);
      } else {
        console.error(message);
      }
    }),
    success: jest.fn((message: string) => console.log(message)),
    warning: jest.fn((message: string) => console.log(message)),
    meta: jest.fn((message: string) => console.log(message)),
    log: jest.fn((message: string) => console.log(message)),
  })),
  AuthService: jest.fn().mockImplementation(() => ({})),
  ApiService: jest.fn().mockImplementation(() => ({})),
  MetadataService: jest.fn().mockImplementation(() => ({})),
  DependencyService: jest.fn().mockImplementation(() => ({})),
  StackService: jest.fn(),
  FileService: jest.fn().mockImplementation(() => ({})),
  ConfigService: jest.fn(),
}));

// Mock fs-extra
jest.mock('fs-extra');

// Mock input utility for confirmation prompts
jest.mock('../../../src/utils/input.js', () => ({
  readSingleChar: jest.fn(),
}));

// Mock path constants
jest.mock('../../../src/constants/paths.js', () => ({
  CLAUDE_JSON_PATH: '/test/home/.claude.json',
}));

import { syncMcpAction } from '../../../src/actions/sync-mcp.js';
import type { SyncMcpArgs } from '../../../src/types/cli.js';
import { readSingleChar } from '../../../src/utils/input.js';

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();
const mockReadSingleChar = readSingleChar as jest.MockedFunction<typeof readSingleChar>;

describe('syncMcpAction', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;
  const originalCwd = process.cwd;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;
    process.cwd = jest.fn(() => '/test/project');

    // Reset all fs-extra mocks
    const mockedFs = fs as jest.Mocked<typeof fs>;
    mockedFs.pathExists.mockReset();
    mockedFs.readJson.mockReset();
    mockedFs.readFile.mockReset();
    mockedFs.writeFile.mockReset();
    mockedFs.ensureDir.mockReset();

    // Reset input mock
    mockReadSingleChar.mockReset();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    process.cwd = originalCwd;
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should sync MCP servers successfully', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      // Mock Claude config exists and has MCP servers
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': {
                type: 'stdio',
                command: 'node',
                args: ['test.js'],
                env: { TEST: 'true' },
              },
            },
          },
        },
      });

      mockedFs.readFile.mockResolvedValue(''); // Empty existing configs
      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      await syncMcpAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('📤 Syncing MCP servers from current project...');
      expect(mockConsoleLog).toHaveBeenCalledWith('MCP Servers to sync (1):');
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ Successfully synced 1 MCP servers');
    });

    it('should handle no MCP servers found', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(false);

      await syncMcpAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('No MCP servers found in current Claude project');
    });

    it('should handle dry run mode', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': {
                type: 'stdio',
                command: 'node',
              },
            },
          },
        },
      });

      // Mock both Codex and Gemini config paths don't exist initially
      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(false) // Codex config doesn't exist
        .mockResolvedValueOnce(false); // Gemini config doesn't exist

      mockedFs.readFile.mockResolvedValue(''); // Empty existing configs
      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      const options: SyncMcpArgs = { dryRun: true };
      await syncMcpAction(options);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Dry run complete'));
    });
  });

  describe('error handling', () => {
    it('should handle mutually exclusive options', async () => {
      const options: SyncMcpArgs = { codexOnly: true, geminiOnly: true };

      await syncMcpAction(options);

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Cannot use both --codex-only and --gemini-only flags together'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle file read errors', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockRejectedValue(new Error('File read error'));

      await syncMcpAction({});

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to sync MCP servers:',
        expect.stringContaining('Failed to read Claude config')
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('confirmation prompt scenarios', () => {
    it('should skip confirmation with --force flag', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      // Mock existing configs
      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(true) // Codex config exists
        .mockResolvedValueOnce(true); // Gemini config exists

      mockedFs.readFile.mockResolvedValue('[mcp_servers.existing]\ncommand = "test"');
      mockedFs.readJson
        .mockResolvedValueOnce({
          projects: {
            '/test/project': { mcpServers: { 'test-server': { type: 'stdio', command: 'node' } } },
          },
        })
        .mockResolvedValueOnce({ mcpServers: { existing: { command: 'test' } } });

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      const options: SyncMcpArgs = { force: true };
      await syncMcpAction(options);

      // Should not call readSingleChar when force is true
      expect(mockReadSingleChar).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ Successfully synced 1 MCP servers');
    });

    it('should skip confirmation in append mode', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(true) // Codex config exists
        .mockResolvedValueOnce(true); // Gemini config exists

      mockedFs.readFile.mockResolvedValue('[mcp_servers.existing]\ncommand = "test"');
      mockedFs.readJson
        .mockResolvedValueOnce({
          projects: {
            '/test/project': { mcpServers: { 'test-server': { type: 'stdio', command: 'node' } } },
          },
        })
        .mockResolvedValueOnce({ mcpServers: { existing: { command: 'test' } } });

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      const options: SyncMcpArgs = { append: true };
      await syncMcpAction(options);

      expect(mockReadSingleChar).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ Successfully synced 1 MCP servers');
    });

    it('should ask for confirmation when overwriting existing configs', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(true) // Codex config exists
        .mockResolvedValueOnce(true); // Gemini config exists

      mockedFs.readFile.mockResolvedValue('[mcp_servers.existing]\ncommand = "test"');
      mockedFs.readJson
        .mockResolvedValueOnce({
          projects: {
            '/test/project': { mcpServers: { 'test-server': { type: 'stdio', command: 'node' } } },
          },
        })
        .mockResolvedValueOnce({ mcpServers: { existing: { command: 'test' } } });

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      // User confirms both prompts
      mockReadSingleChar.mockResolvedValueOnce('y').mockResolvedValueOnce('y');

      await syncMcpAction({});

      expect(mockReadSingleChar).toHaveBeenCalledTimes(2);
      expect(mockReadSingleChar).toHaveBeenCalledWith(
        'Continue with overwrite? This will replace existing MCP server configurations. (y/N): '
      );
    });

    it('should handle user declining confirmation', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(true) // Codex config exists
        .mockResolvedValueOnce(false); // Gemini config doesn't exist

      mockedFs.readFile.mockResolvedValue('[mcp_servers.existing]\ncommand = "test"');
      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      // User declines Codex, accepts Gemini (no existing config)
      mockReadSingleChar.mockResolvedValueOnce('n');

      await syncMcpAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('  Skipped Codex sync');
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ Successfully synced 1 MCP servers');
    });

    it('should skip confirmation when no existing servers', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(false) // Codex config doesn't exist
        .mockResolvedValueOnce(false); // Gemini config doesn't exist

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      await syncMcpAction({});

      expect(mockReadSingleChar).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ Successfully synced 1 MCP servers');
    });
  });

  describe('selective sync options', () => {
    it('should sync only to Codex with --codex-only flag', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(false); // Codex config doesn't exist

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      const options: SyncMcpArgs = { codexOnly: true };
      await syncMcpAction(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Codex (~/.codex/config.toml):');
      expect(mockConsoleLog).not.toHaveBeenCalledWith('Gemini (~/.gemini/settings.json):');
    });

    it('should sync only to Gemini with --gemini-only flag', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(false); // Gemini config doesn't exist

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      const options: SyncMcpArgs = { geminiOnly: true };
      await syncMcpAction(options);

      expect(mockConsoleLog).not.toHaveBeenCalledWith('Codex (~/.codex/config.toml):');
      expect(mockConsoleLog).toHaveBeenCalledWith('Gemini (~/.gemini/settings.json):');
    });
  });

  describe('append vs overwrite modes', () => {
    it('should handle append mode for Codex config', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'new-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(true) // Codex config exists (syncToCodex check)
        .mockResolvedValueOnce(false) // Gemini config doesn't exist (won't be called since codex-only)
        .mockResolvedValueOnce(true); // Codex config exists (writeCodexConfig append check)

      mockedFs.readFile.mockResolvedValue('[mcp_servers.existing]\ncommand = "existing"');
      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      const options: SyncMcpArgs = { append: true, codexOnly: true };
      await syncMcpAction(options);

      // Verify sync completed successfully in append mode
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        '/test/home/.codex/config.toml',
        expect.stringContaining('[mcp_servers.new-server]')
      );
      expect(mockedFs.readFile).toHaveBeenCalledWith('/test/home/.codex/config.toml', 'utf8');
    });

    it('should handle append mode for Gemini config', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      const existingGeminiConfig = { mcpServers: { existing: { command: 'existing' } } };

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(false) // Codex config doesn't exist (won't be called since gemini-only)
        .mockResolvedValueOnce(true); // Gemini config exists

      mockedFs.readJson
        .mockResolvedValueOnce({
          // Claude config
          projects: {
            '/test/project': {
              mcpServers: {
                'new-server': { type: 'stdio', command: 'node' },
              },
            },
          },
        })
        .mockResolvedValueOnce(existingGeminiConfig); // Gemini config

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      const options: SyncMcpArgs = { append: true, geminiOnly: true };
      await syncMcpAction(options);

      // Verify sync completed successfully in append mode
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        '/test/home/.gemini/settings.json',
        expect.stringContaining('"new-server"')
      );
      // Verify essential operations were performed
      expect(mockedFs.ensureDir).toHaveBeenCalled();
    });
  });

  describe('error conditions', () => {
    it('should handle Codex sync errors', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(false); // Codex config doesn't exist

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await syncMcpAction({});

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to sync MCP servers:',
        expect.stringContaining('Failed to sync to Codex')
      );
    });

    it('should handle Gemini sync errors', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'test-server': { type: 'stdio', command: 'node' },
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(false) // Codex config doesn't exist
        .mockResolvedValueOnce(false); // Gemini config doesn't exist

      // Make Codex succeed but Gemini fail
      mockedFs.ensureDir
        .mockResolvedValueOnce() // Codex succeeds
        .mockRejectedValueOnce(new Error('Directory creation failed')); // Gemini fails

      mockedFs.writeFile.mockResolvedValue(); // Codex write succeeds

      await syncMcpAction({});

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to sync MCP servers:',
        expect.stringContaining('Failed to sync to Gemini')
      );
    });

    it('should handle empty project config', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {}, // No mcpServers
        },
      });

      await syncMcpAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('No MCP servers found in current Claude project');
    });

    it('should handle missing project config', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {}, // No project entry
      });

      await syncMcpAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('No MCP servers found in current Claude project');
    });

    it('should handle malformed Claude config', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({}); // No projects field

      await syncMcpAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('No MCP servers found in current Claude project');
    });
  });

  describe('MCP server types', () => {
    it('should handle different MCP server types', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'stdio-server': { type: 'stdio', command: 'node', args: ['script.js'] },
              'http-server': { type: 'http', url: 'http://localhost:3000' },
              'sse-server': { type: 'sse', url: 'http://localhost:3001/events' },
              'no-type-server': { command: 'node' }, // Should default to stdio
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(false) // Codex config doesn't exist
        .mockResolvedValueOnce(false); // Gemini config doesn't exist

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      await syncMcpAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('MCP Servers to sync (4):');
      expect(mockConsoleLog).toHaveBeenCalledWith('  • stdio-server (stdio: node)');
      expect(mockConsoleLog).toHaveBeenCalledWith('  • http-server (http: http://localhost:3000)');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  • sse-server (sse: http://localhost:3001/events)'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('  • no-type-server (stdio: node)');

      // Should warn about non-stdio servers being skipped for Codex
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  Skipped 2 non-stdio servers (Codex only supports stdio)'
      );
    });

    it('should handle servers with missing URLs', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({
        projects: {
          '/test/project': {
            mcpServers: {
              'http-no-url': { type: 'http' }, // Missing URL
            },
          },
        },
      });

      mockedFs.pathExists
        .mockResolvedValueOnce(true) // Claude config exists
        .mockResolvedValueOnce(false) // Codex config doesn't exist
        .mockResolvedValueOnce(false); // Gemini config doesn't exist

      mockedFs.ensureDir.mockResolvedValue();
      mockedFs.writeFile.mockResolvedValue();

      await syncMcpAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('  • http-no-url (http: no-url)');
    });
  });
});
