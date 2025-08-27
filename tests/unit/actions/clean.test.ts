import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Create shared mocks that we can configure in tests
const mockPathExists = jest.fn();
const mockReadJson = jest.fn();
const mockWriteJson = jest.fn();

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
  AuthService: jest.fn().mockImplementation(() => ({})),
  ApiService: jest.fn().mockImplementation(() => ({})),
  MetadataService: jest.fn().mockImplementation(() => ({})),
  DependencyService: jest.fn().mockImplementation(() => ({})),
  StackService: jest.fn(),
  FileService: jest.fn(),
  ConfigService: jest.fn(),
}));

jest.mock('../../../src/services/StackOperationService.js', () => ({
  StackOperationService: jest.fn().mockImplementation(() => ({})),
}));

// Mock fs-extra to use our shared mocks
jest.mock('fs-extra', () => ({
  pathExists: mockPathExists,
  readJson: mockReadJson,
  writeJson: mockWriteJson,
  ensureDir: jest.fn(),
  copy: jest.fn(),
  remove: jest.fn(),
}));

import { cleanAction } from '../../../src/actions/clean.js';
import type { CleanOptions } from '../../../src/types/index.js';

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

describe('cleanAction', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;

    // Setup default mock behaviors
    mockPathExists.mockImplementation((path: string) => {
      // Claude config exists by default
      if (path.includes('.claude.json')) {
        return Promise.resolve(true);
      }
      // Project paths exist by default
      return Promise.resolve(true);
    });

    mockReadJson.mockResolvedValue({
      projects: {
        '/valid/project1': {},
        '/valid/project2': {},
      },
    });

    mockWriteJson.mockResolvedValue(undefined);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should clean up orphaned project configurations', async () => {
      // Make one project missing
      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.claude.json')) {
          return Promise.resolve(true);
        }
        if (path === '/valid/project1') {
          return Promise.resolve(false); // This project is missing
        }
        return Promise.resolve(true);
      });

      await cleanAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('🧹 Cleaning up project configurations...');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 missing project')
      );
      expect(mockWriteJson).toHaveBeenCalled();
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should handle no orphaned configurations', async () => {
      // All projects exist
      mockPathExists.mockResolvedValue(true);

      await cleanAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('🧹 Cleaning up project configurations...');
      expect(mockWriteJson).not.toHaveBeenCalled();
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should handle dry run mode', async () => {
      // Make one project missing
      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.claude.json')) {
          return Promise.resolve(true);
        }
        if (path === '/valid/project1') {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });

      const options: CleanOptions = { dryRun: true };

      await cleanAction(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('DRY RUN - No changes will be made');
      expect(mockWriteJson).not.toHaveBeenCalled();
    });
  });

  describe('configuration validation', () => {
    it('should handle missing claude.json file', async () => {
      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.claude.json')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });

      await cleanAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('No ~/.claude.json file found.');
      expect(mockWriteJson).not.toHaveBeenCalled();
    });

    it('should handle claude.json without projects', async () => {
      mockReadJson.mockResolvedValue({});

      await cleanAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'No project configurations found in ~/.claude.json'
      );
      expect(mockWriteJson).not.toHaveBeenCalled();
    });

    it('should handle empty projects object', async () => {
      mockReadJson.mockResolvedValue({ projects: {} });

      await cleanAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('No projects configured in ~/.claude.json');
      expect(mockWriteJson).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle file read errors', async () => {
      mockReadJson.mockRejectedValue(new Error('Permission denied'));

      await expect(cleanAction({})).rejects.toThrow('Permission denied');
    });

    it('should handle file write errors', async () => {
      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.claude.json')) {
          return Promise.resolve(true);
        }
        if (path === '/valid/project1') {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });

      mockWriteJson.mockRejectedValue(new Error('Write permission denied'));

      await expect(cleanAction({})).rejects.toThrow('Write permission denied');
    });

    it('should handle path existence check errors', async () => {
      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.claude.json')) {
          return Promise.resolve(true);
        }
        throw new Error('Access denied');
      });

      await expect(cleanAction({})).rejects.toThrow('Access denied');
    });
  });

  describe('cleanup operations', () => {
    it('should remove multiple orphaned projects', async () => {
      mockReadJson.mockResolvedValue({
        projects: {
          '/valid/project1': {},
          '/missing/project1': {},
          '/missing/project2': {},
          '/valid/project2': {},
        },
      });

      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.claude.json')) {
          return Promise.resolve(true);
        }
        // Only valid projects exist
        return Promise.resolve(path.startsWith('/valid/'));
      });

      await cleanAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 missing project')
      );
      expect(mockWriteJson).toHaveBeenCalledWith(
        expect.any(String),
        {
          projects: {
            '/valid/project1': {},
            '/valid/project2': {},
          },
        },
        { spaces: 2 }
      );
    });

    it('should preserve non-project configuration', async () => {
      mockReadJson.mockResolvedValue({
        projects: {
          '/missing/project': {},
        },
        otherConfig: 'preserved',
        globalSettings: { theme: 'dark' },
      });

      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.claude.json')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false); // Project is missing
      });

      await cleanAction({});

      expect(mockWriteJson).toHaveBeenCalledWith(
        expect.any(String),
        {
          projects: {},
          otherConfig: 'preserved',
          globalSettings: { theme: 'dark' },
        },
        { spaces: 2 }
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete cleanup workflow', async () => {
      mockReadJson.mockResolvedValue({
        projects: {
          '/valid/project1': { setting: 'value1' },
          '/missing/project1': { setting: 'value2' },
          '/missing/project2': { setting: 'value3' },
          '/valid/project2': { setting: 'value4' },
        },
        globalConfig: 'preserved',
      });

      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.claude.json')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(path.startsWith('/valid/'));
      });

      await cleanAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('🧹 Cleaning up project configurations...');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 missing project')
      );
      expect(mockWriteJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          projects: {
            '/valid/project1': { setting: 'value1' },
            '/valid/project2': { setting: 'value4' },
          },
          globalConfig: 'preserved',
        }),
        { spaces: 2 }
      );
    });

    it('should handle mixed dry run and actual execution', async () => {
      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.claude.json')) {
          return Promise.resolve(true);
        }
        if (path === '/valid/project1') {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });

      // First run in dry mode
      await cleanAction({ dryRun: true });
      expect(mockWriteJson).not.toHaveBeenCalled();

      // Then actual cleanup
      await cleanAction({});
      expect(mockWriteJson).toHaveBeenCalled();
    });
  });
});
