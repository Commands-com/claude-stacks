import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import path from 'path';
import { restoreAction } from '../../../src/actions/restore.js';
import type { DeveloperStack, RestoreOptions } from '../../../src/types/index.js';
import { _TestDataBuilder, TestEnvironment } from '../../utils/test-helpers.js';
import type { FsMocks } from '../../mocks/fs-mocks.js';

// Mock fs-extra
jest.mock('fs-extra', () => {
  const { FsMocks } = require('../../mocks/fs-mocks.js');
  return FsMocks.mockFsExtra();
});

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    stackName: jest.fn().mockImplementation((text: string) => text),
    description: jest.fn().mockImplementation((text: string) => text),
    meta: jest.fn().mockImplementation((text: string) => text),
    success: jest.fn().mockImplementation((text: string) => text),
    error: jest.fn().mockImplementation((text: string) => text),
    warning: jest.fn().mockImplementation((text: string) => text),
    number: jest.fn().mockImplementation((text: string) => text),
  },
}));

// Mock dependencies utility
jest.mock('../../../src/utils/dependencies.js', () => ({
  checkAllDependencies: jest.fn(),
  checkMcpDependencies: jest.fn(),
  displayMissingDependencies: jest.fn(),
}));

// Mock input utility
jest.mock('../../../src/utils/input.js', () => ({
  confirmWithUser: jest.fn(),
}));

// Mock constants
jest.mock('../../../src/constants/paths.js', () => ({
  STACKS_PATH: '/test/.claude/stacks',
  CLAUDE_CONFIG_PATH: '/test/.claude',
  getLocalClaudeDir: jest.fn(() => '/test/project/.claude'),
}));

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

