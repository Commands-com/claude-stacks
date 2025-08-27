import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Mock external dependencies before services
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

// Mock fs-extra
const mockPathExists = jest.fn();
const mockReaddir = jest.fn();
const mockReadJson = jest.fn();
jest.mock('fs-extra', () => ({
  pathExists: mockPathExists,
  readdir: mockReaddir,
  readJson: mockReadJson,
}));

// Mock path module
const mockBasename = jest.fn();
const mockJoin = jest.fn();
jest.mock('path', () => ({
  basename: mockBasename,
  join: mockJoin,
}));

// Mock constants
jest.mock('../../../src/constants/paths.js', () => ({
  STACKS_PATH: '/test/.claude/stacks',
  getStacksPath: jest.fn(() => '/test/.claude/stacks'),
}));

// Mock UI menus
const mockShowLocalStackDetailsAndActions = jest.fn();
jest.mock('../../../src/ui/menus.js', () => ({
  showLocalStackDetailsAndActions: mockShowLocalStackDetailsAndActions,
}));

// Mock services before importing the action
const mockReadSingleChar = jest.fn();
const mockColorNumber = jest.fn();
const mockColorStackName = jest.fn();
const mockColorMeta = jest.fn();
const mockColorInfo = jest.fn();

jest.mock('../../../src/services/index.js', () => ({
  UIService: jest.fn().mockImplementation(() => ({
    info: jest.fn((message: string) => console.log(message)),
    error: jest.fn((message: string) => console.error('Error:', message)),
    success: jest.fn((message: string) => console.log(message)),
    warn: jest.fn((message: string) => console.log(message)),
    warning: jest.fn((message: string) => console.log(message)),
    meta: jest.fn((message: string) => console.log(message)),
    log: jest.fn((message: string) => console.log(message)),
    exit: jest.fn((code: number) => process.exit(code)),
    readSingleChar: mockReadSingleChar,
    colorNumber: mockColorNumber,
    colorStackName: mockColorStackName,
    colorMeta: mockColorMeta,
    colorInfo: mockColorInfo,
  })),
  AuthService: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue('test-access-token'),
    getAccessToken: jest.fn().mockReturnValue('test-access-token'),
  })),
  ConfigService: jest.fn().mockImplementation(() => ({
    readStackConfig: jest.fn(),
    writeStackConfig: jest.fn(),
    getStackFilePath: jest.fn(),
    stackExists: jest.fn().mockResolvedValue(true),
  })),
  ApiService: jest.fn().mockImplementation(() => ({
    getBaseUrl: jest.fn(() => 'https://api.test.com'),
    isLocalDev: jest.fn(() => false),
    makeRequest: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
  MetadataService: jest.fn().mockImplementation(() => ({
    savePublishedStackMetadata: jest.fn(),
    loadPublishedStackMetadata: jest.fn(),
    getMetadataPath: jest.fn(),
    clearMetadata: jest.fn(),
  })),
  FileService: jest.fn().mockImplementation(() => ({
    exists: jest.fn(),
    readJson: jest.fn(),
    writeJson: jest.fn(),
    ensureDir: jest.fn(),
    remove: jest.fn(),
  })),
  StackService: jest.fn().mockImplementation(() => ({
    getStackInfo: jest.fn(),
    validateStack: jest.fn(),
    createStack: jest.fn(),
    updateStack: jest.fn(),
    listStacks: jest.fn(),
    findStack: jest.fn(),
  })),
  StackOperationService: jest.fn().mockImplementation(() => ({
    performRename: jest.fn(),
    performInstall: jest.fn(),
    performExport: jest.fn(),
    performPublish: jest.fn(),
    performDelete: jest.fn(),
    performClean: jest.fn(),
  })),
  DependencyService: jest.fn().mockImplementation(() => ({
    checkDependencies: jest.fn(),
    installDependencies: jest.fn(),
    validateEnvironment: jest.fn(),
  })),
}));

import { listLocalStacks, listAction } from '../../../src/actions/list.js';
import type { DeveloperStack } from '../../../src/types/index.js';

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

