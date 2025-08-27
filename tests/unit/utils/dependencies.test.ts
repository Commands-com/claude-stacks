import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import {
  checkCommandExists,
  checkMcpDependencies,
  checkStatusLineDependencies,
  displayMissingDependencies,
  type MissingDependency,
} from '../../../src/utils/dependencies.js';
import type { StackMcpServer } from '../../../src/types/index.js';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock fs
jest.mock('fs');
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    warning: jest.fn((text: string) => text),
    meta: jest.fn((text: string) => text),
    error: jest.fn((text: string) => text),
    info: jest.fn((text: string) => text),
  },
}));

// Mock dependency mappings
const mockDependencyMappings = {
  commands: {
    npx: {
      description: 'Node.js package runner',
      type: 'system' as const,
      installInstructions: {
        default: 'Install Node.js from https://nodejs.org/',
        darwin: {
          brew: 'brew install node',
          default: 'Install Node.js from https://nodejs.org/ or use: brew install node',
        },
      },
    },
    ccline: {
      description: 'Claude Code status line',
      type: 'statusline' as const,
      checkPaths: ['ccline', '~/.claude/ccline/ccline'],
      installInstructions: {
        default: 'npm install -g @cometix/ccline',
        notes: 'Requires Node.js to be installed first',
      },
    },
    'statusline.sh': {
      description: 'CC status line script',
      type: 'statusline' as const,
      checkPaths: ['statusline.sh', '.claude/statusline.sh'],
      installInstructions: {
        default: 'npx @chongdashu/cc-statusline@latest init',
        notes: 'Creates a local statusline.sh script in your .claude directory',
      },
    },
  },
};

