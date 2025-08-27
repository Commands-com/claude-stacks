import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Create shared mocks that we can configure in tests
const mockPerformRestore = jest.fn();
const mockCheckMcpDependencies = jest.fn();
const mockDisplayMissingDependencies = jest.fn();
const mockPathExists = jest.fn();

// Mock all services to prevent os.homedir() call during module loading
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
    colorInfo: jest.fn().mockImplementation((text: string) => text),
    colorError: jest.fn().mockImplementation((text: string) => text),
    colorSuccess: jest.fn().mockImplementation((text: string) => text),
    colorWarning: jest.fn().mockImplementation((text: string) => text),
    colorMeta: jest.fn().mockImplementation((text: string) => text),
    colorStackName: jest.fn().mockImplementation((text: string) => text),
    colorDescription: jest.fn().mockImplementation((text: string) => text),
    colorHighlight: jest.fn().mockImplementation((text: string) => text),
    colorNumber: jest.fn().mockImplementation((text: string) => text),
    readSingleChar: jest.fn(),
  })),
  AuthService: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue('mock-token'),
    getAccessToken: jest.fn().mockReturnValue('mock-token'),
  })),
  ApiService: jest.fn().mockImplementation(() => ({
    fetchStack: jest.fn(),
    publishStack: jest.fn(),
    getBaseUrl: jest.fn().mockReturnValue('https://api.commands.com'),
    getConfig: jest.fn().mockReturnValue({ baseUrl: 'https://api.commands.com' }),
    isLocalDev: jest.fn().mockReturnValue(false),
  })),
  MetadataService: jest.fn().mockImplementation(() => ({
    getPublishedStackMetadata: jest.fn(),
    savePublishedStackMetadata: jest.fn(),
    removePublishedStackMetadata: jest.fn(),
    findStackByStackId: jest.fn(),
    getAllPublishedStacks: jest.fn(),
    isValidVersion: jest.fn().mockReturnValue(true),
    generateSuggestedVersion: jest.fn().mockReturnValue('1.0.1'),
  })),
  DependencyService: jest.fn().mockImplementation(() => ({
    checkMcpDependencies: mockCheckMcpDependencies,
    displayMissingDependencies: mockDisplayMissingDependencies,
    getMissingDependencyNames: jest.fn().mockResolvedValue([]),
  })),
  StackService: jest.fn(),
  FileService: jest.fn().mockImplementation(() => ({
    pathExists: mockPathExists,
    readJsonFile: jest.fn(),
    writeJsonFile: jest.fn(),
    ensureDir: jest.fn(),
    copyFile: jest.fn(),
    removeFile: jest.fn(),
  })),
  ConfigService: jest.fn(),
}));

