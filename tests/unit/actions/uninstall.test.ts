import { jest } from '@jest/globals';
import { UninstallAction } from '../../../src/actions/uninstall.js';
import type {
  StackRegistryService,
  StackRegistryEntry,
} from '../../../src/services/StackRegistryService.js';
import type { UninstallOptions } from '../../../src/types/index.js';

// Mock dependencies
const mockUI = {
  info: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  success: jest.fn(),
  meta: jest.fn(),
  log: jest.fn(),
  confirm: jest.fn(),
  colorStackName: jest.fn().mockImplementation((text: string) => text),
  colorDescription: jest.fn().mockImplementation((text: string) => text),
  colorInfo: jest.fn().mockImplementation((text: string) => text),
  colorMeta: jest.fn().mockImplementation((text: string) => text),
  colorError: jest.fn().mockImplementation((text: string) => text),
  colorSuccess: jest.fn().mockImplementation((text: string) => text),
  colorWarning: jest.fn().mockImplementation((text: string) => text),
  colorNumber: jest.fn().mockImplementation((text: string) => text),
  colorHighlight: jest.fn().mockImplementation((text: string) => text),
  readSingleChar: jest.fn().mockResolvedValue('y'),
};

const mockFileService = {
  exists: jest.fn(),
  readJsonFile: jest.fn(),
  writeJsonFile: jest.fn(),
  ensureDir: jest.fn(),
  readTextFile: jest.fn(),
  writeTextFile: jest.fn(),
  copyFile: jest.fn(),
  removeFile: jest.fn(),
  globFiles: jest.fn(),
  getFileSize: jest.fn(),
  getFileMtime: jest.fn(),
  isDirectory: jest.fn(),
  listDirectory: jest.fn(),
  removeDirectory: jest.fn(),
};

const mockStackRegistry: jest.Mocked<StackRegistryService> = {
  getRegistry: jest.fn(),
  saveRegistry: jest.fn(),
  registerStack: jest.fn(),
  unregisterStack: jest.fn(),
  getStackEntry: jest.fn(),
  getAllStacks: jest.fn(),
  isStackInstalled: jest.fn(),
  findStacksUsingMcpServer: jest.fn(),
  findStacksWithComponent: jest.fn(),
  updateStackEntry: jest.fn(),
  cleanupRegistry: jest.fn(),
};

const mockServices = {
  ui: mockUI,
  fileService: mockFileService,
};

// Mock fs module
jest.mock('fs-extra', () => ({
  remove: jest.fn(),
  readdir: jest.fn(),
  rmdir: jest.fn(),
}));

import * as fs from 'fs-extra';
const mockFs = fs as jest.Mocked<typeof fs>;

const sampleStackEntry: StackRegistryEntry = {
  stackId: 'org/test-stack',
  name: 'Test Stack',
  installedAt: '2023-01-01T00:00:00.000Z',
  source: 'commands.com',
  version: '1.0.0',
  components: {
    commands: [
      { name: 'test-cmd', path: '/local/.claude/commands/test-cmd.md', isGlobal: false },
      { name: 'global-cmd', path: '/home/.claude/commands/global-cmd.md', isGlobal: true },
    ],
    agents: [{ name: 'test-agent', path: '/local/.claude/agents/test-agent.md', isGlobal: false }],
    mcpServers: ['test-server', 'another-server'],
    settings: [{ type: 'local', fields: ['theme', 'timeout'] }],
    claudeMd: [{ type: 'local', path: '/local/.claude/CLAUDE.md' }],
  },
};
const sampleStackWithHooks: StackRegistryEntry = {
  stackId: 'org/hooks-stack',
  name: 'Hooks Stack',
  installedAt: '2023-01-01T00:00:00.000Z',
  source: 'commands.com',
  version: '1.0.0',
  components: {
    commands: [],
    agents: [],
    hooks: [],
    mcpServers: [],
    settings: [
      {
        type: 'local',
        fields: ['hooks'],
        hooksMetadata: {
          PreToolUse: [
            {
              matcher: 'Read|Grep|Glob|Task',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/local/bin/test-hook.sh',
                },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Edit|Write',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/local/bin/post-hook.sh',
                },
              ],
            },
          ],
        },
      },
    ],
    claudeMd: [],
  },
};

