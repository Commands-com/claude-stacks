import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { StackController } from '../../../src/controllers/StackController.js';
import { StackService } from '../../../src/services/StackService.js';
import { FileService } from '../../../src/services/FileService.js';
import { ConfigService } from '../../../src/services/ConfigService.js';
import {
  StackNotFoundError,
  StackAlreadyExistsError,
  ValidationError,
  FileSystemError,
} from '../../../src/types/errors.js';
import type { CreateStackArgs, DeleteStackArgs, DeveloperStack } from '../../../src/types/stack.js';
import { TestDataBuilder } from '../../utils/test-helpers.js';

// Mock dependencies
jest.mock('../../../src/services/StackService.js');
jest.mock('../../../src/services/FileService.js');
jest.mock('../../../src/services/ConfigService.js');

const MockedStackService = StackService as jest.MockedClass<typeof StackService>;
const MockedFileService = FileService as jest.MockedClass<typeof FileService>;
const MockedConfigService = ConfigService as jest.MockedClass<typeof ConfigService>;

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    success: jest.fn((text: string) => text),
    error: jest.fn((text: string) => text),
    info: jest.fn((text: string) => text),
    warning: jest.fn((text: string) => text),
    meta: jest.fn((text: string) => text),
    stackName: jest.fn((text: string) => text),
    number: jest.fn((text: string) => text),
  },
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

