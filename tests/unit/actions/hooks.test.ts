import { jest } from '@jest/globals';

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
    success: jest.fn().mockImplementation((text: string) => text),
    error: jest.fn().mockImplementation((text: string) => text),
    warning: jest.fn().mockImplementation((text: string) => text),
    stackName: jest.fn().mockImplementation((text: string) => text),
    description: jest.fn().mockImplementation((text: string) => text),
    number: jest.fn().mockImplementation((text: string) => text),
  },
}));

// Mock HookScannerService
const mockHookScannerInstance = {
  scanHook: jest.fn().mockReturnValue({
    riskScore: 10,
    suspiciousPatterns: [],
    hasFileSystemAccess: false,
    hasNetworkAccess: false,
    hasProcessExecution: false,
    hasDangerousImports: false,
    hasCredentialAccess: false,
  }),
};

jest.mock('../../../src/services/HookScannerService.js', () => ({
  HookScannerService: jest.fn().mockImplementation(() => mockHookScannerInstance),
}));

// Mock FileService
const mockFileService = {
  exists: jest.fn(),
  readTextFile: jest.fn(),
  listFiles: jest.fn(),
};

jest.mock('../../../src/services/FileService.js', () => ({
  FileService: jest.fn().mockImplementation(() => mockFileService),
}));

// Create shared mock instances that we can reference
const mockUIServiceMethods = {
  colorError: jest.fn().mockImplementation((text: string) => text),
  colorInfo: jest.fn().mockImplementation((text: string) => text),
  colorMeta: jest.fn().mockImplementation((text: string) => text),
  colorSuccess: jest.fn().mockImplementation((text: string) => text),
};

// Mock UIService
jest.mock('../../../src/services/UIService.js', () => ({
  UIService: jest.fn().mockImplementation(() => mockUIServiceMethods),
}));

// Mock displayHookSafetySummary function
jest.mock('../../../src/ui/display.js', () => ({
  displayHookSafetySummary: jest.fn(),
}));

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  // Prevent actual process exit
  return undefined as never;
}) as jest.MockedFunction<typeof process.exit>;

// Ensure process.exit doesn't actually exit
Object.defineProperty(process, 'exit', {
  value: mockProcessExit,
  writable: true,
});

