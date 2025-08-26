import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Mock external dependencies before services
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

// Mock fs-extra
const mockPathExists = jest.fn();
const mockReadJson = jest.fn();
const mockWriteJson = jest.fn();
jest.mock('fs-extra', () => ({
  pathExists: mockPathExists,
  readJson: mockReadJson,
  writeJson: mockWriteJson,
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

// Mock node-fetch
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

// Mock process.cwd
const mockCwd = jest.fn();
const originalCwd = process.cwd;

// Mock services before importing the action
const mockAuthenticate = jest.fn();
const mockSavePublishedStackMetadata = jest.fn();
const mockGetBaseUrl = jest.fn();
const mockIsLocalDev = jest.fn();

jest.mock('../../../src/services/index.js', () => ({
  UIService: jest.fn().mockImplementation(() => ({
    info: jest.fn((message: string) => console.log(message)),
    error: jest.fn((message: string) => console.error('Rename failed:', message)),
    success: jest.fn((message: string) => console.log(message)),
    warn: jest.fn((message: string) => console.log(message)),
    meta: jest.fn((message: string) => console.log(message)),
    log: jest.fn((message: string) => console.log(message)),
    exit: jest.fn((code: number) => process.exit(code)),
  })),
  AuthService: jest.fn().mockImplementation(() => ({
    authenticate: mockAuthenticate,
    getAccessToken: jest.fn().mockReturnValue('test-access-token'),
  })),
  ConfigService: jest.fn().mockImplementation(() => ({
    readStackConfig: jest.fn(),
    writeStackConfig: jest.fn(),
    getStackFilePath: jest.fn(
      (dir?: string) => `/test/.claude/stacks/${dir || 'current-project'}-stack.json`
    ),
    stackExists: jest.fn().mockResolvedValue(true),
  })),
  ApiService: jest.fn().mockImplementation(() => ({
    getBaseUrl: mockGetBaseUrl,
    isLocalDev: mockIsLocalDev,
    makeRequest: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
  MetadataService: jest.fn().mockImplementation(() => ({
    savePublishedStackMetadata: mockSavePublishedStackMetadata,
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

import { renameAction } from '../../../src/actions/rename.js';
import type { DeveloperStack } from '../../../src/types/index.js';

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

describe('renameAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;
    process.cwd = mockCwd;

    // Reset all mock functions explicitly
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
    mockProcessExit.mockReset();
    mockPathExists.mockReset();
    mockReadJson.mockReset();
    mockWriteJson.mockReset();
    mockBasename.mockReset();
    mockJoin.mockReset();
    mockFetch.mockReset();
    mockCwd.mockReset();
    mockAuthenticate.mockReset();
    mockSavePublishedStackMetadata.mockReset();
    mockGetBaseUrl.mockReset();
    mockIsLocalDev.mockReset();

    // Default mock implementations
    mockCwd.mockReturnValue('/test/current-project');
    mockBasename.mockImplementation((pathStr: string) => pathStr.split('/').pop() || '');
    mockJoin.mockImplementation((...args: string[]) => args.join('/'));

    mockPathExists.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue('test-access-token');
    mockSavePublishedStackMetadata.mockResolvedValue();
    mockGetBaseUrl.mockReturnValue('https://api.test.com');
    mockIsLocalDev.mockReturnValue(false);
    mockWriteJson.mockResolvedValue();

    // Default stack data
    const mockStack: DeveloperStack = {
      name: 'Test Stack',
      description: 'A test stack for renaming',
      commands: [],
      agents: [],
      metadata: {
        published_stack_id: 'test-org/test-stack',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      version: '1.0.0',
    };
    mockReadJson.mockResolvedValue(mockStack);

    // Default API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        organizationUsername: 'test-org',
        name: 'new-stack-name',
        newUrl: 'https://commands.com/stacks/test-org/new-stack-name',
        oldUrl: 'https://commands.com/stacks/test-org/test-stack',
      }),
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    process.cwd = originalCwd;
  });

  describe('successful rename scenarios', () => {
    it('should rename a published stack successfully', async () => {
      await renameAction('New Stack Name');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🏷️  Renaming stack "Test Stack" → "New Stack Name"'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   Current URL: https://commands.com/stacks/test-org/test-stack'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack renamed successfully!');
      expect(mockConsoleLog).toHaveBeenCalledWith('  New title: New Stack Name');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  New URL: https://commands.com/stacks/test-org/new-stack-name'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  Old URL: https://commands.com/stacks/test-org/test-stack (will redirect)'
      );
    });

    it('should handle same URL case (no redirect message)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          organizationUsername: 'test-org',
          name: 'test-stack',
          newUrl: 'https://commands.com/stacks/test-org/test-stack',
          oldUrl: 'https://commands.com/stacks/test-org/test-stack',
        }),
      });

      await renameAction('Test Stack Updated');

      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack renamed successfully!');
      expect(mockConsoleLog).toHaveBeenCalledWith('  New title: Test Stack Updated');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  New URL: https://commands.com/stacks/test-org/test-stack'
      );

      // Should not show redirect message when URLs are the same
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('will redirect'));
    });

    it('should show local dev message when in local development', async () => {
      mockIsLocalDev.mockReturnValue(true);
      mockGetBaseUrl.mockReturnValue('http://localhost:3000');

      await renameAction('New Name');

      expect(mockConsoleLog).toHaveBeenCalledWith('   Using local backend: http://localhost:3000');
    });
  });

  describe('error scenarios', () => {
    it('should fail when stack file does not exist', async () => {
      mockPathExists.mockResolvedValue(false);

      await expect(renameAction('New Name')).rejects.toThrow(
        "Stack file not found: /test/.claude/stacks/current-project-stack.json. Make sure you're in the correct directory and have exported a stack."
      );
    });

    it('should fail when stack is not published', async () => {
      const unpublishedStack: DeveloperStack = {
        name: 'Test Stack',
        description: 'A test stack',
        commands: [],
        agents: [],
        metadata: {
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        version: '1.0.0',
      };
      mockReadJson.mockResolvedValue(unpublishedStack);

      await expect(renameAction('New Name')).rejects.toThrow(
        'Stack is not published. Use "claude-stacks publish" first.'
      );
    });

    it('should fail when authentication fails', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Authentication failed'));

      await expect(renameAction('New Name')).rejects.toThrow('Authentication failed');
    });

    it('should fail when API request fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Stack not found',
      });

      await expect(renameAction('New Name')).rejects.toThrow('Rename failed: 404 Not Found');
    });

    it('should handle empty new title', async () => {
      await expect(renameAction('')).rejects.toThrow(
        "Required parameter 'newTitle' is missing or empty"
      );
    });
  });
});