describe('StackController', () => {
  let stackController: StackController;
  let mockStackService: jest.Mocked<StackService>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Mock StackService instance
    mockStackService = new MockedStackService() as jest.Mocked<StackService>;

    // Replace the StackService constructor to return our mock
    MockedStackService.mockImplementation(() => mockStackService);
    MockedFileService.mockImplementation(() => ({}) as any);
    MockedConfigService.mockImplementation(() => ({}) as any);

    stackController = new StackController();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe('constructor', () => {
    it('should initialize with FileService and ConfigService', () => {
      expect(MockedFileService).toHaveBeenCalled();
      expect(MockedConfigService).toHaveBeenCalled();
      expect(MockedStackService).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    });
  });

  describe('handleCreate', () => {
    const createArgs: CreateStackArgs = {
      name: 'test-org/new-stack',
      description: 'A test stack',
    };

    it('should handle successful stack creation', async () => {
      const stackData = TestDataBuilder.buildStack(createArgs);
      mockStackService.createStack.mockResolvedValue({
        success: true,
        data: stackData,
      });

      await stackController.handleCreate(createArgs);

      expect(mockStackService.createStack).toHaveBeenCalledWith(createArgs);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('created successfully'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Location: ~/.claude/stacks/')
      );
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should handle creation failure', async () => {
      const error = new StackAlreadyExistsError('test-org/existing-stack');
      mockStackService.createStack.mockResolvedValue({
        success: false,
        error,
      });

      await expect(stackController.handleCreate(createArgs)).rejects.toThrow('process.exit called');

      expect(mockStackService.createStack).toHaveBeenCalledWith(createArgs);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(error.message));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('existing stacks'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle unexpected errors during creation', async () => {
      const error = new Error('Unexpected error');
      mockStackService.createStack.mockRejectedValue(error);

      await expect(stackController.handleCreate(createArgs)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('unexpected error occurred')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show stack trace in development mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Development error');
      error.stack = 'Stack trace here';
      mockStackService.createStack.mockRejectedValue(error);

      await expect(stackController.handleCreate(createArgs)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Stack trace here'));

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should show stack trace when DEBUG is set', async () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';

      const error = new Error('Debug error');
      error.stack = 'Debug stack trace';
      mockStackService.createStack.mockRejectedValue(error);

      await expect(stackController.handleCreate(createArgs)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Debug stack trace'));

      process.env.DEBUG = originalDebug;
    });
  });

  describe('handleList', () => {
    it('should display list of stacks', async () => {
      const stacks: DeveloperStack[] = [
        TestDataBuilder.buildStack({
          id: 'org1/stack1',
          name: 'Stack 1',
          version: '1.0.0',
          commands: ['cmd1'],
          agents: ['agent1'],
          mcpServers: [],
        }),
        TestDataBuilder.buildStack({
          id: 'org2/stack2',
          name: 'Stack 2',
          version: '2.0.0',
          commands: [],
          agents: [],
          mcpServers: ['server1', 'server2'],
        }),
      ];

      mockStackService.listStacks.mockResolvedValue({
        success: true,
        data: stacks,
      });

      await stackController.handleList();

      expect(mockStackService.listStacks).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Local Development Stacks')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 2 local stack(s)'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Stack 1'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Stack 2'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('v1.0.0, 2 items'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('v2.0.0, 2 items'));
    });

    it('should handle empty stack list', async () => {
      mockStackService.listStacks.mockResolvedValue({
        success: true,
        data: [],
      });

      await stackController.handleList();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No stacks found'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export your first stack')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('claude-stacks export'));
    });

    it('should handle stacks with missing version', async () => {
      const stackWithoutVersion = TestDataBuilder.buildStack({
        id: 'org/no-version',
        name: 'No Version Stack',
      });
      delete (stackWithoutVersion as any).version;

      mockStackService.listStacks.mockResolvedValue({
        success: true,
        data: [stackWithoutVersion],
      });

      await stackController.handleList();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('v1.0.0')); // fallback version
    });

    it('should handle stacks with missing component arrays', async () => {
      const minimalStack = TestDataBuilder.buildStack({
        id: 'org/minimal',
        name: 'Minimal Stack',
      });
      delete (minimalStack as any).commands;
      delete (minimalStack as any).agents;
      delete (minimalStack as any).mcpServers;

      mockStackService.listStacks.mockResolvedValue({
        success: true,
        data: [minimalStack],
      });

      await stackController.handleList();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('0 items'));
    });

    it('should handle listing failure', async () => {
      const error = new FileSystemError('list', '/stacks', new Error('Permission denied'));
      mockStackService.listStacks.mockResolvedValue({
        success: false,
        error,
      });

      await expect(stackController.handleList()).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(error.message));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('file permissions'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle unexpected errors during listing', async () => {
      const error = new Error('Service unavailable');
      mockStackService.listStacks.mockRejectedValue(error);

      await expect(stackController.handleList()).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('unexpected error occurred')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('handleDelete', () => {
    const deleteArgs: DeleteStackArgs = {
      stackName: 'test-org/delete-stack',
      confirm: true,
      force: false,
    };

    it('should handle successful stack deletion', async () => {
      mockStackService.deleteStack.mockResolvedValue({
        success: true,
        data: undefined,
      });

      await stackController.handleDelete(deleteArgs);

      expect(mockStackService.deleteStack).toHaveBeenCalledWith(deleteArgs);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('deleted successfully'));
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should handle deletion failure', async () => {
      const error = new StackNotFoundError('test-org/missing-stack');
      mockStackService.deleteStack.mockResolvedValue({
        success: false,
        error,
      });

      await expect(stackController.handleDelete(deleteArgs)).rejects.toThrow('process.exit called');

      expect(mockStackService.deleteStack).toHaveBeenCalledWith(deleteArgs);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(error.message));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('available stacks'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle unexpected errors during deletion', async () => {
      const error = new Error('Deletion failed');
      mockStackService.deleteStack.mockRejectedValue(error);

      await expect(stackController.handleDelete(deleteArgs)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('unexpected error occurred')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('stackExists', () => {
    it('should return true for existing stack', async () => {
      mockStackService.stackExists.mockResolvedValue(true);

      const result = await stackController.stackExists('test-org/existing-stack');

      expect(result).toBe(true);
      expect(mockStackService.stackExists).toHaveBeenCalledWith('test-org/existing-stack');
    });

    it('should return false for non-existent stack', async () => {
      mockStackService.stackExists.mockResolvedValue(false);

      const result = await stackController.stackExists('test-org/missing-stack');

      expect(result).toBe(false);
      expect(mockStackService.stackExists).toHaveBeenCalledWith('test-org/missing-stack');
    });
  });

  describe('loadStack', () => {
    it('should return stack data on successful load', async () => {
      const stackData = TestDataBuilder.buildStack({ id: 'test-org/load-stack' });
      mockStackService.loadStack.mockResolvedValue({
        success: true,
        data: stackData,
      });

      const result = await stackController.loadStack('test-org/load-stack');

      expect(result).toEqual(stackData);
      expect(mockStackService.loadStack).toHaveBeenCalledWith('test-org/load-stack');
    });

    it('should return null on load failure', async () => {
      mockStackService.loadStack.mockResolvedValue({
        success: false,
        error: new StackNotFoundError('test-org/missing-stack'),
      });

      const result = await stackController.loadStack('test-org/missing-stack');

      expect(result).toBe(null);
      expect(mockStackService.loadStack).toHaveBeenCalledWith('test-org/missing-stack');
    });
  });

  describe('error handling', () => {
    describe('handleError', () => {
      it('should handle StackNotFoundError', async () => {
        const error = new StackNotFoundError('test-org/missing');
        mockStackService.createStack.mockResolvedValue({
          success: false,
          error,
        });

        await expect(
          stackController.handleCreate({ name: 'test', description: 'test' })
        ).rejects.toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(error.message));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('available stacks'));
      });

      it('should handle StackAlreadyExistsError', async () => {
        const error = new StackAlreadyExistsError('test-org/existing');
        mockStackService.createStack.mockResolvedValue({
          success: false,
          error,
        });

        await expect(
          stackController.handleCreate({ name: 'test', description: 'test' })
        ).rejects.toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(error.message));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('existing stacks'));
      });

      it('should handle ValidationError', async () => {
        const error = new ValidationError('name', 'invalid', 'valid format');
        mockStackService.createStack.mockResolvedValue({
          success: false,
          error,
        });

        await expect(
          stackController.handleCreate({ name: 'test', description: 'test' })
        ).rejects.toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(error.message));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('check your input'));
      });

      it('should handle FileSystemError', async () => {
        const error = new FileSystemError('write', '/test/path', new Error('Permission denied'));
        mockStackService.createStack.mockResolvedValue({
          success: false,
          error,
        });

        await expect(
          stackController.handleCreate({ name: 'test', description: 'test' })
        ).rejects.toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(error.message));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('file permissions'));
      });

      it('should handle non-StackError as unexpected error', async () => {
        const error = new Error('Generic error');
        mockStackService.createStack.mockResolvedValue({
          success: false,
          error,
        });

        await expect(
          stackController.handleCreate({ name: 'test', description: 'test' })
        ).rejects.toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('unexpected error occurred')
        );
      });
    });

    describe('handleUnexpectedError', () => {
      it('should handle Error instances', async () => {
        const error = new Error('Unexpected error');
        mockStackService.createStack.mockRejectedValue(error);

        await expect(
          stackController.handleCreate({ name: 'test', description: 'test' })
        ).rejects.toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('unexpected error occurred')
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'));
      });

      it('should handle non-Error exceptions', async () => {
        mockStackService.createStack.mockRejectedValue('String error');

        await expect(
          stackController.handleCreate({ name: 'test', description: 'test' })
        ).rejects.toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('unexpected error occurred')
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('String error'));
      });

      it('should not show stack trace in production mode', async () => {
        const originalNodeEnv = process.env.NODE_ENV;
        const originalDebug = process.env.DEBUG;
        process.env.NODE_ENV = 'production';
        process.env.DEBUG = '';

        const error = new Error('Production error');
        error.stack = 'Should not show';
        mockStackService.createStack.mockRejectedValue(error);

        await expect(
          stackController.handleCreate({ name: 'test', description: 'test' })
        ).rejects.toThrow('process.exit called');

        expect(consoleErrorSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Should not show')
        );

        process.env.NODE_ENV = originalNodeEnv;
        process.env.DEBUG = originalDebug;
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple operations sequentially', async () => {
      const createArgs = { name: 'test-org/multi-stack', description: 'Test stack' };
      const stackData = TestDataBuilder.buildStack(createArgs);

      // Setup mock responses
      mockStackService.createStack.mockResolvedValue({ success: true, data: stackData });
      mockStackService.stackExists.mockResolvedValue(true);
      mockStackService.loadStack.mockResolvedValue({ success: true, data: stackData });

      // Execute operations
      await stackController.handleCreate(createArgs);
      const exists = await stackController.stackExists('test-org/multi-stack');
      const loaded = await stackController.loadStack('test-org/multi-stack');

      expect(exists).toBe(true);
      expect(loaded).toEqual(stackData);
    });

    it('should handle rapid successive calls', async () => {
      mockStackService.stackExists.mockResolvedValue(true);

      const promises = Array.from({ length: 5 }, () =>
        stackController.stackExists('test-org/concurrent-test')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every(result => result === true)).toBe(true);
      expect(mockStackService.stackExists).toHaveBeenCalledTimes(5);
    });
  });
});
