import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Create shared mocks that we can configure in tests
const mockAuthenticate = jest.fn();
const mockGetBaseUrl = jest.fn();
const mockIsLocalDev = jest.fn();
const mockFindStackByStackId = jest.fn();
const mockRemovePublishedStackMetadata = jest.fn();

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
    authenticate: mockAuthenticate,
    getAccessToken: jest.fn().mockReturnValue('mock-token'),
  })),
  ApiService: jest.fn().mockImplementation(() => ({
    fetchStack: jest.fn(),
    publishStack: jest.fn(),
    getBaseUrl: mockGetBaseUrl,
    getConfig: jest.fn().mockReturnValue({ baseUrl: 'https://api.commands.com' }),
    isLocalDev: mockIsLocalDev,
  })),
  MetadataService: jest.fn().mockImplementation(() => ({
    getPublishedStackMetadata: jest.fn(),
    savePublishedStackMetadata: jest.fn(),
    removePublishedStackMetadata: mockRemovePublishedStackMetadata,
    findStackByStackId: mockFindStackByStackId,
    getAllPublishedStacks: jest.fn(),
    isValidVersion: jest.fn().mockReturnValue(true),
    generateSuggestedVersion: jest.fn().mockReturnValue('1.0.1'),
  })),
  DependencyService: jest.fn().mockImplementation(() => ({
    checkMcpDependencies: jest.fn().mockResolvedValue([]),
    displayMissingDependencies: jest.fn(),
    getMissingDependencyNames: jest.fn().mockResolvedValue([]),
  })),
  StackService: jest.fn(),
  FileService: jest.fn(),
  ConfigService: jest.fn(),
}));

jest.mock('../../../src/services/StackOperationService.js', () => ({
  StackOperationService: jest.fn().mockImplementation(() => ({})),
}));

// Mock node-fetch
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

import { deleteAction } from '../../../src/actions/delete.js';

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