const sampleStackWithHooksNoMetadata: StackRegistryEntry = {
  stackId: 'org/old-hooks-stack',
  name: 'Old Hooks Stack',
  installedAt: '2023-01-01T00:00:00.000Z',
  source: 'commands.com',
  version: '1.0.0',
  components: {
    commands: [],
    agents: [],
    hooks: [],
    mcpServers: [],
    settings: [
      {
        type: 'local',
        fields: ['hooks'], // No hooksMetadata - old format
      },
    ],
    claudeMd: [],
  },
};

describe('UninstallAction', () => {
  let uninstallAction: UninstallAction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock functions explicitly
    Object.values(mockUI).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear();
      }
    });

    Object.values(mockFileService).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear();
      }
    });

    Object.values(mockStackRegistry).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear();
      }
    });

    const mockFsModule = mockFs as jest.Mocked<typeof mockFs>;
    Object.values(mockFsModule).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear();
      }
    });

    uninstallAction = new UninstallAction(mockServices);
    // Mock the private stackRegistry property
    (uninstallAction as any).stackRegistry = mockStackRegistry;
  });

  describe('execute', () => {
    it('should show error when stack is not installed', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(null);

      await uninstallAction.execute('org/non-existent');

      expect(mockUI.error).toHaveBeenCalledWith(
        'Stack "org/non-existent" is not installed in this project.'
      );
      expect(mockUI.info).toHaveBeenCalledWith('Use "claude-stacks list" to see available stacks.');
    });

    it('should show uninstall preview and ask for confirmation', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(true);
      mockUI.confirm.mockResolvedValue(true);

      await uninstallAction.execute('org/test-stack');

      expect(mockUI.info).toHaveBeenCalledWith('🗑️  Preparing to uninstall stack: Test Stack');
      expect(mockUI.meta).toHaveBeenCalledWith('   Source: commands.com');
      expect(mockUI.meta).toHaveBeenCalledWith(
        `   Installed: ${new Date(sampleStackEntry.installedAt).toLocaleDateString()}`
      );
      expect(mockUI.readSingleChar).toHaveBeenCalledWith('\nProceed with uninstallation? (y/N): ');
      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/test-stack');
      expect(mockUI.success).toHaveBeenCalledWith(
        '\n✅ Stack \"Test Stack\" uninstalled successfully!'
      );
    });

    it('should skip confirmation with --force option', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(true);

      const options: UninstallOptions = { force: true };
      await uninstallAction.execute('org/test-stack', options);

      expect(mockUI.confirm).not.toHaveBeenCalled();
      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/test-stack');
    });

    it('should show dry run preview without making changes', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(true);

      const options: UninstallOptions = { dryRun: true };
      await uninstallAction.execute('org/test-stack', options);

      expect(mockUI.info).toHaveBeenCalledWith('\n[DRY RUN] No changes were made.');
      expect(mockStackRegistry.unregisterStack).not.toHaveBeenCalled();
    });

    it('should cancel uninstallation when user declines', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(true);
      mockUI.readSingleChar.mockResolvedValue('n');

      await uninstallAction.execute('org/test-stack');

      expect(mockUI.info).toHaveBeenCalledWith('Uninstallation cancelled.');
      expect(mockStackRegistry.unregisterStack).not.toHaveBeenCalled();
    });

    it('should show warnings for shared components', async () => {
      const otherStack: StackRegistryEntry = {
        stackId: 'org/other-stack',
        name: 'Other Stack',
        installedAt: '2023-01-01T00:00:00.000Z',
        source: 'commands.com',
        components: {
          commands: [],
          agents: [],
          mcpServers: [],
          settings: [],
          claudeMd: [],
        },
      };

      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([sampleStackEntry, otherStack]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([sampleStackEntry, otherStack]);
      mockFileService.exists.mockResolvedValue(true);
      mockUI.readSingleChar.mockResolvedValue('y');

      await uninstallAction.execute('org/test-stack');

      expect(mockUI.warning).toHaveBeenCalledWith('\n⚠️  Dependency warnings:');
    });

    it('should handle only-commands option', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(true);
      mockUI.confirm.mockResolvedValue(true);

      const options: UninstallOptions = { commandsOnly: true };
      await uninstallAction.execute('org/test-stack', options);

      // Should only show commands in preview, not agents or MCP servers
      expect(mockUI.info).toHaveBeenCalledWith('\n  📄 Commands:');
      expect(mockUI.info).not.toHaveBeenCalledWith(expect.stringContaining('Agents:'));
      expect(mockUI.info).not.toHaveBeenCalledWith(expect.stringContaining('MCP Servers:'));
    });

    it('should handle global-only option', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(true);
      mockUI.confirm.mockResolvedValue(true);

      const options: UninstallOptions = { global: true };
      await uninstallAction.execute('org/test-stack', options);

      // Should only process global components
      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/test-stack');
    });

    it('should handle local-only option', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(true);
      mockUI.confirm.mockResolvedValue(true);

      const options: UninstallOptions = { local: true };
      await uninstallAction.execute('org/test-stack', options);

      // Should only process local components
      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/test-stack');
    });

    it('should handle errors during uninstallation', async () => {
      // Mock process.env to ensure we're in test environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      try {
        mockStackRegistry.getStackEntry.mockRejectedValue(new Error('Registry error'));

        await expect(uninstallAction.execute('org/test-stack')).rejects.toThrow('Registry error');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should remove files and clean up empty directories', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(true);
      mockUI.confirm.mockResolvedValue(true);

      // Mock fs operations
      (mockFs.remove as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readdir as jest.Mock).mockResolvedValue([]);
      (mockFs.rmdir as jest.Mock).mockResolvedValue(undefined);

      await uninstallAction.execute('org/test-stack');

      expect(mockFs.remove).toHaveBeenCalledWith('/local/.claude/commands/test-cmd.md');
      expect(mockFs.remove).toHaveBeenCalledWith('/home/.claude/commands/global-cmd.md');
      expect(mockFs.remove).toHaveBeenCalledWith('/local/.claude/agents/test-agent.md');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Removed command: test-cmd');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Removed command: global-cmd');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Removed agent: test-agent');
    });

    it('should handle missing files gracefully', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(false); // Files don't exist
      mockUI.confirm.mockResolvedValue(true);

      await uninstallAction.execute('org/test-stack');

      expect(mockUI.warning).toHaveBeenCalledWith('⚠️  Command file not found: test-cmd');
      expect(mockUI.warning).toHaveBeenCalledWith('⚠️  Command file not found: global-cmd');
      expect(mockUI.warning).toHaveBeenCalledWith('⚠️  Agent file not found: test-agent');
      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/test-stack');
    });
  });

  describe('hooks metadata functionality', () => {
    let mockSettingsFile: Record<string, any>;

    beforeEach(() => {
      // Reset the mock settings file before each test
      mockSettingsFile = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read|Grep|Glob|Task',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/local/bin/test-hook.sh',
                },
              ],
            },
            {
              matcher: 'Write|Edit',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/local/bin/other-hook.sh',
                },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Edit|Write',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/local/bin/post-hook.sh',
                },
                {
                  type: 'command',
                  command: '/usr/local/bin/other-post-hook.sh',
                },
              ],
            },
          ],
        },
        otherSettings: 'should not be affected',
      };

      // Mock file service to return our test settings
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(mockSettingsFile);
      mockFileService.writeJsonFile.mockResolvedValue(undefined);
    });

    it('should remove only specific hooks when hooksMetadata is present', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackWithHooks);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockUI.confirm.mockResolvedValue(true);

      await uninstallAction.execute('org/hooks-stack');

      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.local.json'),
        expect.objectContaining({
          hooks: {
            PreToolUse: [
              {
                matcher: 'Write|Edit',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/local/bin/other-hook.sh',
                  },
                ],
              },
            ],
            PostToolUse: [
              {
                matcher: 'Edit|Write',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/local/bin/other-post-hook.sh',
                  },
                ],
              },
            ],
          },
          otherSettings: 'should not be affected',
        })
      );

      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/hooks-stack');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Removed 1 local setting(s)');
    });

    it('should remove entire hooks field when all hooks from that stack are removed', async () => {
      // Set up a scenario where only the hooks from our stack exist
      const singleHookSettings = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read|Grep|Glob|Task',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/local/bin/test-hook.sh',
                },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Edit|Write',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/local/bin/post-hook.sh',
                },
              ],
            },
          ],
        },
        otherSettings: 'should not be affected',
      };

      mockFileService.readJsonFile.mockResolvedValue(singleHookSettings);
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackWithHooks);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockUI.confirm.mockResolvedValue(true);

      await uninstallAction.execute('org/hooks-stack');

      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.local.json'),
        expect.objectContaining({
          otherSettings: 'should not be affected',
          // hooks field should be completely removed
        })
      );

      // Verify hooks field is not present in the written object
      const writtenSettings = (mockFileService.writeJsonFile as jest.Mock).mock.calls[0][1];
      expect(writtenSettings).not.toHaveProperty('hooks');
    });

    it('should fall back to removing entire hooks field when no hooksMetadata (backward compatibility)', async () => {
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackWithHooksNoMetadata);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockUI.confirm.mockResolvedValue(true);

      await uninstallAction.execute('org/old-hooks-stack');

      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.local.json'),
        expect.objectContaining({
          otherSettings: 'should not be affected',
          // hooks field should be completely removed (old behavior)
        })
      );

      // Verify hooks field is completely removed (old behavior)
      const writtenSettings = (mockFileService.writeJsonFile as jest.Mock).mock.calls[0][1];
      expect(writtenSettings).not.toHaveProperty('hooks');

      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/old-hooks-stack');
      expect(mockUI.success).toHaveBeenCalledWith('✓ Removed 1 local setting(s)');
    });

    it('should handle multiple stacks with overlapping hooks correctly', async () => {
      // First stack has some hooks
      const firstStackHooks = {
        PreToolUse: [
          {
            matcher: 'Read|Grep',
            hooks: [{ type: 'command', command: '/usr/local/bin/shared-hook.sh' }],
          },
        ],
      };

      // Second stack has overlapping and unique hooks
      const secondStackHooksMetadata = {
        PreToolUse: [
          {
            matcher: 'Read|Grep',
            hooks: [{ type: 'command', command: '/usr/local/bin/shared-hook.sh' }], // Same as first
          },
          {
            matcher: 'Task|Write',
            hooks: [{ type: 'command', command: '/usr/local/bin/unique-hook.sh' }], // Unique to second
          },
        ],
      };

      const secondStack: StackRegistryEntry = {
        ...sampleStackWithHooks,
        stackId: 'org/second-hooks-stack',
        name: 'Second Hooks Stack',
        components: {
          ...sampleStackWithHooks.components,
          settings: [
            {
              type: 'local',
              fields: ['hooks'],
              hooksMetadata: secondStackHooksMetadata,
            },
          ],
        },
      };

      // Settings file has hooks from both stacks
      const combinedSettings = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read|Grep',
              hooks: [{ type: 'command', command: '/usr/local/bin/shared-hook.sh' }],
            },
            {
              matcher: 'Task|Write',
              hooks: [{ type: 'command', command: '/usr/local/bin/unique-hook.sh' }],
            },
          ],
        },
        otherSettings: 'should not be affected',
      };

      mockFileService.readJsonFile.mockResolvedValue(combinedSettings);
      mockStackRegistry.getStackEntry.mockResolvedValue(secondStack);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockUI.confirm.mockResolvedValue(true);

      await uninstallAction.execute('org/second-hooks-stack');

      // Should remove hooks specific to second stack but keep shared ones
      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.local.json'),
        expect.objectContaining({
          hooks: {
            PreToolUse: [
              {
                matcher: 'Read|Grep',
                hooks: [{ type: 'command', command: '/usr/local/bin/shared-hook.sh' }],
              },
              // unique-hook.sh should be removed
            ],
          },
          otherSettings: 'should not be affected',
        })
      );

      const writtenSettings = (mockFileService.writeJsonFile as jest.Mock).mock.calls[0][1];
      const preToolUseHooks = writtenSettings.hooks.PreToolUse;

      // Should only have the shared hook left
      expect(preToolUseHooks).toHaveLength(1);
      expect(preToolUseHooks[0].matcher).toBe('Read|Grep');
      expect(preToolUseHooks[0].hooks[0].command).toBe('/usr/local/bin/shared-hook.sh');
    });

    it('should handle settings file not existing', async () => {
      mockFileService.exists.mockResolvedValue(false);
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackWithHooks);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockUI.confirm.mockResolvedValue(true);

      await uninstallAction.execute('org/hooks-stack');

      // Should not try to read or write non-existent file
      expect(mockFileService.readJsonFile).not.toHaveBeenCalled();
      expect(mockFileService.writeJsonFile).not.toHaveBeenCalled();
      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/hooks-stack');
    });

    it('should handle empty hooks metadata gracefully', async () => {
      const emptyHooksStack: StackRegistryEntry = {
        ...sampleStackWithHooks,
        components: {
          ...sampleStackWithHooks.components,
          settings: [
            {
              type: 'local',
              fields: ['hooks'],
              hooksMetadata: {}, // Empty metadata
            },
          ],
        },
      };

      mockStackRegistry.getStackEntry.mockResolvedValue(emptyHooksStack);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockUI.confirm.mockResolvedValue(true);

      await uninstallAction.execute('org/hooks-stack');

      // Should still process without errors
      expect(mockFileService.writeJsonFile).toHaveBeenCalled();
      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/hooks-stack');
    });

    it('should preserve non-hooks settings when removing hooks', async () => {
      const mixedSettingsStack: StackRegistryEntry = {
        ...sampleStackWithHooks,
        components: {
          ...sampleStackWithHooks.components,
          settings: [
            {
              type: 'local',
              fields: ['hooks', 'theme', 'timeout'],
              hooksMetadata: {
                PreToolUse: [
                  {
                    matcher: 'Read|Grep|Glob|Task',
                    hooks: [{ type: 'command', command: '/usr/local/bin/test-hook.sh' }],
                  },
                ],
              },
            },
          ],
        },
      };

      const settingsWithMultipleFields = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read|Grep|Glob|Task',
              hooks: [{ type: 'command', command: '/usr/local/bin/test-hook.sh' }],
            },
          ],
        },
        theme: 'dark',
        timeout: 5000,
        otherSettings: 'should not be affected',
      };

      mockFileService.readJsonFile.mockResolvedValue(settingsWithMultipleFields);
      mockStackRegistry.getStackEntry.mockResolvedValue(mixedSettingsStack);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockUI.confirm.mockResolvedValue(true);

      await uninstallAction.execute('org/hooks-stack');

      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.local.json'),
        expect.objectContaining({
          theme: 'dark',
          timeout: 5000,
          otherSettings: 'should not be affected',
          // hooks should be removed, but other fields preserved
        })
      );

      const writtenSettings = (mockFileService.writeJsonFile as jest.Mock).mock.calls[0][1];
      expect(writtenSettings).not.toHaveProperty('hooks');
      expect(writtenSettings.theme).toBe('dark');
      expect(writtenSettings.timeout).toBe(5000);
      expect(writtenSettings.otherSettings).toBe('should not be affected');
    });
  });

  describe('interactive selection', () => {
    it('should show interactive selection when no stackId provided', async () => {
      mockStackRegistry.getAllStacks.mockResolvedValue([sampleStackEntry]);
      mockUI.readSingleChar.mockResolvedValue('q'); // User quits

      await uninstallAction.execute();

      expect(mockStackRegistry.getAllStacks).toHaveBeenCalled();
      expect(mockUI.info).toHaveBeenCalledWith('\n📦 Installed Stacks:');
      expect(mockUI.info).toHaveBeenCalledWith(expect.stringContaining('1. Test Stack'));
      expect(mockUI.info).toHaveBeenCalledWith('Uninstallation cancelled.');
    });

    it('should show message when no stacks installed for interactive selection', async () => {
      mockStackRegistry.getAllStacks.mockResolvedValue([]);

      await uninstallAction.execute();

      expect(mockStackRegistry.getAllStacks).toHaveBeenCalled();
      expect(mockUI.info).toHaveBeenCalledWith(
        'No stacks are currently installed in this project.'
      );
      expect(mockUI.meta).toHaveBeenCalledWith(
        'Install a stack first with: claude-stacks install <stack-id>'
      );
      expect(mockUI.info).toHaveBeenCalledWith('Uninstallation cancelled.');
    });

    it('should proceed with selected stack in interactive mode', async () => {
      mockStackRegistry.getAllStacks.mockResolvedValue([sampleStackEntry]);
      mockStackRegistry.getStackEntry.mockResolvedValue(sampleStackEntry);
      mockStackRegistry.findStacksUsingMcpServer.mockResolvedValue([]);
      mockStackRegistry.findStacksWithComponent.mockResolvedValue([]);
      mockFileService.exists.mockResolvedValue(true);
      mockUI.readSingleChar.mockResolvedValueOnce('1').mockResolvedValueOnce('y'); // Select stack 1, confirm

      await uninstallAction.execute();

      expect(mockStackRegistry.getAllStacks).toHaveBeenCalled();
      expect(mockStackRegistry.getStackEntry).toHaveBeenCalledWith('org/test-stack');
      expect(mockStackRegistry.unregisterStack).toHaveBeenCalledWith('org/test-stack');
      expect(mockUI.success).toHaveBeenCalledWith(
        '\n✅ Stack "Test Stack" uninstalled successfully!'
      );
    });
  });
});
