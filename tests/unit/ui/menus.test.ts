import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import type { DeveloperStack, RemoteStack } from '../../../src/types/index.js';
import {
  showLocalStackDetailsAndActions,
  showStackDetailsAndActions,
} from '../../../src/ui/menus.js';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  remove: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  basename: jest.fn(),
}));

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
    author: jest.fn().mockImplementation((text: string) => text),
    componentCount: jest.fn().mockImplementation((text: string | number) => String(text)),
    bullet: jest.fn().mockImplementation((text: string) => text),
    path: jest.fn().mockImplementation((text: string) => text),
    highlight: jest.fn().mockImplementation((text: string) => text),
    id: jest.fn().mockImplementation((text: string) => text),
    url: jest.fn().mockImplementation((text: string) => text),
    number: jest.fn().mockImplementation((text: string | number) => String(text)),
  },
}));

// Mock input utility
jest.mock('../../../src/utils/input.js', () => ({
  readSingleChar: jest.fn(),
}));

// Mock display utility
jest.mock('../../../src/ui/display.js', () => ({
  showStackInfo: jest.fn(),
}));

// Mock action modules
jest.mock('../../../src/actions/delete.js', () => ({
  deleteAction: jest.fn(),
}));

jest.mock('../../../src/actions/restore.js', () => ({
  restoreAction: jest.fn(),
}));

jest.mock('../../../src/actions/install.js', () => ({
  installAction: jest.fn(),
}));

jest.mock('../../../src/actions/publish.js', () => ({
  publishAction: jest.fn(),
}));

// Mock open module
jest.mock('open', () => jest.fn());