describe('deleteAction', () => {
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
    mockAuthenticate.mockResolvedValue('mock-token');
    mockGetBaseUrl.mockReturnValue('https://api.test.com');
    mockIsLocalDev.mockReturnValue(false);
    mockFindStackByStackId.mockResolvedValue(null);
    mockRemovePublishedStackMetadata.mockResolvedValue(undefined);

    // Setup successful fetch response by default
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
  });

  describe('basic functionality', () => {
    it('should delete a stack successfully', async () => {
      await deleteAction('test-org/test-stack');

      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Deleting stack test-org/test-stack...');
      expect(mockAuthenticate).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/test-org/test-stack',
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer mock-token',
            'User-Agent': 'claude-stacks-cli/1.0.0',
          },
        }
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack deleted successfully!');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Stack ID: test-org/test-stack');
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should show local dev API URL when in local development mode', async () => {
      mockIsLocalDev.mockReturnValue(true);
      mockGetBaseUrl.mockReturnValue('http://localhost:3000');

      await deleteAction('test-org/local-stack');

      expect(mockConsoleLog).toHaveBeenCalledWith('   Using local backend: http://localhost:3000');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/stacks/test-org/local-stack',
        expect.any(Object)
      );
    });

    it('should handle stack with local metadata', async () => {
      const mockMetadata = {
        projectPath: '/path/to/project',
        stackId: 'test-org/test-stack',
        version: '1.0.0',
        lastPublished: '2023-01-01T00:00:00Z',
      };

      mockFindStackByStackId.mockResolvedValue(mockMetadata);

      await deleteAction('test-org/test-stack');

      expect(mockFindStackByStackId).toHaveBeenCalledWith('test-org/test-stack');
      expect(mockRemovePublishedStackMetadata).toHaveBeenCalledWith('/path/to/project');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Cleared local metadata for /path/to/project');
    });

    it('should handle stack without local metadata', async () => {
      mockFindStackByStackId.mockResolvedValue(null);

      await deleteAction('test-org/test-stack');

      expect(mockFindStackByStackId).toHaveBeenCalledWith('test-org/test-stack');
      expect(mockRemovePublishedStackMetadata).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack deleted successfully!');
    });
  });

  describe('stack ID validation', () => {
    it('should handle valid stack ID format', async () => {
      await deleteAction('valid-org/valid-stack');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/valid-org/valid-stack',
        expect.any(Object)
      );
    });

    it('should reject invalid stack ID without slash', async () => {
      await expect(deleteAction('invalid-stack-id')).rejects.toThrow(
        'Invalid stack ID format. Expected org/name format'
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject empty org or name', async () => {
      await expect(deleteAction('/empty-org')).rejects.toThrow(
        'Invalid stack ID format. Expected org/name format'
      );

      await expect(deleteAction('empty-name/')).rejects.toThrow(
        'Invalid stack ID format. Expected org/name format'
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject empty stack ID', async () => {
      await expect(deleteAction('')).rejects.toThrow(
        "Required parameter 'stackId' is missing or empty"
      );
    });
  });

  describe('error handling', () => {
    it('should handle authentication errors', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Authentication failed'));

      await expect(deleteAction('test-org/test-stack')).rejects.toThrow(
        'Authentication failed'
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Stack not found'),
      });

      await expect(deleteAction('test-org/nonexistent-stack')).rejects.toThrow(
        'Failed to delete stack: 404 Not Found\nStack not found'
      );
    });

    it('should handle API errors without response body', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue(''),
      });

      await expect(deleteAction('test-org/error-stack')).rejects.toThrow(
        'Failed to delete stack: 500 Internal Server Error'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteAction('test-org/network-error-stack')).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle response body parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockRejectedValue(new Error('Parse error')),
      });

      await expect(deleteAction('test-org/parse-error-stack')).rejects.toThrow(
        'Failed to delete stack: 400 Bad Request'
      );
    });

    it('should handle metadata cleanup errors', async () => {
      const mockMetadata = {
        projectPath: '/path/to/project',
        stackId: 'test-org/test-stack',
        version: '1.0.0',
        lastPublished: '2023-01-01T00:00:00Z',
      };

      mockFindStackByStackId.mockResolvedValue(mockMetadata);
      mockRemovePublishedStackMetadata.mockRejectedValue(new Error('Metadata cleanup failed'));

      await expect(deleteAction('test-org/test-stack')).rejects.toThrow(
        'Metadata cleanup failed'
      );

      expect(mockFetch).toHaveBeenCalled(); // Should still attempt API call first
    });

    it('should handle metadata lookup errors', async () => {
      mockFindStackByStackId.mockRejectedValue(new Error('Metadata lookup failed'));

      await expect(deleteAction('test-org/test-stack')).rejects.toThrow(
        'Metadata lookup failed'
      );

      expect(mockFetch).toHaveBeenCalled(); // Should still attempt API call first
    });

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValue('String error');

      await expect(deleteAction('test-org/string-error-stack')).rejects.toThrow(
        'String error'
      );
    });
  });

  describe('API integration', () => {
    it('should use correct API endpoint', async () => {
      await deleteAction('test-org/api-test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/test-org/api-test',
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer mock-token',
            'User-Agent': 'claude-stacks-cli/1.0.0',
          },
        }
      );
    });

    it('should handle different API base URLs', async () => {
      mockGetBaseUrl.mockReturnValue('https://custom-api.example.com');

      await deleteAction('test-org/custom-api-test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-api.example.com/v1/stacks/test-org/custom-api-test',
        expect.any(Object)
      );
    });

    it('should include proper authorization headers', async () => {
      mockAuthenticate.mockResolvedValue('custom-token-12345');

      await deleteAction('test-org/auth-test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom-token-12345',
          }),
        })
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete deletion workflow with metadata', async () => {
      const mockMetadata = {
        projectPath: '/path/to/complete/project',
        stackId: 'complete-org/complete-stack',
        version: '2.1.0',
        lastPublished: '2023-06-01T12:00:00Z',
      };

      mockFindStackByStackId.mockResolvedValue(mockMetadata);

      await deleteAction('complete-org/complete-stack');

      // Verify all steps executed in order
      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Deleting stack complete-org/complete-stack...');
      expect(mockAuthenticate).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/complete-org/complete-stack',
        expect.any(Object)
      );
      expect(mockFindStackByStackId).toHaveBeenCalledWith('complete-org/complete-stack');
      expect(mockRemovePublishedStackMetadata).toHaveBeenCalledWith('/path/to/complete/project');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   Cleared local metadata for /path/to/complete/project'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack deleted successfully!');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Stack ID: complete-org/complete-stack');
    });

    it('should handle rapid successive deletions', async () => {
      const promises = [
        deleteAction('test-org/rapid-1'),
        deleteAction('test-org/rapid-2'),
        deleteAction('test-org/rapid-3'),
      ];

      await Promise.all(promises);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockAuthenticate).toHaveBeenCalledTimes(3);
      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Deleting stack test-org/rapid-1...');
      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Deleting stack test-org/rapid-2...');
      expect(mockConsoleLog).toHaveBeenCalledWith('🗑️ Deleting stack test-org/rapid-3...');
    });

    it('should handle mixed success and failure scenarios', async () => {
      // First deletion succeeds
      await deleteAction('test-org/success-stack');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack deleted successfully!');

      // Second deletion fails
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue('Access denied'),
      });

      await expect(deleteAction('test-org/forbidden-stack')).rejects.toThrow(
        'Failed to delete stack: 403 Forbidden\nAccess denied'
      );
    });
  });
});