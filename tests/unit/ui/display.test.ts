import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { showStackInfo } from '../../../src/ui/display.js';
import type { DeveloperStack } from '../../../src/types/index.js';
import type { FsMocks } from '../../mocks/fs-mocks.js';

// Mock fs-extra
jest.mock('fs-extra', () => {
  const { FsMocks } = require('../../mocks/fs-mocks.js');
  return FsMocks.mockFsExtra();
});

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    info: jest.fn().mockImplementation((text: string) => text),
    meta: jest.fn().mockImplementation((text: string) => text),
    stackName: jest.fn().mockImplementation((text: string) => text),
    description: jest.fn().mockImplementation((text: string) => text),
    error: jest.fn().mockImplementation((text: string) => text),
    success: jest.fn().mockImplementation((text: string) => text),
    warning: jest.fn().mockImplementation((text: string) => text),
    number: jest.fn().mockImplementation((text: string) => text),
    id: jest.fn().mockImplementation((text: string) => text),
  },
}));

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text: string) => text;

  // Add chainable properties
  const chainableMethods = ['cyan', 'blue', 'green', 'red', 'yellow', 'magenta', 'bold'];

  chainableMethods.forEach(method => {
    Object.defineProperty(mockChalk, method, {
      get() {
        return mockChalk;
      },
    });
  });

  return mockChalk;
});

// Mock constants/paths
jest.mock('../../../src/constants/paths.js', () => ({
  STACKS_PATH: '/test/.claude/stacks',
  getStacksPath: jest.fn(() => '/test/.claude/stacks'),
  getLocalClaudeDir: jest.fn(() => '/test/project/.claude'),
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => {
    const validArgs = args.filter(Boolean);
    return validArgs.join('/').replace(/\/+/g, '/');
  }),
  basename: jest.fn(path => (path ? path.split('/').pop() : '')),
  isAbsolute: jest.fn(path => typeof path === 'string' && path.startsWith('/')),
  resolve: jest.fn((...args) => {
    if (args.length === 1) {
      const path = args[0];
      return typeof path === 'string' && path.startsWith('/') ? path : `/resolved/${path}`;
    } else if (args.length === 2) {
      const [baseDir, relativePath] = args;
      return `${baseDir}/${relativePath}`.replace(/\/+/g, '/');
    }
    return args[args.length - 1];
  }),
  normalize: jest.fn(path => path),
  sep: '/',
  extname: jest.fn(path => {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.slice(lastDot) : '';
  }),
}));

// Mock process
const mockProcessCwd = jest.fn();
Object.defineProperty(process, 'cwd', {
  value: mockProcessCwd,
  writable: true,
});

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockConsoleClear = jest.fn();

