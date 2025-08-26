import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { renameAction } from '../../../src/actions/rename.js';
import type { DeveloperStack } from '../../../src/types/index.js';
import { TestDataBuilder } from '../../utils/test-helpers.js';
import type { FsMocks } from '../../mocks/fs-mocks.js';

// Mock fs-extra
jest.mock('fs-extra', () => {
  const { FsMocks } = require('../../mocks/fs-mocks.js');
  return FsMocks.mockFsExtra();
});

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    info: jest.fn().mockImplementation((text: string) => text),
    meta: jest.fn().mockImplementation((text: string) => text),
    stackName: jest.fn().mockImplementation((text: string) => text),
    description: jest.fn().mockImplementation((text: string) => text),
    error: jest.fn().mockImplementation((text: string) => text),
    success: jest.fn().mockImplementation((text: string) => text),
    warning: jest.fn().mockImplementation((text: string) => text),
    number: jest.fn().mockImplementation((text: string) => text),
  },
}));

// Mock auth utility
jest.mock('../../../src/utils/auth.js', () => ({
  authenticate: jest.fn(),
}));

// Mock API utilities
jest.mock('../../../src/utils/api.js', () => ({
  getApiConfig: jest.fn(() => ({ baseUrl: 'https://api.test.com' })),
  isLocalDev: jest.fn(() => false),
}));

// Mock metadata utility
jest.mock('../../../src/utils/metadata.js', () => ({
  savePublishedStackMetadata: jest.fn(),
}));

// Mock constants
jest.mock('../../../src/constants/paths.js', () => ({
  STACKS_PATH: '/test/.claude/stacks',
}));

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

// Mock path module
jest.mock('path', () => ({
  basename: jest.fn((path: string) => path.split('/').pop() || ''),
  join: jest.fn((...args) => args.join('/')),
}));

// Mock process.cwd
const originalCwd = process.cwd;
const mockCwd = jest.fn(() => '/test/current-project');

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

