import { exportAction, exportHelpers } from '../../../src/actions/export.js';
import type { ExportOptions } from '../../../src/types/index.js';
import { FsMocks } from '../../mocks/fs-mocks.js';

// Mock fs-extra
jest.mock('fs-extra', () => {
  const { FsMocks } = require('../../mocks/fs-mocks.js');
  return FsMocks.mockFsExtra();
});

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    error: jest.fn().mockImplementation((text: string) => text),
  },
}));

// Mock path constants
jest.mock('../../../src/constants/paths.js', () => ({
  CLAUDE_JSON_PATH: '/home/.claude.json',
  STACKS_PATH: '/home/.claude/stacks',
  getStacksPath: jest.fn(() => '/home/.claude/stacks'),
  getGlobalCommandsDir: jest.fn(() => '/home/.claude/commands'),
  getGlobalAgentsDir: jest.fn(() => '/home/.claude/agents'),
  getGlobalSettingsPath: jest.fn(() => '/home/.claude/settings.json'),
  getLocalCommandsDir: jest.fn(() => '/project/.claude/commands'),
  getLocalAgentsDir: jest.fn(() => '/project/.claude/agents'),
  getLocalSettingsPath: jest.fn(() => '/project/.claude/settings.local.json'),
}));

// Mock metadata utility
jest.mock('../../../src/utils/metadata.js', () => ({
  getPublishedStackMetadata: jest.fn(),
}));

// Mock version utility
jest.mock('../../../src/utils/version.js', () => ({
  generateSuggestedVersion: jest.fn(version => `${version}.1`),
  isValidVersion: jest.fn(version => /^\d+\.\d+\.\d+$/.test(version)),
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  basename: jest.fn(p => p.split('/').pop() || ''),
}));

// Mock process.cwd
const mockCwd = jest.fn(() => '/test/project');
Object.defineProperty(process, 'cwd', { value: mockCwd });

// Mock console methods - these should capture the actual error calls
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('Export Action Error Handling', () => {
  const fs = require('fs-extra');

  beforeAll(() => {
    // Setup is done by module mocks above
  });

  beforeEach(() => {
    // Clear call history
    jest.clearAllMocks();

    // Setup default fs mocks
    fs.pathExists.mockResolvedValue(false);
    fs.ensureDir.mockResolvedValue(undefined);
    fs.writeJson.mockResolvedValue(undefined);
    fs.readdir.mockResolvedValue([]);
    fs.readFile.mockResolvedValue('');
    fs.readJson.mockResolvedValue({});

    mockCwd.mockReturnValue('/test/project');
  });

  afterAll(async () => {
    // Ensure all promises are resolved and clean up
    await global.flushPromises();
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  describe('Error Scenarios', () => {
    it('should handle file system errors gracefully', async () => {
      fs.ensureDir.mockRejectedValue(new Error('Permission denied'));

      await expect(exportAction('test.json', {})).rejects.toThrow('Permission denied');

      expect(mockConsoleError).toHaveBeenCalledWith('Export failed:', 'Permission denied');
    });

    it('should handle writeJson errors', async () => {
      fs.writeJson.mockRejectedValue(new Error('Disk full'));

      await expect(exportAction('test.json', {})).rejects.toThrow('Disk full');

      expect(mockConsoleError).toHaveBeenCalledWith('Export failed:', 'Disk full');
    });

    it('should handle unknown error types', async () => {
      fs.ensureDir.mockRejectedValue('String error');

      await expect(exportAction('test.json', {})).rejects.toThrow('String error');

      expect(mockConsoleError).toHaveBeenCalledWith('Export failed:', 'String error');
    });

    it('should handle validation errors', async () => {
      const { isValidVersion } = require('../../../src/utils/version.js');
      isValidVersion.mockReturnValue(false);

      await expect(exportAction('test.json', { stackVersion: 'invalid' })).rejects.toThrow(
        'Invalid version format'
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Export failed:',
        expect.stringContaining('Invalid version format')
      );
    });

    it('should validate custom version format with specific message', async () => {
      const { isValidVersion } = require('../../../src/utils/version.js');
      isValidVersion.mockReturnValue(false);

      await expect(exportAction('test.json', { stackVersion: 'invalid-version' })).rejects.toThrow(
        'Invalid version format: invalid-version. Expected format: X.Y.Z'
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Export failed:',
        'Invalid version format: invalid-version. Expected format: X.Y.Z'
      );
    });
  });
});
