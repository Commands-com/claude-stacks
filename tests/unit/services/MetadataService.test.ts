import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import type { PublishedStackMetadata } from '../../../src/types/index.js';

// Mock the metadata and version utilities
const mockGetAllPublishedStacks = jest.fn();
const mockGetPublishedStackMetadata = jest.fn();
const mockSavePublishedStackMetadata = jest.fn();
const mockFindStackByStackId = jest.fn();
const mockRemovePublishedStackMetadata = jest.fn();

jest.mock('../../../src/utils/metadata.ts', () => ({
  getAllPublishedStacks: mockGetAllPublishedStacks,
  getPublishedStackMetadata: mockGetPublishedStackMetadata,
  savePublishedStackMetadata: mockSavePublishedStackMetadata,
  findStackByStackId: mockFindStackByStackId,
  removePublishedStackMetadata: mockRemovePublishedStackMetadata,
}));

const mockIsValidVersion = jest.fn();
const mockGenerateSuggestedVersion = jest.fn();

jest.mock('../../../src/utils/version.ts', () => ({
  isValidVersion: mockIsValidVersion,
  generateSuggestedVersion: mockGenerateSuggestedVersion,
}));

// Import MetadataService after setting up mocks
import { MetadataService } from '../../../src/services/MetadataService.js';