describe('Hook Actions', () => {
  let viewHookAction: any;
  let scanHooksAction: any;
  let listHooksAction: any;

  beforeAll(async () => {
    // Import after mocks are set up
    const hooksModule = await import('../../../src/actions/hooks.js');
    viewHookAction = hooksModule.viewHookAction;
    scanHooksAction = hooksModule.scanHooksAction;
    listHooksAction = hooksModule.listHooksAction;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock functions explicitly
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
    mockProcessExit.mockReset();

    // Reset FileService mocks
    mockFileService.exists.mockReset();
    mockFileService.readTextFile.mockReset();
    mockFileService.listFiles.mockReset();

    // Re-setup color mocks
    const { colors } = require('../../../src/utils/colors.js');
    colors.info = jest.fn().mockImplementation((text: string) => text);
    colors.meta = jest.fn().mockImplementation((text: string) => text);
    colors.success = jest.fn().mockImplementation((text: string) => text);
    colors.error = jest.fn().mockImplementation((text: string) => text);
    colors.warning = jest.fn().mockImplementation((text: string) => text);
    colors.stackName = jest.fn().mockImplementation((text: string) => text);
    colors.description = jest.fn().mockImplementation((text: string) => text);
    colors.number = jest.fn().mockImplementation((text: string) => text);

    // Re-setup UIService mocks to ensure they work correctly
    mockUIServiceMethods.colorError.mockReset();
    mockUIServiceMethods.colorInfo.mockReset();
    mockUIServiceMethods.colorMeta.mockReset();
    mockUIServiceMethods.colorSuccess.mockReset();
    mockUIServiceMethods.colorError.mockImplementation((text: string) => text);
    mockUIServiceMethods.colorInfo.mockImplementation((text: string) => text);
    mockUIServiceMethods.colorMeta.mockImplementation((text: string) => text);
    mockUIServiceMethods.colorSuccess.mockImplementation((text: string) => text);

    // Re-setup HookScannerService mocks
    mockHookScannerInstance.scanHook.mockReset();
    mockHookScannerInstance.scanHook.mockReturnValue({
      riskScore: 10,
      suspiciousPatterns: [],
      hasFileSystemAccess: false,
      hasNetworkAccess: false,
      hasProcessExecution: false,
      hasDangerousImports: false,
      hasCredentialAccess: false,
    });

    // Setup default FileService mocks
    mockFileService.exists.mockResolvedValue(false);
    mockFileService.readTextFile.mockResolvedValue('{}');
    mockFileService.listFiles.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(async () => {
    // Clean up all mocks
    jest.restoreAllMocks();
  });

  describe('viewHookAction', () => {
    it('should display hook details when hook exists', async () => {
      const mockStack = {
        hooks: [
          {
            name: 'test-hook',
            type: 'PreToolUse',
            filePath: './.claude/hooks/test-hook.py',
            content: '#!/usr/bin/env python3\nprint("test hook")',
            riskLevel: 'safe',
            scanResults: {
              riskScore: 5,
              suspiciousPatterns: [],
              hasFileSystemAccess: false,
              hasNetworkAccess: false,
              hasProcessExecution: false,
              hasDangerousImports: false,
              hasCredentialAccess: false,
            },
          },
        ],
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockResolvedValue(JSON.stringify(mockStack));

      await viewHookAction('test-stack.json', 'test-hook');

      expect(mockFileService.exists).toHaveBeenCalledWith('test-stack.json');
      expect(mockFileService.readTextFile).toHaveBeenCalledWith('test-stack.json');

      // Check that UI service methods were called
      expect(mockUIServiceMethods.colorInfo).toHaveBeenCalledWith('\n📋 Hook: test-hook');
      expect(mockUIServiceMethods.colorMeta).toHaveBeenCalledWith('Type: PreToolUse');
      expect(mockUIServiceMethods.colorMeta).toHaveBeenCalledWith('\n📁 Content:');
    });

    it('should handle missing stack file', async () => {
      mockFileService.exists.mockResolvedValue(false);

      await expect(viewHookAction('missing-stack.json', 'test-hook')).rejects.toThrow(
        'Stack file not found: missing-stack.json'
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to view hook:',
        'Stack file not found: missing-stack.json'
      );
    });

    it('should handle missing hook', async () => {
      const mockStack = {
        hooks: [
          {
            name: 'other-hook',
            type: 'PreToolUse',
            filePath: './.claude/hooks/other-hook.py',
            content: 'print("other")',
          },
        ],
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockResolvedValue(JSON.stringify(mockStack));

      await expect(viewHookAction('test-stack.json', 'missing-hook')).rejects.toThrow(
        'Hook "missing-hook" not found'
      );

      expect(mockConsoleError).toHaveBeenCalledWith('Hook "missing-hook" not found');
    });

    it('should handle stack with no hooks', async () => {
      const mockStack = { hooks: [] };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockResolvedValue(JSON.stringify(mockStack));

      await expect(viewHookAction('test-stack.json', 'test-hook')).rejects.toThrow(
        'Hook "test-hook" not found'
      );

      expect(mockConsoleError).toHaveBeenCalledWith('Hook "test-hook" not found');
    });

    it('should handle malformed stack file', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockRejectedValue(new Error('Invalid JSON'));

      await expect(viewHookAction('bad-stack.json', 'test-hook')).rejects.toThrow('Invalid JSON');

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to view hook:', 'Invalid JSON');
    });
  });

  describe('scanHooksAction', () => {
    it('should scan all hooks in a stack file', async () => {
      const mockStack = {
        hooks: [
          {
            name: 'safe-hook',
            type: 'PreToolUse',
            content: 'print("safe")',
            riskLevel: 'safe',
          },
          {
            name: 'risky-hook',
            type: 'PostToolUse',
            content: 'import os; os.system("rm -rf /")',
            riskLevel: 'dangerous',
          },
        ],
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockResolvedValue(JSON.stringify(mockStack));

      await scanHooksAction('test-stack.json', {});

      // Check that UI service methods were called
      expect(mockUIServiceMethods.colorInfo).toHaveBeenCalledWith(
        '🔍 Scanning 2 hooks for security issues...'
      );
    });

    it('should scan hooks in current directory when no stack file specified', async () => {
      const mockHookFiles = ['test-hook.py', 'another-hook.js'];

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.listFiles.mockResolvedValue(mockHookFiles);
      mockFileService.readTextFile.mockImplementation((filePath: string) => {
        if (filePath === '.claude/hooks/test-hook.py') {
          return Promise.resolve('#!/usr/bin/env python3\nprint("test")');
        }
        if (filePath === '.claude/hooks/another-hook.js') {
          return Promise.resolve('console.log("test")');
        }
        return Promise.resolve('');
      });

      await scanHooksAction(undefined, {});

      expect(mockFileService.exists).toHaveBeenCalledWith('.claude/hooks');
      expect(mockFileService.listFiles).toHaveBeenCalledWith('.claude/hooks');
    });

    it('should handle directory with no hooks', async () => {
      mockFileService.exists.mockResolvedValue(false);

      await scanHooksAction(undefined, {});

      expect(mockUIServiceMethods.colorInfo).toHaveBeenCalledWith('No hooks found to scan');
    });

    it('should handle stack file with no hooks', async () => {
      const mockStack = { hooks: [] };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockResolvedValue(JSON.stringify(mockStack));

      await scanHooksAction('empty-stack.json', {});

      expect(mockUIServiceMethods.colorInfo).toHaveBeenCalledWith('No hooks found to scan');
    });
  });

  describe('listHooksAction', () => {
    it('should list all hooks in a stack file', async () => {
      const mockStack = {
        hooks: [
          {
            name: 'pre-tool-hook',
            type: 'PreToolUse',
            filePath: './.claude/hooks/pre-tool-hook.py',
            riskLevel: 'safe',
          },
          {
            name: 'post-tool-hook',
            type: 'PostToolUse',
            filePath: './.claude/hooks/post-tool-hook.py',
            riskLevel: 'warning',
          },
        ],
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockResolvedValue(JSON.stringify(mockStack));

      await listHooksAction('test-stack.json', {});

      expect(mockUIServiceMethods.colorInfo).toHaveBeenCalledWith('📋 Found 2 hooks:');
    });

    it('should list hooks in current directory when no stack file specified', async () => {
      const mockHookFiles = ['session-start.py', 'notification.js'];

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.listFiles.mockResolvedValue(mockHookFiles);
      mockFileService.readTextFile.mockImplementation((filePath: string) => {
        return Promise.resolve('console.log("test")');
      });

      await listHooksAction(undefined, {});

      expect(mockFileService.exists).toHaveBeenCalledWith('.claude/hooks');
      expect(mockFileService.listFiles).toHaveBeenCalledWith('.claude/hooks');
    });

    it('should handle empty hooks directory', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.listFiles.mockResolvedValue([]);

      await listHooksAction(undefined, {});

      expect(mockUIServiceMethods.colorInfo).toHaveBeenCalledWith('No hooks found');
    });

    it('should handle directory that does not exist', async () => {
      mockFileService.exists.mockResolvedValue(false);

      await listHooksAction(undefined, {});

      expect(mockUIServiceMethods.colorInfo).toHaveBeenCalledWith('No hooks found');
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFileService.exists.mockRejectedValue(new Error('File system error'));

      await expect(viewHookAction('test-stack.json', 'test-hook')).rejects.toThrow(
        'File system error'
      );

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to view hook:', 'File system error');
    });

    it('should handle JSON parsing errors', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockRejectedValue(new SyntaxError('Unexpected token'));

      await expect(scanHooksAction('invalid.json', {})).rejects.toThrow('Unexpected token');

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to scan hooks:', 'Unexpected token');
    });

    it('should handle directory read errors', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.listFiles.mockRejectedValue(new Error('Permission denied'));

      await expect(listHooksAction(undefined, {})).rejects.toThrow('Permission denied');

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to list hooks:', 'Permission denied');
    });
  });

  describe('Additional coverage for edge cases', () => {
    beforeEach(() => {
      mockConsoleLog.mockClear();
      mockConsoleError.mockClear();
      jest.clearAllMocks();
    });

    it('should handle hooks with optional fields', async () => {
      const hookWithOptionalFields = {
        name: 'test-hook',
        type: 'pre-commit',
        content: 'echo "test"',
        description: 'Test hook description',
        matcher: '*.js',
        scanResults: {
          riskScore: 5,
          suspiciousPatterns: ['suspicious pattern'],
          hasFileSystemAccess: true,
          hasNetworkAccess: false,
          hasProcessExecution: true,
          hasDangerousImports: false,
          hasCredentialAccess: false,
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockResolvedValue(
        JSON.stringify({ hooks: [hookWithOptionalFields] })
      );

      await viewHookAction('test-stack.json', 'test-hook');

      // Just verify the function executed without error
      expect(mockFileService.readTextFile).toHaveBeenCalled();
    });

    it('should handle empty stacks in scan operations', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readTextFile.mockResolvedValue(JSON.stringify({ commands: [] }));

      // This should complete without errors and cover the no-hooks branches
      await expect(scanHooksAction('test-stack.json', { verbose: false })).resolves.not.toThrow();
    });

    it('should handle empty directories', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.listFiles.mockResolvedValue([]);

      // This should complete without errors
      await expect(scanHooksAction(undefined, { verbose: false })).resolves.not.toThrow();
    });
  });
});
