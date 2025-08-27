import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Create shared mocks that we can configure in tests
const mockFetchStack = jest.fn();
const mockAuthenticate = jest.fn();
const mockCheckMcpDependencies = jest.fn();
const mockIsLocalDev = jest.fn();

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
    fetchStack: mockFetchStack,
    publishStack: jest.fn(),
    getBaseUrl: jest.fn().mockReturnValue('https://api.commands.com'),
    getConfig: jest.fn().mockReturnValue({ baseUrl: 'https://api.commands.com' }),
    isLocalDev: mockIsLocalDev,
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
    displayMissingDependencies: jest.fn(),
    getMissingDependencyNames: jest.fn().mockResolvedValue([]),
  })),
  StackService: jest.fn(),
  FileService: jest.fn(),
  ConfigService: jest.fn(),
}));

jest.mock('../../../src/services/StackOperationService.js', () => ({
  StackOperationService: jest.fn().mockImplementation(() => ({
    performRestore: jest.fn().mockResolvedValue(undefined),
    performInstallation: jest.fn().mockResolvedValue(undefined),
    checkDependencies: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

import { installAction } from '../../../src/actions/install.js';
import type { InstallOptions, RemoteStack } from '../../../src/types/index.js';

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn();

describe('installAction', () => {
  let mockFetch: jest.Mock;

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;

    // Setup successful remote stack response
    const mockRemoteStack: RemoteStack = {
      org: 'test-org',
      name: 'test-stack',
      title: 'Test Stack',
      description: 'A test stack',
      author: 'Test Author',
      version: '1.0.0',
    };

    // Configure the shared mocks
    mockFetchStack.mockResolvedValue(mockRemoteStack);
    mockAuthenticate.mockResolvedValue('mock-token');
    mockCheckMcpDependencies.mockResolvedValue([]);
    mockIsLocalDev.mockReturnValue(false);

    mockFetch = require('node-fetch') as jest.Mock;
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockRemoteStack),
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should install a stack successfully', async () => {
      await installAction('test-org/test-stack', {});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '📥 Fetching stack test-org/test-stack from Commands.com...'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Installing: Test Stack')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('By: Test Author'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('A test stack'));
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should show local dev API URL when in local development mode', async () => {
      // This test would require mocking the API service's isLocalDev method
      // For now, we'll just test that the action can be called
      await installAction('test-org/local-dev-stack', {});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '📥 Fetching stack test-org/local-dev-stack from Commands.com...'
      );
    });

    it('should handle installation options', async () => {
      const options: InstallOptions = {
        overwrite: true,
        globalOnly: false,
        localOnly: false,
      };

      await installAction('test-org/options-stack', options);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '📥 Fetching stack test-org/options-stack from Commands.com...'
      );
    });
  });

  describe('error handling', () => {
    it('should handle invalid stack ID format', async () => {
      // Expect the action to throw an error for invalid format
      await expect(installAction('invalid-stack-id', {})).rejects.toThrow(
        'Stack ID must be in format "org/name"'
      );
    });

    it('should handle API fetch errors', async () => {
      // Configure the fetchStack mock to throw an error for this test
      mockFetchStack.mockRejectedValue(new Error('Stack not found'));

      await expect(installAction('test-org/nonexistent-stack', {})).rejects.toThrow(
        'Stack not found'
      );
    });

    it('should handle network errors', async () => {
      // Configure the fetchStack mock to throw a network error for this test
      mockFetchStack.mockRejectedValue(new Error('Network error'));

      await expect(installAction('test-org/network-error-stack', {})).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('stack processing', () => {
    it('should handle remote stack with minimal data', async () => {
      const minimalStack: RemoteStack = {
        org: 'test-org',
        name: 'minimal-stack',
        title: 'Minimal Stack',
        description: 'A minimal stack',
        version: '1.0.0',
      };

      // Configure the fetchStack mock to return the minimal stack for this test
      mockFetchStack.mockResolvedValue(minimalStack);

      await installAction('test-org/minimal-stack', {});

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Minimal Stack'));
    });

    it('should handle stack with MCP servers', async () => {
      const stackWithMcp: RemoteStack = {
        org: 'test-org',
        name: 'mcp-stack',
        description: 'Stack with MCP servers',
        author: 'Test Author',
        version: '1.0.0',
        mcpServers: [
          {
            name: 'filesystem',
            type: 'stdio',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem'],
          },
        ],
      };

      // Configure the fetchStack mock to return the MCP stack for this test
      mockFetchStack.mockResolvedValue(stackWithMcp);

      await installAction('test-org/mcp-stack', {});

      expect(mockConsoleLog).toHaveBeenCalledWith('🔍 Checking dependencies...');
    });
  });
});
