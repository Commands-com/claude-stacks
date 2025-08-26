import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import path from 'path';
import {
  loadMetadata,
  saveMetadata,
  getPublishedStackMetadata,
  savePublishedStackMetadata,
  removePublishedStackMetadata,
  getAllPublishedStacks,
  findStackByStackId,
  cleanupMetadata,
  getMetadataPath,
} from '../../../src/utils/metadata.js';
import type { StacksMetadata, PublishedStackMetadata } from '../../../src/utils/metadata.js';
import { _FsMocks } from '../../mocks/fs-mocks.js';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  ensureDir: jest.fn(),
  pathExists: jest.fn(),
}));

// Mock constants
jest.mock('../../../src/constants/paths.js', () => ({
  CLAUDE_CONFIG_PATH: '/test/.claude',
  METADATA_FILE_PATH: '/test/.claude/.claude-stacks-meta.json',
}));

const mockConsoleWarn = jest.fn();

describe('metadata utils', () => {
  const originalConsoleWarn = console.warn;
  let mockFs: {
    readJson: jest.MockedFunction<any>;
    writeJson: jest.MockedFunction<any>;
    ensureDir: jest.MockedFunction<any>;
    pathExists: jest.MockedFunction<any>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console
    console.warn = mockConsoleWarn;

    // Get mocked fs-extra
    mockFs = require('fs-extra');

    // Reset mock defaults
    mockFs.pathExists.mockResolvedValue(false);
    mockFs.readJson.mockResolvedValue({});
    mockFs.writeJson.mockResolvedValue();
    mockFs.ensureDir.mockResolvedValue();
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
    jest.resetAllMocks();
  });

  describe('getMetadataPath', () => {
    it('should return correct metadata path', () => {
      const metadataPath = getMetadataPath();
      expect(metadataPath).toBe('/test/.claude/.claude-stacks-meta.json');
    });
  });

  describe('loadMetadata', () => {
    it('should load existing metadata file', async () => {
      const testMetadata: StacksMetadata = {
        published_stacks: {
          'test-org/stack1': {
            stack_id: 'test-org/stack1',
            stack_name: 'Test Stack 1',
            last_published_version: '1.0.0',
            last_published_at: '2024-01-01T00:00:00Z',
            last_export_hash: 'hash123',
          },
        },
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(testMetadata);

      const result = await loadMetadata();

      expect(mockFs.pathExists).toHaveBeenCalledWith('/test/.claude/.claude-stacks-meta.json');
      expect(mockFs.readJson).toHaveBeenCalledWith('/test/.claude/.claude-stacks-meta.json');
      expect(result).toEqual(testMetadata);
    });

    it('should return default metadata when file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await loadMetadata();

      expect(result).toEqual({
        published_stacks: {},
      });
      expect(mockFs.readJson).not.toHaveBeenCalled();
    });

    it('should return default metadata when file is corrupted', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockRejectedValue(new Error('Invalid JSON'));

      const result = await loadMetadata();

      expect(result).toEqual({
        published_stacks: {},
      });
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Warning: Could not read metadata file, starting fresh'
      );
    });

    it('should handle pathExists errors gracefully', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('Permission denied'));

      const result = await loadMetadata();

      expect(result).toEqual({
        published_stacks: {},
      });
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Warning: Could not read metadata file, starting fresh'
      );
    });
  });

  describe('saveMetadata', () => {
    it('should save metadata to file', async () => {
      const testMetadata: StacksMetadata = {
        published_stacks: {
          '/test/save-stack': {
            stack_id: 'test-org/save-stack',
            stack_name: 'Save Stack',
            last_published_version: '1.0.0',
            last_published_at: '2024-01-01T00:00:00Z',
            last_export_hash: 'hash123',
          },
        },
      };

      await saveMetadata(testMetadata);

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        path.dirname('/test/.claude/.claude-stacks-meta.json')
      );
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/.claude/.claude-stacks-meta.json',
        testMetadata,
        { spaces: 2 }
      );
    });

    it('should handle directory creation errors', async () => {
      const testMetadata: StacksMetadata = { published_stacks: {} };
      mockFs.ensureDir.mockRejectedValue(new Error('Permission denied'));

      await expect(saveMetadata(testMetadata)).rejects.toThrow('Permission denied');
      expect(mockFs.writeJson).not.toHaveBeenCalled();
    });

    it('should handle write errors', async () => {
      const testMetadata: StacksMetadata = { published_stacks: {} };
      mockFs.writeJson.mockRejectedValue(new Error('Disk full'));

      await expect(saveMetadata(testMetadata)).rejects.toThrow('Disk full');
      expect(mockFs.ensureDir).toHaveBeenCalled();
    });
  });

  describe('getPublishedStackMetadata', () => {
    it('should return metadata for existing stack', async () => {
      const stackMetadata: PublishedStackMetadata = {
        stack_id: 'test-org/existing-stack',
        stack_name: 'Existing Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash123',
      };

      const fullMetadata: StacksMetadata = {
        published_stacks: {
          'test-org/existing-stack': stackMetadata,
        },
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(fullMetadata);

      const result = await getPublishedStackMetadata('test-org/existing-stack');

      expect(result).toEqual(stackMetadata);
    });

    it('should return null for non-existent stack', async () => {
      const fullMetadata: StacksMetadata = {
        published_stacks: {},
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(fullMetadata);

      const result = await getPublishedStackMetadata('test-org/missing-stack');

      expect(result).toBeNull();
    });

    it('should return null when metadata file is corrupted', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockRejectedValue(new Error('Invalid JSON'));

      const result = await getPublishedStackMetadata('test-org/any-stack');

      expect(result).toBeNull();
    });
  });

  describe('savePublishedStackMetadata', () => {
    it('should save new stack metadata', async () => {
      const existingMetadata: StacksMetadata = {
        published_stacks: {},
      };

      const newStackMetadata: PublishedStackMetadata = {
        stack_id: 'test-org/new-stack',
        stack_name: 'New Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash123',
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(existingMetadata);

      await savePublishedStackMetadata('/test/new', newStackMetadata);

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/.claude/.claude-stacks-meta.json',
        {
          published_stacks: {
            '/test/new': newStackMetadata,
          },
        },
        { spaces: 2 }
      );
    });

    it('should update existing stack metadata', async () => {
      const existingStackMetadata: PublishedStackMetadata = {
        stack_id: 'test-org/update-stack',
        stack_name: 'Original Name',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash123',
      };

      const existingMetadata: StacksMetadata = {
        published_stacks: {
          '/test/update-stack': existingStackMetadata,
        },
      };

      const updatedStackMetadata: PublishedStackMetadata = {
        ...existingStackMetadata,
        name: 'Updated Name',
        description: 'Updated description',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(existingMetadata);

      await savePublishedStackMetadata('/test/update-stack', updatedStackMetadata);

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/.claude/.claude-stacks-meta.json',
        {
          published_stacks: {
            '/test/update-stack': updatedStackMetadata,
          },
        },
        { spaces: 2 }
      );
    });

    it('should handle save errors', async () => {
      const stackMetadata: PublishedStackMetadata = {
        stack_id: 'test-org/error-stack',
        stack_name: 'Error Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash123',
      };

      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeJson.mockRejectedValue(new Error('Write failed'));

      await expect(savePublishedStackMetadata(stackMetadata)).rejects.toThrow('Write failed');
    });
  });

  describe('removePublishedStackMetadata', () => {
    it('should remove existing stack metadata', async () => {
      const stackToKeep: PublishedStackMetadata = {
        stack_id: 'test-org/keep-stack',
        stack_name: 'Keep Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash123',
      };

      const stackToRemove: PublishedStackMetadata = {
        stack_id: 'test-org/remove-stack',
        stack_name: 'Remove Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash456',
      };

      const existingMetadata: StacksMetadata = {
        published_stacks: {
          '/test/keep-stack': stackToKeep,
          '/test/remove-stack': stackToRemove,
        },
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(existingMetadata);

      await removePublishedStackMetadata('/test/remove-stack');

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/.claude/.claude-stacks-meta.json',
        {
          published_stacks: {
            '/test/keep-stack': stackToKeep,
          },
        },
        { spaces: 2 }
      );
    });

    it('should handle removal of non-existent stack gracefully', async () => {
      const existingMetadata: StacksMetadata = {
        published_stacks: {},
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(existingMetadata);

      await removePublishedStackMetadata('test-org/non-existent');

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/.claude/.claude-stacks-meta.json',
        existingMetadata,
        { spaces: 2 }
      );
    });
  });

  describe('getAllPublishedStacks', () => {
    it('should return all published stacks', async () => {
      const stack1: PublishedStackMetadata = {
        stack_id: 'test-org/stack1',
        stack_name: 'Stack 1',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash123',
      };

      const stack2: PublishedStackMetadata = {
        stack_id: 'test-org/stack2',
        stack_name: 'Stack 2',
        last_published_version: '2.0.0',
        last_published_at: '2024-01-02T00:00:00Z',
        last_export_hash: 'hash456',
      };

      const fullMetadata: StacksMetadata = {
        published_stacks: {
          '/test/stack1': stack1,
          '/test/stack2': stack2,
        },
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(fullMetadata);

      const result = await getAllPublishedStacks();

      expect(result).toEqual({
        '/test/stack1': stack1,
        '/test/stack2': stack2,
      });
    });

    it('should return empty object when no stacks are published', async () => {
      const emptyMetadata: StacksMetadata = {
        published_stacks: {},
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(emptyMetadata);

      const result = await getAllPublishedStacks();

      expect(result).toEqual({});
    });

    it('should return empty object when metadata is corrupted', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockRejectedValue(new Error('Invalid JSON'));

      const result = await getAllPublishedStacks();

      expect(result).toEqual({});
    });
  });

  describe('findStackByStackId', () => {
    it('should find stack by exact ID match', async () => {
      const targetStack: PublishedStackMetadata = {
        stack_id: 'test-org/target-stack',
        stack_name: 'Target Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash123',
      };

      const otherStack: PublishedStackMetadata = {
        stack_id: 'test-org/other-stack',
        stack_name: 'Other Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash456',
      };

      const fullMetadata: StacksMetadata = {
        published_stacks: {
          '/test/target': targetStack,
          '/test/other': otherStack,
        },
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(fullMetadata);

      const result = await findStackByStackId('test-org/target-stack');

      expect(result).toEqual({
        path: '/test/target',
        metadata: targetStack,
      });
    });

    it('should return null for non-existent stack ID', async () => {
      const fullMetadata: StacksMetadata = {
        published_stacks: {},
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(fullMetadata);

      const result = await findStackByStackId('test-org/missing-stack');

      expect(result).toBeNull();
    });
  });

  describe('cleanupMetadata', () => {
    it('should remove metadata for stacks with non-existent local paths', async () => {
      const validStack: PublishedStackMetadata = {
        stack_id: 'test-org/valid-stack',
        stack_name: 'Valid Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash123',
      };

      const invalidStack: PublishedStackMetadata = {
        stack_id: 'test-org/invalid-stack',
        stack_name: 'Invalid Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash456',
      };

      const fullMetadata: StacksMetadata = {
        published_stacks: {
          '/test/valid': validStack,
          '/test/invalid': invalidStack,
        },
      };

      // Mock existing metadata
      mockFs.pathExists
        .mockResolvedValueOnce(true) // metadata file exists
        .mockResolvedValueOnce(true) // valid stack path exists
        .mockResolvedValueOnce(false); // invalid stack path doesn't exist

      mockFs.readJson.mockResolvedValue(fullMetadata);

      await cleanupMetadata();

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/.claude/.claude-stacks-meta.json',
        {
          published_stacks: {
            '/test/valid': validStack,
          },
        },
        { spaces: 2 }
      );
    });

    it('should handle metadata file not existing', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await cleanupMetadata();

      expect(mockFs.readJson).not.toHaveBeenCalled();
      expect(mockFs.writeJson).not.toHaveBeenCalled();
    });

    it('should handle no cleanup needed', async () => {
      const validStack: PublishedStackMetadata = {
        stack_id: 'test-org/all-valid',
        stack_name: 'All Valid Stack',
        last_published_version: '1.0.0',
        last_published_at: '2024-01-01T00:00:00Z',
        last_export_hash: 'hash123',
      };

      const fullMetadata: StacksMetadata = {
        published_stacks: {
          '/test/all-valid': validStack,
        },
      };

      mockFs.pathExists
        .mockResolvedValueOnce(true) // metadata file exists (for loadMetadata)
        .mockResolvedValueOnce(true); // /test/all-valid exists

      mockFs.readJson.mockResolvedValue(fullMetadata);

      await cleanupMetadata();

      // Should not write anything since no cleanup was needed
      expect(mockFs.writeJson).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle concurrent access to metadata file', async () => {
      const metadata: StacksMetadata = { published_stacks: {} };

      // First save succeeds
      mockFs.writeJson.mockResolvedValueOnce(undefined);

      await saveMetadata(metadata);

      expect(mockFs.writeJson).toHaveBeenCalledTimes(1);
    });

    it('should handle very large metadata files', async () => {
      const largeMetadata: StacksMetadata = {
        published_stacks: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [
            `/test/stack-${i}`,
            {
              stack_id: `test-org/stack-${i}`,
              stack_name: `Stack ${i}`,
              last_published_version: '1.0.0',
              last_published_at: '2024-01-01T00:00:00Z',
              last_export_hash: `hash${i}`,
            },
          ])
        ),
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(largeMetadata);

      const result = await getAllPublishedStacks();

      expect(Object.keys(result)).toHaveLength(1000);
      expect(result['/test/stack-0']?.stack_name).toBe('Stack 0');
      expect(result['/test/stack-999']?.stack_name).toBe('Stack 999');
    });
  });
});
