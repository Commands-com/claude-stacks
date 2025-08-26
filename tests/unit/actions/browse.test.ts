import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { browseAction } from '../../../src/actions/browse.js';
import type { RemoteStack, ApiStackResponse, ApiSearchResponse } from '../../../src/types/index.js';
import { FsMocks } from '../../mocks/fs-mocks.js';

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
    highlight: jest.fn().mockImplementation((text: string) => text),
    author: jest.fn().mockImplementation((text: string) => text),
    componentCount: jest.fn().mockImplementation((text: string) => text),
    bullet: jest.fn().mockImplementation((text: string) => text),
    id: jest.fn().mockImplementation((text: string) => text),
    url: jest.fn().mockImplementation((text: string) => text),
  },
}));

// Mock input utility
jest.mock('../../../src/utils/input.js', () => ({
  readSingleChar: jest.fn(),
}));

// Mock API utilities
jest.mock('../../../src/utils/api.js', () => ({
  getApiConfig: jest.fn(() => ({ baseUrl: 'https://api.test.com' })),
  isLocalDev: jest.fn(() => false),
}));

// Mock auth utility
jest.mock('../../../src/utils/auth.js', () => ({
  authenticate: jest.fn(),
}));

// Mock install action
jest.mock('../../../src/actions/install.js', () => ({
  installAction: jest.fn(),
}));

// Mock delete action
jest.mock('../../../src/actions/delete.js', () => ({
  deleteAction: jest.fn(),
}));

// Mock open utility
jest.mock('open', () => jest.fn());

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockConsoleClear = jest.fn();
const mockProcessExit = jest.fn();