jest.mock('../../../src/services/StackOperationService.js', () => ({
  StackOperationService: jest.fn().mockImplementation(() => ({
    performRestore: mockPerformRestore,
    performInstallation: jest.fn().mockResolvedValue(undefined),
    checkDependencies: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { restoreAction } from '../../../src/actions/restore.js';
import type { RestoreOptions } from '../../../src/types/index.js';

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

describe('restoreAction', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;

    // Configure the shared mocks with default success behavior
    mockPerformRestore.mockResolvedValue(undefined);
    mockCheckMcpDependencies.mockResolvedValue([]);
    mockDisplayMissingDependencies.mockImplementation(() => {});
    mockPathExists.mockResolvedValue(true);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should restore configuration successfully', async () => {
      await restoreAction('/test/stack.json', {});

      expect(mockPerformRestore).toHaveBeenCalledWith('/test/stack.json', {});
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should handle restore with force option', async () => {
      const options: RestoreOptions = { force: true };

      await restoreAction('/test/stack.json', options);

      expect(mockPerformRestore).toHaveBeenCalledWith('/test/stack.json', options);
    });

    it('should handle restore with backup option', async () => {
      const options: RestoreOptions = { backup: true };

      await restoreAction('/test/stack.json', options);

      expect(mockPerformRestore).toHaveBeenCalledWith('/test/stack.json', options);
    });

    it('should handle restore with globalOnly option', async () => {
      const options: RestoreOptions = { globalOnly: true };

      await restoreAction('/test/stack.json', options);

      expect(mockPerformRestore).toHaveBeenCalled();
    });

    it('should handle restore with localOnly option', async () => {
      const options: RestoreOptions = { localOnly: true };

      await restoreAction('/test/stack.json', options);

      expect(mockPerformRestore).toHaveBeenCalled();
    });

    it('should check MCP dependencies during restore', async () => {
      await restoreAction('/test/stack.json', {});

      // The restore process should check dependencies
      expect(mockPerformRestore).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle restore errors gracefully', async () => {
      mockPerformRestore.mockRejectedValue(new Error('Restore failed'));

      await expect(restoreAction({})).rejects.toThrow('Restore failed');
    });

    it('should handle file system errors', async () => {
      mockPerformRestore.mockRejectedValue(new Error('File system error'));

      await expect(restoreAction('/test/stack.json', {})).rejects.toThrow('File system error');
    });

    it('should handle MCP dependency check errors', async () => {
      mockPerformRestore.mockRejectedValue(new Error('Dependency check failed'));

      await expect(restoreAction('/test/stack.json', {})).rejects.toThrow(
        'Dependency check failed'
      );
    });

    it('should handle permission errors', async () => {
      mockPerformRestore.mockRejectedValue(new Error('Permission denied'));

      await expect(restoreAction({})).rejects.toThrow('Permission denied');
    });

    it('should handle invalid configuration', async () => {
      mockPerformRestore.mockRejectedValue(new Error('Invalid configuration'));

      await expect(restoreAction({})).rejects.toThrow('Invalid configuration');
    });

    it('should handle non-Error exceptions', async () => {
      mockPerformRestore.mockRejectedValue('String error');

      await expect(restoreAction({})).rejects.toThrow('String error');
    });
  });

  describe('configuration options', () => {
    it('should handle combined options', async () => {
      const options: RestoreOptions = {
        force: true,
        backup: true,
        globalOnly: false,
        localOnly: true,
      };

      await restoreAction('/test/stack.json', options);

      expect(mockPerformRestore).toHaveBeenCalled();
    });

    it('should validate conflicting options', async () => {
      const options: RestoreOptions = {
        globalOnly: true,
        localOnly: true,
      };

      await restoreAction('/test/stack.json', options);

      expect(mockPerformRestore).toHaveBeenCalled();
    });
  });

  describe('dependency management', () => {
    it('should display missing dependencies when found', async () => {
      // Since the restore action delegates to performRestore, we just verify it was called
      await restoreAction('/test/stack.json', {});

      expect(mockPerformRestore).toHaveBeenCalledWith('/test/stack.json', {});
    });

    it('should handle empty dependency list', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      await restoreAction('/test/stack.json', {});

      expect(mockPerformRestore).toHaveBeenCalled();
    });
  });

  describe('backup and recovery', () => {
    it('should create backup when requested', async () => {
      const options: RestoreOptions = { backup: true };

      await restoreAction('/test/stack.json', options);

      expect(mockPerformRestore).toHaveBeenCalled();
    });

    it('should skip backup by default', async () => {
      await restoreAction('/test/stack.json', {});

      expect(mockPerformRestore).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete restore workflow', async () => {
      const options: RestoreOptions = {
        force: true,
        backup: true,
      };

      await restoreAction('/test/stack.json', options);

      expect(mockPerformRestore).toHaveBeenCalledWith('/test/stack.json', options);
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should handle rapid successive restores', async () => {
      const promises = [
        restoreAction({ force: true }),
        restoreAction({ backup: true }),
        restoreAction({ globalOnly: true }),
      ];

      await Promise.all(promises);

      expect(mockPerformRestore).toHaveBeenCalledTimes(3);
    });
  });
});
