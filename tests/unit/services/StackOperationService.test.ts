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

jest.mock('fs-extra', () => ({
  pathExists: mockPathExists,
  readJson: mockReadJson,
  writeJson: mockWriteJson,
  remove: mockRemove,
}));

jest.mock('os', () => ({
  tmpdir: jest.fn(() => '/tmp'),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  isAbsolute: jest.fn((p: string) => p.startsWith('/')),
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

    // Re-setup fs-extra mocks to ensure they work correctly
    const fsExtra = require('fs-extra');
    fsExtra.pathExists = mockPathExists;
    fsExtra.readJson = mockReadJson;
    fsExtra.writeJson = mockWriteJson;
    fsExtra.remove = mockRemove;

    // Re-setup path mocks to ensure they work correctly
    const path = require('path');
    path.join = jest.fn((...args) => args.join('/'));
    path.isAbsolute = jest.fn((p: string) => p.startsWith('/'));

    // Re-setup os mocks to ensure they work correctly
    const os = require('os');
    os.tmpdir = jest.fn(() => '/tmp');

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

      expect(mockUI.info).toHaveBeenCalledWith('📝 Restoring 1 global command(s)...');
      expect(mockUI.info).toHaveBeenCalledWith('🤖 Restoring 1 global agent(s)...');
      expect(mockUI.meta).toHaveBeenCalledWith('   Global commands: 1');
      expect(mockUI.meta).toHaveBeenCalledWith('   Global agents: 1');
    });

    it('should handle restore with localOnly option', async () => {
      const options: RestoreOptions = { localOnly: true };

      await stackOperationService.performRestore('test-stack.json', options);

      expect(mockUI.info).toHaveBeenCalledWith('📝 Restoring 1 local command(s)...');
      expect(mockUI.info).toHaveBeenCalledWith('🤖 Restoring 1 local agent(s)...');
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

      expect(mockUI.info).toHaveBeenCalledWith('🔌 Restoring 1 MCP server(s)...');
      expect(mockUI.meta).toHaveBeenCalledWith('   MCP servers: 1');
    });

    it('should restore settings when present', async () => {
      await stackOperationService.performRestore('test-stack.json');

      expect(mockUI.info).toHaveBeenCalledWith('⚙️  Restoring settings...');
    });

    it('should restore Claude.md files when present', async () => {
      await stackOperationService.performRestore('test-stack.json');

      expect(mockUI.info).toHaveBeenCalledWith('📄 Restoring Claude.md files...');
    });
  });

  describe('performInstallation', () => {
    beforeEach(() => {
      mockWriteJson.mockResolvedValue(undefined);
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
      expect(mockUI.info).toHaveBeenCalledWith('📝 Restoring 1 global command(s)...');
      expect(mockUI.info).toHaveBeenCalledWith('📝 Restoring 1 local command(s)...');
      expect(mockUI.info).toHaveBeenCalledWith('🤖 Restoring 1 global agent(s)...');
      expect(mockUI.info).toHaveBeenCalledWith('🤖 Restoring 1 local agent(s)...');
      expect(mockUI.info).toHaveBeenCalledWith('🔌 Restoring 1 MCP server(s)...');
      expect(mockUI.info).toHaveBeenCalledWith('⚙️  Restoring settings...');
      expect(mockUI.info).toHaveBeenCalledWith('📄 Restoring Claude.md files...');
    });
  });
});
