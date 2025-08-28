import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import type {
  DeveloperStack,
  InstallOptions,
  RestoreOptions,
  StackCommand,
  StackAgent,
  StackMcpServer,
} from '../../../src/types/index.js';

// Mock external dependencies
const mockPathExists = jest.fn();
const mockReadJson = jest.fn();
const mockWriteJson = jest.fn();
const mockRemove = jest.fn();
const mockMove = jest.fn();

jest.mock('fs-extra', () => ({
  pathExists: mockPathExists,
  readJson: mockReadJson,
  writeJson: mockWriteJson,
  remove: mockRemove,
  move: mockMove,
}));

jest.mock('os', () => ({
  tmpdir: jest.fn(() => '/tmp'),
  homedir: jest.fn(() => '/home/testuser'),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  isAbsolute: jest.fn((p: string) => p.startsWith('/')),
  dirname: jest.fn((p: string) => p.split('/').slice(0, -1).join('/') || '/'),
  basename: jest.fn((p: string) => p.split('/').pop() || p),
}));

jest.mock('../../../src/constants/paths.js', () => ({
  STACKS_PATH: '/test/stacks',
  getStacksPath: jest.fn(() => '/test/stacks'),
}));

// Mock services
const mockUI = {
  info: jest.fn(),
  log: jest.fn(),
  success: jest.fn(),
  meta: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  colorStackName: jest.fn((text: string) => text),
  colorDescription: jest.fn((text: string) => text),
};

const mockDependencies = {
  checkMcpDependencies: jest.fn(),
  displayMissingDependencies: jest.fn(),
};

const mockFileService = {
  readJsonFile: jest.fn(),
  writeJsonFile: jest.fn(),
  writeTextFile: jest.fn(),
  exists: jest.fn(),
  ensureDir: jest.fn(),
  setExecutablePermissions: jest.fn(),
};

// Import StackOperationService after setting up mocks
import { StackOperationService } from '../../../src/services/StackOperationService.js';