describe('restoreAction', () => {
  let mockFs: ReturnType<typeof FsMocks.mockFsExtra>;
  let testEnv: TestEnvironment;

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;

    // Ensure all mocks are properly reset
    mockProcessExit.mockReset();
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();

    // Re-setup color mocks to ensure they work correctly
    const { colors } = require('../../../src/utils/colors.js');
    colors.info = jest.fn().mockImplementation((text: string) => text);
    colors.meta = jest.fn().mockImplementation((text: string) => text);
    colors.stackName = jest.fn().mockImplementation((text: string) => text);
    colors.description = jest.fn().mockImplementation((text: string) => text);
    colors.error = jest.fn().mockImplementation((text: string) => text);
    colors.success = jest.fn().mockImplementation((text: string) => text);
    colors.warning = jest.fn().mockImplementation((text: string) => text);
    colors.number = jest.fn().mockImplementation((text: string) => text);

    // Re-setup path mocks to ensure they work correctly
    const pathConstants = require('../../../src/constants/paths.js');
    pathConstants.getLocalClaudeDir = jest.fn(() => '/test/project/.claude');

    // Setup fs mocks
    mockFs = require('fs-extra');

    // Default successful mock implementations
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readJson.mockResolvedValue(TestDataBuilder.buildStack());
    mockFs.ensureDir.mockResolvedValue();
    mockFs.writeJson.mockResolvedValue();
    mockFs.copy.mockResolvedValue();
    mockFs.writeFile.mockResolvedValue();
    mockFs.readFile.mockResolvedValue('');

    // Mock dependencies check
    const mockCheckAllDependencies =
      require('../../../src/utils/dependencies.js').checkAllDependencies;
    const mockCheckMcpDependencies =
      require('../../../src/utils/dependencies.js').checkMcpDependencies;
    const mockDisplayMissingDependencies =
      require('../../../src/utils/dependencies.js').displayMissingDependencies;

    mockCheckAllDependencies.mockResolvedValue([]);
    mockCheckMcpDependencies.mockResolvedValue([]);
    mockDisplayMissingDependencies.mockReturnValue();

    // Mock user confirmation
    const mockConfirm = require('../../../src/utils/input.js').confirmWithUser;
    mockConfirm.mockResolvedValue(true);

    testEnv = new TestEnvironment();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    jest.resetAllMocks();
  });

  describe('basic functionality', () => {
    it('should restore a stack with absolute path', async () => {
      const stackPath = '/absolute/path/to/stack.json';
      const testStack = TestDataBuilder.buildStack({
        id: 'test-org/restore-stack',
        name: 'Test Restore Stack',
        description: 'A stack for testing restore functionality',
        commands: [],
        agents: [],
        mcpServers: [],
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction(stackPath, {});

      expect(mockFs.pathExists).toHaveBeenCalledWith(stackPath);
      expect(mockFs.readJson).toHaveBeenCalledWith(stackPath);
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test Restore Stack'));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('A stack for testing restore functionality')
      );
    });

    it('should restore a stack with relative path (filename only)', async () => {
      const stackFilename = 'my-stack.json';
      const expectedPath = path.join('/test/.claude/stacks', stackFilename);
      const testStack = TestDataBuilder.buildStack();

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction(stackFilename, {});

      expect(mockFs.pathExists).toHaveBeenCalledWith(expectedPath);
      expect(mockFs.readJson).toHaveBeenCalledWith(expectedPath);
    });

    it('should handle overwrite mode', async () => {
      const testStack = TestDataBuilder.buildStack();
      const options: RestoreOptions = { overwrite: true };

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', options);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Overwrite'));
    });

    it('should handle add/merge mode by default', async () => {
      const testStack = TestDataBuilder.buildStack();

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', {});

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Add/Merge'));
    });
  });

  describe('component restoration', () => {
    it('should restore stack with global commands', async () => {
      const testStack = TestDataBuilder.buildStack({
        commands: [
          {
            id: 'global-cmd',
            name: 'Global Command',
            description: 'A global command',
            content: 'echo "global"',
            // No filePath means global
          },
        ],
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should restore stack with local commands', async () => {
      const testStack = TestDataBuilder.buildStack({
        commands: [
          {
            id: 'local-cmd',
            name: 'Local Command',
            description: 'A local command',
            content: 'echo "local"',
            filePath: './local-command.sh',
          },
        ],
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should restore stack with global agents', async () => {
      const testStack = TestDataBuilder.buildStack({
        agents: [
          {
            id: 'global-agent',
            name: 'Global Agent',
            description: 'A global agent',
            content: 'agent content',
            // No filePath means global
          },
        ],
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should restore stack with local agents', async () => {
      const testStack = TestDataBuilder.buildStack({
        agents: [
          {
            id: 'local-agent',
            name: 'Local Agent',
            description: 'A local agent',
            content: 'agent content',
            filePath: './local-agent.md',
          },
        ],
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should restore stack with MCP servers', async () => {
      const testStack = TestDataBuilder.buildStack({
        mcpServers: [
          {
            name: 'test-server',
            command: 'node',
            args: ['server.js'],
          },
        ],
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should restore stack with settings', async () => {
      const testStack = TestDataBuilder.buildStack({
        settings: {
          customSetting: 'value',
          anotherSetting: 123,
        },
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should handle stack with mixed component types', async () => {
      const testStack = TestDataBuilder.buildStack({
        commands: [
          {
            id: 'global-cmd',
            name: 'Global Command',
            description: 'Global',
            content: 'global command',
          },
          {
            id: 'local-cmd',
            name: 'Local Command',
            description: 'Local',
            content: 'local command',
            filePath: './local.sh',
          },
        ],
        agents: [
          {
            id: 'global-agent',
            name: 'Global Agent',
            description: 'Global',
            content: 'global agent',
          },
          {
            id: 'local-agent',
            name: 'Local Agent',
            description: 'Local',
            content: 'local agent',
            filePath: './local.md',
          },
        ],
        mcpServers: [
          {
            name: 'server1',
            command: 'node',
            args: ['server1.js'],
          },
          {
            name: 'server2',
            command: 'python',
            args: ['server2.py'],
          },
        ],
        settings: {
          theme: 'dark',
          autoSave: true,
        },
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });
  });

  describe('options handling', () => {
    it('should handle globalOnly option', async () => {
      const testStack = TestDataBuilder.buildStack({
        commands: [
          { id: 'global', name: 'Global', description: 'Global', content: 'global' },
          {
            id: 'local',
            name: 'Local',
            description: 'Local',
            content: 'local',
            filePath: './local.sh',
          },
        ],
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', { globalOnly: true });

      // Should still ensure directories are created
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should handle localOnly option', async () => {
      const testStack = TestDataBuilder.buildStack({
        commands: [
          { id: 'global', name: 'Global', description: 'Global', content: 'global' },
          {
            id: 'local',
            name: 'Local',
            description: 'Local',
            content: 'local',
            filePath: './local.sh',
          },
        ],
      });

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', { localOnly: true });

      // Should still ensure directories are created
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should handle combined options', async () => {
      const testStack = TestDataBuilder.buildStack();

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction('/test/stack.json', {
        overwrite: true,
        globalOnly: true,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Overwrite'));
    });
  });

  describe('error handling', () => {
    it('should handle missing stack file', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await restoreAction('/nonexistent/stack.json', {});

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Restore failed:'),
        expect.stringContaining('Stack file not found')
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid JSON in stack file', async () => {
      mockFs.readJson.mockRejectedValue(new Error('Invalid JSON'));

      await restoreAction('/test/invalid.json', {});

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Restore failed:'),
        expect.stringContaining('Invalid JSON')
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle file system errors during directory creation', async () => {
      const testStack = TestDataBuilder.buildStack();
      mockFs.readJson.mockResolvedValue(testStack);
      mockFs.ensureDir.mockRejectedValue(new Error('Permission denied'));

      await restoreAction('/test/stack.json', {});

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Restore failed:'),
        expect.stringContaining('Permission denied')
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle dependency check failures', async () => {
      const testStack = TestDataBuilder.buildStack({
        mcpServers: [
          {
            name: 'test-server',
            command: 'node',
            args: ['server.js'],
          },
        ],
      });
      mockFs.readJson.mockResolvedValue(testStack);

      // Make the MCP dependency check fail
      const mockCheckMcpDependencies =
        require('../../../src/utils/dependencies.js').checkMcpDependencies;
      mockCheckMcpDependencies.mockRejectedValue(new Error('Dependency not found'));

      await restoreAction('/test/stack.json', {});

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Restore failed:'),
        expect.stringContaining('Dependency not found')
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error exceptions', async () => {
      mockFs.readJson.mockRejectedValue('String error');

      await restoreAction('/test/stack.json', {});

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Restore failed:'),
        'String error'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('path resolution', () => {
    it('should resolve absolute paths as-is', async () => {
      const absolutePath = '/absolute/path/to/stack.json';
      const testStack = TestDataBuilder.buildStack();

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction(absolutePath, {});

      expect(mockFs.pathExists).toHaveBeenCalledWith(absolutePath);
    });

    it('should resolve relative paths with directory', async () => {
      const relativePath = './relative/path/stack.json';
      const testStack = TestDataBuilder.buildStack();

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction(relativePath, {});

      expect(mockFs.pathExists).toHaveBeenCalledWith(relativePath);
    });

    it('should resolve filename-only paths to stacks directory', async () => {
      const filename = 'stack.json';
      const expectedPath = '/test/.claude/stacks/stack.json';
      const testStack = TestDataBuilder.buildStack();

      mockFs.readJson.mockResolvedValue(testStack);

      await restoreAction(filename, {});

      expect(mockFs.pathExists).toHaveBeenCalledWith(expectedPath);
    });

    it('should handle path resolution errors', async () => {
      const invalidPath = 'nonexistent.json';
      mockFs.pathExists.mockResolvedValue(false);

      await restoreAction(invalidPath, {});

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Restore failed:'),
        expect.stringContaining('Stack file not found')
      );
    });
  });

  describe('stack validation', () => {
    it('should handle stack with missing optional properties', async () => {
      const minimalStack = {
        name: 'minimal-stack',
        description: 'Minimal stack for testing',
        version: '1.0.0',
        // Missing commands, agents, mcpServers arrays
      };

      mockFs.readJson.mockResolvedValue(minimalStack);

      await restoreAction('/test/minimal.json', {});

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('minimal-stack'));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Minimal stack for testing')
      );
    });

    it('should handle stack with empty arrays', async () => {
      const emptyStack = TestDataBuilder.buildStack({
        commands: [],
        agents: [],
        mcpServers: [],
      });

      mockFs.readJson.mockResolvedValue(emptyStack);

      await restoreAction('/test/empty.json', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should handle stack with null/undefined arrays', async () => {
      const stackWithNulls = TestDataBuilder.buildStack();
      (stackWithNulls as any).commands = null;
      (stackWithNulls as any).agents = undefined;

      mockFs.readJson.mockResolvedValue(stackWithNulls);

      await restoreAction('/test/nulls.json', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete restoration workflow', async () => {
      const complexStack = TestDataBuilder.buildStack({
        name: 'complex-stack',
        description: 'A complex stack with all features',
        commands: [
          {
            id: 'build',
            name: 'Build Command',
            description: 'Build the project',
            content: 'npm run build',
          },
        ],
        agents: [
          {
            id: 'helper',
            name: 'Helper Agent',
            description: 'Helpful agent',
            content: 'I am helpful',
          },
        ],
        mcpServers: [
          {
            name: 'filesystem',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem'],
          },
        ],
        settings: {
          autoSave: true,
          theme: 'dark',
        },
      });

      mockFs.readJson.mockResolvedValue(complexStack);

      await restoreAction('/test/complex.json', { overwrite: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('complex-stack'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Overwrite'));
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/.claude');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
    });

    it('should handle restoration with permission issues', async () => {
      const testStack = TestDataBuilder.buildStack();
      mockFs.readJson.mockResolvedValue(testStack);

      // Simulate permission error on second ensureDir call
      mockFs.ensureDir
        .mockResolvedValueOnce(undefined) // First call succeeds
        .mockRejectedValueOnce(new Error('EACCES: permission denied'));

      await restoreAction('/test/stack.json', {});

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Restore failed:'),
        expect.stringContaining('permission denied')
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    // Additional error path tests for better coverage
    it('should handle MCP server restoration with claude.json read errors', async () => {
      const stackWithMcpServer = TestDataBuilder.buildStack({
        mcpServers: [
          {
            name: 'test-server',
            type: 'stdio',
            command: 'test-command',
            args: ['--test'],
          },
        ],
      });

      mockFs.readJson.mockImplementation((path: string) => {
        if (path.includes('stack.json')) {
          return Promise.resolve(stackWithMcpServer);
        }
        if (path.includes('.claude.json')) {
          throw new Error('Cannot read claude.json');
        }
        return Promise.resolve({});
      });
      mockFs.pathExists.mockResolvedValue(true);

      await restoreAction('/test/stack.json', {});

      // Should continue despite MCP server error and complete restoration
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test Stack'));
    });
  });
});
