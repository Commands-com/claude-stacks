import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import type { RemoteStack } from '../../../src/types/index.js';

// Mock the API utils before importing ApiService
const mockGetApiConfig = jest.fn(() => ({
  baseUrl: 'https://api.test.com',
  authUrl: 'https://api.commands.com/oauth/authorize',
  tokenUrl: 'https://api.commands.com/oauth/token',
  clientId: 'claude-stacks-cli',
}));

const mockIsLocalDev = jest.fn(() => false);

jest.mock('../../../src/utils/api.ts', () => ({
  getApiConfig: mockGetApiConfig,
  isLocalDev: mockIsLocalDev,
}));

// Mock SecureHttpClient
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../../src/utils/secureHttp.ts', () => ({
  SecureHttpClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  },
}));

// Import ApiService after setting up mocks
import { ApiService } from '../../../src/services/ApiService.js';

describe('ApiService', () => {
  let apiService: ApiService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockGetApiConfig.mockReturnValue({
      baseUrl: 'https://api.test.com',
      authUrl: 'https://api.commands.com/oauth/authorize',
      tokenUrl: 'https://api.commands.com/oauth/token',
      clientId: 'claude-stacks-cli',
    });

    mockIsLocalDev.mockReturnValue(false);
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockDelete.mockReset();

    apiService = new ApiService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with API config', () => {
      const config = apiService.getConfig();
      expect(config.baseUrl).toBe('https://api.test.com');
      expect(config.authUrl).toBe('https://api.commands.com/oauth/authorize');
      expect(config.tokenUrl).toBe('https://api.commands.com/oauth/token');
      expect(config.clientId).toBe('claude-stacks-cli');
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the current configuration', () => {
      const config = apiService.getConfig();

      expect(config).toEqual({
        baseUrl: 'https://api.test.com',
        authUrl: 'https://api.commands.com/oauth/authorize',
        tokenUrl: 'https://api.commands.com/oauth/token',
        clientId: 'claude-stacks-cli',
      });

      // Verify it's a copy, not the original
      config.baseUrl = 'modified';
      expect(apiService.getConfig().baseUrl).toBe('https://api.test.com');
    });
  });

  describe('isLocalDev', () => {
    it('should return false by default', () => {
      expect(apiService.isLocalDev()).toBe(false);
    });
  });

  describe('getBaseUrl', () => {
    it('should return the base URL from configuration', () => {
      expect(apiService.getBaseUrl()).toBe('https://api.test.com');
    });
  });

  describe('fetchStack', () => {
    const mockStack: RemoteStack = {
      org: 'test-org',
      name: 'test-stack',
      title: 'Test Stack',
      description: 'A test stack',
      version: '1.0.0',
      author: 'test-author',
    };

    it('should successfully fetch a stack', async () => {
      mockGet.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStack),
      });

      const result = await apiService.fetchStack('test-org/test-stack', 'test-token');

      expect(result).toEqual(mockStack);
      expect(mockGet).toHaveBeenCalledWith('https://api.test.com/v1/stacks/test-org/test-stack', {
        Authorization: 'Bearer test-token',
        'User-Agent': 'claude-stacks-cli/1.0.0',
        Accept: 'application/json',
      });
    });

    it('should handle API errors with response text', async () => {
      mockGet.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Stack not found'),
      });

      await expect(apiService.fetchStack('test-org/nonexistent', 'test-token')).rejects.toThrow(
        'Failed to fetch stack: 404 Not Found\nStack not found'
      );
    });

    it('should handle API errors without response text', async () => {
      mockGet.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockRejectedValue(new Error('Parse error')),
      });

      await expect(apiService.fetchStack('test-org/error-stack', 'test-token')).rejects.toThrow(
        'Failed to fetch stack: 500 Internal Server Error\nUnknown error'
      );
    });

    it('should handle network errors', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(apiService.fetchStack('test-org/test-stack', 'test-token')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('publishStack', () => {
    const mockPayload = {
      name: 'Test Stack',
      description: 'A test stack',
      commands: [],
    };

    const mockResponse = {
      id: 'test-org/test-stack',
      url: 'https://commands.com/stacks/test-org/test-stack',
    };

    it('should successfully publish a new stack', async () => {
      mockPost.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiService.publishStack(mockPayload, 'test-token');

      expect(result).toEqual(mockResponse);
      expect(mockPost).toHaveBeenCalledWith('https://api.test.com/v1/stacks', mockPayload, {
        Authorization: 'Bearer test-token',
        'User-Agent': 'claude-stacks-cli/1.0.0',
      });
    });

    it('should successfully update an existing stack', async () => {
      mockPut.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiService.publishStack(
        mockPayload,
        'test-token',
        'test-org/test-stack'
      );

      expect(result).toEqual(mockResponse);
      expect(mockPut).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/test-org/test-stack',
        mockPayload,
        {
          Authorization: 'Bearer test-token',
          'User-Agent': 'claude-stacks-cli/1.0.0',
        }
      );
    });

    it('should handle publish errors', async () => {
      mockPost.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue('Invalid payload'),
      });

      await expect(apiService.publishStack(mockPayload, 'test-token')).rejects.toThrow(
        'Upload failed: 400 Bad Request\nInvalid payload'
      );
    });
  });

  describe('deleteStack', () => {
    it('should successfully delete a stack', async () => {
      mockDelete.mockResolvedValue({
        ok: true,
      });

      await expect(
        apiService.deleteStack('test-org/test-stack', 'test-token')
      ).resolves.toBeUndefined();

      expect(mockDelete).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/test-org/test-stack',
        {
          Authorization: 'Bearer test-token',
          'User-Agent': 'claude-stacks-cli/1.0.0',
        }
      );
    });

    it('should handle delete errors', async () => {
      mockDelete.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue('Access denied'),
      });

      await expect(
        apiService.deleteStack('test-org/protected-stack', 'test-token')
      ).rejects.toThrow('Delete failed: 403 Forbidden\nAccess denied');
    });
  });

  describe('renameStack', () => {
    const mockRenameResponse = {
      organizationUsername: 'test-org',
      name: 'new-stack-name',
      newUrl: 'https://commands.com/stacks/test-org/new-stack-name',
      oldUrl: 'https://commands.com/stacks/test-org/old-stack-name',
    };

    it('should successfully rename a stack', async () => {
      mockPut.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRenameResponse),
      });

      const result = await apiService.renameStack(
        'test-org/old-stack-name',
        'New Stack Name',
        'test-token'
      );

      expect(result).toEqual(mockRenameResponse);
      expect(mockPut).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks/test-org/old-stack-name/title',
        { title: 'New Stack Name' },
        {
          Authorization: 'Bearer test-token',
          'User-Agent': 'claude-stacks-cli/1.0.0',
        }
      );
    });

    it('should handle rename errors', async () => {
      mockPut.mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: jest.fn().mockResolvedValue('Invalid title format'),
      });

      await expect(
        apiService.renameStack('test-org/test-stack', 'Invalid@Title!', 'test-token')
      ).rejects.toThrow('Rename failed: 422 Unprocessable Entity\nInvalid title format');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration partially', () => {
      const originalConfig = apiService.getConfig();

      apiService.updateConfig({ baseUrl: 'https://localhost:3000' });

      const updatedConfig = apiService.getConfig();
      expect(updatedConfig).toEqual({
        ...originalConfig,
        baseUrl: 'https://localhost:3000',
      });
    });

    it('should update multiple config properties', () => {
      apiService.updateConfig({
        baseUrl: 'https://staging.api.com',
        authUrl: 'https://staging.api.com/oauth/authorize',
      });

      const config = apiService.getConfig();
      expect(config).toEqual({
        baseUrl: 'https://staging.api.com',
        authUrl: 'https://staging.api.com/oauth/authorize',
        tokenUrl: 'https://api.commands.com/oauth/token',
        clientId: 'claude-stacks-cli',
      });
    });
  });
});
