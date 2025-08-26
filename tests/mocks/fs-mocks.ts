import { jest } from '@jest/globals';
import { vol } from 'memfs';

/**
 * File system mocks for testing
 */
export class FsMocks {
  /**
   * Mock fs-extra with in-memory file system
   */
  static mockFsExtra() {
    const fsExtraMock = {
      readJson: jest.fn(),
      writeJson: jest.fn(),
      ensureDir: jest.fn(),
      copy: jest.fn(),
      remove: jest.fn(),
      pathExists: jest.fn(),
      readdir: jest.fn(),
      stat: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      unlink: jest.fn(),
    };

    // Default implementations
    fsExtraMock.readJson.mockResolvedValue({});
    fsExtraMock.writeJson.mockResolvedValue(undefined);
    fsExtraMock.ensureDir.mockResolvedValue(undefined);
    fsExtraMock.copy.mockResolvedValue(undefined);
    fsExtraMock.remove.mockResolvedValue(undefined);
    fsExtraMock.pathExists.mockResolvedValue(true);
    fsExtraMock.readdir.mockResolvedValue([]);
    fsExtraMock.stat.mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 0,
      mtime: new Date(),
    });
    fsExtraMock.readFile.mockResolvedValue('');
    fsExtraMock.writeFile.mockResolvedValue(undefined);
    fsExtraMock.mkdir.mockResolvedValue(undefined);
    fsExtraMock.rmdir.mockResolvedValue(undefined);
    fsExtraMock.unlink.mockResolvedValue(undefined);

    return fsExtraMock;
  }

  /**
   * Create a virtual file system structure
   */
  static createVirtualFs(structure: Record<string, any>) {
    vol.reset();
    vol.fromJSON(structure);
  }

  /**
   * Mock common file operations with custom behaviors
   */
  static mockFileOperations(overrides: Record<string, any> = {}) {
    const defaultMocks = this.mockFsExtra();

    return {
      ...defaultMocks,
      ...overrides,
    };
  }

  /**
   * Mock file system errors
   */
  static mockFsErrors(operations: string[] = ['readJson', 'writeJson']) {
    const fsExtraMock = this.mockFsExtra();

    operations.forEach(op => {
      if (fsExtraMock[op as keyof typeof fsExtraMock]) {
        (fsExtraMock[op as keyof typeof fsExtraMock] as jest.MockedFunction<any>).mockRejectedValue(
          new Error(`Mock ${op} error`)
        );
      }
    });

    return fsExtraMock;
  }

  /**
   * Mock path existence checks
   */
  static mockPathExistence(paths: Record<string, boolean>) {
    const fsExtraMock = this.mockFsExtra();

    fsExtraMock.pathExists.mockImplementation((path: string) => {
      return Promise.resolve(paths[path] ?? false);
    });

    return fsExtraMock;
  }

  /**
   * Mock directory listings
   */
  static mockDirectoryListings(listings: Record<string, string[]>) {
    const fsExtraMock = this.mockFsExtra();

    fsExtraMock.readdir.mockImplementation((path: string) => {
      return Promise.resolve(listings[path] ?? []);
    });

    return fsExtraMock;
  }

  /**
   * Mock file content reading
   */
  static mockFileReading(files: Record<string, any>) {
    const fsExtraMock = this.mockFsExtra();

    fsExtraMock.readJson.mockImplementation((path: string) => {
      if (files[path]) {
        return Promise.resolve(files[path]);
      }
      throw new Error(`File not found: ${path}`);
    });

    fsExtraMock.readFile.mockImplementation((path: string) => {
      if (files[path]) {
        return Promise.resolve(
          typeof files[path] === 'string' ? files[path] : JSON.stringify(files[path])
        );
      }
      throw new Error(`File not found: ${path}`);
    });

    return fsExtraMock;
  }
}

/**
 * Common file system test scenarios
 */
export const fsTestScenarios = {
  // Empty project directory
  emptyProject: {
    '/project': null,
  },

  // Project with basic structure
  basicProject: {
    '/project/package.json': JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
    }),
    '/project/src/index.ts': 'console.log("Hello, World!");',
    '/project/README.md': '# Test Project',
  },

  // Project with Claude stacks configuration
  stackProject: {
    '/project/.claude/config.json': JSON.stringify({
      stacks: ['org/stack1', 'org/stack2'],
      currentStack: 'org/stack1',
    }),
    '/project/.claude/stacks/org--stack1.json': JSON.stringify({
      id: 'org/stack1',
      name: 'Stack 1',
      files: {},
    }),
    '/project/package.json': JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
    }),
  },

  // Project with MCP configurations
  mcpProject: {
    '/home/.claude_desktop_config.json': JSON.stringify({
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
        },
      },
    }),
    '/project/package.json': JSON.stringify({
      name: 'mcp-project',
      version: '1.0.0',
    }),
  },
};
