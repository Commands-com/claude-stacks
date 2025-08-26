import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as path from 'path';
import { PathSecurity } from '../../../src/utils/pathSecurity.js';

// Mock testHelpers
jest.mock('../../../src/utils/testHelpers.js', () => ({
  isTestEnvironment: jest.fn(),
  isTestPath: jest.fn(),
}));

import { isTestEnvironment, isTestPath } from '../../../src/utils/testHelpers.js';

const mockedIsTestEnvironment = jest.mocked(isTestEnvironment);
const mockedIsTestPath = jest.mocked(isTestPath);

describe('PathSecurity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to non-test environment
    mockedIsTestEnvironment.mockReturnValue(false);
    mockedIsTestPath.mockReturnValue(false);
  });

  describe('sanitizePath', () => {
    const baseDir = '/safe/base/dir';

    it('should sanitize a valid path', () => {
      const inputPath = 'subdir/file.json';
      const result = PathSecurity.sanitizePath(inputPath, baseDir);
      expect(result).toBe(path.resolve(baseDir, inputPath));
    });

    it('should throw error for empty path', () => {
      expect(() => PathSecurity.sanitizePath('', baseDir)).toThrow(
        'Invalid path: path must be a non-empty string'
      );
    });

    it('should throw error for null path', () => {
      expect(() => PathSecurity.sanitizePath(null as any, baseDir)).toThrow(
        'Invalid path: path must be a non-empty string'
      );
    });

    it('should throw error for non-string path', () => {
      expect(() => PathSecurity.sanitizePath(123 as any, baseDir)).toThrow(
        'Invalid path: path must be a non-empty string'
      );
    });

    it('should throw error for empty base directory', () => {
      expect(() => PathSecurity.sanitizePath('file.json', '')).toThrow(
        'Invalid base directory: must be a non-empty string'
      );
    });

    it('should throw error for null base directory', () => {
      expect(() => PathSecurity.sanitizePath('file.json', null as any)).toThrow(
        'Invalid base directory: must be a non-empty string'
      );
    });

    it('should throw error for non-string base directory', () => {
      expect(() => PathSecurity.sanitizePath('file.json', 123 as any)).toThrow(
        'Invalid base directory: must be a non-empty string'
      );
    });

    it('should detect path traversal attempts', () => {
      expect(() => PathSecurity.sanitizePath('../../../etc/passwd', baseDir)).toThrow(
        'Path traversal attempt detected: path outside allowed directory'
      );
    });

    it('should detect path traversal with encoded characters', () => {
      expect(() => PathSecurity.sanitizePath('subdir/../../../etc/passwd', baseDir)).toThrow(
        'Path traversal attempt detected: path outside allowed directory'
      );
    });

    it('should allow paths that resolve to the base directory', () => {
      const result = PathSecurity.sanitizePath('.', baseDir);
      expect(result).toBe(path.resolve(baseDir));
    });

    it('should reject forbidden file extensions', () => {
      expect(() => PathSecurity.sanitizePath('malicious.exe', baseDir)).toThrow(
        'File type not allowed: .exe'
      );
    });

    it('should allow valid file extensions', () => {
      const validFiles = ['config.json', 'readme.md', 'notes.txt', 'config.yaml', 'setup.yml'];

      validFiles.forEach(filename => {
        expect(() => PathSecurity.sanitizePath(filename, baseDir)).not.toThrow();
      });
    });

    it('should detect forbidden patterns in filenames', () => {
      const forbiddenNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'LPT9'];

      forbiddenNames.forEach(filename => {
        expect(() => PathSecurity.sanitizePath(filename, baseDir)).toThrow(
          /Forbidden path pattern detected/
        );
      });
    });

    it('should detect invalid characters in filenames', () => {
      const invalidChars = [
        'file<.json',
        'file>.json',
        'file:.json',
        'file"|.json',
        'file?.json',
        'file*.json',
      ];

      invalidChars.forEach(filename => {
        expect(() => PathSecurity.sanitizePath(filename, baseDir)).toThrow(
          /Forbidden path pattern detected/
        );
      });
    });

    it('should detect leading whitespace in filenames', () => {
      expect(() => PathSecurity.sanitizePath(' leading-space.json', baseDir)).toThrow(
        /Forbidden path pattern detected/
      );
    });

    it('should detect trailing whitespace in filenames', () => {
      expect(() => PathSecurity.sanitizePath('trailing-space ', baseDir)).toThrow(
        /Forbidden path pattern detected/
      );
    });

    it('should allow files without extensions', () => {
      expect(() => PathSecurity.sanitizePath('Dockerfile', baseDir)).not.toThrow();
    });

    describe('test environment behavior', () => {
      beforeEach(() => {
        mockedIsTestEnvironment.mockReturnValue(true);
      });

      it('should allow test paths in test environment', () => {
        mockedIsTestPath.mockReturnValue(true);
        const testPath = '/tmp/test-path';

        const result = PathSecurity.sanitizePath(testPath, baseDir);
        expect(result).toBe(path.resolve(baseDir, path.normalize(testPath)));
      });

      it('should still validate non-test paths in test environment', () => {
        mockedIsTestPath.mockReturnValue(false);

        expect(() => PathSecurity.sanitizePath('../../../etc/passwd', baseDir)).toThrow(
          'Path traversal attempt detected: path outside allowed directory'
        );
      });
    });
  });

  describe('validateFilePath', () => {
    const allowedBase = '/allowed/base';

    it('should validate paths within allowed directory', () => {
      const validPath = path.join(allowedBase, 'subdir', 'file.txt');
      expect(() => PathSecurity.validateFilePath(validPath, allowedBase)).not.toThrow();
    });

    it('should reject paths outside allowed directory', () => {
      const invalidPath = '/other/directory/file.txt';
      expect(() => PathSecurity.validateFilePath(invalidPath, allowedBase)).toThrow(
        'Access denied: path outside allowed directory'
      );
    });

    it('should reject dangerous file extensions', () => {
      const dangerousFiles = [
        'malware.exe',
        'script.bat',
        'command.cmd',
        'screen.scr',
        'virus.vbs',
        'powershell.ps1',
        'shell.sh',
      ];

      dangerousFiles.forEach(filename => {
        const filePath = path.join(allowedBase, filename);
        expect(() => PathSecurity.validateFilePath(filePath, allowedBase)).toThrow(
          /Dangerous file type not allowed/
        );
      });
    });

    it('should reject paths with null bytes', () => {
      const pathWithNullByte = path.join(allowedBase, 'file\0.txt');
      expect(() => PathSecurity.validateFilePath(pathWithNullByte, allowedBase)).toThrow(
        'Invalid filename: null bytes not allowed'
      );
    });

    it('should reject excessively long paths', () => {
      const longPath = path.join(allowedBase, 'a'.repeat(5000));
      expect(() => PathSecurity.validateFilePath(longPath, allowedBase)).toThrow(
        'Path too long: exceeds maximum allowed length'
      );
    });

    it('should allow the base directory itself', () => {
      expect(() => PathSecurity.validateFilePath(allowedBase, allowedBase)).not.toThrow();
    });

    describe('test environment behavior', () => {
      beforeEach(() => {
        mockedIsTestEnvironment.mockReturnValue(true);
      });

      it('should skip validation for test paths in test environment', () => {
        mockedIsTestPath.mockReturnValue(true);
        const testPath = '/tmp/test-dangerous.exe';

        expect(() => PathSecurity.validateFilePath(testPath, allowedBase)).not.toThrow();
      });

      it('should still validate non-test paths in test environment', () => {
        mockedIsTestPath.mockReturnValue(false);
        const invalidPath = '/other/directory/file.txt';

        expect(() => PathSecurity.validateFilePath(invalidPath, allowedBase)).toThrow(
          'Access denied: path outside allowed directory'
        );
      });
    });
  });

  describe('isPathAllowed', () => {
    const allowedDirs = ['/allowed1', '/allowed2', '/allowed3'];

    it('should return true for paths within allowed directories', () => {
      const validPaths = [
        '/allowed1/subdir/file.txt',
        '/allowed2/another/path',
        '/allowed3/deep/nested/path',
      ];

      validPaths.forEach(validPath => {
        expect(PathSecurity.isPathAllowed(validPath, allowedDirs)).toBe(true);
      });
    });

    it('should return false for paths outside allowed directories', () => {
      const invalidPaths = ['/forbidden/path', '/tmp/file.txt', '/etc/passwd'];

      invalidPaths.forEach(invalidPath => {
        expect(PathSecurity.isPathAllowed(invalidPath, allowedDirs)).toBe(false);
      });
    });

    it('should return true for exact match with allowed directory', () => {
      allowedDirs.forEach(dir => {
        expect(PathSecurity.isPathAllowed(dir, allowedDirs)).toBe(true);
      });
    });

    it('should handle relative paths by resolving them', () => {
      // This test assumes we're in a specific working directory
      const relativePath = './some/relative/path';
      const resolvedPath = path.resolve(relativePath);

      // Create an allowed directory that would contain the resolved path
      const allowedDir = path.dirname(path.dirname(resolvedPath));
      const allowedDirsWithRelative = [allowedDir];

      expect(PathSecurity.isPathAllowed(relativePath, allowedDirsWithRelative)).toBe(true);
    });

    describe('test environment behavior', () => {
      beforeEach(() => {
        mockedIsTestEnvironment.mockReturnValue(true);
      });

      it('should return true for test paths in test environment', () => {
        mockedIsTestPath.mockReturnValue(true);
        const testPath = '/tmp/test-path';

        expect(PathSecurity.isPathAllowed(testPath, allowedDirs)).toBe(true);
      });

      it('should still validate non-test paths in test environment', () => {
        mockedIsTestPath.mockReturnValue(false);
        const invalidPath = '/forbidden/path';

        expect(PathSecurity.isPathAllowed(invalidPath, allowedDirs)).toBe(false);
      });
    });
  });

  describe('edge cases and security tests', () => {
    const baseDir = '/safe/base';

    it('should handle Windows-style paths on Unix systems', () => {
      const windowsPath = 'subdir\\file.txt';
      expect(() => PathSecurity.sanitizePath(windowsPath, baseDir)).not.toThrow();
    });

    it('should normalize multiple consecutive separators', () => {
      const pathWithMultipleSeps = 'subdir//file.json';
      const result = PathSecurity.sanitizePath(pathWithMultipleSeps, baseDir);
      expect(result).toBe(path.resolve(baseDir, 'subdir/file.json'));
    });

    it('should handle current directory references safely', () => {
      const pathWithCurrentDir = './subdir/file.json';
      const result = PathSecurity.sanitizePath(pathWithCurrentDir, baseDir);
      expect(result).toBe(path.resolve(baseDir, 'subdir/file.json'));
    });

    it('should detect sneaky path traversal attempts', () => {
      const sneakyPaths = [
        'subdir/../../..',
        'subdir/../../../etc/passwd',
        './../../../etc/passwd',
        'subdir/.././../etc/passwd',
      ];

      sneakyPaths.forEach(sneakyPath => {
        expect(() => PathSecurity.sanitizePath(sneakyPath, baseDir)).toThrow(
          'Path traversal attempt detected'
        );
      });
    });

    it('should handle case insensitive Windows reserved names', () => {
      const reservedNames = ['con', 'CON', 'Con', 'cOn'];

      reservedNames.forEach(name => {
        expect(() => PathSecurity.sanitizePath(name, baseDir)).toThrow(
          /Forbidden path pattern detected/
        );
      });
    });
  });
});
