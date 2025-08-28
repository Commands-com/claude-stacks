import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import path from 'path';
import { FileService } from '../../../src/services/FileService.js';
import { FileSystemError } from '../../../src/types/errors.js';
import type { FsMocks } from '../../mocks/fs-mocks.js';

// Mock fs-extra
jest.mock('fs-extra', () => {
  const { FsMocks } = require('../../mocks/fs-mocks.js');
  return FsMocks.mockFsExtra();
});

describe('FileService', () => {
  let fileService: FileService;
  let mockFs: ReturnType<typeof FsMocks.mockFsExtra>;

  beforeEach(() => {
    fileService = new FileService();
    mockFs = require('fs-extra');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('readJsonFile', () => {
    const testPath = '/test/config.json';
    const testData = { name: 'test', version: '1.0.0' };

    it('should successfully read and parse JSON file', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(testData);

      const result = await fileService.readJsonFile(testPath);

      expect(mockFs.pathExists).toHaveBeenCalledWith(testPath);
      expect(mockFs.readJson).toHaveBeenCalledWith(testPath);
      expect(result).toEqual(testData);
    });

    it('should throw FileSystemError when file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await expect(fileService.readJsonFile(testPath)).rejects.toThrow(FileSystemError);

      expect(mockFs.pathExists).toHaveBeenCalledWith(testPath);
      expect(mockFs.readJson).not.toHaveBeenCalled();
    });

    it('should wrap fs.readJson errors in FileSystemError', async () => {
      const fsError = new Error('Parse error');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockRejectedValue(fsError);

      await expect(fileService.readJsonFile(testPath)).rejects.toThrow(FileSystemError);

      const result = fileService.readJsonFile(testPath);
      await expect(result).rejects.toThrow('Failed to read file at /test/config.json');
    });

    it('should handle pathExists errors gracefully', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('Permission denied'));

      await expect(fileService.readJsonFile(testPath)).rejects.toThrow(FileSystemError);
    });

    it('should preserve FileSystemError when already wrapped', async () => {
      const fileSystemError = new FileSystemError('read', testPath, new Error('Custom error'));
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockRejectedValue(fileSystemError);

      await expect(fileService.readJsonFile(testPath)).rejects.toBe(fileSystemError);
    });

    it('should return typed data when generic type specified', async () => {
      interface TestConfig {
        name: string;
        version: string;
      }

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(testData);

      const result = await fileService.readJsonFile<TestConfig>(testPath);

      expect(result.name).toBe('test');
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('writeJsonFile', () => {
    const testPath = '/test/config.json';
    const testData = { name: 'test', version: '1.0.0' };

    it('should successfully write JSON file with default spacing', async () => {
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeJson.mockResolvedValue();

      await fileService.writeJsonFile(testPath, testData);

      expect(mockFs.ensureDir).toHaveBeenCalledWith(path.dirname(testPath));
      expect(mockFs.writeJson).toHaveBeenCalledWith(testPath, testData, { spaces: 2 });
    });

    it('should write JSON file with custom spacing', async () => {
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeJson.mockResolvedValue();

      await fileService.writeJsonFile(testPath, testData, { spaces: 4 });

      expect(mockFs.writeJson).toHaveBeenCalledWith(testPath, testData, { spaces: 4 });
    });

    it('should handle directory creation errors', async () => {
      const dirError = new Error('Permission denied');
      mockFs.ensureDir.mockRejectedValue(dirError);

      await expect(fileService.writeJsonFile(testPath, testData)).rejects.toThrow(FileSystemError);

      expect(mockFs.ensureDir).toHaveBeenCalledWith(path.dirname(testPath));
      expect(mockFs.writeJson).not.toHaveBeenCalled();
    });

    it('should handle write errors', async () => {
      const writeError = new Error('Disk full');
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeJson.mockRejectedValue(writeError);

      await expect(fileService.writeJsonFile(testPath, testData)).rejects.toThrow(FileSystemError);

      const result = fileService.writeJsonFile(testPath, testData);
      await expect(result).rejects.toThrow('Failed to write file at /test/config.json');
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        config: {
          nested: {
            array: [1, 2, 3],
            object: { key: 'value' },
          },
        },
        metadata: {
          created: new Date().toISOString(),
          tags: ['tag1', 'tag2'],
        },
      };

      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeJson.mockResolvedValue();

      await fileService.writeJsonFile(testPath, complexData);

      expect(mockFs.writeJson).toHaveBeenCalledWith(testPath, complexData, { spaces: 2 });
    });
  });

  describe('readTextFile', () => {
    const testPath = '/test/file.txt';
    const testContent = 'Hello, World!\nThis is a test file.';

    it('should successfully read text file', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(testContent);

      const result = await fileService.readTextFile(testPath);

      expect(mockFs.pathExists).toHaveBeenCalledWith(testPath);
      expect(mockFs.readFile).toHaveBeenCalledWith(testPath, 'utf-8');
      expect(result).toBe(testContent);
    });

    it('should throw FileSystemError when file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await expect(fileService.readTextFile(testPath)).rejects.toThrow(FileSystemError);

      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should handle read errors', async () => {
      const readError = new Error('Permission denied');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockRejectedValue(readError);

      await expect(fileService.readTextFile(testPath)).rejects.toThrow(FileSystemError);
    });

    it('should handle empty files', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('');

      const result = await fileService.readTextFile(testPath);

      expect(result).toBe('');
    });

    it('should handle unicode content', async () => {
      const unicodeContent = '🚀 测试 τεστ тест テスト';
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(unicodeContent);

      const result = await fileService.readTextFile(testPath);

      expect(result).toBe(unicodeContent);
    });
  });

  describe('writeTextFile', () => {
    const testPath = '/test/file.txt';
    const testContent = 'Hello, World!\nThis is a test file.';

    it('should successfully write text file', async () => {
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      await fileService.writeTextFile(testPath, testContent);

      expect(mockFs.ensureDir).toHaveBeenCalledWith(path.dirname(testPath));
      expect(mockFs.writeFile).toHaveBeenCalledWith(testPath, testContent, 'utf-8');
    });

    it('should handle directory creation errors', async () => {
      const dirError = new Error('Permission denied');
      mockFs.ensureDir.mockRejectedValue(dirError);

      await expect(fileService.writeTextFile(testPath, testContent)).rejects.toThrow(
        FileSystemError
      );
    });

    it('should handle write errors', async () => {
      const writeError = new Error('Disk full');
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockRejectedValue(writeError);

      await expect(fileService.writeTextFile(testPath, testContent)).rejects.toThrow(
        FileSystemError
      );
    });

    it('should handle empty content', async () => {
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      await fileService.writeTextFile(testPath, '');

      expect(mockFs.writeFile).toHaveBeenCalledWith(testPath, '', 'utf-8');
    });

    it('should handle unicode content', async () => {
      const unicodeContent = '🚀 测试 τεστ тест テスト';
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      await fileService.writeTextFile(testPath, unicodeContent);

      expect(mockFs.writeFile).toHaveBeenCalledWith(testPath, unicodeContent, 'utf-8');
    });
  });

  describe('exists', () => {
    const testPath = '/test/file.txt';

    it('should return true when file exists', async () => {
      mockFs.pathExists.mockResolvedValue(true);

      const result = await fileService.exists(testPath);

      expect(mockFs.pathExists).toHaveBeenCalledWith(testPath);
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await fileService.exists(testPath);

      expect(result).toBe(false);
    });

    it('should return false when pathExists throws error', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('Permission denied'));

      const result = await fileService.exists(testPath);

      expect(result).toBe(false);
    });
  });

  describe('ensureDir', () => {
    const testDir = '/test/directory';

    it('should successfully create directory', async () => {
      mockFs.ensureDir.mockResolvedValue();

      await fileService.ensureDir(testDir);

      expect(mockFs.ensureDir).toHaveBeenCalledWith(testDir);
    });

    it('should handle directory creation errors', async () => {
      const dirError = new Error('Permission denied');
      mockFs.ensureDir.mockRejectedValue(dirError);

      await expect(fileService.ensureDir(testDir)).rejects.toThrow(FileSystemError);

      const result = fileService.ensureDir(testDir);
      await expect(result).rejects.toThrow('Failed to create directory file at /test/directory');
    });

    it('should work with nested directory paths', async () => {
      const nestedDir = '/test/deeply/nested/directory';
      mockFs.ensureDir.mockResolvedValue();

      await fileService.ensureDir(nestedDir);

      expect(mockFs.ensureDir).toHaveBeenCalledWith(nestedDir);
    });
  });

  describe('listFiles', () => {
    const testDir = '/test/directory';
    const testFiles = ['file1.txt', 'file2.json', 'file3.md'];

    it('should list all files when no filter provided', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(testFiles);

      const result = await fileService.listFiles(testDir);

      expect(mockFs.pathExists).toHaveBeenCalledWith(testDir);
      expect(mockFs.readdir).toHaveBeenCalledWith(testDir);
      expect(result).toEqual(testFiles);
    });

    it('should return empty array when directory does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await fileService.listFiles(testDir);

      expect(mockFs.pathExists).toHaveBeenCalledWith(testDir);
      expect(mockFs.readdir).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should apply filter when provided', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(testFiles);

      const jsonFilter = (file: string) => file.endsWith('.json');
      const result = await fileService.listFiles(testDir, jsonFilter);

      expect(result).toEqual(['file2.json']);
    });

    it('should handle readdir errors', async () => {
      const readdirError = new Error('Permission denied');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockRejectedValue(readdirError);

      await expect(fileService.listFiles(testDir)).rejects.toThrow(FileSystemError);
    });

    it('should handle empty directories', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue([]);

      const result = await fileService.listFiles(testDir);

      expect(result).toEqual([]);
    });

    it('should work with complex filters', async () => {
      const complexFiles = ['test.spec.ts', 'index.ts', 'config.json', 'README.md', 'test.test.js'];
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(complexFiles);

      const testFilter = (file: string) => file.includes('test') || file.includes('spec');
      const result = await fileService.listFiles(testDir, testFilter);

      expect(result).toEqual(['test.spec.ts', 'test.test.js']);
    });
  });

  describe('copyFile', () => {
    const sourcePath = '/test/source.txt';
    const destPath = '/test/destination.txt';

    it('should successfully copy file', async () => {
      mockFs.ensureDir.mockResolvedValue();
      mockFs.copy.mockResolvedValue();

      await fileService.copyFile(sourcePath, destPath);

      expect(mockFs.ensureDir).toHaveBeenCalledWith(path.dirname(destPath));
      expect(mockFs.copy).toHaveBeenCalledWith(sourcePath, destPath);
    });

    it('should handle directory creation errors', async () => {
      const dirError = new Error('Permission denied');
      mockFs.ensureDir.mockRejectedValue(dirError);

      await expect(fileService.copyFile(sourcePath, destPath)).rejects.toThrow(FileSystemError);
    });

    it('should handle copy errors', async () => {
      const copyError = new Error('Source file not found');
      mockFs.ensureDir.mockResolvedValue();
      mockFs.copy.mockRejectedValue(copyError);

      await expect(fileService.copyFile(sourcePath, destPath)).rejects.toThrow(FileSystemError);

      const result = fileService.copyFile(sourcePath, destPath);
      await expect(result).rejects.toThrow('Failed to copy file at /test/source.txt');
    });

    it('should work with nested destination paths', async () => {
      const nestedDest = '/test/deeply/nested/destination.txt';
      mockFs.ensureDir.mockResolvedValue();
      mockFs.copy.mockResolvedValue();

      await fileService.copyFile(sourcePath, nestedDest);

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/deeply/nested');
    });
  });

  describe('remove', () => {
    const testPath = '/test/file.txt';

    it('should successfully remove file', async () => {
      mockFs.remove.mockResolvedValue();

      await fileService.remove(testPath);

      expect(mockFs.remove).toHaveBeenCalledWith(testPath);
    });

    it('should handle removal errors', async () => {
      const removeError = new Error('File in use');
      mockFs.remove.mockRejectedValue(removeError);

      await expect(fileService.remove(testPath)).rejects.toThrow(FileSystemError);

      const result = fileService.remove(testPath);
      await expect(result).rejects.toThrow('Failed to remove file at /test/file.txt');
    });

    it('should work with directories', async () => {
      const testDir = '/test/directory';
      mockFs.remove.mockResolvedValue();

      await fileService.remove(testDir);

      expect(mockFs.remove).toHaveBeenCalledWith(testDir);
    });
  });

  describe('getStats', () => {
    const testPath = '/test/file.txt';
    const mockStats = {
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date('2023-01-01'),
      ctime: new Date('2023-01-01'),
      atime: new Date('2023-01-01'),
      mode: 0o644,
      uid: 1000,
      gid: 1000,
    };

    it('should successfully get file stats', async () => {
      mockFs.stat.mockResolvedValue(mockStats as any);

      const result = await fileService.getStats(testPath);

      expect(mockFs.stat).toHaveBeenCalledWith(testPath);
      expect(result).toEqual(mockStats);
    });

    it('should handle stat errors', async () => {
      const statError = new Error('File not found');
      mockFs.stat.mockRejectedValue(statError);

      await expect(fileService.getStats(testPath)).rejects.toThrow(FileSystemError);

      const result = fileService.getStats(testPath);
      await expect(result).rejects.toThrow('Failed to stat file at /test/file.txt');
    });

    it('should work with directories', async () => {
      const dirStats = {
        ...mockStats,
        isFile: () => false,
        isDirectory: () => true,
      };

      mockFs.stat.mockResolvedValue(dirStats as any);

      const result = await fileService.getStats('/test/directory');

      expect(result.isDirectory()).toBe(true);
      expect(result.isFile()).toBe(false);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle very long file paths', async () => {
      const longPath = `/test/${'a'.repeat(1000)}.txt`;
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('content');

      const result = await fileService.readTextFile(longPath);

      expect(result).toBe('content');
    });

    it('should handle special characters in paths', async () => {
      const specialPath = '/test/file with spaces & symbols (1).txt';
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('content');

      const result = await fileService.readTextFile(specialPath);

      expect(mockFs.readFile).toHaveBeenCalledWith(specialPath, 'utf-8');
      expect(result).toBe('content');
    });

    it('should handle concurrent operations', async () => {
      const testPath1 = '/test/file1.txt';
      const testPath2 = '/test/file2.txt';

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('content');

      const promises = [fileService.readTextFile(testPath1), fileService.readTextFile(testPath2)];

      const results = await Promise.all(promises);

      expect(results).toEqual(['content', 'content']);
      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });

    it('should handle null and undefined data gracefully', async () => {
      const testPath = '/test/null.json';
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeJson.mockResolvedValue();

      await fileService.writeJsonFile(testPath, null);
      await fileService.writeJsonFile(testPath, undefined);

      expect(mockFs.writeJson).toHaveBeenCalledWith(testPath, null, { spaces: 2 });
      expect(mockFs.writeJson).toHaveBeenCalledWith(testPath, undefined, { spaces: 2 });
    });
  });

  describe('path validation security (non-test paths)', () => {
    // Mock testHelpers to return false for security validation tests
    beforeEach(() => {
      const testHelpers = require('../../../src/utils/testHelpers.js');
      testHelpers.isTestEnvironment = jest.fn(() => false);
      testHelpers.isTestPath = jest.fn(() => false);
    });

    it('should reject dangerous file extensions', async () => {
      const dangerousFile = '/production/script.exe';

      await expect(fileService.readTextFile(dangerousFile)).rejects.toThrow(FileSystemError);
    });

    it('should reject paths with null bytes', async () => {
      const nullBytePath = '/production/file\0hidden.txt';

      await expect(fileService.readTextFile(nullBytePath)).rejects.toThrow(FileSystemError);
    });

    it('should reject excessively long paths', async () => {
      const longPath = `/production/${'a'.repeat(4100)}.txt`;

      await expect(fileService.readTextFile(longPath)).rejects.toThrow(FileSystemError);
    });

    it('should reject other dangerous file extensions', async () => {
      const dangerousFiles = [
        '/production/script.bat',
        '/production/script.cmd',
        '/production/script.scr',
        '/production/script.vbs',
        '/production/script.ps1',
        '/production/script.sh',
      ];

      for (const file of dangerousFiles) {
        await expect(fileService.readTextFile(file)).rejects.toThrow(FileSystemError);
      }
    });
  });
});
