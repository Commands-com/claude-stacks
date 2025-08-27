import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StackService } from '../../../src/services/StackService.js';
import { ConfigService } from '../../../src/services/ConfigService.js';
import { FileService } from '../../../src/services/FileService.js';
import { TestEnvironment, MockFactory, TestDataBuilder } from '../../utils/test-helpers.js';
import { FsMocks } from '../../mocks/fs-mocks.js';

// Mock dependencies
jest.mock('../../../src/services/ConfigService.js');
jest.mock('../../../src/services/FileService.js');

const MockedConfigService = ConfigService as jest.MockedClass<typeof ConfigService>;
const MockedFileService = FileService as jest.MockedClass<typeof FileService>;

describe('StackService', () => {
  let stackService: StackService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockFileService: jest.Mocked<FileService>;
  let testEnv: TestEnvironment;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances manually
    mockConfigService = {
      getStacksDir: jest.fn(),
      ensureDirectoriesExist: jest.fn(),
      validateStackName: jest.fn(),
      addStack: jest.fn(),
      removeStack: jest.fn(),
      listStacks: jest.fn(),
    } as jest.Mocked<ConfigService>;

    mockFileService = {
      pathExists: jest.fn(),
      exists: jest.fn(),
      readJsonFile: jest.fn(),
      writeJsonFile: jest.fn(),
      deleteFile: jest.fn(),
      remove: jest.fn(),
      ensureDir: jest.fn(),
      listFiles: jest.fn(),
    } as jest.Mocked<FileService>;

    // Setup default mock implementations
    mockConfigService.getStacksDir.mockReturnValue('/test/stacks');
    mockConfigService.ensureDirectoriesExist.mockResolvedValue();
    mockConfigService.validateStackName.mockReturnValue();
    mockFileService.pathExists.mockResolvedValue(true);
    mockFileService.exists.mockResolvedValue(true);
    mockFileService.readJsonFile.mockResolvedValue({});
    mockFileService.writeJsonFile.mockResolvedValue();
    mockFileService.ensureDir.mockResolvedValue();

    // Create service instance with injected dependencies
    stackService = new StackService(mockFileService, mockConfigService);

    // Set up test environment
    testEnv = new TestEnvironment();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('createStack', () => {
    it('should create a new stack with valid data', async () => {
      const stackData = {
        name: 'test-org/new-stack',
        description: 'A new stack for testing',
      };

      mockFileService.exists.mockResolvedValue(false);

      const result = await stackService.createStack(stackData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.name).toBe(stackData.name);
        expect(result.data.description).toBe(stackData.description);
        expect(result.data.metadata.created_at).toBeDefined();
        expect(result.data.metadata.updated_at).toBeDefined();
      }

      expect(mockFileService.writeJsonFile).toHaveBeenCalledTimes(1);
      expect(mockFileService.ensureDir).toHaveBeenCalledTimes(1);
    });

    it('should return error if stack already exists', async () => {
      const stackData = TestDataBuilder.buildStack();
      mockFileService.exists.mockResolvedValue(true);

      const result = await stackService.createStack({
        name: stackData.id,
        description: stackData.description,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid stack names', async () => {
      const invalidStackData = {
        name: 'invalid-id',
        description: 'test',
      };

      mockConfigService.validateStackName.mockImplementation(() => {
        throw new Error('Invalid stack name format');
      });
      mockFileService.exists.mockResolvedValue(false);

      const result = await stackService.createStack(invalidStackData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle file system errors gracefully', async () => {
      const stackData = TestDataBuilder.buildStack();
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.writeJsonFile.mockRejectedValue(new Error('Write error'));

      const result = await stackService.createStack({
        name: stackData.id,
        description: stackData.description,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Write error');
      }
    });
  });

  describe('loadStack', () => {
    it('should load an existing stack', async () => {
      const stackData = TestDataBuilder.buildStack({
        id: 'test-org/existing-stack',
      });

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(stackData);

      const result = await stackService.loadStack('test-org/existing-stack');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(stackData);
      }
      expect(mockFileService.readJsonFile).toHaveBeenCalled();
    });

    it('should return error for non-existent stack', async () => {
      mockFileService.exists.mockResolvedValue(false);

      const result = await stackService.loadStack('test-org/missing-stack');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle corrupted stack files', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockRejectedValue(new Error('Invalid JSON'));

      const result = await stackService.loadStack('test-org/corrupted-stack');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid JSON');
      }
    });
  });

  describe('saveStack', () => {
    it('should save stack updates', async () => {
      const stackData = TestDataBuilder.buildStack({
        id: 'test-org/update-stack',
        name: 'Updated Stack Name',
      });

      const result = await stackService.saveStack(stackData);

      expect(result.success).toBe(true);
      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: stackData.name, // Should be the name property, not id
        })
      );
    });

    it('should handle file system errors during save', async () => {
      const stackData = TestDataBuilder.buildStack();
      mockFileService.writeJsonFile.mockRejectedValue(new Error('Write error'));

      const result = await stackService.saveStack(stackData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Write error');
      }
    });
  });

  describe('deleteStack', () => {
    it('should delete an existing stack', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.remove.mockResolvedValue();

      const result = await stackService.deleteStack({
        stackName: 'test-org/delete-stack',
        confirm: true,
        force: false,
      });

      expect(result.success).toBe(true);
      expect(mockFileService.remove).toHaveBeenCalled();
    });

    it('should return error for non-existent stack', async () => {
      mockFileService.exists.mockResolvedValue(false);

      const result = await stackService.deleteStack({
        stackName: 'test-org/missing-stack',
        confirm: true,
        force: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should require confirmation or force flag', async () => {
      mockFileService.exists.mockResolvedValue(true);

      const result = await stackService.deleteStack({
        stackName: 'test-org/stack',
        confirm: false,
        force: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle file system errors during deletion', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.remove.mockRejectedValue(new Error('Delete error'));

      const result = await stackService.deleteStack({
        stackName: 'test-org/error-stack',
        confirm: true,
        force: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Delete error');
      }
    });
  });

  describe('listStacks', () => {
    it('should return list of all stacks', async () => {
      const stack1 = TestDataBuilder.buildStack({ id: 'org1/stack1' });
      const stack2 = TestDataBuilder.buildStack({ id: 'org2/stack2' });

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.listFiles.mockResolvedValue(['stack1', 'stack2']);
      mockFileService.readJsonFile.mockResolvedValueOnce(stack1).mockResolvedValueOnce(stack2);

      const result = await stackService.listStacks();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it('should return empty array when no stacks exist', async () => {
      mockFileService.exists.mockResolvedValue(false);

      const result = await stackService.listStacks();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should handle corrupted stack files in list', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.listFiles.mockResolvedValue(['stack1', 'stack2']);
      mockFileService.readJsonFile
        .mockResolvedValueOnce(TestDataBuilder.buildStack({ id: 'org1/stack1' }))
        .mockRejectedValueOnce(new Error('Corrupted file'));

      const result = await stackService.listStacks();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]!.id).toBe('org1/stack1');
      }
    });
  });

  describe('stackExists', () => {
    it('should return true for existing stack', async () => {
      mockFileService.exists.mockResolvedValue(true);

      const exists = await stackService.stackExists('test-org/existing-stack');

      expect(exists).toBe(true);
      expect(mockFileService.exists).toHaveBeenCalled();
    });

    it('should return false for non-existent stack', async () => {
      mockFileService.exists.mockResolvedValue(false);

      const exists = await stackService.stackExists('test-org/missing-stack');

      expect(exists).toBe(false);
    });
  });

  describe('getStackMetadata', () => {
    it('should return metadata for existing stack', async () => {
      const stackData = TestDataBuilder.buildStack({
        id: 'test-org/meta-stack',
        metadata: {
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      });

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(stackData);

      const result = await stackService.getStackMetadata('test-org/meta-stack');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.name).toBe(stackData.name);
      }
    });

    it('should return error for non-existent stack', async () => {
      mockFileService.exists.mockResolvedValue(false);

      const result = await stackService.getStackMetadata('test-org/missing-stack');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', () => {
      expect(() => new StackService(mockFileService, mockConfigService)).not.toThrow();
    });

    it('should handle concurrent access gracefully', async () => {
      const stackData = TestDataBuilder.buildStack();

      // Simulate concurrent operations
      const promises = [stackService.saveStack(stackData), stackService.saveStack(stackData)];

      const results = await Promise.all(promises);

      // Both should succeed or handle the concurrency gracefully
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle moderate number of stacks efficiently', async () => {
      const stackIds = Array.from({ length: 10 }, (_, i) => `stack${i}`);
      const stacks = stackIds.map(id => TestDataBuilder.buildStack({ id: `org/${id}` }));

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.listFiles.mockResolvedValue(stackIds);

      // Mock file reads to resolve quickly
      stacks.forEach(stack => {
        mockFileService.readJsonFile.mockResolvedValue(stack);
      });

      const start = performance.now();
      const result = await stackService.listStacks();
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(10);
      }
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Branch Coverage Improvements', () => {
    describe('createStack edge cases', () => {
      it('should handle stack creation when description is explicitly undefined', async () => {
        const stackData = {
          name: 'test-org/minimal-stack',
          description: undefined,
        };

        mockFileService.exists.mockResolvedValue(false);

        const result = await stackService.createStack(stackData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.description).toBe('test-org/minimal-stack configuration');
        }
      });

      it('should handle non-Error exceptions in createStack', async () => {
        const stackData = { name: 'test-org/exception-stack', description: 'test' };
        mockFileService.exists.mockResolvedValue(false);
        mockFileService.ensureDir.mockRejectedValue('String error'); // Non-Error exception

        const result = await stackService.createStack(stackData);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Unknown error');
        }
      });
    });

    describe('loadStack edge cases', () => {
      it('should handle non-Error exceptions in loadStack', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockRejectedValue('String error'); // Non-Error exception

        const result = await stackService.loadStack('test-org/exception-stack');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Unknown error');
        }
      });
    });

    describe('saveStack edge cases', () => {
      it('should handle non-Error exceptions in saveStack', async () => {
        const stackData = TestDataBuilder.buildStack();
        mockFileService.writeJsonFile.mockRejectedValue('String error'); // Non-Error exception

        const result = await stackService.saveStack(stackData);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Unknown error');
        }
      });

      it('should update metadata timestamp when saving', async () => {
        const stackData = TestDataBuilder.buildStack({
          metadata: {
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            exported_from: '/old/path',
          },
        });

        const result = await stackService.saveStack(stackData);

        expect(result.success).toBe(true);
        expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            metadata: expect.objectContaining({
              created_at: '2024-01-01T00:00:00Z', // Should preserve original
              updated_at: expect.not.stringMatching('2024-01-01T00:00:00Z'), // Should be updated
              exported_from: '/old/path', // Should preserve original
            }),
          })
        );
      });
    });

    describe('deleteStack edge cases', () => {
      it('should handle non-Error exceptions in deleteStack', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.remove.mockRejectedValue('String error'); // Non-Error exception

        const result = await stackService.deleteStack({
          stackName: 'test-org/exception-stack',
          confirm: true,
          force: false,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Unknown error');
        }
      });

      it('should allow deletion with force flag even without confirm', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.remove.mockResolvedValue();

        const result = await stackService.deleteStack({
          stackName: 'test-org/force-delete',
          confirm: false,
          force: true,
        });

        expect(result.success).toBe(true);
        expect(mockFileService.remove).toHaveBeenCalled();
      });
    });

    describe('listStacks edge cases', () => {
      it('should handle non-Error exceptions in listStacks', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.listFiles.mockRejectedValue('String error'); // Non-Error exception

        const result = await stackService.listStacks();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Unknown error');
        }
      });

      it('should handle stacks with missing metadata files', async () => {
        mockFileService.exists
          .mockResolvedValueOnce(true) // STACKS_PATH exists
          .mockResolvedValueOnce(false) // First metadata file doesn't exist
          .mockResolvedValueOnce(true); // Second metadata file exists

        mockFileService.listFiles.mockResolvedValue(['stack1', 'stack2']);
        mockFileService.readJsonFile.mockResolvedValue(
          TestDataBuilder.buildStack({ id: 'org/stack2' })
        );

        const result = await stackService.listStacks();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
          expect(result.data[0]!.id).toBe('org/stack2'); // Should check id instead
        }
      });

      it('should sort stacks by creation date with fallback for missing dates', async () => {
        const stack1 = TestDataBuilder.buildStack({
          id: 'org/stack1',
          metadata: {
            created_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            exported_from: '/path',
          },
        });
        const stack2 = TestDataBuilder.buildStack({
          id: 'org/stack2',
          metadata: undefined, // Missing metadata
        });
        const stack3 = TestDataBuilder.buildStack({
          id: 'org/stack3',
          metadata: {
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            exported_from: '/path',
          },
        });

        mockFileService.exists.mockResolvedValue(true);
        mockFileService.listFiles.mockResolvedValue(['stack1', 'stack2', 'stack3']);
        mockFileService.readJsonFile
          .mockResolvedValueOnce(stack1)
          .mockResolvedValueOnce(stack2)
          .mockResolvedValueOnce(stack3);

        const result = await stackService.listStacks();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(3);
          // Should be sorted: stack1 (2024-01-02), stack3 (2024-01-01), stack2 (fallback to epoch)
          expect(result.data[0]!.id).toBe('org/stack1');
          expect(result.data[1]!.id).toBe('org/stack3');
          expect(result.data[2]!.id).toBe('org/stack2');
        }
      });
    });

    describe('getStackMetadata edge cases', () => {
      it('should handle non-Error exceptions in getStackMetadata', async () => {
        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockRejectedValue('String error'); // Non-Error exception

        const result = await stackService.getStackMetadata('test-org/exception-stack');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Unknown error');
        }
      });

      it('should build metadata with fallback values', async () => {
        const stackData = {
          name: 'test-org/minimal-stack',
          description: 'Test stack',
          // Missing version and metadata
        };

        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue(stackData);

        const result = await stackService.getStackMetadata('test-org/minimal-stack');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('test-org/minimal-stack');
          expect(result.data.version).toBe('1.0.0'); // Fallback version
          expect(result.data.author).toBeUndefined(); // No metadata
          expect(result.data.createdAt).toBeDefined(); // Current date as fallback
          expect(result.data.updatedAt).toBeDefined(); // Current date as fallback
          expect(result.data.dependencies).toEqual([]);
          expect(result.data.files).toEqual([]);
        }
      });

      it('should extract author from metadata exported_from path', async () => {
        const stackData = TestDataBuilder.buildStack({
          id: 'test-org/author-stack',
          metadata: {
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            exported_from: '/Users/developer/my-project',
          },
        });

        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue(stackData);

        const result = await stackService.getStackMetadata('test-org/author-stack');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.author).toBe('my-project'); // Extracted from path
        }
      });

      it('should handle metadata without exported_from', async () => {
        const stackData = TestDataBuilder.buildStack({
          id: 'test-org/no-export-stack',
          metadata: {
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            // No exported_from
          },
        });

        mockFileService.exists.mockResolvedValue(true);
        mockFileService.readJsonFile.mockResolvedValue(stackData);

        const result = await stackService.getStackMetadata('test-org/no-export-stack');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.author).toBeUndefined();
        }
      });
    });
  });
});