describe('display module', () => {
  let mockFs: ReturnType<typeof FsMocks.mockFsExtra>;

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleClear = console.clear;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    console.clear = mockConsoleClear;

    // Reset all mock functions explicitly
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
    mockConsoleClear.mockReset();

    // Re-setup color mocks to ensure they work correctly
    const { colors } = require('../../../src/utils/colors.js');
    colors.info = jest.fn().mockImplementation((text: string) => text);
    colors.meta = jest.fn().mockImplementation((text: string) => text);
    colors.stackName = jest.fn().mockImplementation((text: string) => text);
    colors.description = jest.fn().mockImplementation((text: string) => text);
    colors.error = jest.fn().mockImplementation((text: string) => text);
    colors.success = jest.fn().mockImplementation((text: string) => text);
    colors.warning = jest.fn().mockImplementation((text: string) => text);
    colors.number = jest.fn().mockImplementation((text: string) => text);
    colors.id = jest.fn().mockImplementation((text: string) => text);

    // Re-setup path mocks to ensure they work correctly
    const pathConstants = require('../../../src/constants/paths.js');
    pathConstants.getStacksPath = jest.fn(() => '/test/.claude/stacks');
    pathConstants.STACKS_PATH = '/test/.claude/stacks';
    pathConstants.getLocalClaudeDir = jest.fn(() => '/test/project/.claude');

    // Re-setup path module mocks to ensure they work correctly
    const mockPath = require('path');
    mockPath.join = jest.fn((...args) => {
      const validArgs = args.filter(Boolean);
      return validArgs.join('/').replace(/\/+/g, '/');
    });
    mockPath.basename = jest.fn(path => (path ? path.split('/').pop() : ''));
    mockPath.isAbsolute = jest.fn(path => typeof path === 'string' && path.startsWith('/'));
    mockPath.resolve = jest.fn((...args) => {
      if (args.length === 1) {
        const path = args[0];
        return typeof path === 'string' && path.startsWith('/') ? path : `/resolved/${path}`;
      } else if (args.length === 2) {
        const [baseDir, relativePath] = args;
        return `${baseDir}/${relativePath}`.replace(/\/+/g, '/');
      }
      return args[args.length - 1];
    });
    mockPath.normalize = jest.fn(path => path);
    mockPath.sep = '/';
    mockPath.extname = jest.fn(path => {
      const parts = path.split('/');
      const filename = parts[parts.length - 1];
      const lastDot = filename.lastIndexOf('.');
      return lastDot > 0 ? filename.slice(lastDot) : '';
    });

    // Setup fs mocks
    mockFs = require('fs-extra');
    mockFs.pathExists.mockReset();
    mockFs.readJson.mockReset();
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readJson.mockResolvedValue({});

    // Setup process.cwd mock
    mockProcessCwd.mockReset();
    mockProcessCwd.mockReturnValue('/test/current-directory');
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.clear = originalConsoleClear;
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('showStackInfo', () => {
    describe('current directory display', () => {
      it('should display current directory information when showCurrent is true', async () => {
        await showStackInfo(undefined, true);

        expect(mockConsoleLog).toHaveBeenCalledWith('🎯 Current Directory Environment');
        expect(mockConsoleLog).toHaveBeenCalledWith('Path: /test/current-directory\n');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Current directory analysis not yet implemented in refactored version'
        );
      });

      it('should use colors.meta for path display', async () => {
        const { colors } = require('../../../src/utils/colors.js');

        await showStackInfo(undefined, true);

        expect(colors.meta).toHaveBeenCalledWith('Path: /test/current-directory\n');
        expect(colors.info).toHaveBeenCalledWith(
          'Current directory analysis not yet implemented in refactored version'
        );
      });
    });

    describe('stack file loading', () => {
      it('should load stack from file when provided', async () => {
        const mockStack: DeveloperStack = {
          name: 'test-stack',
          description: 'A test stack',
          version: '1.0.0',
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/path/stack.json');

        expect(mockFs.pathExists).toHaveBeenCalledWith('/test/path/stack.json');
        expect(mockFs.readJson).toHaveBeenCalledWith('/test/path/stack.json');
        expect(mockConsoleLog).toHaveBeenCalledWith('📦 test-stack');
      });

      it('should resolve stack file path from current directory when not provided', async () => {
        const mockPath = require('path');
        mockPath.basename.mockReturnValue('my-project');

        const mockStack: DeveloperStack = {
          name: 'my-project-stack',
          description: 'Auto-resolved stack',
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo();

        expect(mockPath.basename).toHaveBeenCalledWith('/test/current-directory');
        expect(mockFs.pathExists).toHaveBeenCalledWith(
          '/test/.claude/stacks/my-project-stack.json'
        );
      });

      it('should handle relative paths without slashes', async () => {
        const mockStack: DeveloperStack = {
          name: 'relative-stack',
          description: 'A relative path stack',
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('simple-name.json');

        expect(mockFs.pathExists).toHaveBeenCalledWith('/test/.claude/stacks/simple-name.json');
      });

      it('should resolve absolute paths for complex filenames', async () => {
        const mockPath = require('path');
        mockPath.resolve.mockReturnValue('/test/current-directory/complex/path.json');

        const mockStack: DeveloperStack = {
          name: 'complex-stack',
          description: 'A complex path stack',
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('complex/path.json');

        expect(mockPath.resolve).toHaveBeenCalledWith(
          '/test/current-directory',
          'complex/path.json'
        );
        expect(mockFs.pathExists).toHaveBeenCalledWith('/test/current-directory/complex/path.json');
      });

      it('should throw error when stack file does not exist', async () => {
        mockFs.pathExists.mockResolvedValue(false);

        await expect(showStackInfo('/nonexistent/stack.json')).rejects.toThrow(
          'Access denied: stack file path outside allowed directories. Allowed: /test/.claude/stacks, /test/current-directory'
        );
      });

      it('should handle JSON reading errors', async () => {
        mockFs.readJson.mockRejectedValue(new Error('Invalid JSON'));

        await expect(showStackInfo('/test/invalid.json')).rejects.toThrow('Invalid JSON');
      });
    });

    describe('stack header display', () => {
      it('should display basic stack information', async () => {
        const mockStack: DeveloperStack = {
          name: 'header-test-stack',
          description: 'Testing header display',
          version: '2.1.0',
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('📦 header-test-stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('Version: 2.1.0');
        expect(mockConsoleLog).toHaveBeenCalledWith('Description: Testing header display');
      });

      it('should display metadata when available', async () => {
        const mockStack: DeveloperStack = {
          name: 'metadata-stack',
          description: 'Stack with metadata',
          metadata: {
            exported_from: 'test-source',
            created_at: '2024-01-01T12:00:00Z', // Use noon to avoid timezone edge cases
            published_stack_id: 'org/published-stack',
            published_version: '1.2.3',
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('Exported from: test-source');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringMatching(/Created: \d{1,2}\/\d{1,2}\/2024/)
        );
        expect(mockConsoleLog).toHaveBeenCalledWith('Published ID: org/published-stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('Published Version: 1.2.3');
      });

      it('should use colors for different elements', async () => {
        const { colors } = require('../../../src/utils/colors.js');

        const mockStack: DeveloperStack = {
          name: 'color-test-stack',
          description: 'Testing colors',
          version: '1.0.0',
          metadata: {
            published_stack_id: 'org/stack',
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(colors.meta).toHaveBeenCalledWith('1.0.0');
        expect(colors.description).toHaveBeenCalledWith('Testing colors');
        expect(colors.id).toHaveBeenCalledWith('org/stack');
      });

      it('should handle missing optional fields gracefully', async () => {
        const mockStack: DeveloperStack = {
          name: 'minimal-stack',
          description: 'Minimal stack info',
          // No version, no metadata
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('📦 minimal-stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('Description: Minimal stack info');
        // Should not call version-related logs
        expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Version:'));
      });
    });

    describe('component categorization and display', () => {
      it('should categorize and display global components', async () => {
        const mockStack: DeveloperStack = {
          name: 'component-stack',
          description: 'Stack with components',
          commands: [
            {
              name: 'global-cmd',
              filePath: '~/commands/global.md',
              content: 'global command content',
              description: 'A global command',
            },
          ],
          agents: [
            {
              name: 'global-agent',
              filePath: '~/agents/global.md',
              content: 'global agent content',
              description: 'A global agent',
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('GLOBAL (~/.claude/):');
        expect(mockConsoleLog).toHaveBeenCalledWith('  Commands (1):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ global-cmd', '- A global command');
        expect(mockConsoleLog).toHaveBeenCalledWith('  Agents (1):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ global-agent', '- A global agent');
      });

      it('should categorize and display local components', async () => {
        const mockStack: DeveloperStack = {
          name: 'local-component-stack',
          description: 'Stack with local components',
          commands: [
            {
              name: 'local-cmd',
              filePath: './commands/local.md',
              content: 'local command content',
              description: 'A local command',
            },
          ],
          agents: [
            {
              name: 'local-agent',
              filePath: './agents/local.md',
              content: 'local agent content',
              description: 'A local agent',
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('LOCAL (./.claude/):');
        expect(mockConsoleLog).toHaveBeenCalledWith('  Commands (1):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ local-cmd', '- A local command');
        expect(mockConsoleLog).toHaveBeenCalledWith('  Agents (1):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ local-agent', '- A local agent');
      });

      it('should handle mixed global and local components', async () => {
        const mockStack: DeveloperStack = {
          name: 'mixed-stack',
          description: 'Stack with mixed components',
          commands: [
            {
              name: 'global-cmd',
              filePath: '~/commands/global.md',
              content: 'global command content',
              description: 'Global command',
            },
            {
              name: 'local-cmd',
              filePath: './commands/local.md',
              content: 'local command content',
              description: 'Local command',
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        // Should display both sections
        expect(mockConsoleLog).toHaveBeenCalledWith('GLOBAL (~/.claude/):');
        expect(mockConsoleLog).toHaveBeenCalledWith('LOCAL (./.claude/):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ global-cmd', '- Global command');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ local-cmd', '- Local command');
      });

      it('should handle components without descriptions', async () => {
        const mockStack: DeveloperStack = {
          name: 'no-desc-stack',
          description: 'Stack with no component descriptions',
          commands: [
            {
              name: 'no-desc-cmd',
              filePath: '~/commands/no-desc.md',
              content: 'command content',
              // No description field
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ no-desc-cmd',
          '- No description available'
        );
      });

      it('should skip empty component sections', async () => {
        const mockStack: DeveloperStack = {
          name: 'empty-components-stack',
          description: 'Stack with no components',
          // No commands, agents, or other components
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        // Should not display any component sections
        expect(mockConsoleLog).not.toHaveBeenCalledWith('GLOBAL (~/.claude/):');
        expect(mockConsoleLog).not.toHaveBeenCalledWith('LOCAL (./.claude/):');
      });
    });

    describe('description truncation', () => {
      it('should truncate long descriptions to 80 characters', async () => {
        const longDescription = 'A'.repeat(100); // 100 characters
        const mockStack: DeveloperStack = {
          name: 'truncation-test',
          description: 'Stack for testing truncation',
          commands: [
            {
              name: 'long-desc-cmd',
              filePath: '~/commands/long.md',
              content: 'content',
              description: longDescription,
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        const expectedTruncated = `${'A'.repeat(77)}...`;
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ long-desc-cmd',
          `- ${expectedTruncated}`
        );
      });

      it('should not truncate descriptions under 80 characters', async () => {
        const shortDescription = 'Short description';
        const mockStack: DeveloperStack = {
          name: 'short-desc-test',
          description: 'Stack for testing short descriptions',
          commands: [
            {
              name: 'short-desc-cmd',
              filePath: '~/commands/short.md',
              content: 'content',
              description: shortDescription,
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ short-desc-cmd',
          `- ${shortDescription}`
        );
      });

      it('should handle exactly 80 character descriptions', async () => {
        const exactDescription = 'A'.repeat(80); // Exactly 80 characters
        const mockStack: DeveloperStack = {
          name: 'exact-desc-test',
          description: 'Stack for testing exact length',
          agents: [
            {
              name: 'exact-desc-agent',
              filePath: './agents/exact.md',
              content: 'content',
              description: exactDescription,
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        // Should not be truncated (exactly 80 chars)
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ exact-desc-agent',
          `- ${exactDescription}`
        );
      });
    });

    describe('MCP servers display', () => {
      it('should display MCP servers with basic info', async () => {
        const mockStack: DeveloperStack = {
          name: 'mcp-stack',
          description: 'Stack with MCP servers',
          mcpServers: [
            {
              name: 'filesystem',
              type: 'stdio',
              command: 'npx',
              args: ['@modelcontextprotocol/server-filesystem'],
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('  MCP Servers (1):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ filesystem (stdio) - npx');
      });

      it('should display MCP servers with URLs', async () => {
        const mockStack: DeveloperStack = {
          name: 'mcp-url-stack',
          description: 'Stack with URL MCP servers',
          mcpServers: [
            {
              name: 'web-server',
              type: 'http',
              url: 'http://localhost:3000/mcp',
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ web-server (http) - http://localhost:3000/mcp'
        );
      });

      it('should display MCP servers without type or command/url', async () => {
        const mockStack: DeveloperStack = {
          name: 'minimal-mcp-stack',
          description: 'Stack with minimal MCP config',
          mcpServers: [
            {
              name: 'minimal-server',
              type: 'stdio',
              // No command, args, or url
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ minimal-server (stdio)');
      });

      it('should handle multiple MCP servers', async () => {
        const mockStack: DeveloperStack = {
          name: 'multi-mcp-stack',
          description: 'Stack with multiple MCP servers',
          mcpServers: [
            {
              name: 'filesystem',
              type: 'stdio',
              command: 'npx',
              args: ['filesystem-server'],
            },
            {
              name: 'database',
              type: 'http',
              url: 'http://localhost:5432/mcp',
            },
            {
              name: 'simple-server',
              type: 'stdio',
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('  MCP Servers (3):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ filesystem (stdio) - npx');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ database (http) - http://localhost:5432/mcp'
        );
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ simple-server (stdio)');
      });

      it('should skip MCP section when no servers', async () => {
        const mockStack: DeveloperStack = {
          name: 'no-mcp-stack',
          description: 'Stack without MCP servers',
          // No mcpServers field
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('MCP Servers'));
      });
    });

    describe('CLAUDE.md display', () => {
      it('should display global CLAUDE.md', async () => {
        const mockStack: DeveloperStack = {
          name: 'claude-md-stack',
          description: 'Stack with CLAUDE.md',
          claudeMd: {
            global: {
              path: '~/.claude/CLAUDE.md',
              content: 'Global instructions',
            },
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('GLOBAL (~/.claude/):');
        expect(mockConsoleLog).toHaveBeenCalledWith('  CLAUDE.md:');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ ~/.claude/CLAUDE.md',
          '- Global project instructions'
        );
      });

      it('should display local CLAUDE.md', async () => {
        const mockStack: DeveloperStack = {
          name: 'local-claude-md-stack',
          description: 'Stack with local CLAUDE.md',
          claudeMd: {
            local: {
              path: './.claude/CLAUDE.md',
              content: 'Local instructions',
            },
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('LOCAL (./.claude/):');
        expect(mockConsoleLog).toHaveBeenCalledWith('  CLAUDE.md:');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ ./.claude/CLAUDE.md',
          '- Local project instructions'
        );
      });

      it('should display both global and local CLAUDE.md', async () => {
        const mockStack: DeveloperStack = {
          name: 'both-claude-md-stack',
          description: 'Stack with both CLAUDE.md files',
          claudeMd: {
            global: {
              path: '~/.claude/CLAUDE.md',
              content: 'Global instructions',
            },
            local: {
              path: './.claude/CLAUDE.md',
              content: 'Local instructions',
            },
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        // Should display both sections
        expect(mockConsoleLog).toHaveBeenCalledWith('GLOBAL (~/.claude/):');
        expect(mockConsoleLog).toHaveBeenCalledWith('LOCAL (./.claude/):');
        // Each should have their CLAUDE.md
        const claudeMdCalls = mockConsoleLog.mock.calls.filter(call => call[0] === '  CLAUDE.md:');
        expect(claudeMdCalls).toHaveLength(2);
      });
    });

    describe('settings display', () => {
      it('should display settings when available', async () => {
        const mockStack: DeveloperStack = {
          name: 'settings-stack',
          description: 'Stack with settings',
          settings: {
            theme: 'dark',
            timeout: 5000,
            enabled: true,
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('SETTINGS:');
        expect(mockConsoleLog).toHaveBeenCalledWith('  theme:', 'dark');
        expect(mockConsoleLog).toHaveBeenCalledWith('  timeout:', '5000');
        expect(mockConsoleLog).toHaveBeenCalledWith('  enabled:', 'true');
      });

      it('should skip settings when empty or undefined', async () => {
        const mockStack: DeveloperStack = {
          name: 'no-settings-stack',
          description: 'Stack without settings',
          // No settings field
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).not.toHaveBeenCalledWith('SETTINGS:');
      });

      it('should skip specific settings like $schema and feedbackSurveyState', async () => {
        const mockStack: DeveloperStack = {
          name: 'filtered-settings-stack',
          description: 'Stack with filtered settings',
          settings: {
            $schema: 'https://schema.com/settings.json',
            feedbackSurveyState: { completed: true },
            validSetting: 'should-display',
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('SETTINGS:');
        expect(mockConsoleLog).toHaveBeenCalledWith('  validSetting:', 'should-display');
        expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('$schema'));
        expect(mockConsoleLog).not.toHaveBeenCalledWith(
          expect.stringContaining('feedbackSurveyState')
        );
      });

      it('should handle object settings with JSON formatting', async () => {
        const mockStack: DeveloperStack = {
          name: 'object-settings-stack',
          description: 'Stack with object settings',
          settings: {
            database: {
              host: 'localhost',
              port: 5432,
              name: 'testdb',
            },
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('SETTINGS:');
        // Should format the object as JSON with proper indentation
        const expectedJson = JSON.stringify(
          {
            host: 'localhost',
            port: 5432,
            name: 'testdb',
          },
          null,
          2
        ).replace(/\n/g, '\n    ');
        expect(mockConsoleLog).toHaveBeenCalledWith('  database:', expectedJson);
      });

      describe('special settings handling', () => {
        it('should handle permissions settings', async () => {
          const mockStack: DeveloperStack = {
            name: 'permissions-stack',
            description: 'Stack with permissions',
            settings: {
              permissions: {
                allow: ['read', 'write'],
                deny: ['delete'],
                ask: ['execute'],
                additionalDirectories: ['/home/user', '/opt/app'],
              },
            },
          };

          mockFs.readJson.mockResolvedValue(mockStack);

          await showStackInfo('/test/stack.json');

          expect(mockConsoleLog).toHaveBeenCalledWith('  permissions:');
          expect(mockConsoleLog).toHaveBeenCalledWith('    allow: 2 rules');
          expect(mockConsoleLog).toHaveBeenCalledWith('    deny: 1 rules');
          expect(mockConsoleLog).toHaveBeenCalledWith('    ask: 1 rules');
          expect(mockConsoleLog).toHaveBeenCalledWith('    additional directories: 2 entries');
        });

        it('should handle statusLine settings', async () => {
          const mockStack: DeveloperStack = {
            name: 'statusline-stack',
            description: 'Stack with status line',
            settings: {
              statusLine: {
                type: 'command',
                command: 'git status --short',
              },
            },
          };

          mockFs.readJson.mockResolvedValue(mockStack);

          await showStackInfo('/test/stack.json');

          expect(mockConsoleLog).toHaveBeenCalledWith(
            '  statusLine:',
            'command: git status --short'
          );
        });

        it('should handle statusLine settings without command', async () => {
          const mockStack: DeveloperStack = {
            name: 'statusline-no-cmd-stack',
            description: 'Stack with status line but no command',
            settings: {
              statusLine: {
                type: 'display',
                // No command field
              },
            },
          };

          mockFs.readJson.mockResolvedValue(mockStack);

          await showStackInfo('/test/stack.json');

          expect(mockConsoleLog).toHaveBeenCalledWith('  statusLine:', 'type: display');
        });

        it('should handle statusLine settings with unknown type', async () => {
          const mockStack: DeveloperStack = {
            name: 'statusline-unknown-stack',
            description: 'Stack with unknown status line type',
            settings: {
              statusLine: {
                // No type field
                someOtherProperty: 'value',
              },
            },
          };

          mockFs.readJson.mockResolvedValue(mockStack);

          await showStackInfo('/test/stack.json');

          expect(mockConsoleLog).toHaveBeenCalledWith('  statusLine:', 'type: unknown');
        });

        it('should handle hooks settings', async () => {
          const mockStack: DeveloperStack = {
            name: 'hooks-stack',
            description: 'Stack with hooks',
            settings: {
              hooks: {
                'pre-commit': [
                  {
                    matcher: '*.js',
                    hooks: ['eslint', 'prettier'],
                  },
                  {
                    matcher: '*.ts',
                    hooks: ['tslint'],
                  },
                ],
              },
            },
          };

          mockFs.readJson.mockResolvedValue(mockStack);

          await showStackInfo('/test/stack.json');

          expect(mockConsoleLog).toHaveBeenCalledWith('  hooks:');
          expect(mockConsoleLog).toHaveBeenCalledWith(
            '    ✓ pre-commit:',
            '2 matcher(s), 3 hook(s)'
          );
        });

        it('should handle null hooks settings', async () => {
          const mockStack: DeveloperStack = {
            name: 'null-hooks-stack',
            description: 'Stack with null hooks',
            settings: {
              hooks: null, // null hooks should be handled gracefully
              validSetting: 'should-display',
            },
          };

          mockFs.readJson.mockResolvedValue(mockStack);

          await showStackInfo('/test/stack.json');

          expect(mockConsoleLog).toHaveBeenCalledWith('SETTINGS:');
          expect(mockConsoleLog).toHaveBeenCalledWith('  validSetting:', 'should-display');
          // hooks: null should not cause any output
          expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('hooks:'));
        });

        it('should handle non-object hooks settings', async () => {
          const mockStack: DeveloperStack = {
            name: 'invalid-hooks-stack',
            description: 'Stack with invalid hooks',
            settings: {
              hooks: 'invalid-string', // string instead of object
              validSetting: 'should-display',
            },
          };

          mockFs.readJson.mockResolvedValue(mockStack);

          await showStackInfo('/test/stack.json');

          expect(mockConsoleLog).toHaveBeenCalledWith('SETTINGS:');
          expect(mockConsoleLog).toHaveBeenCalledWith('  validSetting:', 'should-display');
          // Invalid hooks should not be displayed since displayHooks returns early for non-objects
          expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('hooks:'));
        });
      });
    });

    describe('text formatting and utilities', () => {
      it('should handle special characters in descriptions', async () => {
        const specialDescription = 'Description with "quotes" and \'single quotes\' & symbols';
        const mockStack: DeveloperStack = {
          name: 'special-chars-stack',
          description: 'Stack with special characters',
          commands: [
            {
              name: 'special-cmd',
              filePath: '~/commands/special.md',
              content: 'content',
              description: specialDescription,
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ special-cmd', `- ${specialDescription}`);
      });

      it('should handle empty string descriptions', async () => {
        const mockStack: DeveloperStack = {
          name: 'empty-desc-stack',
          description: 'Stack with empty description',
          agents: [
            {
              name: 'empty-desc-agent',
              filePath: './agents/empty.md',
              content: 'content',
              description: '', // Empty description
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ empty-desc-agent', '- ');
      });

      it('should handle unicode and emoji in descriptions', async () => {
        const unicodeDescription = 'Unicode test 🚀 with émojis and spëcial chars ñ';
        const mockStack: DeveloperStack = {
          name: 'unicode-stack',
          description: 'Stack with unicode',
          commands: [
            {
              name: 'unicode-cmd',
              filePath: '~/commands/unicode.md',
              content: 'content',
              description: unicodeDescription,
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ unicode-cmd', `- ${unicodeDescription}`);
      });

      it('should handle newlines in descriptions', async () => {
        const multilineDescription = 'First line\nSecond line\nThird line';
        const expectedDescription = 'First line Second line Third line'; // Should be flattened
        const mockStack: DeveloperStack = {
          name: 'multiline-stack',
          description: 'Stack with multiline descriptions',
          commands: [
            {
              name: 'multiline-cmd',
              filePath: '~/commands/multiline.md',
              content: 'content',
              description: multilineDescription,
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        // The display should handle newlines appropriately
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ multiline-cmd',
          expect.stringContaining('First line')
        );
      });
    });

    describe('edge cases and error handling', () => {
      it('should handle null/undefined components gracefully', async () => {
        const mockStack: DeveloperStack = {
          name: 'null-components-stack',
          description: 'Stack with null components',
          commands: undefined,
          agents: undefined,
          mcpServers: undefined,
          settings: undefined,
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        // Should not throw an error
        await expect(showStackInfo('/test/stack.json')).resolves.not.toThrow();

        // Should display basic info but skip component sections
        expect(mockConsoleLog).toHaveBeenCalledWith('📦 null-components-stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('Description: Stack with null components');
      });

      it('should handle empty arrays for components', async () => {
        const mockStack: DeveloperStack = {
          name: 'empty-arrays-stack',
          description: 'Stack with empty arrays',
          commands: [],
          agents: [],
          mcpServers: [],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        // Should not display component sections for empty arrays
        expect(mockConsoleLog).not.toHaveBeenCalledWith('GLOBAL (~/.claude/):');
        expect(mockConsoleLog).not.toHaveBeenCalledWith('LOCAL (./.claude/):');
        expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('MCP Servers'));
      });

      it('should handle malformed settings gracefully', async () => {
        const mockStack: DeveloperStack = {
          name: 'malformed-settings-stack',
          description: 'Stack with malformed settings',
          settings: {
            permissions: null, // Should be object
            statusLine: 'invalid', // Should be object
            hooks: [], // Should be object
            validSetting: 'works',
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        // Should not throw an error
        await expect(showStackInfo('/test/stack.json')).resolves.not.toThrow();

        expect(mockConsoleLog).toHaveBeenCalledWith('SETTINGS:');
        expect(mockConsoleLog).toHaveBeenCalledWith('  validSetting:', 'works');
      });

      it('should handle components with missing filePath', async () => {
        const mockStack: DeveloperStack = {
          name: 'missing-filepath-stack',
          description: 'Stack with components missing filePath',
          commands: [
            {
              name: 'no-path-cmd',
              filePath: '', // Empty string
              content: 'content',
              description: 'Command with no path',
            },
          ],
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        // Should not categorize as global or local, might not display at all
        // The component categorization depends on filePath starting with ~ or .
        expect(mockConsoleLog).toHaveBeenCalledWith('📦 missing-filepath-stack');
      });

      it('should handle large number of components efficiently', async () => {
        // Test with many components to ensure no performance issues
        const commands = Array.from({ length: 100 }, (_, i) => ({
          name: `cmd-${i}`,
          filePath: `~/commands/cmd-${i}.md`,
          content: `Command ${i} content`,
          description: `Command ${i} description`,
        }));

        const mockStack: DeveloperStack = {
          name: 'large-stack',
          description: 'Stack with many components',
          commands,
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        // Should complete without timeout or excessive memory usage
        await expect(showStackInfo('/test/stack.json')).resolves.not.toThrow();

        expect(mockConsoleLog).toHaveBeenCalledWith('  Commands (100):');
      });

      it('should handle deeply nested settings objects', async () => {
        const deepObject = {
          level1: {
            level2: {
              level3: {
                level4: {
                  deepValue: 'nested value',
                  arrayValue: [1, 2, 3],
                  boolValue: true,
                },
              },
            },
          },
        };

        const mockStack: DeveloperStack = {
          name: 'deep-settings-stack',
          description: 'Stack with deeply nested settings',
          settings: {
            deepSetting: deepObject,
          },
        };

        mockFs.readJson.mockResolvedValue(mockStack);

        await showStackInfo('/test/stack.json');

        expect(mockConsoleLog).toHaveBeenCalledWith('SETTINGS:');
        const expectedJson = JSON.stringify(deepObject, null, 2).replace(/\n/g, '\n    ');
        expect(mockConsoleLog).toHaveBeenCalledWith('  deepSetting:', expectedJson);
      });
    });

    describe('comprehensive integration', () => {
      it('should handle a complete stack with all features', async () => {
        const completeStack: DeveloperStack = {
          name: 'complete-stack',
          description: 'A complete stack with all features',
          version: '2.5.0',
          commands: [
            {
              name: 'global-command',
              filePath: '~/commands/global.md',
              content: 'Global command content',
              description: 'A global command',
            },
            {
              name: 'local-command',
              filePath: './commands/local.md',
              content: 'Local command content',
              description: 'A local command',
            },
          ],
          agents: [
            {
              name: 'test-agent',
              filePath: '~/agents/test.md',
              content: 'Agent content',
              description: 'A test agent',
            },
          ],
          mcpServers: [
            {
              name: 'filesystem',
              type: 'stdio',
              command: 'npx',
              args: ['filesystem-server'],
            },
            {
              name: 'web-api',
              type: 'http',
              url: 'http://localhost:3000/mcp',
            },
          ],
          settings: {
            theme: 'dark',
            permissions: {
              allow: ['read', 'write'],
              deny: ['delete'],
            },
            database: {
              host: 'localhost',
              port: 5432,
            },
          },
          claudeMd: {
            global: {
              path: '~/.claude/CLAUDE.md',
              content: 'Global instructions',
            },
            local: {
              path: './.claude/CLAUDE.md',
              content: 'Local instructions',
            },
          },
          metadata: {
            created_at: '2024-01-01T12:00:00Z', // Use noon to avoid timezone issues
            exported_from: 'test-source',
            published_stack_id: 'org/complete-stack',
            published_version: '2.5.0',
          },
        };

        mockFs.readJson.mockResolvedValue(completeStack);

        await showStackInfo('/test/complete-stack.json');

        // Verify header
        expect(mockConsoleLog).toHaveBeenCalledWith('📦 complete-stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('Version: 2.5.0');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Description: A complete stack with all features'
        );
        expect(mockConsoleLog).toHaveBeenCalledWith('Exported from: test-source');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringMatching(/Created: \d{1,2}\/\d{1,2}\/2024/)
        );
        expect(mockConsoleLog).toHaveBeenCalledWith('Published ID: org/complete-stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('Published Version: 2.5.0');

        // Verify global components
        expect(mockConsoleLog).toHaveBeenCalledWith('GLOBAL (~/.claude/):');
        expect(mockConsoleLog).toHaveBeenCalledWith('  Commands (1):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ global-command', '- A global command');
        expect(mockConsoleLog).toHaveBeenCalledWith('  Agents (1):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ test-agent', '- A test agent');
        expect(mockConsoleLog).toHaveBeenCalledWith('  CLAUDE.md:');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ ~/.claude/CLAUDE.md',
          '- Global project instructions'
        );

        // Verify local components
        expect(mockConsoleLog).toHaveBeenCalledWith('LOCAL (./.claude/):');
        expect(mockConsoleLog).toHaveBeenCalledWith('  Commands (1):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ local-command', '- A local command');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ ./.claude/CLAUDE.md',
          '- Local project instructions'
        );

        // Verify MCP servers
        expect(mockConsoleLog).toHaveBeenCalledWith('  MCP Servers (2):');
        expect(mockConsoleLog).toHaveBeenCalledWith('    ✓ filesystem (stdio) - npx');
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '    ✓ web-api (http) - http://localhost:3000/mcp'
        );

        // Verify settings
        expect(mockConsoleLog).toHaveBeenCalledWith('SETTINGS:');
        expect(mockConsoleLog).toHaveBeenCalledWith('  theme:', 'dark');
        expect(mockConsoleLog).toHaveBeenCalledWith('  permissions:');
        expect(mockConsoleLog).toHaveBeenCalledWith('    allow: 2 rules');
        expect(mockConsoleLog).toHaveBeenCalledWith('    deny: 1 rules');
      });
    });
  });
});