describe('renameAction', () => {
  let mockFs: ReturnType<typeof FsMocks.mockFsExtra>;
  let mockFetch: jest.Mock;
  let mockAuthenticate: jest.Mock;
  let mockSavePublishedStackMetadata: jest.Mock;
  let mockGetApiConfig: jest.Mock;
  let mockIsLocalDev: jest.Mock;

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;
    process.cwd = mockCwd;

    // Ensure all mocks are properly reset
    mockProcessExit.mockReset();
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
    mockCwd.mockReturnValue('/test/current-project');

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

    // Re-setup path mocks properly
    const pathModule = require('path');
    pathModule.basename.mockImplementation((pathStr: string) => pathStr.split('/').pop() || '');
    pathModule.join.mockImplementation((...args: string[]) => args.join('/'));

    // Setup fs mocks
    mockFs = require('fs-extra');
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readJson.mockResolvedValue(TestDataBuilder.buildStack());
    mockFs.writeJson.mockResolvedValue();

    // Setup other mocked modules
    mockFetch = require('node-fetch') as jest.Mock;
    mockAuthenticate = require('../../../src/utils/auth.js').authenticate;
    mockSavePublishedStackMetadata =
      require('../../../src/utils/metadata.js').savePublishedStackMetadata;
    mockGetApiConfig = require('../../../src/utils/api.js').getApiConfig;
    mockIsLocalDev = require('../../../src/utils/api.js').isLocalDev;

    // Default successful mock implementations
    mockAuthenticate.mockResolvedValue('test-access-token');
    mockSavePublishedStackMetadata.mockResolvedValue();
    mockGetApiConfig.mockReturnValue({ baseUrl: 'https://api.test.com' });
    mockIsLocalDev.mockReturnValue(false);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        organizationUsername: 'test-org',
        name: 'new-stack-name',
        newUrl: 'https://commands.com/stacks/test-org/new-stack-name',
        oldUrl: 'https://commands.com/stacks/test-org/old-stack-name',
      }),
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    process.cwd = originalCwd;
    jest.resetAllMocks();
  });

  describe('successful rename scenarios', () => {
    it('should rename a published stack successfully', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        id: 'test-org/old-stack-name',
        name: 'Old Stack Name',
        description: 'A test stack for renaming',
        metadata: {
          published_stack_id: 'test-org/old-stack-name',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      await renameAction('New Stack Name');

      // Verify stack file loading
      expect(mockFs.pathExists).toHaveBeenCalledWith(
        '/test/.claude/stacks/current-project-stack.json'
      );
      expect(mockFs.readJson).toHaveBeenCalledWith(
        '/test/.claude/stacks/current-project-stack.json'
      );

      // Verify authentication
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/test-org/old-stack-name/rename',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-access-token',
            'User-Agent': 'claude-stacks-cli/1.0.0',
          },
          body: JSON.stringify({ title: 'New Stack Name' }),
        }
      );

      // Verify stack file update
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/.claude/stacks/current-project-stack.json',
        expect.objectContaining({
          name: 'New Stack Name',
          metadata: expect.objectContaining({
            published_stack_id: 'test-org/new-stack-name',
            updated_at: expect.any(String),
          }),
        }),
        { spaces: 2 }
      );

      // Verify metadata update
      expect(mockSavePublishedStackMetadata).toHaveBeenCalledWith('/test/current-project', {
        stack_id: 'test-org/new-stack-name',
        stack_name: 'New Stack Name',
        last_published_version: '1.0.0',
        last_published_at: expect.any(String),
      });

      // Verify console output
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🏷️  Renaming stack "Old Stack Name" → "New Stack Name"'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   Current URL: https://commands.com/stacks/test-org/old-stack-name'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack renamed successfully!');
      expect(mockConsoleLog).toHaveBeenCalledWith('  New title: New Stack Name');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  New URL: https://commands.com/stacks/test-org/new-stack-name'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  Old URL: https://commands.com/stacks/test-org/old-stack-name (will redirect)'
      );
    });

    it('should handle same URL case (no redirect message)', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        id: 'test-org/test-stack',
        name: 'Test Stack',
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      // Mock API response with same URL
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
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);
      mockIsLocalDev.mockReturnValue(true);
      mockGetApiConfig.mockReturnValue({ baseUrl: 'http://localhost:3000' });

      await renameAction('New Name');

      expect(mockConsoleLog).toHaveBeenCalledWith('   Using local backend: http://localhost:3000');
    });

    it('should handle stack without version (default to 1.0.0)', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });
      delete publishedStack.version; // Remove version field

      mockFs.readJson.mockResolvedValue(publishedStack);

      await renameAction('New Name');

      expect(mockSavePublishedStackMetadata).toHaveBeenCalledWith(
        '/test/current-project',
        expect.objectContaining({
          last_published_version: '1.0.0',
        })
      );
    });
  });

  describe('error scenarios', () => {
    it('should fail when stack file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Rename failed:',
        "Stack file not found: /test/.claude/stacks/current-project-stack.json. Make sure you're in the correct directory and have exported a stack."
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail when stack is not published', async () => {
      const unpublishedStack = TestDataBuilder.buildStack({
        metadata: {
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          // No published_stack_id
        },
      });

      mockFs.readJson.mockResolvedValue(unpublishedStack);

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Rename failed:',
        'Stack is not published. Use "claude-stacks publish" first.'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail when stack has invalid published_stack_id format', async () => {
      const invalidStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'invalid-format',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(invalidStack);

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Rename failed:',
        'Invalid published stack ID format. Expected "org/name".'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail when authentication fails', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);
      mockAuthenticate.mockRejectedValue(new Error('Authentication failed'));

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith('Rename failed:', 'Authentication failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail when API request fails with status error', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Stack not found',
      });

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Rename failed:',
        'Rename failed: 404 Not Found\nStack not found'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail when API request fails without response body', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => '',
      });

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Rename failed:',
        'Rename failed: 500 Internal Server Error'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail when API response format is invalid', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Rename failed:',
        'Invalid API response format'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail when file operations fail', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);
      mockFs.writeJson.mockRejectedValue(new Error('Permission denied'));

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith('Rename failed:', 'Permission denied');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail when metadata save fails', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);
      mockSavePublishedStackMetadata.mockRejectedValue(new Error('Metadata save failed'));

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith('Rename failed:', 'Metadata save failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error thrown values', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);
      mockAuthenticate.mockRejectedValue('String error');

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith('Rename failed:', 'String error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('API response handling', () => {
    it('should handle API response with missing fields (use defaults)', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      // API response with some missing fields
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          organizationUsername: 'test-org',
          // Missing name, newUrl, oldUrl
        }),
      });

      await renameAction('New Name');

      // Should still work with default empty strings
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/.claude/stacks/current-project-stack.json',
        expect.objectContaining({
          metadata: expect.objectContaining({
            published_stack_id: 'test-org/',
          }),
        }),
        { spaces: 2 }
      );

      expect(mockSavePublishedStackMetadata).toHaveBeenCalledWith(
        '/test/current-project',
        expect.objectContaining({
          stack_id: 'test-org/',
        })
      );
    });

    it('should handle fetch network error', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);
      mockFetch.mockRejectedValue(new Error('Network error'));

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith('Rename failed:', 'Network error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle JSON parsing error in error response', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Rename failed:',
        'Rename failed: 400 Bad Request'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('file path handling', () => {
    it('should use correct stack file path based on current directory', async () => {
      mockCwd.mockReturnValue('/different/project/path');

      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      await renameAction('New Name');

      expect(mockFs.pathExists).toHaveBeenCalledWith('/test/.claude/stacks/path-stack.json');
      expect(mockFs.readJson).toHaveBeenCalledWith('/test/.claude/stacks/path-stack.json');
      expect(mockSavePublishedStackMetadata).toHaveBeenCalledWith(
        '/different/project/path',
        expect.any(Object)
      );
    });

    it('should handle empty directory name', async () => {
      mockCwd.mockReturnValue('/');

      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      await renameAction('New Name');

      expect(mockFs.pathExists).toHaveBeenCalledWith('/test/.claude/stacks/-stack.json');
    });
  });

  describe('edge cases', () => {
    it('should handle stack without metadata', async () => {
      const stackWithoutMetadata = TestDataBuilder.buildStack();
      delete stackWithoutMetadata.metadata;

      mockFs.readJson.mockResolvedValue(stackWithoutMetadata);

      await renameAction('New Name');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Rename failed:',
        'Stack is not published. Use "claude-stacks publish" first.'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle empty new title', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      await renameAction('');

      // Should still make the API call with empty title
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/test-org/test-stack/rename',
        expect.objectContaining({
          body: JSON.stringify({ title: '' }),
        })
      );
    });

    it('should handle special characters in new title', async () => {
      const publishedStack = TestDataBuilder.buildStack({
        metadata: {
          published_stack_id: 'test-org/test-stack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      mockFs.readJson.mockResolvedValue(publishedStack);

      const specialTitle = 'Test Stack with "quotes" & special chars! 🚀';
      await renameAction(specialTitle);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/test-org/test-stack/rename',
        expect.objectContaining({
          body: JSON.stringify({ title: specialTitle }),
        })
      );

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/.claude/stacks/current-project-stack.json',
        expect.objectContaining({
          name: specialTitle,
        }),
        { spaces: 2 }
      );
    });
  });
});