describe('dependencies utilities', () => {
  const mockConsoleLog = jest.fn();
  const originalConsoleLog = console.log;
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;

    // Mock dependency mappings file
    mockReadFileSync.mockReturnValue(JSON.stringify(mockDependencyMappings));

    // Reset process.platform
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  describe('checkCommandExists', () => {
    it('should return true when command exists', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0)); // Exit code 0 means success
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkCommandExists('npm');

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('which', ['npm'], { stdio: 'ignore' });
    });

    it('should return false when command does not exist', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(1)); // Exit code 1 means not found
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkCommandExists('nonexistent-command');

      expect(result).toBe(false);
      expect(mockSpawn).toHaveBeenCalledWith('which', ['nonexistent-command'], { stdio: 'ignore' });
    });

    it('should return false when spawn encounters an error', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setImmediate(() => callback(new Error('Command failed')));
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkCommandExists('error-command');

      expect(result).toBe(false);
    });

    it('should handle both error and close events correctly', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0));
          } else if (event === 'error') {
            // Error handler is set but not called in this test
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkCommandExists('valid-command');

      expect(result).toBe(true);
      expect(mockChild.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockChild.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('checkMcpDependencies', () => {
    it('should return empty array when all dependencies are available', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0)); // All commands exist
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const mcpServers: StackMcpServer[] = [
        {
          name: 'test-server1',
          type: 'stdio',
          command: 'npm',
        },
        {
          name: 'test-server2',
          type: 'stdio',
          command: 'python',
        },
      ];

      const result = await checkMcpDependencies(mcpServers);

      expect(result).toEqual([]);
      expect(mockSpawn).toHaveBeenCalledTimes(2); // Two unique commands
    });

    it('should identify missing dependencies', async () => {
      // Mock npm exists (exit code 0), python doesn't exist (exit code 1)
      let callCount = 0;
      mockSpawn.mockImplementation((command, args) => {
        callCount++;
        const mockChild = {
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              const exitCode = args[0] === 'npm' ? 0 : 1; // npm exists, python doesn't
              setImmediate(() => callback(exitCode));
            }
          }),
        };
        return mockChild as any;
      });

      const mcpServers: StackMcpServer[] = [
        {
          name: 'npm-server',
          type: 'stdio',
          command: 'npm',
        },
        {
          name: 'python-server',
          type: 'stdio',
          command: 'python',
        },
      ];

      const result = await checkMcpDependencies(mcpServers);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        command: 'python',
        type: 'mcp',
        requiredBy: ['python-server'],
        installInstructions: expect.stringContaining('python'),
      });
    });

    it('should group servers by command to avoid duplicate checks', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(1)); // Command doesn't exist
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const mcpServers: StackMcpServer[] = [
        {
          name: 'server1',
          type: 'stdio',
          command: 'uvx',
        },
        {
          name: 'server2',
          type: 'stdio',
          command: 'uvx',
        },
        {
          name: 'server3',
          type: 'stdio',
          command: 'uvx',
        },
      ];

      const result = await checkMcpDependencies(mcpServers);

      expect(mockSpawn).toHaveBeenCalledTimes(1); // Only check uvx once
      expect(result).toHaveLength(1);
      expect(result[0].requiredBy).toEqual(['server1', 'server2', 'server3']);
    });

    it('should skip non-stdio servers', async () => {
      const mcpServers: StackMcpServer[] = [
        {
          name: 'sse-server',
          type: 'sse' as any,
          url: 'https://example.com',
        },
      ];

      const result = await checkMcpDependencies(mcpServers);

      expect(result).toEqual([]);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should skip servers without command', async () => {
      const mcpServers: StackMcpServer[] = [
        {
          name: 'incomplete-server',
          type: 'stdio',
          // No command property
        } as any,
      ];

      const result = await checkMcpDependencies(mcpServers);

      expect(result).toEqual([]);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should handle servers without names', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(1)); // Command doesn't exist
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const mcpServers: StackMcpServer[] = [
        {
          type: 'stdio',
          command: 'missing-cmd',
          // No name property
        } as any,
      ];

      const result = await checkMcpDependencies(mcpServers);

      expect(result).toHaveLength(1);
      expect(result[0].requiredBy).toEqual(['Unknown MCP Server']);
    });

    it('should provide install instructions for all commands', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(1)); // Command doesn't exist
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const testCommands = ['uvx', 'npx', 'docker', 'python3', 'node', 'unknown-cmd'];

      for (const command of testCommands) {
        const mcpServers: StackMcpServer[] = [
          {
            name: `${command}-server`,
            type: 'stdio',
            command,
          },
        ];

        const result = await checkMcpDependencies(mcpServers);

        expect(result).toHaveLength(1);
        expect(result[0].installInstructions).toBeDefined();
        expect(result[0].installInstructions.length).toBeGreaterThan(0);
        // Verify that instructions are provided (content varies by OS and mappings)
        expect(result[0].installInstructions).not.toBe('');
      }
    });
  });

  describe('checkStatusLineDependencies', () => {
    it('should return empty array when statusLine is undefined', async () => {
      const result = await checkStatusLineDependencies(undefined);

      expect(result).toEqual([]);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should return empty array when statusLine has no type or command', async () => {
      const result = await checkStatusLineDependencies({});

      expect(result).toEqual([]);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should return empty array when type is not command', async () => {
      const result = await checkStatusLineDependencies({ type: 'ccline' });

      expect(result).toEqual([]);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should check command when type is command', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0)); // Command exists
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkStatusLineDependencies({
        type: 'command',
        command: 'statusline.sh',
      });

      expect(result).toEqual([]);
      expect(mockSpawn).toHaveBeenCalledWith('which', ['statusline.sh'], { stdio: 'ignore' });
    });

    it('should return missing dependency when command not found', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(1)); // Command doesn't exist
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkStatusLineDependencies({
        type: 'command',
        command: 'statusline.sh',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        command: 'statusline.sh',
        type: 'statusline',
        requiredBy: ['Status line display'],
        installInstructions: expect.stringContaining('npx @chongdashu/cc-statusline@latest init'),
      });
    });

    it('should check ccline command from mapping', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0)); // Command exists
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkStatusLineDependencies({
        type: 'command',
        command: 'ccline',
      });

      expect(result).toEqual([]);
      expect(mockSpawn).toHaveBeenCalledWith('which', ['ccline'], { stdio: 'ignore' });
    });

    it('should check multiple paths for ccline when first fails', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation((command, args) => {
        callCount++;
        const mockChild = {
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              // First call (ccline) fails, second call (~/.claude/ccline/ccline) succeeds
              const exitCode = callCount === 1 ? 1 : 0;
              setImmediate(() => callback(exitCode));
            }
          }),
        };
        return mockChild as any;
      });

      const result = await checkStatusLineDependencies({
        type: 'command',
        command: 'ccline',
      });

      expect(result).toEqual([]);
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(mockSpawn).toHaveBeenCalledWith('which', ['ccline'], { stdio: 'ignore' });
      expect(mockSpawn).toHaveBeenCalledWith(
        'which',
        expect.arrayContaining([expect.stringMatching(/ccline\/ccline$/)]),
        {
          stdio: 'ignore',
        }
      );
    });

    it('should return missing dependency when all paths fail', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(1)); // All commands fail
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkStatusLineDependencies({
        type: 'command',
        command: 'ccline',
      });

      expect(result).toHaveLength(1);
      expect(mockSpawn).toHaveBeenCalledTimes(3); // Tried both paths + expanded path
      expect(result[0]).toMatchObject({
        command: 'ccline',
        type: 'statusline',
        requiredBy: ['Status line display'],
        installInstructions: expect.stringContaining('npm install -g @cometix/ccline'),
      });
    });

    it('should handle path with slashes correctly', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0)); // Command exists
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkStatusLineDependencies({
        type: 'command',
        command: '~/.claude/ccline/ccline',
      });

      expect(result).toEqual([]);
      expect(mockSpawn).toHaveBeenCalledWith('which', ['ccline'], { stdio: 'ignore' });
    });

    it('should handle spawn errors gracefully', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setImmediate(() => callback(new Error('Command failed')));
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkStatusLineDependencies({
        type: 'command',
        command: 'ccline',
      });

      expect(result).toHaveLength(1);
      expect(result[0].command).toBe('ccline');
    });

    it('should use OS-specific install instructions on macOS', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(1)); // Command doesn't exist
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const result = await checkStatusLineDependencies({
        type: 'command',
        command: 'ccline',
      });

      expect(result).toHaveLength(1);
      expect(result[0].installInstructions).toContain('npm install -g @cometix/ccline');
    });
  });

  describe('displayMissingDependencies', () => {
    it('should not display anything when no missing dependencies', () => {
      displayMissingDependencies([]);

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should display missing dependencies with proper formatting', () => {
      const missingDeps: MissingDependency[] = [
        {
          command: 'uvx',
          type: 'mcp',
          requiredBy: ['python-server', 'ai-server'],
          installInstructions: 'Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh',
        },
        {
          command: 'docker',
          type: 'mcp',
          requiredBy: ['container-server'],
          installInstructions: 'Install Docker: https://docs.docker.com/get-docker/',
        },
      ];

      displayMissingDependencies(missingDeps);

      expect(mockConsoleLog).toHaveBeenCalledWith('\\n⚠️  Missing Dependencies Detected');
      expect(mockConsoleLog).toHaveBeenCalledWith('\\nMCP Server Dependencies:');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'The following MCP servers may not work due to missing dependencies:\\n'
      );

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ uvx');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Required by: python-server, ai-server');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   📦 Installation: Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh'
      );

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ docker');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Required by: container-server');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   📦 Installation: Install Docker: https://docs.docker.com/get-docker/'
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Missing MCP server dependencies will prevent those servers from starting.'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Missing status line dependencies only affect the visual status line display.'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "You can still use other parts of the stack that don't require these dependencies.\\n"
      );
    });

    it('should handle single missing dependency', () => {
      const missingDeps: MissingDependency[] = [
        {
          command: 'python',
          type: 'mcp',
          requiredBy: ['single-server'],
          installInstructions: 'Install Python: https://www.python.org/downloads/',
        },
      ];

      displayMissingDependencies(missingDeps);

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ python');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Required by: single-server');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   📦 Installation: Install Python: https://www.python.org/downloads/'
      );
    });
  });
});