describe('MetadataService', () => {
  let metadataService: MetadataService;

  const mockMetadata: PublishedStackMetadata = {
    stack_id: 'test-org/test-stack',
    exported_from: 'https://commands.com/stacks/test-org/test-stack',
    name: 'Test Stack',
    description: 'A test stack',
    version: '1.0.0',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z',
  };

  const mockAllStacks = {
    '/test/project1': mockMetadata,
    '/test/project2': {
      stack_id: 'test-org/another-stack',
      exported_from: 'https://commands.com/stacks/test-org/another-stack',
      name: 'Another Stack',
      description: 'Another test stack',
      version: '2.0.0',
      created_at: '2023-01-02T00:00:00.000Z',
      updated_at: '2023-01-02T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockGetAllPublishedStacks.mockReset();
    mockGetPublishedStackMetadata.mockReset();
    mockSavePublishedStackMetadata.mockReset();
    mockFindStackByStackId.mockReset();
    mockRemovePublishedStackMetadata.mockReset();
    mockIsValidVersion.mockReset();
    mockGenerateSuggestedVersion.mockReset();

    metadataService = new MetadataService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getAllPublishedStacks', () => {
    it('should return all published stacks metadata', async () => {
      mockGetAllPublishedStacks.mockResolvedValue(mockAllStacks);

      const result = await metadataService.getAllPublishedStacks();

      expect(mockGetAllPublishedStacks).toHaveBeenCalled();
      expect(result).toEqual(mockAllStacks);
    });

    it('should return empty object when no stacks are published', async () => {
      mockGetAllPublishedStacks.mockResolvedValue({});

      const result = await metadataService.getAllPublishedStacks();

      expect(result).toEqual({});
    });

    it('should handle errors from getAllPublishedStacks', async () => {
      mockGetAllPublishedStacks.mockRejectedValue(new Error('Metadata read error'));

      await expect(metadataService.getAllPublishedStacks()).rejects.toThrow('Metadata read error');
    });
  });

  describe('getPublishedStackMetadata', () => {
    it('should return metadata for existing project', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(mockMetadata);

      const result = await metadataService.getPublishedStackMetadata('/test/project');

      expect(mockGetPublishedStackMetadata).toHaveBeenCalledWith('/test/project');
      expect(result).toEqual(mockMetadata);
    });

    it('should return null for non-existent project', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(null);

      const result = await metadataService.getPublishedStackMetadata('/nonexistent/project');

      expect(result).toBeNull();
    });

    it('should handle errors from getPublishedStackMetadata', async () => {
      mockGetPublishedStackMetadata.mockRejectedValue(new Error('Read error'));

      await expect(
        metadataService.getPublishedStackMetadata('/test/project')
      ).rejects.toThrow('Read error');
    });
  });

  describe('savePublishedStackMetadata', () => {
    it('should save metadata successfully', async () => {
      mockSavePublishedStackMetadata.mockResolvedValue(undefined);

      await metadataService.savePublishedStackMetadata('/test/project', mockMetadata);

      expect(mockSavePublishedStackMetadata).toHaveBeenCalledWith('/test/project', mockMetadata);
    });

    it('should handle save errors', async () => {
      mockSavePublishedStackMetadata.mockRejectedValue(new Error('Save error'));

      await expect(
        metadataService.savePublishedStackMetadata('/test/project', mockMetadata)
      ).rejects.toThrow('Save error');
    });
  });

  describe('findStackByStackId', () => {
    it('should find stack by stack ID and return normalized result', async () => {
      const mockFoundResult = {
        path: '/test/project',
        metadata: mockMetadata,
      };
      mockFindStackByStackId.mockResolvedValue(mockFoundResult);

      const result = await metadataService.findStackByStackId('test-org/test-stack');

      expect(mockFindStackByStackId).toHaveBeenCalledWith('test-org/test-stack');
      expect(result).toEqual({
        projectPath: '/test/project',
        metadata: mockMetadata,
      });
    });

    it('should return null when stack ID not found', async () => {
      mockFindStackByStackId.mockResolvedValue(null);

      const result = await metadataService.findStackByStackId('nonexistent/stack');

      expect(result).toBeNull();
    });

    it('should handle errors from findStackByStackId', async () => {
      mockFindStackByStackId.mockRejectedValue(new Error('Find error'));

      await expect(
        metadataService.findStackByStackId('test-org/test-stack')
      ).rejects.toThrow('Find error');
    });
  });

  describe('removePublishedStackMetadata', () => {
    it('should remove metadata successfully', async () => {
      mockRemovePublishedStackMetadata.mockResolvedValue(undefined);

      await metadataService.removePublishedStackMetadata('/test/project');

      expect(mockRemovePublishedStackMetadata).toHaveBeenCalledWith('/test/project');
    });

    it('should handle removal errors', async () => {
      mockRemovePublishedStackMetadata.mockRejectedValue(new Error('Remove error'));

      await expect(
        metadataService.removePublishedStackMetadata('/test/project')
      ).rejects.toThrow('Remove error');
    });
  });

  describe('isValidVersion', () => {
    it('should return true for valid semver', () => {
      mockIsValidVersion.mockReturnValue(true);

      const result = metadataService.isValidVersion('1.0.0');

      expect(mockIsValidVersion).toHaveBeenCalledWith('1.0.0');
      expect(result).toBe(true);
    });

    it('should return false for invalid semver', () => {
      mockIsValidVersion.mockReturnValue(false);

      const result = metadataService.isValidVersion('invalid-version');

      expect(mockIsValidVersion).toHaveBeenCalledWith('invalid-version');
      expect(result).toBe(false);
    });

    it('should handle edge cases', () => {
      mockIsValidVersion.mockReturnValue(false);

      const result = metadataService.isValidVersion('');
      expect(result).toBe(false);

      const result2 = metadataService.isValidVersion('1');
      expect(mockIsValidVersion).toHaveBeenCalledWith('1');
    });
  });

  describe('generateSuggestedVersion', () => {
    it('should generate suggested version', () => {
      mockGenerateSuggestedVersion.mockReturnValue('1.1.0');

      const result = metadataService.generateSuggestedVersion('1.0.0');

      expect(mockGenerateSuggestedVersion).toHaveBeenCalledWith('1.0.0');
      expect(result).toBe('1.1.0');
    });

    it('should handle version generation errors', () => {
      mockGenerateSuggestedVersion.mockImplementation(() => {
        throw new Error('Version generation error');
      });

      expect(() => metadataService.generateSuggestedVersion('invalid')).toThrow(
        'Version generation error'
      );
    });
  });

  describe('hasPublishedMetadata', () => {
    it('should return true when metadata exists', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(mockMetadata);

      const result = await metadataService.hasPublishedMetadata('/test/project');

      expect(result).toBe(true);
    });

    it('should return false when metadata does not exist', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(null);

      const result = await metadataService.hasPublishedMetadata('/test/project');

      expect(result).toBe(false);
    });

    it('should handle metadata check errors', async () => {
      mockGetPublishedStackMetadata.mockRejectedValue(new Error('Check error'));

      await expect(metadataService.hasPublishedMetadata('/test/project')).rejects.toThrow(
        'Check error'
      );
    });
  });

  describe('updatePublishedStackMetadata', () => {
    it('should update existing metadata successfully', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(mockMetadata);
      mockSavePublishedStackMetadata.mockResolvedValue(undefined);

      const updates = { version: '1.1.0', updated_at: '2023-01-02T00:00:00.000Z' };

      await metadataService.updatePublishedStackMetadata('/test/project', updates);

      expect(mockGetPublishedStackMetadata).toHaveBeenCalledWith('/test/project');
      expect(mockSavePublishedStackMetadata).toHaveBeenCalledWith('/test/project', {
        ...mockMetadata,
        ...updates,
      });
    });

    it('should throw error when metadata does not exist', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(null);

      await expect(
        metadataService.updatePublishedStackMetadata('/test/project', { version: '1.1.0' })
      ).rejects.toThrow('No published metadata found for project: /test/project');
    });

    it('should handle update errors', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(mockMetadata);
      mockSavePublishedStackMetadata.mockRejectedValue(new Error('Update error'));

      await expect(
        metadataService.updatePublishedStackMetadata('/test/project', { version: '1.1.0' })
      ).rejects.toThrow('Update error');
    });

    it('should handle partial updates correctly', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(mockMetadata);
      mockSavePublishedStackMetadata.mockResolvedValue(undefined);

      const partialUpdate = { description: 'Updated description' };

      await metadataService.updatePublishedStackMetadata('/test/project', partialUpdate);

      expect(mockSavePublishedStackMetadata).toHaveBeenCalledWith('/test/project', {
        ...mockMetadata,
        description: 'Updated description',
      });
    });
  });

  describe('getStackIdForProject', () => {
    it('should return stack ID when metadata exists', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(mockMetadata);

      const result = await metadataService.getStackIdForProject('/test/project');

      expect(result).toBe('test-org/test-stack');
    });

    it('should return null when metadata does not exist', async () => {
      mockGetPublishedStackMetadata.mockResolvedValue(null);

      const result = await metadataService.getStackIdForProject('/test/project');

      expect(result).toBeNull();
    });

    it('should return null when metadata exists but has no stack_id', async () => {
      const metadataWithoutStackId = { ...mockMetadata };
      delete metadataWithoutStackId.stack_id;
      mockGetPublishedStackMetadata.mockResolvedValue(metadataWithoutStackId);

      const result = await metadataService.getStackIdForProject('/test/project');

      expect(result).toBeNull();
    });

    it('should handle errors when getting stack ID', async () => {
      mockGetPublishedStackMetadata.mockRejectedValue(new Error('Get error'));

      await expect(metadataService.getStackIdForProject('/test/project')).rejects.toThrow(
        'Get error'
      );
    });
  });

  describe('isStackIdPublished', () => {
    it('should return true when stack ID is published', async () => {
      mockFindStackByStackId.mockResolvedValue({
        path: '/test/project',
        metadata: mockMetadata,
      });

      const result = await metadataService.isStackIdPublished('test-org/test-stack');

      expect(mockFindStackByStackId).toHaveBeenCalledWith('test-org/test-stack');
      expect(result).toBe(true);
    });

    it('should return false when stack ID is not published', async () => {
      mockFindStackByStackId.mockResolvedValue(null);

      const result = await metadataService.isStackIdPublished('nonexistent/stack');

      expect(result).toBe(false);
    });

    it('should handle errors when checking if stack ID is published', async () => {
      mockFindStackByStackId.mockRejectedValue(new Error('Check error'));

      await expect(metadataService.isStackIdPublished('test-org/test-stack')).rejects.toThrow(
        'Check error'
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete metadata lifecycle', async () => {
      // Initial state - no metadata
      mockGetPublishedStackMetadata.mockResolvedValueOnce(null);
      const hasMetadata1 = await metadataService.hasPublishedMetadata('/test/project');
      expect(hasMetadata1).toBe(false);

      // Save metadata
      mockSavePublishedStackMetadata.mockResolvedValue(undefined);
      await metadataService.savePublishedStackMetadata('/test/project', mockMetadata);

      // Check metadata exists
      mockGetPublishedStackMetadata.mockResolvedValueOnce(mockMetadata);
      const hasMetadata2 = await metadataService.hasPublishedMetadata('/test/project');
      expect(hasMetadata2).toBe(true);

      // Update metadata
      mockGetPublishedStackMetadata.mockResolvedValueOnce(mockMetadata);
      await metadataService.updatePublishedStackMetadata('/test/project', { version: '1.1.0' });

      // Remove metadata
      mockRemovePublishedStackMetadata.mockResolvedValue(undefined);
      await metadataService.removePublishedStackMetadata('/test/project');

      expect(mockSavePublishedStackMetadata).toHaveBeenCalledTimes(2); // Initial save + update
      expect(mockRemovePublishedStackMetadata).toHaveBeenCalledWith('/test/project');
    });

    it('should handle version validation and generation workflow', () => {
      // Validate versions
      mockIsValidVersion.mockReturnValueOnce(true);
      expect(metadataService.isValidVersion('1.0.0')).toBe(true);

      mockIsValidVersion.mockReturnValueOnce(false);
      expect(metadataService.isValidVersion('invalid')).toBe(false);

      // Generate suggested version
      mockGenerateSuggestedVersion.mockReturnValue('1.1.0');
      const suggested = metadataService.generateSuggestedVersion('1.0.0');
      expect(suggested).toBe('1.1.0');
    });

    it('should handle edge cases with malformed metadata', async () => {
      const malformedMetadata = {
        ...mockMetadata,
        stack_id: undefined,
        version: null,
      } as any;

      mockGetPublishedStackMetadata.mockResolvedValue(malformedMetadata);

      const stackId = await metadataService.getStackIdForProject('/test/project');
      expect(stackId).toBeNull();

      const hasMetadata = await metadataService.hasPublishedMetadata('/test/project');
      expect(hasMetadata).toBe(true); // metadata exists but is malformed
    });
  });
});