describe('browseAction', () => {
  let mockFetch: jest.Mock;
  let mockReadSingleChar: jest.Mock;
  let mockAuthenticate: jest.Mock;
  let mockInstallAction: jest.Mock;
  let mockDeleteAction: jest.Mock;
  let mockOpen: jest.Mock;

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleClear = console.clear;
  const originalProcessExit = process.exit;

  const mockApiSearchResponse: ApiSearchResponse = {
    stacks: [
      {
        org: 'test-org',
        name: 'test-stack',
        title: 'Test Stack',
        description: 'A test stack for testing',
        author: 'Test Author',
        version: '1.0.0',
        public: true,
        viewCount: 100,
        installCount: 50,
        commandCount: 5,
        agentCount: 2,
        mcpServerCount: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        org: 'another-org',
        name: 'another-stack',
        title: 'Another Stack',
        description: 'Another test stack',
        author: 'Another Author',
        version: '2.0.0',
        public: true,
        viewCount: 200,
        installCount: 100,
        commandCount: 10,
        agentCount: 3,
        mcpServerCount: 2,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ],
    total: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    console.clear = mockConsoleClear;
    process.exit = mockProcessExit as any;

    // Ensure all mocks are properly reset
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
    mockConsoleClear.mockReset();
    mockProcessExit.mockReset();

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
    colors.highlight = jest.fn().mockImplementation((text: string) => text);
    colors.author = jest.fn().mockImplementation((text: string) => text);
    colors.componentCount = jest.fn().mockImplementation((text: string) => text);
    colors.bullet = jest.fn().mockImplementation((text: string) => text);
    colors.id = jest.fn().mockImplementation((text: string) => text);
    colors.url = jest.fn().mockImplementation((text: string) => text);

    // Setup API mocks
    const mockGetApiConfig = require('../../../src/utils/api.js').getApiConfig;
    mockGetApiConfig.mockReturnValue({ baseUrl: 'https://api.test.com' });

    const mockIsLocalDev = require('../../../src/utils/api.js').isLocalDev;
    mockIsLocalDev.mockReturnValue(false);

    // Setup input mock
    mockReadSingleChar = require('../../../src/utils/input.js').readSingleChar;
    mockReadSingleChar.mockReset();

    // Setup auth mock
    mockAuthenticate = require('../../../src/utils/auth.js').authenticate;
    mockAuthenticate.mockReset();
    mockAuthenticate.mockResolvedValue('test-access-token');

    // Setup action mocks
    mockInstallAction = require('../../../src/actions/install.js').installAction;
    mockInstallAction.mockReset();
    mockInstallAction.mockResolvedValue();

    mockDeleteAction = require('../../../src/actions/delete.js').deleteAction;
    mockDeleteAction.mockReset();
    mockDeleteAction.mockResolvedValue();

    // Setup open mock
    mockOpen = require('open');
    mockOpen.mockReset();
    mockOpen.mockResolvedValue();

    // Setup fetch mock with successful response
    mockFetch = require('node-fetch') as jest.Mock;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockApiSearchResponse),
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.clear = originalConsoleClear;
    process.exit = originalProcessExit;
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('main menu functionality', () => {
    it('should display main browse menu and quit when q is pressed', async () => {
      mockReadSingleChar.mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Browse Development Stacks')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('All Stacks'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('My Stacks'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Search'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Quit'));
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should handle empty input as quit', async () => {
      mockReadSingleChar.mockResolvedValueOnce('');

      await browseAction();

      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should handle invalid menu option and retry', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('x') // Invalid option
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith('Invalid option. Please try again.');
    });
  });

  describe('all stacks functionality', () => {
    it('should fetch and display all stacks when a is pressed', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('a') // Select all stacks
        .mockResolvedValueOnce('b') // Go back from stack list
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith('🔍 Fetching stacks from Commands.com...');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('All Public Stacks'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Found 2 stack(s)'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('1. test-stack'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('2. another-stack'));
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks?',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': 'claude-stacks-cli/1.0.0',
          }),
        })
      );
    });

    it('should show local dev API URL when in local development mode', async () => {
      const mockIsLocalDev = require('../../../src/utils/api.js').isLocalDev;
      const mockGetApiConfig = require('../../../src/utils/api.js').getApiConfig;

      mockIsLocalDev.mockReturnValue(true);
      mockGetApiConfig.mockReturnValue({ baseUrl: 'http://localhost:3000' });

      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Using local backend:'));
    });

    it('should handle empty stacks response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ stacks: [], total: 0 }),
      });

      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('') // Press any key to continue
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No stacks found matching your criteria')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Press any key to continue')
      );
    });

    it('should handle API fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('') // Press any key to continue
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to fetch stacks:', 'Network error');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Press any key to continue')
      );
    });

    it('should handle API response error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Server error details'),
      });

      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to fetch stacks:',
        'Browse failed: 500 Internal Server Error\nServer error details'
      );
    });
  });

  describe('stack selection and actions', () => {
    it('should display stack details when valid number is selected', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('a') // Select all stacks
        .mockResolvedValueOnce('1') // Select first stack
        .mockResolvedValueOnce('b') // Go back from stack details
        .mockResolvedValueOnce('b') // Go back from stack list
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      // Should display stack details
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('test-stack'));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('A test stack for testing')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test Author'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('1.0.0'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Commands: 5'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Agents: 2'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('MCP Servers: 1'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('test-org/test-stack'));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('https://commands.com/stacks/test-org/test-stack')
      );
    });

    it('should handle invalid stack selection', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('a') // Select all stacks
        .mockResolvedValueOnce('5') // Select invalid stack number (only 2 stacks)
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Invalid selection. Please enter a number between 1 and 2'
      );
    });

    it('should install stack when i is pressed', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('a') // Select all stacks
        .mockResolvedValueOnce('1') // Select first stack
        .mockResolvedValueOnce('i') // Install
        .mockResolvedValueOnce('') // Press any key to continue
        .mockResolvedValueOnce('b') // Go back from stack details
        .mockResolvedValueOnce('b') // Go back from stack list
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Installing stack'));
      expect(mockInstallAction).toHaveBeenCalledWith('test-org/test-stack', {});
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Press any key to continue')
      );
    });

    it('should handle install action error', async () => {
      mockInstallAction.mockRejectedValue(new Error('Install failed'));

      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('i')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleError).toHaveBeenCalledWith('Install failed:', 'Install failed');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Press any key to continue')
      );
    });

    it('should open browser when v is pressed', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('v') // View in browser
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Opening https://commands.com/stacks/test-org/test-stack')
      );
      expect(mockOpen).toHaveBeenCalledWith('https://commands.com/stacks/test-org/test-stack');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Opened in browser'));
    });

    it('should handle browser open error', async () => {
      mockOpen.mockRejectedValue(new Error('Failed to open browser'));

      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('v')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to open browser:',
        'Failed to open browser'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Please open manually'));
    });
  });

  describe('my stacks functionality', () => {
    it('should fetch and display user stacks when m is pressed', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('m') // Select my stacks
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockAuthenticate).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks?myStacks=true',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
            'User-Agent': 'claude-stacks-cli/1.0.0',
          }),
        })
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('My Published Stacks'));
    });

    it('should handle my stacks API error', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Auth failed'));

      mockReadSingleChar
        .mockResolvedValueOnce('m')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to fetch your stacks:', 'Auth failed');
    });
  });

  describe('search functionality', () => {
    beforeEach(() => {
      // Mock process.stdin for search input
      const mockStdin = {
        resume: jest.fn(),
        setEncoding: jest.fn(),
        once: jest.fn((event: string, callback: (data: string) => void) => {
          // Simulate user typing search term
          setTimeout(() => callback('test search\n'), 0);
        }),
      };
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
      });
    });

    it('should perform search when s is pressed', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('s') // Select search
        .mockResolvedValueOnce('b') // Go back from results
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Search Stacks'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Enter search term'));
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/stacks?search=test+search',
        expect.any(Object)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Search Results for "test search"')
      );
    });

    it('should handle search API error', async () => {
      mockFetch.mockRejectedValue(new Error('Search failed'));

      mockReadSingleChar
        .mockResolvedValueOnce('s')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleError).toHaveBeenCalledWith('Search failed:', 'Search failed');
    });

    it('should handle empty search term', async () => {
      const mockStdin = {
        resume: jest.fn(),
        setEncoding: jest.fn(),
        once: jest.fn((event: string, callback: (data: string) => void) => {
          setTimeout(() => callback('\n'), 0); // Empty search
        }),
      };
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
      });

      mockReadSingleChar.mockResolvedValueOnce('s').mockResolvedValueOnce('q');

      await browseAction();

      // Should not make API call for empty search
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('search='),
        expect.any(Object)
      );
    });
  });

  describe('my stacks management actions', () => {
    beforeEach(() => {
      // Set up a mock private stack for testing ownership actions
      const privateStackResponse: ApiSearchResponse = {
        stacks: [
          {
            org: 'user-org',
            name: 'private-stack',
            title: 'Private Stack',
            description: 'A private test stack',
            author: 'Current User',
            version: '1.0.0',
            public: false, // Private stack
            viewCount: 10,
            installCount: 5,
            commandCount: 3,
            agentCount: 1,
            mcpServerCount: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('myStacks=true')) {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue(privateStackResponse),
          });
        }
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue(mockApiSearchResponse),
        });
      });
    });

    it('should show ownership actions for my stacks', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('m') // My stacks
        .mockResolvedValueOnce('1') // Select first stack
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('★ private-stack')); // Ownership indicator
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Private (only visible to you)')
      ); // Visibility status
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('ake public')); // Visibility action (partial match)
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('ename')); // Rename action (partial match)
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('elete')); // Delete action (partial match)
    });

    it('should handle rename action', async () => {
      // Mock process.stdin for rename input
      const mockStdin = {
        resume: jest.fn(),
        setEncoding: jest.fn(),
        once: jest.fn((event: string, callback: (data: string) => void) => {
          setTimeout(() => callback('New Stack Name\n'), 0);
        }),
      };
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
      });

      // Mock rename API response
      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/rename') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              organizationUsername: 'user-org',
              name: 'new-stack-name',
              newUrl: 'https://commands.com/stacks/user-org/new-stack-name',
            }),
          });
        }
        // Return my stacks response for other calls
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({
            stacks: [
              {
                org: 'user-org',
                name: 'private-stack',
                public: false,
                author: 'Current User',
                description: 'A private test stack',
              },
            ],
          }),
        });
      });

      mockReadSingleChar
        .mockResolvedValueOnce('m') // My stacks
        .mockResolvedValueOnce('1') // Select stack
        .mockResolvedValueOnce('r') // Rename
        .mockResolvedValueOnce('') // Continue after rename
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Current name: "private-stack"')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Enter new title'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Renaming stack'));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Stack renamed successfully')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('New Stack Name'));
    });

    it('should handle visibility toggle to public', async () => {
      // Mock visibility update API
      mockFetch.mockImplementation((url: string, options: any) => {
        if (options?.method === 'PATCH') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({ public: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({
            stacks: [
              {
                org: 'user-org',
                name: 'private-stack',
                public: false,
                author: 'Current User',
                description: 'A private test stack',
              },
            ],
          }),
        });
      });

      mockReadSingleChar
        .mockResolvedValueOnce('m') // My stacks
        .mockResolvedValueOnce('1') // Select stack
        .mockResolvedValueOnce('m') // Make public
        .mockResolvedValueOnce('y') // Confirm
        .mockResolvedValueOnce('') // Continue
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockReadSingleChar).toHaveBeenCalledWith(
        expect.stringContaining('Make "private-stack" public?')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Making stack public'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Stack is now public'));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Others can now discover and install your stack')
      );
    });

    it('should handle delete action with confirmation', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('m') // My stacks
        .mockResolvedValueOnce('1') // Select stack
        .mockResolvedValueOnce('d') // Delete
        .mockResolvedValueOnce('y') // Confirm delete
        .mockResolvedValueOnce('') // Continue
        .mockResolvedValueOnce('q'); // Quit (goes directly to main menu after delete)

      await browseAction();

      expect(mockReadSingleChar).toHaveBeenCalledWith(
        expect.stringContaining('Delete "private-stack"?')
      );
      expect(mockDeleteAction).toHaveBeenCalledWith('user-org/private-stack');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Stack deleted. Press any key to continue')
      );
    });

    it('should cancel delete when n is pressed', async () => {
      mockReadSingleChar
        .mockResolvedValueOnce('m') // My stacks
        .mockResolvedValueOnce('1') // Select stack
        .mockResolvedValueOnce('d') // Delete
        .mockResolvedValueOnce('n') // Cancel delete
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('b') // Go back
        .mockResolvedValueOnce('q'); // Quit

      await browseAction();

      expect(mockDeleteAction).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Delete cancelled'));
    });
  });

  describe('error handling', () => {
    it('should handle browse action failure and exit', async () => {
      // Mock a failure that causes the outer try-catch to trigger
      mockReadSingleChar.mockRejectedValue(new Error('Input failure'));

      await expect(browseAction()).rejects.toThrow('Input failure');

      expect(mockConsoleError).toHaveBeenCalledWith('Browse failed:', 'Input failure');
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should handle unexpected API response format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ unexpected: 'response' }), // Invalid format
      });

      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('q');

      await browseAction();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No stacks found matching your criteria')
      );
    });
  });

  describe('edge cases', () => {
    it('should handle stack without org field', async () => {
      const stackWithoutOrg: ApiSearchResponse = {
        stacks: [
          {
            org: '',
            name: 'test-stack',
            description: 'Test stack without org',
            author: 'Test Author',
            public: true,
            viewCount: 0,
            installCount: 0,
            commandCount: 0,
            agentCount: 0,
            mcpServerCount: 0,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(stackWithoutOrg),
      });

      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('q');

      await browseAction();

      // Should fall back to author/name format
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test Author/test-stack')
      );
    });

    it('should handle missing component counts', async () => {
      const stackWithMissingCounts: ApiSearchResponse = {
        stacks: [
          {
            org: 'test-org',
            name: 'minimal-stack',
            description: 'Minimal stack',
            author: 'Test Author',
            public: true,
            // Missing count fields
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(stackWithMissingCounts),
      });

      mockReadSingleChar
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('q');

      await browseAction();

      // Should display 0 for missing counts
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Commands: 0'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Agents: 0'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('MCP Servers: 0'));
    });
  });
});
