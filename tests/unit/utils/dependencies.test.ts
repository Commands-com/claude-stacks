import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { spawn } from 'child_process';
import {
  checkCommandExists,
  checkMcpDependencies,
  displayMissingDependencies,
  type MissingDependency,
} from '../../../src/utils/dependencies.js';
import type { StackMcpServer } from '../../../src/types/index.js';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    warning: jest.fn((text: string) => text),
    meta: jest.fn((text: string) => text),
    error: jest.fn((text: string) => text),
    info: jest.fn((text: string) => text),
  },
}));

describe('dependencies utilities', () => {
  const mockConsoleLog = jest.fn();
  const originalConsoleLog = console.log;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
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
      expect(result[0]).toEqual({
        command: 'python',
        mcpServers: ['python-server'],
        installInstructions: 'Install Python: https://www.python.org/downloads/',
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
      expect(result[0].mcpServers).toEqual(['server1', 'server2', 'server3']);
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
      expect(result[0].mcpServers).toEqual(['Unknown MCP Server']);
    });

    it('should provide correct install instructions for known commands', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(1)); // Command doesn't exist
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChild as any);

      const testCases = [
        { command: 'uvx', expected: 'Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh' },
        {
          command: 'npx',
          expected: 'Install Node.js: https://nodejs.org/ (npx comes with Node.js)',
        },
        { command: 'docker', expected: 'Install Docker: https://docs.docker.com/get-docker/' },
        { command: 'python3', expected: 'Install Python: https://www.python.org/downloads/' },
        { command: 'node', expected: 'Install Node.js: https://nodejs.org/' },
        {
          command: 'unknown-cmd',
          expected: 'Install unknown-cmd (check the MCP server documentation for instructions)',
        },
      ];

      for (const { command, expected } of testCases) {
        const mcpServers: StackMcpServer[] = [
          {
            name: `${command}-server`,
            type: 'stdio',
            command,
          },
        ];

        const result = await checkMcpDependencies(mcpServers);

        expect(result).toHaveLength(1);
        expect(result[0].installInstructions).toBe(expected);
      }
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
          mcpServers: ['python-server', 'ai-server'],
          installInstructions: 'Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh',
        },
        {
          command: 'docker',
          mcpServers: ['container-server'],
          installInstructions: 'Install Docker: https://docs.docker.com/get-docker/',
        },
      ];

      displayMissingDependencies(missingDeps);

      expect(mockConsoleLog).toHaveBeenCalledWith('\n⚠️  Missing Dependencies Detected');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'The following MCP servers may not work due to missing dependencies:\n'
      );

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Command not found: uvx');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Required by: python-server, ai-server');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   To fix: Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh'
      );

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Command not found: docker');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Required by: container-server');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   To fix: Install Docker: https://docs.docker.com/get-docker/'
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'These MCP servers will be installed but may fail to start until dependencies are available.'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "You can still use other parts of the stack that don't require these dependencies.\n"
      );
    });

    it('should handle single missing dependency', () => {
      const missingDeps: MissingDependency[] = [
        {
          command: 'python',
          mcpServers: ['single-server'],
          installInstructions: 'Install Python: https://www.python.org/downloads/',
        },
      ];

      displayMissingDependencies(missingDeps);

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Command not found: python');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Required by: single-server');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   To fix: Install Python: https://www.python.org/downloads/'
      );
    });
  });
});