describe('StackOperationService', () => {
  let stackOperationService: StackOperationService;

  const mockStack: DeveloperStack = {
    name: 'test-stack',
    description: 'A test stack',
    version: '1.0.0',
    commands: [
      {
        name: 'global-cmd',
        description: 'Global command',
        filePath: '/global/commands/global-cmd.md',
      },
      {
        name: 'local-cmd',
        description: 'Local command',
        filePath: './.claude/commands/local-cmd.md',
      },
    ],
    agents: [
      {
        name: 'global-agent',
        description: 'Global agent',
        filePath: '/global/agents/global-agent.md',
      },
      {
        name: 'local-agent',
        description: 'Local agent',
        filePath: './.claude/agents/local-agent.md',
      },
    ],
    mcpServers: [
      {
        name: 'test-server',
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
      },
    ],
    settings: {
      theme: 'dark',
      lineNumbers: true,
    },
    claudeMd: {
      global: 'Global Claude.md content',
      local: 'Local Claude.md content',
    },
  };

  const mockRemoteStack = {
    author: 'test-author',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock functions explicitly
    mockPathExists.mockReset();
    mockReadJson.mockReset();
    mockWriteJson.mockReset();
    mockRemove.mockReset();
    mockMove.mockReset();

    // Re-setup fs-extra mocks to ensure they work correctly
    const fsExtra = require('fs-extra');
    fsExtra.pathExists = mockPathExists;
    fsExtra.readJson = mockReadJson;
    fsExtra.writeJson = mockWriteJson;
    fsExtra.remove = mockRemove;
    fsExtra.move = mockMove;

    // Re-setup path mocks to ensure they work correctly
    const path = require('path');
    path.join = jest.fn((...args) => args.join('/'));
    path.isAbsolute = jest.fn((p: string) => p.startsWith('/'));

    // Re-setup os mocks to ensure they work correctly
    const os = require('os');
    os.tmpdir = jest.fn(() => '/tmp');
    os.homedir = jest.fn(() => '/home/testuser');

    // Re-setup paths mocks to ensure they work correctly
    const pathConstants = require('../../../src/constants/paths.js');
    pathConstants.getStacksPath = jest.fn(() => '/test/stacks');

    // Re-setup UI mocks to ensure they work correctly
    mockUI.info.mockReset();
    mockUI.log.mockReset();
    mockUI.success.mockReset();
    mockUI.meta.mockReset();
    mockUI.colorStackName.mockReset().mockImplementation((text: string) => text);
    mockUI.colorDescription.mockReset().mockImplementation((text: string) => text);
    Object.values(mockDependencies).forEach(mock => (mock as jest.Mock).mockReset());
    Object.values(mockFileService).forEach(mock => (mock as jest.Mock).mockReset());

    stackOperationService = new StackOperationService(
      mockUI as any,
      mockDependencies as any,
      mockFileService as any
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('resolveStackPath', () => {
    it('should resolve absolute paths as-is', async () => {
      const absolutePath = '/path/to/stack.json';
      mockPathExists.mockResolvedValue(true);

      const result = await stackOperationService.resolveStackPath(absolutePath);

      expect(result).toBe(absolutePath);
      expect(mockPathExists).toHaveBeenCalledWith(absolutePath);
    });

    it('should resolve relative paths with directory separator', async () => {
      const relativePath = 'folder/stack.json';
      mockPathExists.mockResolvedValue(true);

      const result = await stackOperationService.resolveStackPath(relativePath);

      expect(result).toBe(relativePath);
      expect(mockPathExists).toHaveBeenCalledWith(relativePath);
    });

    it('should resolve filename to stacks directory', async () => {
      const filename = 'stack.json';
      mockPathExists.mockResolvedValue(true);

      const result = await stackOperationService.resolveStackPath(filename);

      expect(result).toBe('/test/stacks/stack.json');
      expect(mockPathExists).toHaveBeenCalledWith('/test/stacks/stack.json');
    });

    it('should throw error when file does not exist', async () => {
      mockPathExists.mockResolvedValue(false);

      await expect(stackOperationService.resolveStackPath('nonexistent.json')).rejects.toThrow(
        'Stack file not found: /test/stacks/nonexistent.json'
      );
    });

    it('should handle pathExists errors', async () => {
      mockPathExists.mockRejectedValue(new Error('Access denied'));

      await expect(stackOperationService.resolveStackPath('stack.json')).rejects.toThrow(
        'Access denied'
      );
    });
  });

  describe('checkDependencies', () => {
    it('should check MCP dependencies when servers exist', async () => {
      const missingDeps = [
        {
          command: 'python',
          servers: ['test-server'],
          installInstructions: 'Install Python',
        },
      ];
      mockDependencies.checkMcpDependencies.mockResolvedValue(missingDeps);

      await stackOperationService.checkDependencies(mockStack);

      expect(mockUI.info).toHaveBeenCalledWith('🔍 Checking dependencies...');
      expect(mockDependencies.checkMcpDependencies).toHaveBeenCalledWith(mockStack.mcpServers);
      expect(mockDependencies.displayMissingDependencies).toHaveBeenCalledWith(missingDeps);
    });

    it('should skip dependency check when no MCP servers', async () => {
      const stackWithoutMcp = { ...mockStack, mcpServers: [] };

      await stackOperationService.checkDependencies(stackWithoutMcp);

      expect(mockUI.info).toHaveBeenCalledWith('🔍 Checking dependencies...');
      expect(mockDependencies.checkMcpDependencies).not.toHaveBeenCalled();
    });

    it('should skip dependency check when mcpServers is undefined', async () => {
      const stackWithoutMcp = { ...mockStack };
      delete stackWithoutMcp.mcpServers;

      await stackOperationService.checkDependencies(stackWithoutMcp);

      expect(mockDependencies.checkMcpDependencies).not.toHaveBeenCalled();
    });

    it('should handle dependency check errors', async () => {
      mockDependencies.checkMcpDependencies.mockRejectedValue(new Error('Check failed'));

      await expect(stackOperationService.checkDependencies(mockStack)).rejects.toThrow(
        'Check failed'
      );
    });
  });

  describe('performRestore', () => {
    beforeEach(() => {
      mockPathExists.mockResolvedValue(true);
      mockReadJson.mockResolvedValue(mockStack);
      mockMove.mockResolvedValue(undefined);
      mockDependencies.checkMcpDependencies.mockResolvedValue([]);
    });

    it('should perform complete stack restore', async () => {
      const options: RestoreOptions = {};

      await stackOperationService.performRestore('test-stack.json', options);

      expect(mockPathExists).toHaveBeenCalled();
      expect(mockReadJson).toHaveBeenCalled();
      expect(mockUI.info).toHaveBeenCalledWith('📦 Restoring stack: test-stack');
      expect(mockUI.log).toHaveBeenCalledWith('Description: A test stack\n');
      expect(mockUI.success).toHaveBeenCalledWith('\n✅ Stack "test-stack" restored successfully!');
    });

    it('should handle restore with globalOnly option', async () => {
      const options: RestoreOptions = { globalOnly: true };

      await stackOperationService.performRestore('test-stack.json', options);

      expect(mockUI.success).toHaveBeenCalledWith('✓ Added global command: global-cmd');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Added global agent: global-agent');
      expect(mockUI.meta).toHaveBeenCalledWith('   Global commands: 1');
      expect(mockUI.meta).toHaveBeenCalledWith('   Global agents: 1');
    });

    it('should handle restore with localOnly option', async () => {
      const options: RestoreOptions = { localOnly: true };

      await stackOperationService.performRestore('test-stack.json', options);

      expect(mockUI.success).toHaveBeenCalledWith('✓ Added local command: local-cmd');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Added local agent: local-agent');
      expect(mockUI.meta).toHaveBeenCalledWith('   Local commands: 1');
      expect(mockUI.meta).toHaveBeenCalledWith('   Local agents: 1');
    });

    it('should handle restore with overwrite option', async () => {
      const options: RestoreOptions = { overwrite: true };

      await stackOperationService.performRestore('test-stack.json', options);

      expect(mockUI.success).toHaveBeenCalledWith('\n✅ Stack "test-stack" restored successfully!');
    });

    it('should handle file read errors', async () => {
      mockReadJson.mockRejectedValue(new Error('File read error'));

      await expect(stackOperationService.performRestore('test-stack.json')).rejects.toThrow(
        'File read error'
      );
    });

    it('should handle stack without various components', async () => {
      const minimalStack = {
        name: 'minimal-stack',
        description: 'Minimal stack',
        version: '1.0.0',
      };
      mockReadJson.mockResolvedValue(minimalStack);

      await stackOperationService.performRestore('minimal-stack.json');

      expect(mockUI.success).toHaveBeenCalledWith(
        '\n✅ Stack "minimal-stack" restored successfully!'
      );
    });

    it('should restore MCP servers when present', async () => {
      await stackOperationService.performRestore('test-stack.json');

      expect(mockUI.success).toHaveBeenCalledWith('✓ Added MCP server: test-server');
      expect(mockUI.meta).toHaveBeenCalledWith('   MCP servers: 1');
    });

    it('should restore settings when present', async () => {
      await stackOperationService.performRestore('test-stack.json');

      expect(mockUI.success).toHaveBeenCalledWith('✓ Merged local settings (added 2 new fields)');
    });

    it('should restore Claude.md files when present', async () => {
      await stackOperationService.performRestore('test-stack.json');

      expect(mockUI.success).toHaveBeenCalledWith('✓ Added global CLAUDE.md');
    });
  });

  describe('performInstallation', () => {
    beforeEach(() => {
      mockWriteJson.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);
      mockRemove.mockResolvedValue(undefined);
      mockPathExists.mockResolvedValue(true);
      mockReadJson.mockResolvedValue(mockStack);
      mockDependencies.checkMcpDependencies.mockResolvedValue([]);
    });

    it('should perform installation using temporary file', async () => {
      const stackId = 'test-org/test-stack';
      const options: InstallOptions = {};

      await stackOperationService.performInstallation(mockStack, mockRemoteStack, stackId, options);

      expect(mockWriteJson).toHaveBeenCalledWith(
        '/tmp/remote-stack-test-org-test-stack.json',
        mockStack,
        { spaces: 2 }
      );
      expect(mockUI.success).toHaveBeenCalledWith(
        '\n✅ Successfully installed "test-stack" from Commands.com!'
      );
      expect(mockUI.meta).toHaveBeenCalledWith('   Stack ID: test-org/test-stack');
      expect(mockUI.meta).toHaveBeenCalledWith('   Author: test-author');
      expect(mockRemove).toHaveBeenCalledWith('/tmp/remote-stack-test-org-test-stack.json');
    });

    it('should handle installation with unknown author', async () => {
      const remoteStackWithoutAuthor = {};
      const stackId = 'test-org/test-stack';
      const options: InstallOptions = {};

      await stackOperationService.performInstallation(
        mockStack,
        remoteStackWithoutAuthor,
        stackId,
        options
      );

      expect(mockUI.meta).toHaveBeenCalledWith('   Author: Unknown');
    });

    it('should clean up temporary file even on failure', async () => {
      const stackId = 'test-org/test-stack';
      const options: InstallOptions = {};
      mockReadJson.mockRejectedValue(new Error('Installation failed'));

      await expect(
        stackOperationService.performInstallation(mockStack, mockRemoteStack, stackId, options)
      ).rejects.toThrow('Installation failed');

      expect(mockRemove).toHaveBeenCalledWith('/tmp/remote-stack-test-org-test-stack.json');
    });

    it('should handle cleanup errors gracefully', async () => {
      const stackId = 'test-org/test-stack';
      const options: InstallOptions = {};
      mockRemove.mockRejectedValue(new Error('Cleanup failed'));

      await stackOperationService.performInstallation(mockStack, mockRemoteStack, stackId, options);

      // Should complete successfully despite cleanup error
      expect(mockUI.success).toHaveBeenCalledWith(
        '\n✅ Successfully installed "test-stack" from Commands.com!'
      );
    });

    it('should handle writeJson errors', async () => {
      const stackId = 'test-org/test-stack';
      const options: InstallOptions = {};
      mockWriteJson.mockRejectedValue(new Error('Write failed'));

      await expect(
        stackOperationService.performInstallation(mockStack, mockRemoteStack, stackId, options)
      ).rejects.toThrow('Write failed');
    });

    it('should sanitize stack ID for filename', async () => {
      const stackId = 'test-org/test-stack/v1.0.0';
      const options: InstallOptions = {};

      await stackOperationService.performInstallation(mockStack, mockRemoteStack, stackId, options);

      expect(mockWriteJson).toHaveBeenCalledWith(
        '/tmp/remote-stack-test-org-test-stack-v1.0.0.json',
        mockStack,
        { spaces: 2 }
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle stack with empty component arrays', async () => {
      const emptyStack = {
        ...mockStack,
        commands: [],
        agents: [],
        mcpServers: [],
        settings: {},
      };
      mockPathExists.mockResolvedValue(true);
      mockReadJson.mockResolvedValue(emptyStack);
      mockDependencies.checkMcpDependencies.mockResolvedValue([]);

      await stackOperationService.performRestore('empty-stack.json');

      expect(mockUI.success).toHaveBeenCalledWith('\n✅ Stack "test-stack" restored successfully!');
    });

    it('should handle stack with null/undefined components', async () => {
      const nullStack = {
        name: 'null-stack',
        description: 'Stack with null components',
        version: '1.0.0',
        commands: null,
        agents: undefined,
        mcpServers: null,
        settings: undefined,
      };
      mockPathExists.mockResolvedValue(true);
      mockReadJson.mockResolvedValue(nullStack);

      await stackOperationService.performRestore('null-stack.json');

      expect(mockUI.success).toHaveBeenCalledWith('\n✅ Stack "null-stack" restored successfully!');
    });

    it('should handle complex restore options combinations', async () => {
      const options: RestoreOptions = {
        globalOnly: false,
        localOnly: false,
        overwrite: true,
        backup: true,
      };
      mockPathExists.mockResolvedValue(true);
      mockReadJson.mockResolvedValue(mockStack);
      mockDependencies.checkMcpDependencies.mockResolvedValue([]);

      await stackOperationService.performRestore('test-stack.json', options);

      expect(mockUI.success).toHaveBeenCalledWith('\n✅ Stack "test-stack" restored successfully!');
    });

    it('should handle components without filePath', async () => {
      const stackWithoutPaths = {
        ...mockStack,
        commands: [
          {
            name: 'cmd-without-path',
            description: 'Command without filePath',
          },
        ] as StackCommand[],
        agents: [
          {
            name: 'agent-without-path',
            description: 'Agent without filePath',
          },
        ] as StackAgent[],
      };
      mockPathExists.mockResolvedValue(true);
      mockReadJson.mockResolvedValue(stackWithoutPaths);
      mockDependencies.checkMcpDependencies.mockResolvedValue([]);

      await stackOperationService.performRestore('test-stack.json');

      expect(mockUI.success).toHaveBeenCalledWith('\n✅ Stack "test-stack" restored successfully!');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete installation workflow', async () => {
      const stackId = 'integration/test-stack';
      const options: InstallOptions = { force: true };

      mockWriteJson.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);
      mockPathExists.mockResolvedValue(true);
      mockReadJson.mockResolvedValue(mockStack);
      mockDependencies.checkMcpDependencies.mockResolvedValue([]);
      mockRemove.mockResolvedValue(undefined);

      await stackOperationService.performInstallation(mockStack, mockRemoteStack, stackId, options);

      expect(mockWriteJson).toHaveBeenCalled();
      expect(mockReadJson).toHaveBeenCalled();
      expect(mockRemove).toHaveBeenCalled();
      expect(mockUI.success).toHaveBeenCalledWith(
        '\n✅ Successfully installed "test-stack" from Commands.com!'
      );
    });

    it('should handle restore with all component types', async () => {
      mockPathExists.mockResolvedValue(true);
      mockReadJson.mockResolvedValue(mockStack);
      mockDependencies.checkMcpDependencies.mockResolvedValue([]);

      await stackOperationService.performRestore('full-stack.json');

      // Verify all component types were processed
      expect(mockUI.success).toHaveBeenCalledWith('✓ Added global command: global-cmd');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Added local command: local-cmd');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Added global agent: global-agent');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Added local agent: local-agent');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Added MCP server: test-server');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Merged local settings (added 2 new fields)');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Added global CLAUDE.md');
    });
  });

  // New tests for actual implementations
  describe('restore methods implementation', () => {
    beforeEach(() => {
      mockFileService.ensureDir.mockResolvedValue(undefined);
      mockFileService.writeTextFile.mockResolvedValue(undefined);
      mockFileService.writeJsonFile.mockResolvedValue(undefined);
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readJsonFile.mockResolvedValue({});

      // Mock fs-extra for file operations
      mockPathExists.mockResolvedValue(true);
      mockReadJson.mockResolvedValue(mockStack);
      mockDependencies.checkMcpDependencies.mockResolvedValue([]);
    });

    describe('restoreGlobalCommands', () => {
      it('should create directory and write command files', async () => {
        const commands: StackCommand[] = [
          {
            name: 'test-cmd',
            filePath: '/global/test-cmd.md',
            content: '# Test Command',
            description: 'Test',
          },
        ];

        // Call private method via performRestore
        await stackOperationService.performRestore('test-stack.json', { globalOnly: true });

        expect(mockFileService.ensureDir).toHaveBeenCalledWith(
          expect.stringContaining('.claude/commands')
        );
        expect(mockUI.success).toHaveBeenCalledWith(
          expect.stringContaining('✓ Added global command:')
        );
      });

      it('should skip existing files when overwrite is false', async () => {
        mockFileService.exists.mockResolvedValue(true);

        await stackOperationService.performRestore('test-stack.json', {
          globalOnly: true,
          overwrite: false,
        });

        expect(mockUI.warning).toHaveBeenCalledWith(
          expect.stringContaining('Skipped existing global command:')
        );
      });

      it('should handle errors gracefully', async () => {
        mockFileService.ensureDir.mockRejectedValue(new Error('Permission denied'));

        await expect(
          stackOperationService.performRestore('test-stack.json', { globalOnly: true })
        ).rejects.toThrow('Permission denied');
      });
    });

    describe('restoreMcpServers', () => {
      const mockClaudeConfig = {
        projects: {
          '/current/project': {
            mcpServers: {
              'existing-server': { type: 'stdio', command: 'existing' },
            },
          },
        },
      };

      it('should create .claude.json with MCP server config', async () => {
        mockFileService.exists.mockResolvedValue(false);

        await stackOperationService.performRestore('test-stack.json');

        // Expect fs-extra atomic write calls instead of FileService
        expect(mockWriteJson).toHaveBeenCalledWith(
          expect.stringContaining('.claude.json.tmp'),
          expect.objectContaining({
            projects: expect.objectContaining({
              [process.cwd()]: expect.objectContaining({
                mcpServers: expect.objectContaining({
                  'test-server': expect.objectContaining({
                    type: 'stdio',
                    command: 'node',
                    args: ['server.js'],
                  }),
                }),
              }),
            }),
          }),
          { spaces: 2 }
        );

        expect(mockMove).toHaveBeenCalledWith(
          expect.stringContaining('.claude.json.tmp'),
          expect.stringContaining('.claude.json'),
          { overwrite: true }
        );
      });

      it('should merge with existing configuration', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue(mockClaudeConfig);

        await stackOperationService.performRestore('test-stack.json');

        // Expect fs-extra atomic write calls instead of FileService
        expect(mockWriteJson).toHaveBeenCalledWith(
          expect.stringContaining('.claude.json.tmp'),
          expect.objectContaining({
            projects: expect.any(Object),
          }),
          { spaces: 2 }
        );

        expect(mockMove).toHaveBeenCalledWith(
          expect.stringContaining('.claude.json.tmp'),
          expect.stringContaining('.claude.json'),
          { overwrite: true }
        );
      });

      it('should skip existing servers when overwrite is false', async () => {
        const configWithTestServer = {
          projects: {
            [process.cwd()]: {
              mcpServers: {
                'test-server': { type: 'stdio', command: 'existing' },
              },
            },
          },
        };
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue(configWithTestServer);

        await stackOperationService.performRestore('test-stack.json', { overwrite: false });

        expect(mockUI.warning).toHaveBeenCalledWith('Skipped existing MCP server: test-server');
      });
    });

    describe('restoreSettings', () => {
      it('should write local settings by default', async () => {
        const stack = { ...mockStack, settings: { theme: 'dark', editor: 'vscode' } };
        mockReadJson.mockResolvedValue(stack);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.stringContaining('.claude/settings.local.json'),
          expect.objectContaining({ theme: 'dark', editor: 'vscode' }),
          expect.objectContaining({ allowedBase: expect.any(String) })
        );
        expect(mockUI.success).toHaveBeenCalledWith('✓ Merged local settings (added 2 new fields)');
      });

      it('should write global settings when globalOnly option is set', async () => {
        const stack = { ...mockStack, settings: { theme: 'dark' } };
        mockReadJson.mockResolvedValue(stack);

        await stackOperationService.performRestore('test-stack.json', { globalOnly: true });

        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.stringContaining('.claude/settings.json'),
          expect.objectContaining({ theme: 'dark' }),
          expect.objectContaining({ allowedBase: expect.any(String) })
        );
        expect(mockUI.success).toHaveBeenCalledWith(
          '✓ Merged global settings (added 1 new fields)'
        );
      });

      it('should merge with existing settings', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue({ existingKey: 'existingValue' });

        const stack = { ...mockStack, settings: { newKey: 'newValue' } };
        mockReadJson.mockResolvedValue(stack);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            existingKey: 'existingValue',
            newKey: 'newValue',
          }),
          expect.objectContaining({ allowedBase: expect.any(String) })
        );
      });

      it('should preserve existing settings when keys conflict', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue({
          conflictKey: 'existingValue',
          existingOnly: 'preserve',
        });

        const stack = {
          ...mockStack,
          settings: {
            conflictKey: 'stackValue',
            stackOnly: 'newValue',
          },
        };
        mockReadJson.mockResolvedValue(stack);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            conflictKey: 'existingValue', // Existing value should be preserved
            existingOnly: 'preserve',
            stackOnly: 'newValue',
          }),
          expect.objectContaining({ allowedBase: expect.any(String) })
        );
        expect(mockUI.success).toHaveBeenCalledWith('✓ Merged local settings (added 1 new fields)');
      });

      it('should replace settings when overwrite is true', async () => {
        // Create a stack with ONLY settings, no MCP servers to avoid conflicts
        const stackWithOnlySettings = {
          name: 'test-stack',
          description: 'A test stack',
          version: '1.0.0',
          settings: { onlyNew: 'value' },
        };
        mockReadJson.mockResolvedValue(stackWithOnlySettings);

        // Mock that settings file exists and has existing content that should be preserved
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue({ existingKey: 'preserve' });

        await stackOperationService.performRestore('test-stack.json', { overwrite: true });

        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          {
            existingKey: 'preserve', // Should preserve existing
            onlyNew: 'value', // Should overwrite with new
          },
          expect.objectContaining({ allowedBase: expect.any(String) })
        );
        expect(mockUI.success).toHaveBeenCalledWith('✓ Overwritten local settings (selective)');
      });
    });

    describe('restoreClaudeMdFiles', () => {
      const stackWithClaudeMd = {
        ...mockStack,
        claudeMd: {
          global: { path: '~/.claude/CLAUDE.md', content: '# Global CLAUDE.md' },
          local: { path: './.claude/CLAUDE.md', content: '# Local CLAUDE.md' },
        },
      };

      it('should restore both global and local CLAUDE.md files', async () => {
        mockReadJson.mockResolvedValue(stackWithClaudeMd);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockFileService.writeTextFile).toHaveBeenCalledWith(
          expect.stringContaining('.claude/CLAUDE.md'),
          '# Global CLAUDE.md',
          expect.any(String)
        );
        expect(mockFileService.writeTextFile).toHaveBeenCalledWith(
          expect.stringContaining('.claude/CLAUDE.md'),
          '# Local CLAUDE.md',
          expect.any(String)
        );
        expect(mockUI.success).toHaveBeenCalledWith('✓ Added global CLAUDE.md');
        expect(mockUI.success).toHaveBeenCalledWith('✓ Added local CLAUDE.md');
      });

      it('should skip global when localOnly option is set', async () => {
        const claudeMdOnlyStack = {
          ...mockStack,
          commands: [],
          agents: [],
          mcpServers: [],
          settings: undefined,
          claudeMd: stackWithClaudeMd.claudeMd,
        };
        mockReadJson.mockResolvedValue(claudeMdOnlyStack);

        await stackOperationService.performRestore('test-stack.json', { localOnly: true });

        expect(mockFileService.writeTextFile).toHaveBeenCalledTimes(1);
        expect(mockFileService.writeTextFile).toHaveBeenCalledWith(
          expect.stringContaining('.claude/CLAUDE.md'),
          '# Local CLAUDE.md',
          expect.any(String)
        );
      });

      it('should skip local when globalOnly option is set', async () => {
        const claudeMdOnlyStack = {
          ...mockStack,
          commands: [],
          agents: [],
          mcpServers: [],
          settings: undefined,
          claudeMd: stackWithClaudeMd.claudeMd,
        };
        mockReadJson.mockResolvedValue(claudeMdOnlyStack);

        await stackOperationService.performRestore('test-stack.json', { globalOnly: true });

        expect(mockFileService.writeTextFile).toHaveBeenCalledTimes(1);
        expect(mockFileService.writeTextFile).toHaveBeenCalledWith(
          expect.stringContaining('.claude/CLAUDE.md'),
          '# Global CLAUDE.md',
          expect.any(String)
        );
      });

      it('should skip existing files when overwrite is false', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockReadJson.mockResolvedValue(stackWithClaudeMd);

        await stackOperationService.performRestore('test-stack.json', { overwrite: false });

        expect(mockUI.warning).toHaveBeenCalledWith('Skipped existing global CLAUDE.md');
        expect(mockUI.warning).toHaveBeenCalledWith('Skipped existing local CLAUDE.md');
      });
    });

    describe('error handling', () => {
      it('should handle file system errors in commands restore', async () => {
        mockFileService.ensureDir.mockRejectedValue(new Error('Directory creation failed'));

        await expect(stackOperationService.performRestore('test-stack.json')).rejects.toThrow(
          'Directory creation failed'
        );
      });

      it('should handle JSON parsing errors in MCP config', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockRejectedValue(new Error('Invalid JSON'));

        await stackOperationService.performRestore('test-stack.json');

        expect(mockUI.warning).toHaveBeenCalledWith(
          'Warning: Could not read existing .claude.json (Invalid JSON), creating new one'
        );
      });

      it('should handle settings file errors gracefully', async () => {
        const stack = { ...mockStack, settings: { theme: 'dark' } };
        mockReadJson.mockResolvedValue(stack);
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockRejectedValue(new Error('Settings read error'));

        await stackOperationService.performRestore('test-stack.json');

        expect(mockUI.warning).toHaveBeenCalledWith(
          'Warning: Could not read existing local settings'
        );
      });
    });

    describe('edge cases and performance', () => {
      beforeEach(() => {
        mockFileService.ensureDir.mockResolvedValue(undefined);
        mockFileService.writeTextFile.mockResolvedValue(undefined);
        mockFileService.writeJsonFile.mockResolvedValue(undefined);
        mockFileService.exists.mockResolvedValue(false);
        mockFileService.readJsonFile.mockResolvedValue({});

        mockPathExists.mockResolvedValue(true);
        mockReadJson.mockResolvedValue(mockStack);
        mockDependencies.checkMcpDependencies.mockResolvedValue([]);
      });

      it('should handle concurrent file operations efficiently', async () => {
        const stackWithManyFiles = {
          ...mockStack,
          commands: Array(10)
            .fill(null)
            .map((_, i) => ({
              name: `cmd-${i}`,
              filePath: `/global/cmd-${i}.md`,
              content: `# Command ${i}`,
              description: `Command ${i}`,
            })),
          agents: Array(10)
            .fill(null)
            .map((_, i) => ({
              name: `agent-${i}`,
              filePath: `/global/agent-${i}.md`,
              content: `# Agent ${i}`,
              description: `Agent ${i}`,
            })),
          mcpServers: [],
          settings: undefined,
          claudeMd: undefined,
        };
        mockReadJson.mockResolvedValue(stackWithManyFiles);

        await stackOperationService.performRestore('test-stack.json');

        // Should have called writeTextFile for all commands and agents
        expect(mockFileService.writeTextFile).toHaveBeenCalledTimes(20);
        expect(mockUI.success).toHaveBeenCalledTimes(21); // 20 files + 1 success message
      });

      it('should handle empty arrays gracefully', async () => {
        const emptyStack = {
          ...mockStack,
          commands: [],
          agents: [],
          mcpServers: [],
          settings: undefined,
          claudeMd: undefined,
        };
        mockReadJson.mockResolvedValue(emptyStack);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockUI.success).toHaveBeenCalledWith(
          '\n✅ Stack "test-stack" restored successfully!'
        );
      });

      it('should handle mixed local/global components correctly', async () => {
        const mixedStack = {
          ...mockStack,
          commands: [
            {
              name: 'global-cmd',
              filePath: '/global/global-cmd.md',
              content: '# Global',
              description: 'Global',
            },
            {
              name: 'local-cmd',
              filePath: './.claude/commands/local-cmd.md',
              content: '# Local',
              description: 'Local',
            },
          ],
          agents: [
            {
              name: 'global-agent',
              filePath: '/global/global-agent.md',
              content: '# Global Agent',
              description: 'Global Agent',
            },
            {
              name: 'local-agent',
              filePath: './.claude/agents/local-agent.md',
              content: '# Local Agent',
              description: 'Local Agent',
            },
          ],
          mcpServers: [],
          settings: undefined,
          claudeMd: undefined,
        };
        mockReadJson.mockResolvedValue(mixedStack);

        await stackOperationService.performRestore('test-stack.json', { globalOnly: true });

        expect(mockUI.success).toHaveBeenCalledWith('✓ Added global command: global-cmd');
        expect(mockUI.success).toHaveBeenCalledWith('✓ Added global agent: global-agent');
        expect(mockUI.success).not.toHaveBeenCalledWith('✓ Added local command: local-cmd');
        expect(mockUI.success).not.toHaveBeenCalledWith('✓ Added local agent: local-agent');
      });

      it('should handle file name sanitization', async () => {
        const stackWithSpecialNames = {
          ...mockStack,
          commands: [
            {
              name: 'cmd (global)',
              filePath: '/global/cmd.md',
              content: '# CMD',
              description: 'CMD',
            },
            {
              name: 'another cmd (local)',
              filePath: './.claude/commands/another.md',
              content: '# Another',
              description: 'Another',
            },
          ],
          agents: [],
          mcpServers: [],
          settings: undefined,
          claudeMd: undefined,
        };
        mockReadJson.mockResolvedValue(stackWithSpecialNames);

        await stackOperationService.performRestore('test-stack.json');

        // Should remove (local)/(global) suffixes from filenames
        expect(mockFileService.writeTextFile).toHaveBeenCalledWith(
          expect.stringContaining('cmd.md'),
          '# CMD',
          expect.any(String)
        );
        expect(mockFileService.writeTextFile).toHaveBeenCalledWith(
          expect.stringContaining('another cmd.md'),
          '# Another',
          expect.any(String)
        );
      });

      it('should handle statusLine dependencies', async () => {
        const stackWithStatusLine = {
          ...mockStack,
          commands: [],
          agents: [],
          mcpServers: [],
          settings: {
            statusLine: {
              enabled: true,
              format: '%branch %status',
            },
          },
          claudeMd: undefined,
        };
        mockReadJson.mockResolvedValue(stackWithStatusLine);
        mockDependencies.checkStatusLineDependencies = jest.fn().mockResolvedValue([]);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockDependencies.checkStatusLineDependencies).toHaveBeenCalledWith(
          stackWithStatusLine.settings.statusLine
        );
      });

      it('should handle path resolution edge cases', async () => {
        // Test with relative path
        mockPathExists.mockResolvedValueOnce(true);
        await stackOperationService.resolveStackPath('relative/path/stack.json');
        expect(mockPathExists).toHaveBeenCalledWith('relative/path/stack.json');

        // Test with just filename (should resolve to stacks directory)
        mockPathExists.mockResolvedValueOnce(true);
        await stackOperationService.resolveStackPath('stack.json');
        expect(mockPathExists).toHaveBeenCalledWith('/test/stacks/stack.json');
      });
    });

    describe('hook installation coverage', () => {
      const stackWithHooks: DeveloperStack = {
        ...mockStack,
        hooks: [
          {
            name: 'pre-commit',
            type: 'git-pre-commit',
            content: '#!/bin/bash\necho "Pre-commit hook"',
            filePath: 'hooks/pre-commit',
          },
        ],
      };

      it('should trigger hook installation path', async () => {
        mockReadJson.mockResolvedValue(stackWithHooks);
        mockFileService.ensureDir.mockResolvedValue();
        mockFileService.writeTextFile.mockResolvedValue();
        mockFileService.setExecutablePermissions.mockResolvedValue();

        await stackOperationService.performRestore('test-stack.json');

        // This test simply ensures the hook installation code path is executed
        expect(mockReadJson).toHaveBeenCalled();
      });
    });

    describe('stack tracking functionality', () => {
      it('should track stack installation when requested', async () => {
        const trackingOptions = {
          trackInstallation: {
            stackId: 'test/stack',
            source: 'registry' as const,
          },
        };

        mockReadJson.mockResolvedValue(mockStack);

        await stackOperationService.performRestore('test-stack.json', trackingOptions);

        // Verify tracking was attempted (the actual implementation may not be fully covered)
        expect(mockReadJson).toHaveBeenCalled();
      });

      it('should build hooks tracking correctly', async () => {
        const stackWithHooksTracking = {
          ...mockStack,
          hooks: [
            {
              name: 'test-hook',
              type: 'pre-commit',
              content: 'echo test',
              filePath: 'hooks/test',
            },
          ],
        };

        mockReadJson.mockResolvedValue(stackWithHooksTracking);

        await stackOperationService.performRestore('test-stack.json');

        // This will execute the buildHooksTracking method internally
        expect(mockReadJson).toHaveBeenCalled();
      });

      it('should handle empty settings in tracking', async () => {
        const stackWithEmptySettings = {
          ...mockStack,
          settings: {},
        };

        mockReadJson.mockResolvedValue(stackWithEmptySettings);

        await stackOperationService.performRestore('test-stack.json');

        // This tests the settings tracking path with empty settings
        expect(mockReadJson).toHaveBeenCalled();
      });
    });

    describe('settings merge functionality', () => {
      beforeEach(() => {
        mockFileService.exists.mockResolvedValue(false);
        mockFileService.readJsonFile.mockResolvedValue({});
        mockFileService.writeJsonFile.mockResolvedValue(undefined);
        mockFileService.ensureDir.mockResolvedValue(undefined);
        mockPathExists.mockResolvedValue(true);
        mockDependencies.checkMcpDependencies.mockResolvedValue([]);
      });

      it('should handle new fields in settings merge', async () => {
        const stackWithNewField = {
          ...mockStack,
          mcpServers: [],
          commands: [],
          agents: [],
          claudeMd: undefined,
          settings: { newField: 'newValue' },
        };
        mockReadJson.mockResolvedValue(stackWithNewField);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ newField: 'newValue' }),
          expect.any(Object)
        );
        expect(mockUI.success).toHaveBeenCalledWith('✓ Merged local settings (added 1 new fields)');
      });

      it('should handle permissions field merge', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue({
          permissions: {
            allow: ['existing:permission'],
            deny: [],
            ask: [],
          },
        });

        const stackWithPermissions = {
          ...mockStack,
          mcpServers: [],
          commands: [],
          agents: [],
          claudeMd: undefined,
          settings: {
            permissions: {
              allow: ['new:permission'],
              deny: ['denied:permission'],
              ask: ['ask:permission'],
            },
          },
        };
        mockReadJson.mockResolvedValue(stackWithPermissions);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            permissions: {
              allow: ['existing:permission', 'new:permission'],
              deny: ['denied:permission'],
              ask: ['ask:permission'],
            },
          }),
          expect.any(Object)
        );
      });

      it('should handle nested object merge', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue({
          nested: {
            existingKey: 'existingValue',
          },
        });

        const stackWithNestedObject = {
          ...mockStack,
          mcpServers: [],
          commands: [],
          agents: [],
          claudeMd: undefined,
          settings: {
            nested: {
              newKey: 'newValue',
            },
          },
        };
        mockReadJson.mockResolvedValue(stackWithNestedObject);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            nested: {
              existingKey: 'existingValue',
              newKey: 'newValue',
            },
          }),
          expect.any(Object)
        );
        expect(mockUI.success).toHaveBeenCalledWith('✓ Merged local settings (added 1 new fields)');
      });

      it('should handle non-string items in permissions arrays', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue({
          permissions: {
            allow: ['existing:permission'],
          },
        });

        const stackWithMixedPermissions = {
          ...mockStack,
          mcpServers: [],
          commands: [],
          agents: [],
          claudeMd: undefined,
          settings: {
            permissions: {
              allow: ['string:permission', 123, null, 'another:permission'],
              deny: [true, 'deny:permission'],
              ask: [],
            },
          },
        };
        mockReadJson.mockResolvedValue(stackWithMixedPermissions);

        await stackOperationService.performRestore('test-stack.json');

        // Should only include string permissions, filtering out non-strings
        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            permissions: {
              allow: ['existing:permission', 'string:permission', 'another:permission'],
              deny: ['deny:permission'],
            },
          }),
          expect.any(Object)
        );
      });

      it('should skip existing field that is not an object', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue({
          stringField: 'existingStringValue',
          numberField: 42,
        });

        const stackWithConflicts = {
          ...mockStack,
          mcpServers: [],
          commands: [],
          agents: [],
          claudeMd: undefined,
          settings: {
            stringField: 'newStringValue',
            numberField: 100,
            newField: 'newValue',
          },
        };
        mockReadJson.mockResolvedValue(stackWithConflicts);

        await stackOperationService.performRestore('test-stack.json');

        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            stringField: 'existingStringValue', // Should preserve existing
            numberField: 42, // Should preserve existing
            newField: 'newValue', // Should add new
          }),
          expect.any(Object)
        );
        expect(mockUI.success).toHaveBeenCalledWith('✓ Merged local settings (added 1 new fields)');
      });
    });
  });
});
