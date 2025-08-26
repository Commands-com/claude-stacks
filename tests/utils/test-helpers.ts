import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Test utilities for setting up isolated test environments
 */
export class TestEnvironment {
  private tempDirs: string[] = [];

  /**
   * Create a temporary directory for test isolation
   */
  async createTempDir(prefix = 'claude-stacks-test-'): Promise<string> {
    const tempDir = await fs.mkdtemp(join(tmpdir(), prefix));
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  /**
   * Clean up all created temporary directories
   */
  async cleanup(): Promise<void> {
    await Promise.all(
      this.tempDirs.map(async dir => {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch (error) {
          console.warn(`Failed to cleanup temp dir ${dir}:`, error);
        }
      })
    );
    this.tempDirs = [];
  }

  /**
   * Create a test file with content
   */
  async createTestFile(dir: string, filename: string, content: string): Promise<string> {
    const filepath = join(dir, filename);
    await fs.writeFile(filepath, content, 'utf8');
    return filepath;
  }

  /**
   * Create a test directory structure
   */
  async createTestStructure(baseDir: string, structure: Record<string, any>): Promise<void> {
    for (const [name, content] of Object.entries(structure)) {
      const path = join(baseDir, name);

      if (typeof content === 'string') {
        // File
        await fs.mkdir(join(path, '..'), { recursive: true });
        await fs.writeFile(path, content, 'utf8');
      } else if (typeof content === 'object' && content !== null) {
        // Directory
        await fs.mkdir(path, { recursive: true });
        await this.createTestStructure(path, content);
      }
    }
  }
}

/**
 * Mock factory for common dependencies
 */
export class MockFactory {
  /**
   * Create a mock spinner (ora)
   */
  static createMockSpinner() {
    return {
      start: jest.fn().mockReturnThis(),
      stop: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
      warn: jest.fn().mockReturnThis(),
      info: jest.fn().mockReturnThis(),
      text: '',
      color: 'cyan',
      isSpinning: false,
    };
  }

  /**
   * Create a mock inquirer prompt
   */
  static createMockInquirer(responses: Record<string, any> = {}) {
    return {
      prompt: jest.fn().mockImplementation((questions: any[]) => {
        const result: Record<string, any> = {};
        questions.forEach(q => {
          if (q.name && responses[q.name] !== undefined) {
            result[q.name] = responses[q.name];
          } else if (q.default !== undefined) {
            result[q.name] = q.default;
          }
        });
        return Promise.resolve(result);
      }),
    };
  }

  /**
   * Create a mock fetch response
   */
  static createMockFetchResponse(data: any, status = 200, statusText = 'OK') {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      headers: new Map(),
      url: 'http://test.com',
    });
  }

  /**
   * Create a mock fs-extra module
   */
  static createMockFsExtra() {
    return {
      readJson: jest.fn(),
      writeJson: jest.fn(),
      ensureDir: jest.fn(),
      copy: jest.fn(),
      remove: jest.fn(),
      pathExists: jest.fn(),
      readdir: jest.fn(),
      stat: jest.fn(),
    };
  }
}

/**
 * Assertion helpers for testing
 */
export class TestAssertions {
  /**
   * Assert that a value is a valid stack ID (org/name format)
   */
  static assertValidStackId(value: string): void {
    expect(value).toMatch(/^[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+$/);
  }

  /**
   * Assert that an object has all required properties
   */
  static assertHasProperties<T>(obj: any, properties: (keyof T)[]): void {
    properties.forEach(prop => {
      expect(obj).toHaveProperty(String(prop));
    });
  }

  /**
   * Assert that a function throws with a specific message
   */
  static async assertThrowsWithMessage(fn: () => Promise<any>, message: string): Promise<void> {
    await expect(fn()).rejects.toThrow(message);
  }

  /**
   * Assert that a file exists with specific content
   */
  static async assertFileContent(filepath: string, expectedContent: string): Promise<void> {
    const content = await fs.readFile(filepath, 'utf8');
    expect(content).toBe(expectedContent);
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure execution time of an async function
   */
  static async measureExecutionTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
    return { result, duration };
  }

  /**
   * Run a function multiple times and get statistics
   */
  static async benchmark<T>(
    fn: () => Promise<T>,
    iterations = 10
  ): Promise<{
    avg: number;
    min: number;
    max: number;
    median: number;
    results: T[];
  }> {
    const measurements: number[] = [];
    const results: T[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await this.measureExecutionTime(fn);
      measurements.push(duration);
      results.push(result);
    }

    measurements.sort((a, b) => a - b);

    return {
      avg: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      min: measurements[0]!,
      max: measurements[measurements.length - 1]!,
      median: measurements[Math.floor(measurements.length / 2)]!,
      results,
    };
  }
}

/**
 * Data builders for creating test objects
 */
export class TestDataBuilder {
  /**
   * Build a test stack configuration
   */
  static buildStack(overrides: Partial<any> = {}) {
    return {
      id: 'test-org/test-stack',
      name: 'Test Stack',
      description: 'A test stack for development',
      author: 'test-user',
      version: '1.0.0',
      dependencies: [],
      mcpConfigs: {},
      files: {},
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...overrides,
    };
  }

  /**
   * Build a test API response
   */
  static buildApiResponse<T>(data: T, success = true, message = 'Success') {
    return {
      success,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build test MCP configuration
   */
  static buildMcpConfig(overrides: Partial<any> = {}) {
    return {
      name: 'test-mcp',
      command: 'node',
      args: ['test-server.js'],
      env: {},
      ...overrides,
    };
  }
}
