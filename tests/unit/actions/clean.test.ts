import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { cleanAction } from '../../../src/actions/clean.js';
import type { CleanOptions } from '../../../src/types/index.js';
import { FsMocks } from '../../mocks/fs-mocks.js';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn(),
  ensureDir: jest.fn(),
  copy: jest.fn(),
  remove: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rmdir: jest.fn(),
  unlink: jest.fn(),
}));

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    info: jest.fn((text: string) => text),
    meta: jest.fn((text: string) => text),
    success: jest.fn((text: string) => text),
    error: jest.fn((text: string) => text),
    warning: jest.fn((text: string) => text),
  },
}));

// Mock paths constant
jest.mock('../../../src/constants/paths.js', () => ({
  CLAUDE_JSON_PATH: '/home/user/.claude.json',
}));

// Console and process mocks
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

describe('cleanAction', () => {
  let mockFs: any;
  let mockColors: any;

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    // Get fresh mock instances
    mockFs = require('fs-extra');
    mockColors = require('../../../src/utils/colors.js').colors;

    // Reset all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;

    // Reset fs mock defaults - config file exists and has projects by default
    mockFs.pathExists.mockImplementation((path: string) => {
      if (path === '/home/user/.claude.json') {
        return Promise.resolve(true); // Config file exists by default
      }
      return Promise.resolve(false); // Project paths don't exist by default (so we get cleanup)
    });
    mockFs.readJson.mockResolvedValue({
      projects: {
        '/default/project': { name: 'default' },
      },
    });
    mockFs.writeJson.mockResolvedValue(undefined);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe('validateClaudeConfig', () => {
    it('should return null when config file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await cleanAction();

      expect(mockFs.pathExists).toHaveBeenCalledWith('/home/user/.claude.json');
      expect(mockConsoleLog).toHaveBeenCalledWith('No ~/.claude.json file found.');
      expect(mockColors.warning).toHaveBeenCalledWith('No ~/.claude.json file found.');
    });

    it('should return null when projects property is missing', async () => {
      mockFs.readJson.mockResolvedValue({});

      await cleanAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'No project configurations found in ~/.claude.json'
      );
      expect(mockColors.info).toHaveBeenCalledWith(
        'No project configurations found in ~/.claude.json'
      );
    });

    it('should return null when projects property is not an object', async () => {
      mockFs.readJson.mockResolvedValue({ projects: 'invalid' });

      await cleanAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'No project configurations found in ~/.claude.json'
      );
      expect(mockColors.info).toHaveBeenCalledWith(
        'No project configurations found in ~/.claude.json'
      );
    });

    it('should return null when projects object is empty', async () => {
      mockFs.readJson.mockResolvedValue({ projects: {} });

      await cleanAction();

      expect(mockConsoleLog).toHaveBeenCalledWith('No projects configured in ~/.claude.json');
      expect(mockColors.info).toHaveBeenCalledWith('No projects configured in ~/.claude.json');
    });
  });

  describe('checkProjectsExistence', () => {
    it('should identify existing and missing projects', async () => {
      const config = {
        projects: {
          '/existing/project1': { name: 'project1' },
          '/missing/project2': { name: 'project2' },
          '/existing/project3': { name: 'project3' },
          '/missing/project4': { name: 'project4' },
        },
      };
      mockFs.readJson.mockResolvedValue(config);

      // Mock path existence - some exist, some don't
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true); // Config file exists
        }
        return Promise.resolve(path.includes('existing'));
      });

      await cleanAction();

      expect(mockFs.pathExists).toHaveBeenCalledTimes(5); // 1 for config file + 4 for projects
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ /existing/project1');
      expect(mockConsoleLog).toHaveBeenCalledWith('✗ /missing/project2');
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ /existing/project3');
      expect(mockConsoleLog).toHaveBeenCalledWith('✗ /missing/project4');

      expect(mockColors.success).toHaveBeenCalledWith('✓ /existing/project1');
      expect(mockColors.error).toHaveBeenCalledWith('✗ /missing/project2');
    });

    it('should handle concurrent path existence checks', async () => {
      const config = {
        projects: {
          '/path1': {},
          '/path2': {},
          '/path3': {},
          '/path4': {},
          '/path5': {},
        },
      };
      mockFs.readJson.mockResolvedValue(config);

      let resolveCount = 0;
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true); // Config file exists
        }
        resolveCount++;
        return Promise.resolve(true);
      });

      await cleanAction();

      expect(mockFs.pathExists).toHaveBeenCalledTimes(6); // 1 for config + 5 for projects
      expect(resolveCount).toBe(5); // Only project paths counted
    });
  });

  describe('calculateFileSavings', () => {
    it('should calculate accurate file size savings', async () => {
      const initialConfig = {
        projects: {
          '/existing/project': { name: 'existing' },
          '/missing/project1': { name: 'missing1' },
          '/missing/project2': { name: 'missing2' },
        },
        otherData: 'preserved',
      };

      mockFs.readJson.mockResolvedValue(initialConfig);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        // Return true only for existing project paths
        return Promise.resolve(path.includes('existing'));
      });

      await cleanAction();

      // Verify writeJson was called with updated config
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/home/user/.claude.json',
        {
          projects: {
            '/existing/project': { name: 'existing' },
          },
          otherData: 'preserved',
        },
        { spaces: 2 }
      );

      // Check that file size information was logged
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('File size:'));
    });
  });

  describe('performCleanup', () => {
    it('should perform actual cleanup when not in dry run mode', async () => {
      const config = {
        projects: {
          '/existing/project': { name: 'existing' },
          '/missing/project': { name: 'missing' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        return Promise.resolve(path.includes('existing'));
      });

      await cleanAction({ dryRun: false });

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/home/user/.claude.json',
        {
          projects: {
            '/existing/project': { name: 'existing' },
          },
        },
        { spaces: 2 }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith('\n✅ Cleanup complete!');
      expect(mockColors.success).toHaveBeenCalledWith('\n✅ Cleanup complete!');
      expect(mockConsoleLog).toHaveBeenCalledWith('Removed 1 project entries');
    });

    it('should skip cleanup in dry run mode', async () => {
      const config = {
        projects: {
          '/existing/project': { name: 'existing' },
          '/missing/project': { name: 'missing' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        return Promise.resolve(path.includes('existing'));
      });

      await cleanAction({ dryRun: true });

      expect(mockFs.writeJson).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('\n🔍 DRY RUN - No changes made');
      expect(mockColors.warning).toHaveBeenCalledWith('\n🔍 DRY RUN - No changes made');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Run without --dry-run to actually remove these entries'
      );
    });

    it('should preserve non-project config properties', async () => {
      const config = {
        projects: {
          '/missing/project': { name: 'missing' },
        },
        globalSettings: { theme: 'dark' },
        userPreferences: { autoUpdate: true },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        // All project paths are missing
        return Promise.resolve(false);
      });

      await cleanAction();

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/home/user/.claude.json',
        {
          projects: {},
          globalSettings: { theme: 'dark' },
          userPreferences: { autoUpdate: true },
        },
        { spaces: 2 }
      );
    });
  });

  describe('happy path scenarios', () => {
    it('should successfully clean missing projects', async () => {
      const config = {
        projects: {
          '/existing/project1': { name: 'project1' },
          '/missing/project2': { name: 'project2' },
          '/existing/project3': { name: 'project3' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        return Promise.resolve(path.includes('existing'));
      });

      await cleanAction();

      // Verify initial info messages
      expect(mockConsoleLog).toHaveBeenCalledWith('🧹 Cleaning up project configurations...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Checking 3 project paths...\n');

      // Verify project existence checks
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ /existing/project1');
      expect(mockConsoleLog).toHaveBeenCalledWith('✗ /missing/project2');
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ /existing/project3');

      // Verify missing projects summary
      expect(mockConsoleLog).toHaveBeenCalledWith('\nFound 1 missing project(s):');
      expect(mockConsoleLog).toHaveBeenCalledWith('  • /missing/project2');

      // Verify cleanup completion
      expect(mockConsoleLog).toHaveBeenCalledWith('\n✅ Cleanup complete!');
      expect(mockConsoleLog).toHaveBeenCalledWith('Removed 1 project entries');
    });

    it('should handle case when all projects exist', async () => {
      const config = {
        projects: {
          '/existing/project1': { name: 'project1' },
          '/existing/project2': { name: 'project2' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockResolvedValue(true);

      await cleanAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '\n✅ All project paths exist - no cleanup needed!'
      );
      expect(mockColors.success).toHaveBeenCalledWith(
        '\n✅ All project paths exist - no cleanup needed!'
      );
      expect(mockFs.writeJson).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle JSON parsing errors', async () => {
      mockFs.pathExists.mockResolvedValue(true); // claude.json exists but is corrupted
      mockFs.readJson.mockRejectedValue(new Error('Invalid JSON'));

      await cleanAction();

      expect(mockConsoleError).toHaveBeenCalledWith('Clean failed:', 'Invalid JSON');
      expect(mockColors.error).toHaveBeenCalledWith('Clean failed:');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle file system write errors', async () => {
      const config = {
        projects: {
          '/missing/project': { name: 'missing' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        // All project paths are missing
        return Promise.resolve(false);
      });
      mockFs.writeJson.mockRejectedValue(new Error('Write permission denied'));

      await cleanAction();

      expect(mockConsoleError).toHaveBeenCalledWith('Clean failed:', 'Write permission denied');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle path existence check errors', async () => {
      const config = {
        projects: {
          '/some/project': { name: 'project' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockRejectedValue(new Error('Permission denied'));

      await cleanAction();

      expect(mockConsoleError).toHaveBeenCalledWith('Clean failed:', 'Permission denied');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error thrown objects', async () => {
      mockFs.readJson.mockRejectedValue('String error');

      await cleanAction();

      expect(mockConsoleError).toHaveBeenCalledWith('Clean failed:', 'String error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle undefined thrown objects', async () => {
      mockFs.readJson.mockRejectedValue(undefined);

      await cleanAction();

      expect(mockConsoleError).toHaveBeenCalledWith('Clean failed:', 'undefined');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('console output and colors', () => {
    it('should use proper colors for different message types', async () => {
      const config = {
        projects: {
          '/existing/project': { name: 'existing' },
          '/missing/project': { name: 'missing' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        return Promise.resolve(path.includes('existing'));
      });

      await cleanAction({ dryRun: true });

      // Verify color usage
      expect(mockColors.info).toHaveBeenCalledWith('🧹 Cleaning up project configurations...');
      expect(mockColors.warning).toHaveBeenCalledWith('DRY RUN - No changes will be made');
      expect(mockColors.meta).toHaveBeenCalledWith('Checking 2 project paths...\n');
      expect(mockColors.success).toHaveBeenCalledWith('✓ /existing/project');
      expect(mockColors.error).toHaveBeenCalledWith('✗ /missing/project');
      expect(mockColors.warning).toHaveBeenCalledWith('\nFound 1 missing project(s):');
      expect(mockColors.meta).toHaveBeenCalledWith('  • /missing/project');
      expect(mockColors.warning).toHaveBeenCalledWith('\n🔍 DRY RUN - No changes made');
      expect(mockColors.meta).toHaveBeenCalledWith(
        'Run without --dry-run to actually remove these entries'
      );
    });

    it('should display project count correctly', async () => {
      const config = {
        projects: {
          '/project1': {},
          '/project2': {},
          '/project3': {},
          '/project4': {},
          '/project5': {},
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockResolvedValue(true);

      await cleanAction();

      expect(mockConsoleLog).toHaveBeenCalledWith('Checking 5 project paths...\n');
      expect(mockColors.meta).toHaveBeenCalledWith('Checking 5 project paths...\n');
    });

    it('should display multiple missing projects correctly', async () => {
      const config = {
        projects: {
          '/missing/project1': { name: 'project1' },
          '/missing/project2': { name: 'project2' },
          '/missing/project3': { name: 'project3' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        // All project paths are missing
        return Promise.resolve(false);
      });

      await cleanAction({ dryRun: true });

      expect(mockConsoleLog).toHaveBeenCalledWith('\nFound 3 missing project(s):');
      expect(mockConsoleLog).toHaveBeenCalledWith('  • /missing/project1');
      expect(mockConsoleLog).toHaveBeenCalledWith('  • /missing/project2');
      expect(mockConsoleLog).toHaveBeenCalledWith('  • /missing/project3');
    });
  });

  describe('options handling', () => {
    it('should handle default empty options', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await cleanAction();

      // Should work with default options (not in dry run mode)
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
    });

    it('should handle undefined options', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await cleanAction(undefined);

      // Should work with undefined options
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
    });

    it('should respect dryRun: false option', async () => {
      const config = {
        projects: {
          '/missing/project': { name: 'missing' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        // All project paths are missing
        return Promise.resolve(false);
      });

      await cleanAction({ dryRun: false });

      expect(mockFs.writeJson).toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
    });
  });

  describe('edge cases', () => {
    it('should handle projects with special characters in paths', async () => {
      const config = {
        projects: {
          '/path with spaces/project': { name: 'spaced' },
          '/path-with-dashes/project': { name: 'dashed' },
          '/path_with_underscores/project': { name: 'underscored' },
          '/path.with.dots/project': { name: 'dotted' },
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        // All project paths are missing
        return Promise.resolve(false);
      });

      await cleanAction();

      expect(mockFs.pathExists).toHaveBeenCalledWith('/path with spaces/project');
      expect(mockFs.pathExists).toHaveBeenCalledWith('/path-with-dashes/project');
      expect(mockFs.pathExists).toHaveBeenCalledWith('/path_with_underscores/project');
      expect(mockFs.pathExists).toHaveBeenCalledWith('/path.with.dots/project');
    });

    it('should handle empty project objects', async () => {
      const config = {
        projects: {
          '/project1': {},
          '/project2': null,
          '/project3': undefined,
        },
      };

      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        // All project paths are missing
        return Promise.resolve(false);
      });

      await cleanAction();

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/home/user/.claude.json',
        { projects: {} },
        { spaces: 2 }
      );
    });

    it('should handle very large project lists efficiently', async () => {
      const projects: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        projects[`/project${i}`] = { name: `project${i}` };
      }

      const config = { projects };
      mockFs.readJson.mockResolvedValue(config);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        // All project paths are missing
        return Promise.resolve(false);
      });

      const startTime = Date.now();
      await cleanAction({ dryRun: true });
      const endTime = Date.now();

      // Should complete reasonably quickly (under 5 seconds even with 100 projects)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(mockFs.pathExists).toHaveBeenCalledTimes(101); // 100 projects + 1 claude.json
      expect(mockConsoleLog).toHaveBeenCalledWith('Checking 100 project paths...\n');
    });
  });

  describe('file size calculation accuracy', () => {
    it('should calculate file sizes with proper precision', async () => {
      const largeConfig = {
        projects: {
          '/missing/project': {
            name: 'project',
            description: 'A'.repeat(1000), // Large description to test KB calculations
            metadata: {
              created: new Date().toISOString(),
              settings: { key: 'value'.repeat(100) },
            },
          },
        },
      };

      mockFs.readJson.mockResolvedValue(largeConfig);
      mockFs.pathExists.mockImplementation((path: string) => {
        // Always return true for the claude.json path
        if (path === '/home/user/.claude.json') {
          return Promise.resolve(true);
        }
        // All project paths are missing
        return Promise.resolve(false);
      });

      await cleanAction();

      // Should log file size information with KB precision
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/File size: \d+(\.\d+)? KB → \d+(\.\d+)? KB \(saved \d+(\.\d+)? KB\)/)
      );
    });
  });
});
