import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StackController } from '../../../src/controllers/StackController.js';
import { StackService } from '../../../src/services/StackService.js';
import { ConfigService } from '../../../src/services/ConfigService.js';
import { TestEnvironment, _TestDataBuilder } from '../../utils/test-helpers.js';
import { setupApiMocks, _mockFetch } from '../../mocks/api-mocks.js';

// Mock services
jest.mock('../../../src/services/StackService.js');
jest.mock('../../../src/services/ConfigService.js');

// Mock process.exit to prevent test termination
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

const MockedStackService = StackService as jest.MockedClass<typeof StackService>;
const MockedConfigService = ConfigService as jest.MockedClass<typeof ConfigService>;

describe('StackController Integration Tests', () => {
  let stackController: StackController;
  let mockStackService: jest.Mocked<StackService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let testEnv: TestEnvironment;

  beforeEach(() => {
    testEnv = new TestEnvironment();
    jest.clearAllMocks();
    mockProcessExit.mockClear();

    // Setup service mocks
    mockStackService = {
      createStack: jest.fn(),
      stackExists: jest.fn(),
      loadStack: jest.fn(),
      deleteStack: jest.fn(),
    } as any;

    mockConfigService = {
      addStack: jest.fn(),
      removeStack: jest.fn(),
    } as any;

    // Mock the constructor to use our mocked services
    MockedStackService.mockImplementation(() => mockStackService);
    MockedConfigService.mockImplementation(() => mockConfigService);

    // Create controller instance
    stackController = new StackController();

    // Mock error handling methods to prevent process.exit
    jest.spyOn(stackController as any, 'handleError').mockImplementation(() => {});
    jest.spyOn(stackController as any, 'handleUnexpectedError').mockImplementation(() => {});

    // Setup API mocks
    setupApiMocks();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Stack Management', () => {
    it('should create stack successfully', async () => {
      const createArgs = {
        name: 'lifecycle-test',
        description: 'Testing stack creation',
      };

      // Mock service responses for creation
      mockStackService.createStack.mockResolvedValue({ success: true });

      // Test creation - should not throw
      await expect(stackController.handleCreate(createArgs)).resolves.not.toThrow();

      // Verify service was called correctly
      expect(mockStackService.createStack).toHaveBeenCalledWith(createArgs);
    });

    it('should check if stack exists', async () => {
      const stackName = 'test-stack';

      mockStackService.stackExists.mockResolvedValue(true);

      const exists = await stackController.stackExists(stackName);
      expect(exists).toBe(true);
      expect(mockStackService.stackExists).toHaveBeenCalledWith(stackName);
    });

    it('should load stack', async () => {
      const stackName = 'test-stack';
      const stackData = TestDataBuilder.buildStack({
        name: stackName,
        description: 'Test stack',
      });

      mockStackService.loadStack.mockResolvedValue({ success: true, data: stackData });

      const result = await stackController.loadStack(stackName);
      expect(result).toEqual(stackData);
      expect(mockStackService.loadStack).toHaveBeenCalledWith(stackName);
    });

    it('should handle deletion successfully', async () => {
      const deleteArgs = { name: 'test-stack' };

      mockStackService.deleteStack.mockResolvedValue({ success: true });

      await expect(stackController.handleDelete(deleteArgs)).resolves.not.toThrow();

      expect(mockStackService.deleteStack).toHaveBeenCalledWith(deleteArgs);
    });

    it('should handle stack creation failure', async () => {
      const createArgs = {
        name: 'test-stack',
        description: 'Test stack',
      };

      // Mock service to return failure
      mockStackService.createStack.mockResolvedValue({
        success: false,
        error: 'Stack already exists',
      });

      // Should handle the service failure gracefully
      await expect(stackController.handleCreate(createArgs)).resolves.not.toThrow();

      expect(mockStackService.createStack).toHaveBeenCalledWith(createArgs);
    });

    it('should handle stack loading failure', async () => {
      const stackName = 'non-existent-stack';

      mockStackService.loadStack.mockResolvedValue({
        success: false,
        error: 'Stack not found',
      });

      const result = await stackController.loadStack(stackName);
      expect(result).toBeNull();
      expect(mockStackService.loadStack).toHaveBeenCalledWith(stackName);
    });
  });

  describe('Stack List Operations', () => {
    it('should handle list operation', async () => {
      // handleList doesn't return data, just logs to console
      await expect(stackController.handleList()).resolves.not.toThrow();
    });
  });

  describe('Service Integration', () => {
    it('should handle service errors gracefully', async () => {
      const stackName = 'test-stack';

      // Mock service error
      mockStackService.loadStack.mockResolvedValue({
        success: false,
        error: 'Service error',
      });

      const result = await stackController.loadStack(stackName);
      expect(result).toBeNull();
    });
  });
});