describe('ui/menus', () => {
  // Mock console methods
  const mockConsoleLog = jest.fn();
  const mockConsoleError = jest.fn();
  const mockConsoleClear = jest.fn();

  // Store original values
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleClear = console.clear;

  let mockFs: any;
  let mockPath: any;
  let mockInput: any;
  let mockDisplay: any;
  let mockDeleteAction: any;
  let mockRestoreAction: any;
  let mockInstallAction: any;
  let mockPublishAction: any;
  let mockOpen: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console and process
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    console.clear = mockConsoleClear;

    // Reset all mock functions
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
    mockConsoleClear.mockReset();

    // Get and reset mocked modules
    mockFs = require('fs-extra');
    mockPath = require('path');
    mockInput = require('../../../src/utils/input.js');
    mockDisplay = require('../../../src/ui/display.js');
    mockDeleteAction = require('../../../src/actions/delete.js').deleteAction;
    mockRestoreAction = require('../../../src/actions/restore.js').restoreAction;
    mockInstallAction = require('../../../src/actions/install.js').installAction;
    mockPublishAction = require('../../../src/actions/publish.js').publishAction;
    mockOpen = require('open');

    mockFs.remove.mockReset();
    mockPath.basename.mockReset();
    mockInput.readSingleChar.mockReset();
    mockDisplay.showStackInfo.mockReset();
    mockDeleteAction.mockReset();
    mockRestoreAction.mockReset();
    mockInstallAction.mockReset();
    mockPublishAction.mockReset();
    mockOpen.mockReset();

    // Re-setup color mocks to ensure they work correctly
    const { colors } = require('../../../src/utils/colors.js');
    colors.info = jest.fn().mockImplementation((text: string) => text);
    colors.meta = jest.fn().mockImplementation((text: string) => text);
    colors.stackName = jest.fn().mockImplementation((text: string) => text);
    colors.description = jest.fn().mockImplementation((text: string) => text);
    colors.error = jest.fn().mockImplementation((text: string) => text);
    colors.success = jest.fn().mockImplementation((text: string) => text);
    colors.warning = jest.fn().mockImplementation((text: string) => text);
    colors.author = jest.fn().mockImplementation((text: string) => text);
    colors.componentCount = jest.fn().mockImplementation((text: string | number) => String(text));
    colors.bullet = jest.fn().mockImplementation((text: string) => text);
    colors.path = jest.fn().mockImplementation((text: string) => text);
    colors.highlight = jest.fn().mockImplementation((text: string) => text);
    colors.id = jest.fn().mockImplementation((text: string) => text);
    colors.url = jest.fn().mockImplementation((text: string) => text);
    colors.number = jest.fn().mockImplementation((text: string | number) => String(text));

    // Mock Date object to ensure consistent formatting
    const mockDate = jest.fn().mockImplementation((dateString?: string) => {
      if (dateString === '2023-01-01T00:00:00Z') {
        return {
          toLocaleString: () => '1/1/2023, 12:00:00 AM',
          toLocaleDateString: () => '1/1/2023',
        };
      }
      return new (jest.requireActual('util').Date)(dateString);
    });
    global.Date = mockDate as any;

    // Setup default mocks
    mockPath.basename.mockReturnValue('test-stack.json');
    mockInput.readSingleChar.mockResolvedValue('b'); // Default to 'back' action
    mockFs.remove.mockResolvedValue();
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.clear = originalConsoleClear;
  });

  describe('showLocalStackDetailsAndActions', () => {
    const createMockLocalStack = (overrides: Partial<DeveloperStack> = {}): DeveloperStack => ({
      name: 'test-stack',
      description: 'A test stack for unit testing',
      version: '1.0.0',
      filePath: '/path/to/test-stack.json',
      commands: [{ name: 'test-command', description: 'Test command' }],
      agents: [{ name: 'test-agent', description: 'Test agent' }],
      mcpServers: [{ name: 'test-mcp', description: 'Test MCP server' }],
      metadata: {
        created_at: '2023-01-01T00:00:00Z',
        exported_from: 'test-project',
      },
      ...overrides,
    });

    it('should display local stack details correctly', async () => {
      const stack = createMockLocalStack();

      await showLocalStackDetailsAndActions(stack);

      // Check stack details display
      expect(mockConsoleLog).toHaveBeenCalledWith('\n📦 test-stack');
      expect(mockConsoleLog).toHaveBeenCalledWith('Description: A test stack for unit testing');
      expect(mockConsoleLog).toHaveBeenCalledWith('File: test-stack.json');
      expect(mockConsoleLog).toHaveBeenCalledWith('Version: 1.0.0');
    });

    it('should display component counts correctly', async () => {
      const stack = createMockLocalStack();

      await showLocalStackDetailsAndActions(stack);

      // Check component display
      expect(mockConsoleLog).toHaveBeenCalledWith('Components: 3 items');
      expect(mockConsoleLog).toHaveBeenCalledWith('   • Commands: 1');
      expect(mockConsoleLog).toHaveBeenCalledWith('   • Agents: 1');
      expect(mockConsoleLog).toHaveBeenCalledWith('   • MCP Servers: 1');
    });

    it('should display metadata correctly', async () => {
      const stack = createMockLocalStack();

      await showLocalStackDetailsAndActions(stack);

      // Check metadata display (using exact date formatting)
      expect(mockConsoleLog).toHaveBeenCalledWith('Created: 1/1/2023, 12:00:00 AM');
      expect(mockConsoleLog).toHaveBeenCalledWith('Exported from: test-project');
      expect(mockConsoleLog).toHaveBeenCalledWith('File path: /path/to/test-stack.json');
    });

    it('should handle stack with no version', async () => {
      const stack = createMockLocalStack({ version: undefined });

      await showLocalStackDetailsAndActions(stack);

      // Should display basic info without version
      expect(mockConsoleLog).toHaveBeenCalledWith('\n📦 test-stack');
      expect(mockConsoleLog).toHaveBeenCalledWith('Description: A test stack for unit testing');
      expect(mockConsoleLog).toHaveBeenCalledWith('File: test-stack.json');

      // Should not display version line
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Version:'));
    });

    it('should handle stack with empty components', async () => {
      const stack = createMockLocalStack({
        commands: [],
        agents: undefined,
        mcpServers: [],
      });

      await showLocalStackDetailsAndActions(stack);

      // Check component display with zero counts
      expect(mockConsoleLog).toHaveBeenCalledWith('Components: 0 items');
      expect(mockConsoleLog).toHaveBeenCalledWith('   • Commands: 0');
      expect(mockConsoleLog).toHaveBeenCalledWith('   • Agents: 0');
      expect(mockConsoleLog).toHaveBeenCalledWith('   • MCP Servers: 0');
    });

    it('should display action prompt correctly', async () => {
      const stack = createMockLocalStack();

      await showLocalStackDetailsAndActions(stack);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          'Actions: (r)estore, (o)verwrite, (p)ublish, (s)how details, (d)elete file, (b)ack'
        )
      );
    });

    describe('action handling', () => {
      it('should handle restore action', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar.mockResolvedValueOnce('r');
        mockRestoreAction.mockResolvedValue();

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleLog).toHaveBeenCalledWith('\n🔄 Restoring stack to current project...');
        expect(mockRestoreAction).toHaveBeenCalledWith('/path/to/test-stack.json', {});
        expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack restored successfully!');
      });

      it('should handle restore action failure', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar.mockResolvedValueOnce('r');
        mockRestoreAction.mockRejectedValue(new Error('Restore failed'));

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleError).toHaveBeenCalledWith('Restore failed:', 'Restore failed');
      });

      it('should handle overwrite action with confirmation', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('o') // Choose overwrite
          .mockResolvedValueOnce('y'); // Confirm overwrite
        mockRestoreAction.mockResolvedValue();

        await showLocalStackDetailsAndActions(stack);

        expect(mockInput.readSingleChar).toHaveBeenCalledWith(
          expect.stringContaining('Overwrite current project with "test-stack"?')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '\n🔄 Overwriting current project with stack...'
        );
        expect(mockRestoreAction).toHaveBeenCalledWith('/path/to/test-stack.json', {
          overwrite: true,
        });
        expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack overwrite completed successfully!');
      });

      it('should handle overwrite action cancellation', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('o') // Choose overwrite
          .mockResolvedValueOnce('n'); // Cancel overwrite

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleLog).toHaveBeenCalledWith('Overwrite cancelled.');
        expect(mockRestoreAction).not.toHaveBeenCalled();
      });

      it('should handle publish action with public visibility', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('p') // Choose publish
          .mockResolvedValueOnce('y') // Make public
          .mockResolvedValueOnce(''); // Continue after success
        mockPublishAction.mockResolvedValue();

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleLog).toHaveBeenCalledWith('\n📤 Publishing stack to Commands.com...');
        expect(mockInput.readSingleChar).toHaveBeenCalledWith(
          'Make this stack publicly discoverable? (y/N): '
        );
        expect(mockConsoleLog).toHaveBeenCalledWith('Publishing as public stack...');
        expect(mockPublishAction).toHaveBeenCalledWith('/path/to/test-stack.json', {
          public: true,
        });
        expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack published successfully!');
        expect(mockConsoleLog).toHaveBeenCalledWith('Visibility: Public (discoverable by others)');
      });

      it('should handle publish action with private visibility', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('p') // Choose publish
          .mockResolvedValueOnce('n') // Make private
          .mockResolvedValueOnce(''); // Continue after success
        mockPublishAction.mockResolvedValue();

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleLog).toHaveBeenCalledWith('Publishing as private stack...');
        expect(mockPublishAction).toHaveBeenCalledWith('/path/to/test-stack.json', {
          public: false,
        });
        expect(mockConsoleLog).toHaveBeenCalledWith('Visibility: Private (only visible to you)');
      });

      it('should handle publish action failure', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('p') // Choose publish
          .mockResolvedValueOnce('y') // Make public
          .mockResolvedValueOnce(''); // Continue after error
        mockPublishAction.mockRejectedValue(new Error('Publish failed'));

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleError).toHaveBeenCalledWith('Publish failed:', 'Publish failed');
        expect(mockConsoleLog).toHaveBeenCalledWith('\nPress any key to continue...');
      });

      it('should handle show details action', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('s') // Choose show details
          .mockResolvedValueOnce('') // Continue after details
          .mockResolvedValueOnce('b'); // Back from details menu
        mockDisplay.showStackInfo.mockResolvedValue();

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleLog).toHaveBeenCalledWith('\n📋 Detailed stack information:');
        expect(mockDisplay.showStackInfo).toHaveBeenCalledWith('/path/to/test-stack.json');
        expect(mockConsoleLog).toHaveBeenCalledWith('\nPress any key to return to actions menu...');
      });

      it('should handle delete action with confirmation', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('d') // Choose delete
          .mockResolvedValueOnce('y'); // Confirm delete

        await showLocalStackDetailsAndActions(stack);

        expect(mockInput.readSingleChar).toHaveBeenCalledWith(
          expect.stringContaining('Delete local file "test-stack.json"?')
        );
        expect(mockFs.remove).toHaveBeenCalledWith('/path/to/test-stack.json');
        expect(mockConsoleLog).toHaveBeenCalledWith('✅ Deleted test-stack.json successfully!');
      });

      it('should handle delete action cancellation', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('d') // Choose delete
          .mockResolvedValueOnce('n'); // Cancel delete

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleLog).toHaveBeenCalledWith('Delete cancelled.');
        expect(mockFs.remove).not.toHaveBeenCalled();
      });

      it('should handle delete action failure', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('d') // Choose delete
          .mockResolvedValueOnce('y'); // Confirm delete
        mockFs.remove.mockRejectedValue(new Error('Delete failed'));

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleError).toHaveBeenCalledWith('Failed to delete file:', 'Delete failed');
      });

      it('should handle back action', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar.mockResolvedValueOnce('b');

        await showLocalStackDetailsAndActions(stack);

        // Should exit without calling any actions
        expect(mockRestoreAction).not.toHaveBeenCalled();
        expect(mockPublishAction).not.toHaveBeenCalled();
        expect(mockDeleteAction).not.toHaveBeenCalled();
      });

      it('should handle empty input as back action', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar.mockResolvedValueOnce('');

        await showLocalStackDetailsAndActions(stack);

        // Should exit without calling any actions
        expect(mockRestoreAction).not.toHaveBeenCalled();
        expect(mockPublishAction).not.toHaveBeenCalled();
        expect(mockDeleteAction).not.toHaveBeenCalled();
      });

      it('should handle invalid action', async () => {
        const stack = createMockLocalStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('x') // Invalid action
          .mockResolvedValueOnce('b'); // Then back

        await showLocalStackDetailsAndActions(stack);

        expect(mockConsoleLog).toHaveBeenCalledWith('Invalid action. Please try again.');
      });
    });
  });

  describe('showStackDetailsAndActions', () => {
    const createMockRemoteStack = (overrides: Partial<RemoteStack> = {}): RemoteStack => ({
      org: 'test-org',
      name: 'test-stack',
      description: 'A test remote stack',
      author: 'Test Author',
      version: '1.0.0',
      commandCount: 2,
      agentCount: 1,
      mcpServerCount: 3,
      viewCount: 100,
      installCount: 50,
      createdAt: '2023-01-01T00:00:00Z',
      ...overrides,
    });

    it('should display remote stack details correctly', async () => {
      const stack = createMockRemoteStack();

      await showStackDetailsAndActions(stack, 'access-token');

      expect(mockConsoleLog).toHaveBeenCalledWith('\n📦 test-stack');
      expect(mockConsoleLog).toHaveBeenCalledWith('Description: A test remote stack');
      expect(mockConsoleLog).toHaveBeenCalledWith('Author: Test Author');
      expect(mockConsoleLog).toHaveBeenCalledWith('Version: 1.0.0');
    });

    it('should display remote stack with unknown author', async () => {
      const stack = createMockRemoteStack({ author: undefined });

      await showStackDetailsAndActions(stack, null);

      expect(mockConsoleLog).toHaveBeenCalledWith('Author: Unknown');
    });

    it('should display component counts correctly', async () => {
      const stack = createMockRemoteStack();

      await showStackDetailsAndActions(stack, null);

      expect(mockConsoleLog).toHaveBeenCalledWith('Components: 6 items');
      expect(mockConsoleLog).toHaveBeenCalledWith('   • Commands: 2');
      expect(mockConsoleLog).toHaveBeenCalledWith('   • Agents: 1');
      expect(mockConsoleLog).toHaveBeenCalledWith('   • MCP Servers: 3');
    });

    it('should display stats correctly', async () => {
      const stack = createMockRemoteStack();

      await showStackDetailsAndActions(stack, null);

      expect(mockConsoleLog).toHaveBeenCalledWith('Stats: 100 views, 50 installs');
      expect(mockConsoleLog).toHaveBeenCalledWith('Created: 1/1/2023');
      expect(mockConsoleLog).toHaveBeenCalledWith('Stack ID: test-org/test-stack');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'URL: https://commands.com/stacks/test-org/test-stack'
      );
    });

    it('should handle missing stats gracefully', async () => {
      const stack = createMockRemoteStack({
        viewCount: undefined,
        installCount: undefined,
        createdAt: undefined,
      });

      await showStackDetailsAndActions(stack, null);

      expect(mockConsoleLog).toHaveBeenCalledWith('Stats: 0 views, 0 installs');
      expect(mockConsoleLog).toHaveBeenCalledWith('Created: Unknown');
    });

    it('should display action prompt without delete for non-authenticated users', async () => {
      const stack = createMockRemoteStack();

      await showStackDetailsAndActions(stack, null);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Actions: (i)nstall, (v)iew in browser, (b)ack')
      );
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('(d)elete'));
    });

    it('should display action prompt with delete for authenticated users', async () => {
      const stack = createMockRemoteStack();

      await showStackDetailsAndActions(stack, 'access-token');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Actions: (i)nstall, (v)iew in browser, (d)elete, (b)ack')
      );
    });

    describe('action handling', () => {
      it('should handle install action', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar.mockResolvedValueOnce('i');
        mockInstallAction.mockResolvedValue();

        await showStackDetailsAndActions(stack, null);

        expect(mockConsoleLog).toHaveBeenCalledWith('\n📦 Installing stack...');
        expect(mockInstallAction).toHaveBeenCalledWith('test-org/test-stack', {});
        expect(mockConsoleLog).toHaveBeenCalledWith('✅ Stack installed successfully!');
      });

      it('should handle install action failure', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar.mockResolvedValueOnce('i');
        mockInstallAction.mockRejectedValue(new Error('Install failed'));

        await showStackDetailsAndActions(stack, null);

        expect(mockConsoleError).toHaveBeenCalledWith('Install failed:', 'Install failed');
      });

      it('should handle view action', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar.mockResolvedValueOnce('v');
        mockOpen.mockResolvedValue();

        await showStackDetailsAndActions(stack, null);

        expect(mockConsoleLog).toHaveBeenCalledWith(
          '\n🌐 Opening https://commands.com/stacks/test-org/test-stack...'
        );
        expect(mockOpen).toHaveBeenCalledWith('https://commands.com/stacks/test-org/test-stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('✅ Opened in browser!');
      });

      it('should handle view action failure', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar.mockResolvedValueOnce('v');
        mockOpen.mockRejectedValue(new Error('Failed to open browser'));

        await showStackDetailsAndActions(stack, null);

        expect(mockConsoleError).toHaveBeenCalledWith(
          'Failed to open browser:',
          'Failed to open browser'
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Please open manually: https://commands.com/stacks/test-org/test-stack'
        );
      });

      it('should handle delete action with confirmation when authenticated', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('d') // Choose delete
          .mockResolvedValueOnce('y'); // Confirm delete
        mockDeleteAction.mockResolvedValue();

        await showStackDetailsAndActions(stack, 'access-token');

        expect(mockInput.readSingleChar).toHaveBeenCalledWith(
          expect.stringContaining('Delete "test-stack"? This cannot be undone. (y/N): ')
        );
        expect(mockDeleteAction).toHaveBeenCalledWith('test-org/test-stack');
      });

      it('should handle delete action cancellation when authenticated', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('d') // Choose delete
          .mockResolvedValueOnce('n'); // Cancel delete

        await showStackDetailsAndActions(stack, 'access-token');

        expect(mockConsoleLog).toHaveBeenCalledWith('Delete cancelled.');
        expect(mockDeleteAction).not.toHaveBeenCalled();
      });

      it('should handle delete action failure when authenticated', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('d') // Choose delete
          .mockResolvedValueOnce('y'); // Confirm delete
        mockDeleteAction.mockRejectedValue(new Error('Delete failed'));

        await showStackDetailsAndActions(stack, 'access-token');

        expect(mockConsoleError).toHaveBeenCalledWith('Delete failed:', 'Delete failed');
      });

      it('should ignore delete action when not authenticated', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar.mockResolvedValueOnce('d');

        await showStackDetailsAndActions(stack, null);

        expect(mockDeleteAction).not.toHaveBeenCalled();
        expect(mockConsoleLog).toHaveBeenCalledWith('Invalid action. Please try again.');
      });

      it('should handle back action', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar.mockResolvedValueOnce('b');

        await showStackDetailsAndActions(stack, null);

        // Should exit without calling any actions
        expect(mockInstallAction).not.toHaveBeenCalled();
        expect(mockDeleteAction).not.toHaveBeenCalled();
        expect(mockOpen).not.toHaveBeenCalled();
      });

      it('should handle empty input as back action', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar.mockResolvedValueOnce('');

        await showStackDetailsAndActions(stack, null);

        // Should exit without calling any actions
        expect(mockInstallAction).not.toHaveBeenCalled();
        expect(mockDeleteAction).not.toHaveBeenCalled();
        expect(mockOpen).not.toHaveBeenCalled();
      });

      it('should handle invalid action', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar
          .mockResolvedValueOnce('x') // Invalid action
          .mockResolvedValueOnce('b'); // Then back

        await showStackDetailsAndActions(stack, null);

        expect(mockConsoleLog).toHaveBeenCalledWith('Invalid action. Please try again.');
      });
    });

    describe('edge cases', () => {
      it('should handle stack with no version', async () => {
        const stack = createMockRemoteStack({ version: undefined });

        await showStackDetailsAndActions(stack, null);

        expect(mockConsoleLog).toHaveBeenCalledWith('\n📦 test-stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('Description: A test remote stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('Author: Test Author');
        expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Version:'));
      });

      it('should handle component counts with undefined values', async () => {
        const stack = createMockRemoteStack({
          commandCount: undefined,
          agentCount: undefined,
          mcpServerCount: undefined,
        });

        await showStackDetailsAndActions(stack, null);

        expect(mockConsoleLog).toHaveBeenCalledWith('Components: 0 items');
        expect(mockConsoleLog).toHaveBeenCalledWith('   • Commands: 0');
        expect(mockConsoleLog).toHaveBeenCalledWith('   • Agents: 0');
        expect(mockConsoleLog).toHaveBeenCalledWith('   • MCP Servers: 0');
      });

      it('should handle case-insensitive input', async () => {
        const stack = createMockRemoteStack();
        mockInput.readSingleChar.mockResolvedValueOnce('I'); // Uppercase I
        mockInstallAction.mockResolvedValue();

        await showStackDetailsAndActions(stack, null);

        expect(mockInstallAction).toHaveBeenCalledWith('test-org/test-stack', {});
      });
    });
  });
});