describe('list', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;

    // Reset all mock functions explicitly
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
    mockProcessExit.mockReset();
    mockPathExists.mockReset();
    mockReaddir.mockReset();
    mockReadJson.mockReset();
    mockBasename.mockReset();
    mockJoin.mockReset();
    mockShowLocalStackDetailsAndActions.mockReset();
    mockReadSingleChar.mockReset();
    mockColorNumber.mockReset();
    mockColorStackName.mockReset();
    mockColorMeta.mockReset();
    mockColorInfo.mockReset();

    // Default mock implementations
    mockBasename.mockImplementation((pathStr: string) => pathStr.split('/').pop() || '');
    mockJoin.mockImplementation((...args: string[]) => args.join('/'));

    mockPathExists.mockResolvedValue(true);
    mockReaddir.mockResolvedValue([]);
    mockReadJson.mockResolvedValue({});
    mockShowLocalStackDetailsAndActions.mockResolvedValue(undefined);
    mockReadSingleChar.mockResolvedValue('');

    // Color mocks return the text as-is for easier testing
    mockColorNumber.mockImplementation((text: string) => text);
    mockColorStackName.mockImplementation((text: string) => text);
    mockColorMeta.mockImplementation((text: string) => text);
    mockColorInfo.mockImplementation((text: string) => text);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe('listLocalStacks', () => {
    it('should return empty array when stacks directory does not exist', async () => {
      mockPathExists.mockResolvedValue(false);

      const result = await listLocalStacks();

      expect(result).toEqual([]);
      expect(mockPathExists).toHaveBeenCalledWith('/test/.claude/stacks');
      expect(mockReaddir).not.toHaveBeenCalled();
    });

    it('should return empty array when no stack files found', async () => {
      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['README.txt', 'config.yml']);

      const result = await listLocalStacks();

      expect(result).toEqual([]);
      expect(mockReaddir).toHaveBeenCalledWith('/test/.claude/stacks');
    });

    it('should read and parse valid stack files correctly', async () => {
      const mockStack1: DeveloperStack = {
        name: 'test-stack-1',
        description: 'Test Stack 1',
        version: '1.0.0',
        commands: [{ name: 'cmd1', filePath: '/path/cmd1.md', content: 'content1' }],
        agents: [],
        mcpServers: [],
        metadata: { created_at: '2024-01-02T00:00:00Z' },
      };

      const mockStack2: DeveloperStack = {
        name: 'test-stack-2',
        description: 'Test Stack 2',
        version: '2.0.0',
        commands: [],
        agents: [{ name: 'agent1', filePath: '/path/agent1.md', content: 'content1' }],
        mcpServers: [{ name: 'server1', type: 'stdio', command: 'test' }],
        metadata: { created_at: '2024-01-01T00:00:00Z' },
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['stack1.json', 'stack2.json', 'README.md']);
      mockReadJson.mockImplementation((filePath: string) => {
        if (filePath === '/test/.claude/stacks/stack1.json') {
          return Promise.resolve(mockStack1);
        }
        if (filePath === '/test/.claude/stacks/stack2.json') {
          return Promise.resolve(mockStack2);
        }
        return Promise.reject(new Error(`Unknown file: ${filePath}`));
      });

      const result = await listLocalStacks();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...mockStack1,
        filePath: '/test/.claude/stacks/stack1.json',
      });
      expect(result[1]).toEqual({
        ...mockStack2,
        filePath: '/test/.claude/stacks/stack2.json',
      });
      expect(mockReadJson).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid JSON files gracefully by skipping them', async () => {
      const mockStack: DeveloperStack = {
        name: 'valid-stack',
        description: 'Valid Stack',
        version: '1.0.0',
        commands: [],
        agents: [],
        mcpServers: [],
        metadata: { created_at: '2024-01-01T00:00:00Z' },
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['valid.json', 'invalid.json', 'corrupted.json']);
      mockReadJson.mockImplementation((filePath: string) => {
        if (filePath === '/test/.claude/stacks/valid.json') {
          return Promise.resolve(mockStack);
        }
        // Invalid files throw errors
        return Promise.reject(new Error('Invalid JSON'));
      });

      const result = await listLocalStacks();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('valid-stack');
      expect(result[0].filePath).toBe('/test/.claude/stacks/valid.json');
      expect(mockReadJson).toHaveBeenCalledTimes(3);
    });

    it('should sort stacks by creation date with newest first', async () => {
      const oldStack: DeveloperStack = {
        name: 'old-stack',
        description: 'Old Stack',
        metadata: { created_at: '2024-01-01T00:00:00Z' },
      };

      const newStack: DeveloperStack = {
        name: 'new-stack',
        description: 'New Stack',
        metadata: { created_at: '2024-01-03T00:00:00Z' },
      };

      const middleStack: DeveloperStack = {
        name: 'middle-stack',
        description: 'Middle Stack',
        metadata: { created_at: '2024-01-02T00:00:00Z' },
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['old.json', 'new.json', 'middle.json']);
      mockReadJson.mockImplementation((filePath: string) => {
        if (filePath === '/test/.claude/stacks/old.json') return Promise.resolve(oldStack);
        if (filePath === '/test/.claude/stacks/new.json') return Promise.resolve(newStack);
        if (filePath === '/test/.claude/stacks/middle.json') return Promise.resolve(middleStack);
        return Promise.reject(new Error('Unknown file'));
      });

      const result = await listLocalStacks();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('new-stack'); // Newest first
      expect(result[1].name).toBe('middle-stack');
      expect(result[2].name).toBe('old-stack'); // Oldest last
    });

    it('should handle stacks with missing metadata gracefully', async () => {
      const stackWithoutMetadata: DeveloperStack = {
        name: 'no-metadata-stack',
        description: 'Stack without metadata',
      };

      const stackWithMetadata: DeveloperStack = {
        name: 'with-metadata-stack',
        description: 'Stack with metadata',
        metadata: { created_at: '2024-01-01T00:00:00Z' },
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['no-meta.json', 'with-meta.json']);
      mockReadJson.mockImplementation((filePath: string) => {
        if (filePath === '/test/.claude/stacks/no-meta.json')
          return Promise.resolve(stackWithoutMetadata);
        if (filePath === '/test/.claude/stacks/with-meta.json')
          return Promise.resolve(stackWithMetadata);
        return Promise.reject(new Error('Unknown file'));
      });

      const result = await listLocalStacks();

      expect(result).toHaveLength(2);
      // Stack with metadata should be first (newer date beats no date)
      expect(result[0].name).toBe('with-metadata-stack');
      expect(result[1].name).toBe('no-metadata-stack');
    });

    it('should add filePath property to each stack', async () => {
      const mockStack: DeveloperStack = {
        name: 'test-stack',
        description: 'Test Stack',
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['test.json']);
      mockReadJson.mockResolvedValue(mockStack);

      const result = await listLocalStacks();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockStack,
        filePath: '/test/.claude/stacks/test.json',
      });
    });
  });

  describe('browse navigation', () => {
    beforeEach(() => {
      // Mock the browseAction function
      const mockBrowseAction = jest.fn();
      jest.doMock('../../../src/actions/browse.js', () => ({
        browseAction: mockBrowseAction,
      }));
    });

    it('should show browse option in selection prompt', async () => {
      const mockStack: DeveloperStack = {
        name: 'test-stack',
        description: 'Test stack',
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['test.json']);
      mockReadJson.mockResolvedValue(mockStack);
      mockReadSingleChar.mockResolvedValue(''); // Exit

      await listAction();

      expect(mockReadSingleChar).toHaveBeenCalledWith(
        expect.stringContaining('(b)rowse published stacks')
      );
    });

    it('should call browseAction when b is pressed', async () => {
      const { browseAction } = require('../../../src/actions/browse.js');
      const mockStack: DeveloperStack = {
        name: 'test-stack',
        description: 'Test stack',
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['test.json']);
      mockReadJson.mockResolvedValue(mockStack);
      mockReadSingleChar
        .mockResolvedValueOnce('b') // Browse
        .mockResolvedValueOnce(''); // Then exit

      await listAction();

      expect(browseAction).toHaveBeenCalled();
    });

    it('should continue showing list after returning from browse', async () => {
      const { browseAction } = require('../../../src/actions/browse.js');
      const mockStack: DeveloperStack = {
        name: 'test-stack',
        description: 'Test stack',
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['test.json']);
      mockReadJson.mockResolvedValue(mockStack);
      mockReadSingleChar
        .mockResolvedValueOnce('b') // Browse
        .mockResolvedValueOnce(''); // Then exit

      await listAction();

      expect(browseAction).toHaveBeenCalled();
      // Should show list again after returning
      expect(mockConsoleLog).toHaveBeenCalledWith('💾 Local Development Stacks\n');
    });

    it('should handle browse action error gracefully', async () => {
      const { browseAction } = require('../../../src/actions/browse.js');
      browseAction.mockRejectedValue(new Error('Browse failed'));

      const mockStack: DeveloperStack = {
        name: 'test-stack',
        description: 'Test stack',
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['test.json']);
      mockReadJson.mockResolvedValue(mockStack);
      mockReadSingleChar
        .mockResolvedValueOnce('b') // Browse (will fail)
        .mockResolvedValueOnce(''); // Then exit

      // Should handle the error by catching it
      await expect(listAction()).rejects.toThrow('Browse failed');
    });
  });

  describe('listAction', () => {
    it('should handle empty stack list case', async () => {
      mockPathExists.mockResolvedValue(false); // No stacks directory

      await listAction();

      expect(mockConsoleLog).toHaveBeenCalledWith('💾 Local Development Stacks\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('No stacks found in ~/.claude/stacks/');
      expect(mockConsoleLog).toHaveBeenCalledWith('Export your first stack with:');
      expect(mockConsoleLog).toHaveBeenCalledWith('  claude-stacks export');
      expect(mockReadSingleChar).not.toHaveBeenCalled();
    });

    it('should handle empty stacks directory', async () => {
      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue([]); // Empty directory

      await listAction();

      expect(mockConsoleLog).toHaveBeenCalledWith('💾 Local Development Stacks\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('No stacks found in ~/.claude/stacks/');
    });

    it('should handle file system errors', async () => {
      const fsError = new Error('Permission denied reading directory');
      mockPathExists.mockRejectedValue(fsError);

      await expect(listAction()).rejects.toThrow('Permission denied reading directory');
    });

    it('should display stack list with proper formatting', async () => {
      const mockStack1: DeveloperStack = {
        name: 'stack-1',
        description: 'First stack',
        version: '1.0.0',
        commands: [{ name: 'cmd1', filePath: '/path/cmd1.md', content: 'content1' }],
        agents: [],
        mcpServers: [],
        metadata: { created_at: '2024-01-02T00:00:00Z' },
      };

      const mockStack2: DeveloperStack = {
        name: 'stack-2',
        description: 'Second stack',
        version: '2.0.0',
        commands: [],
        agents: [{ name: 'agent1', filePath: '/path/agent1.md', content: 'content1' }],
        mcpServers: [{ name: 'server1', type: 'stdio', command: 'test' }],
        metadata: { created_at: '2024-01-01T00:00:00Z' },
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['stack1.json', 'stack2.json']);
      mockReadJson.mockImplementation((filePath: string) => {
        if (filePath.includes('stack1.json')) return Promise.resolve(mockStack1);
        if (filePath.includes('stack2.json')) return Promise.resolve(mockStack2);
        return Promise.reject(new Error('Unknown file'));
      });
      mockReadSingleChar.mockResolvedValue(''); // User exits

      await listAction();

      expect(mockConsoleLog).toHaveBeenCalledWith('💾 Local Development Stacks\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('Found 2 local stack(s):\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('1. stack-1 (stack1.json) - v1.0.0, 1 items');
      expect(mockConsoleLog).toHaveBeenCalledWith('2. stack-2 (stack2.json) - v2.0.0, 2 items');
    });

    it('should handle valid stack selection and show details', async () => {
      const mockStack: DeveloperStack = {
        name: 'stack-1',
        description: 'First stack',
        version: '1.0.0',
        commands: [{ name: 'cmd1', filePath: '/path/cmd1.md', content: 'content1' }],
        agents: [],
        mcpServers: [],
        metadata: { created_at: '2024-01-02T00:00:00Z' },
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['stack1.json']);
      mockReadJson.mockResolvedValue(mockStack);
      mockReadSingleChar
        .mockResolvedValueOnce('1') // Select first stack
        .mockResolvedValueOnce(''); // Then exit

      await listAction();

      expect(mockShowLocalStackDetailsAndActions).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'stack-1',
          filePath: '/test/.claude/stacks/stack1.json',
        })
      );
    });

    it('should handle invalid stack selection gracefully', async () => {
      const mockStack: DeveloperStack = {
        name: 'stack-1',
        description: 'First stack',
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['stack1.json']);
      mockReadJson.mockResolvedValue(mockStack);
      mockReadSingleChar
        .mockResolvedValueOnce('99') // Invalid selection
        .mockResolvedValueOnce(''); // Then exit

      await listAction();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error:',
        'Invalid selection. Please enter a number between 1 and 1'
      );
      expect(mockShowLocalStackDetailsAndActions).not.toHaveBeenCalled();
    });

    it('should handle non-numeric input gracefully', async () => {
      const mockStack: DeveloperStack = {
        name: 'stack-1',
        description: 'First stack',
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['stack1.json']);
      mockReadJson.mockResolvedValue(mockStack);
      mockReadSingleChar
        .mockResolvedValueOnce('abc') // Non-numeric input
        .mockResolvedValueOnce(''); // Then exit

      await listAction();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error:',
        'Invalid selection. Please enter a number between 1 and 1'
      );
      expect(mockShowLocalStackDetailsAndActions).not.toHaveBeenCalled();
    });

    it('should handle directory with mixed file types', async () => {
      const stack: DeveloperStack = {
        name: 'test-stack',
        description: 'Test stack',
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue([
        'stack.json', // Valid stack file
        'README.md', // Non-JSON file (should be ignored)
        'config.yaml', // Non-JSON file (should be ignored)
        '.hidden.json', // Hidden JSON file (should be processed)
        'backup.json.bak', // Non-JSON file with .json in name (should be ignored)
      ]);
      mockReadJson.mockImplementation((filePath: string) => {
        if (filePath.includes('stack.json')) return Promise.resolve(stack);
        if (filePath.includes('.hidden.json'))
          return Promise.resolve({
            ...stack,
            name: 'hidden-stack',
          });
        return Promise.reject(new Error('Should not be called for non-JSON files'));
      });

      const result = await listLocalStacks();

      expect(result).toHaveLength(2);
      expect(mockReadJson).toHaveBeenCalledTimes(2); // Only for JSON files
    });

    it('should handle stacks with complex component structure', async () => {
      const complexStack: DeveloperStack = {
        name: 'complex-stack',
        description: 'Complex stack with many components',
        version: '3.2.1',
        commands: [
          { name: 'cmd1', filePath: '/path/cmd1.md', content: 'content1' },
          { name: 'cmd2', filePath: '/path/cmd2.md', content: 'content2' },
          { name: 'cmd3', filePath: '/path/cmd3.md', content: 'content3' },
        ],
        agents: [
          { name: 'agent1', filePath: '/path/agent1.md', content: 'content1' },
          { name: 'agent2', filePath: '/path/agent2.md', content: 'content2' },
        ],
        mcpServers: [
          { name: 'server1', type: 'stdio', command: 'cmd1' },
          { name: 'server2', type: 'http', url: 'http://localhost:3000' },
          { name: 'server3', type: 'sse', url: 'http://localhost:3001' },
        ],
      };

      mockPathExists.mockResolvedValue(true);
      mockReaddir.mockResolvedValue(['complex.json']);
      mockReadJson.mockResolvedValue(complexStack);
      mockReadSingleChar.mockResolvedValue('');

      await listAction();

      expect(mockConsoleLog).toHaveBeenCalledWith('Found 1 local stack(s):\n');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '1. complex-stack (complex.json) - v3.2.1, 8 items'
      );
    });
  });
});
