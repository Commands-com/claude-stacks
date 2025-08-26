import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { deleteAction } from '../../../src/actions/delete.js';
import type { PublishedStackMetadata } from '../../../src/utils/metadata.js';

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    warning: jest.fn().mockImplementation((text: string) => text),
    meta: jest.fn().mockImplementation((text: string) => text),
    success: jest.fn().mockImplementation((text: string) => text),
    error: jest.fn().mockImplementation((text: string) => text),
  },
}));

// Mock API utilities
jest.mock('../../../src/utils/api.js', () => ({
  getApiConfig: jest.fn(() => ({ baseUrl: 'https://api.test.com' })),
  isLocalDev: jest.fn(() => false),
}));

// Mock authentication utility
jest.mock('../../../src/utils/auth.js', () => ({
  authenticate: jest.fn(),
}));

// Mock metadata utilities
jest.mock('../../../src/utils/metadata.js', () => ({
  findStackByStackId: jest.fn(),
  removePublishedStackMetadata: jest.fn(),
}));

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

describe('deleteAction', () => {
  let mockFetch: jest.Mock;
  let mockAuthenticate: jest.Mock;
  let mockGetApiConfig: jest.Mock;
  let mockIsLocalDev: jest.Mock;
  let mockFindStackByStackId: jest.Mock;
  let mockRemovePublishedStackMetadata: jest.Mock;
  let mockColors: any;

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
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
    mockProcessExit.mockReset();

    // Re-setup color mocks to ensure they work correctly
    const { colors } = require('../../../src/utils/colors.js');
    colors.warning = jest.fn().mockImplementation((text: string) => text);
    colors.meta = jest.fn().mockImplementation((text: string) => text);
    colors.success = jest.fn().mockImplementation((text: string) => text);
    colors.error = jest.fn().mockImplementation((text: string) => text);
    mockColors = colors;

    // Setup API utility mocks
    mockGetApiConfig = require('../../../src/utils/api.js').getApiConfig;
    mockGetApiConfig.mockReturnValue({ baseUrl: 'https://api.test.com' });

    mockIsLocalDev = require('../../../src/utils/api.js').isLocalDev;
    mockIsLocalDev.mockReturnValue(false);

    // Setup authentication mock
    mockAuthenticate = require('../../../src/utils/auth.js').authenticate;
    mockAuthenticate.mockResolvedValue('mock-access-token');

    // Setup metadata utility mocks
    mockFindStackByStackId = require('../../../src/utils/metadata.js').findStackByStackId;
    mockRemovePublishedStackMetadata =
      require('../../../src/utils/metadata.js').removePublishedStackMetadata;

    // Setup successful fetch response by default
    mockFetch = require('node-fetch') as jest.Mock;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: jest.fn().mockResolvedValue(''),
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('successful deletion workflow', () => {
    it('should delete a stack successfully with metadata cleanup', async () => {
      // Setup metadata for cleanup
      const mockStackMetadata: { path: string; metadata: PublishedStackMetadata } = {
        path: '/test/path',
        metadata: {
          stack_id: 'test-org/test-stack',
          stack_name: 'test-stack',
          last_published_version: '1.0.0',
          last_published_at: '2023-01-01',
        },
      };
      mockFindStackByStackId.mockResolvedValue(mockStackMetadata);
      mockRemovePublishedStackMetadata.mockResolvedValue(undefined);

      await deleteAction('test-org/test-stack');

      // Verify authentication
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith('https://api.test.com/v1/stacks/test-org/test-stack', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer mock-access-token',
          'User-Agent': 'claude-stacks-cli/1.0.0',
        },
      });

      // Verify metadata cleanup
      expect(mockFindStackByStackId).toHaveBeenCalledWith('test-org/test-stack');
      expect(mockRemovePublishedStackMetadata).toHaveBeenCalledWith('/test/path');

      // Verify console output
      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Deleting stack test-org/test-stack...');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Cleared local metadata for /test/path');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack deleted successfully!');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Stack ID: test-org/test-stack');

      // Verify process doesn't exit
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should delete a stack successfully without metadata cleanup', async () => {
      // No metadata found for cleanup
      mockFindStackByStackId.mockResolvedValue(null);

      await deleteAction('test-org/test-stack');

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith('https://api.test.com/v1/stacks/test-org/test-stack', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer mock-access-token',
          'User-Agent': 'claude-stacks-cli/1.0.0',
        },
      });

      // Verify metadata cleanup attempted but none found
      expect(mockFindStackByStackId).toHaveBeenCalledWith('test-org/test-stack');
      expect(mockRemovePublishedStackMetadata).not.toHaveBeenCalled();

      // Verify success message
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack deleted successfully!');
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should show local dev message when in local development mode', async () => {
      mockIsLocalDev.mockReturnValue(true);
      mockGetApiConfig.mockReturnValue({ baseUrl: 'http://localhost:3000' });

      await deleteAction('test-org/test-stack');

      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Deleting stack test-org/test-stack...');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Using local backend: http://localhost:3000');
    });

    it('should handle stack names with special characters', async () => {
      await deleteAction('test-org/my-special-stack-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/test-org/my-special-stack-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('stack ID validation', () => {
    it('should reject stack ID without slash separator', async () => {
      await deleteAction('invalid-stack-id');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: invalid-stack-id'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject stack ID with empty org', async () => {
      await deleteAction('/stack-name');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: /stack-name'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject stack ID with empty name', async () => {
      await deleteAction('org/');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: org/'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject stack ID with only slash', async () => {
      await deleteAction('/');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: /'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject empty stack ID', async () => {
      await deleteAction('');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: '
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('authentication errors', () => {
    it('should handle authentication failure', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Authentication failed'));

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith('Delete failed:', 'Authentication failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle authentication timeout', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Authentication timeout'));

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith('Delete failed:', 'Authentication timeout');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('API deletion errors', () => {
    it('should handle 404 not found error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Stack not found'),
      });

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Failed to delete stack: 404 Not Found\nStack not found'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle 403 forbidden error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue('Insufficient permissions'),
      });

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Failed to delete stack: 403 Forbidden\nInsufficient permissions'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Internal error occurred'),
      });

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Failed to delete stack: 500 Internal Server Error\nInternal error occurred'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle API error without response body', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue(''),
      });

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Failed to delete stack: 400 Bad Request'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle network error during deletion', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith('Delete failed:', 'Network error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle response body parsing error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockRejectedValue(new Error('Parse error')),
      });

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Delete failed:',
        'Failed to delete stack: 400 Bad Request'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('metadata cleanup errors', () => {
    it('should fail deletion if metadata lookup fails', async () => {
      mockFindStackByStackId.mockRejectedValue(new Error('Metadata read error'));

      await deleteAction('test-org/test-stack');

      expect(mockFetch).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith('Delete failed:', 'Metadata read error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail deletion if metadata removal fails', async () => {
      const mockStackMetadata = {
        path: '/test/path',
        metadata: {
          stack_id: 'test-org/test-stack',
          stack_name: 'test-stack',
          last_published_version: '1.0.0',
          last_published_at: '2023-01-01',
        },
      };
      mockFindStackByStackId.mockResolvedValue(mockStackMetadata);
      mockRemovePublishedStackMetadata.mockRejectedValue(new Error('Metadata remove error'));

      await deleteAction('test-org/test-stack');

      expect(mockFetch).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith('Delete failed:', 'Metadata remove error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle non-Error objects thrown as exceptions', async () => {
      mockAuthenticate.mockRejectedValue('String error');

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith('Delete failed:', 'String error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle null error thrown', async () => {
      mockAuthenticate.mockRejectedValue(null);

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith('Delete failed:', 'null');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle undefined error thrown', async () => {
      mockAuthenticate.mockRejectedValue(undefined);

      await deleteAction('test-org/test-stack');

      expect(mockConsoleError).toHaveBeenCalledWith('Delete failed:', 'undefined');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle extremely long stack IDs', async () => {
      const longStackId = `${'a'.repeat(100)}/${'b'.repeat(100)}`;

      await deleteAction(longStackId);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.test.com/v1/stacks/${longStackId}`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should handle stack ID with multiple slashes', async () => {
      await deleteAction('org/category/stack-name');

      // Should treat 'org' as org and 'category' as name (split takes only first two elements)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/org/category',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('API configuration variations', () => {
    it('should use custom API base URL', async () => {
      mockGetApiConfig.mockReturnValue({ baseUrl: 'https://custom-api.example.com' });

      await deleteAction('test-org/test-stack');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-api.example.com/v1/stacks/test-org/test-stack',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should handle API URL with trailing slash', async () => {
      mockGetApiConfig.mockReturnValue({ baseUrl: 'https://api.test.com/' });

      await deleteAction('test-org/test-stack');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com//v1/stacks/test-org/test-stack',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('console output and user experience', () => {
    it('should display proper deletion start message', async () => {
      await deleteAction('test-org/my-stack');

      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Deleting stack test-org/my-stack...');
      expect(mockColors.warning).toHaveBeenCalledWith('🗑️ Deleting stack test-org/my-stack...');
    });

    it('should display proper success message with stack ID', async () => {
      await deleteAction('test-org/my-stack');

      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack deleted successfully!');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Stack ID: test-org/my-stack');
      expect(mockColors.success).toHaveBeenCalledWith('✅ Stack deleted successfully!');
      expect(mockColors.meta).toHaveBeenCalledWith('   Stack ID: test-org/my-stack');
    });

    it('should display metadata cleanup confirmation', async () => {
      const mockStackMetadata = {
        path: '/Users/test/my-stack',
        metadata: {
          stack_id: 'test-org/my-stack',
          stack_name: 'my-stack',
          last_published_version: '1.0.0',
          last_published_at: '2023-01-01',
        },
      };
      mockFindStackByStackId.mockResolvedValue(mockStackMetadata);

      await deleteAction('test-org/my-stack');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   Cleared local metadata for /Users/test/my-stack'
      );
      expect(mockColors.meta).toHaveBeenCalledWith(
        '   Cleared local metadata for /Users/test/my-stack'
      );
    });

    it('should use proper color functions for error messages', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Auth error'));

      await deleteAction('test-org/test-stack');

      expect(mockColors.error).toHaveBeenCalledWith('Delete failed:');
    });
  });
});
