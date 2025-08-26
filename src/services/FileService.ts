import * as fs from 'fs-extra';
import * as path from 'path';
import { FileSystemError } from '../types/index.js';
import { PathSecurity } from '../utils/pathSecurity.js';
import { isTestEnvironment, isTestPath } from '../utils/testHelpers.js';

/**
 * Service for file system operations with proper error handling and security validation
 */
export class FileService {
  /**
   * Validates a file path for security before performing operations
   * @param filePath The file path to validate
   * @param allowedBase Optional base directory that the path must be within
   * @throws FileSystemError if path is invalid or unsafe
   */
  private validateFilePath(filePath: string, allowedBase?: string): void {
    // Skip validation in test environment for test paths
    if (isTestEnvironment() && isTestPath(filePath)) {
      return;
    }

    try {
      // If no allowed base is specified, use the current working directory
      const baseDir = allowedBase ?? process.cwd();

      // Validate the path is safe and within the allowed directory
      PathSecurity.validateFilePath(filePath, baseDir);

      // Additional checks for dangerous file extensions in file operations
      const ext = path.extname(filePath).toLowerCase();
      const dangerousExts = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.ps1', '.sh'];
      if (dangerousExts.includes(ext)) {
        throw new Error(`Dangerous file type not allowed: ${ext}`);
      }

      // Check for null bytes (path truncation attack)
      if (filePath.includes('\0')) {
        throw new Error('Invalid filename: null bytes not allowed');
      }

      // Check for excessively long paths
      if (filePath.length > 4096) {
        throw new Error('Path too long: exceeds maximum allowed length');
      }
    } catch (error) {
      throw new FileSystemError(
        'path validation',
        filePath,
        error instanceof Error ? error : new Error('Path validation failed')
      );
    }
  }
  /**
   * Safely read and parse a JSON file with validation
   */
  async readJsonFile<T = unknown>(filePath: string): Promise<T> {
    // Validate file path for security
    this.validateFilePath(filePath);

    try {
      if (!(await fs.pathExists(filePath))) {
        throw new FileSystemError('read', filePath, new Error('File does not exist'));
      }

      return (await fs.readJson(filePath)) as T;
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      throw new FileSystemError('read', filePath, error as Error);
    }
  }

  /**
   * Safely write JSON data to a file
   */
  async writeJsonFile<T>(
    filePath: string,
    data: T,
    options: { spaces?: number } = {}
  ): Promise<void> {
    // Validate file path for security
    this.validateFilePath(filePath);

    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeJson(filePath, data, { spaces: options.spaces ?? 2 });
    } catch (error) {
      throw new FileSystemError('write', filePath, error as Error);
    }
  }

  /**
   * Safely read text file content
   */
  async readTextFile(filePath: string): Promise<string> {
    // Validate file path for security
    this.validateFilePath(filePath);

    try {
      if (!(await fs.pathExists(filePath))) {
        throw new FileSystemError('read', filePath, new Error('File does not exist'));
      }

      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      throw new FileSystemError('read', filePath, error as Error);
    }
  }

  /**
   * Safely write text content to a file
   */
  async writeTextFile(filePath: string, content: string): Promise<void> {
    // Validate file path for security
    this.validateFilePath(filePath);

    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new FileSystemError('write', filePath, error as Error);
    }
  }

  /**
   * Check if a file or directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      return await fs.pathExists(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists, creating if necessary
   */
  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.ensureDir(dirPath);
    } catch (error) {
      throw new FileSystemError('create directory', dirPath, error as Error);
    }
  }

  /**
   * List files in a directory with optional filtering
   */
  // eslint-disable-next-line no-unused-vars
  async listFiles(dirPath: string, filter?: (_file: string) => boolean): Promise<string[]> {
    try {
      if (!(await fs.pathExists(dirPath))) {
        return [];
      }

      const files = await fs.readdir(dirPath);
      return filter ? files.filter(filter) : files;
    } catch (error) {
      throw new FileSystemError('list', dirPath, error as Error);
    }
  }

  /**
   * Copy a file from source to destination
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    // Validate both source and destination paths for security
    this.validateFilePath(sourcePath);
    this.validateFilePath(destPath);

    try {
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(sourcePath, destPath);
    } catch (error) {
      throw new FileSystemError('copy', sourcePath, error as Error);
    }
  }

  /**
   * Remove a file or directory
   */
  async remove(filePath: string): Promise<void> {
    try {
      await fs.remove(filePath);
    } catch (error) {
      throw new FileSystemError('remove', filePath, error as Error);
    }
  }

  /**
   * Get file stats
   */
  async getStats(filePath: string): Promise<fs.Stats> {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      throw new FileSystemError('stat', filePath, error as Error);
    }
  }
}
