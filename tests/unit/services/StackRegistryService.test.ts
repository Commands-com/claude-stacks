import { jest } from '@jest/globals';
import { StackRegistryService } from '../../../src/services/StackRegistryService.js';
import type { FileService } from '../../../src/services/FileService.js';
import type { StackRegistryEntry } from '../../../src/services/StackRegistryService.js';

describe('StackRegistryService', () => {
  let registryService: StackRegistryService;
  let mockFileService: jest.Mocked<FileService>;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    // Create fresh mocks for each test
    mockFileService = {
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

    registryService = new StackRegistryService(mockFileService, mockProjectPath);
  });

  describe('getRegistry', () => {
    it('should return existing registry when file exists', async () => {
      const sampleRegistry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/stack1': {
            stackId: 'org/stack1',
            name: 'Test Stack 1',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            version: '1.0.0',
            components: {
              commands: [],
              agents: [],
              mcpServers: [],
              settings: [],
              claudeMd: [],
            },
          },
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(sampleRegistry);

      const result = await registryService.getRegistry();

      expect(result).toEqual(sampleRegistry);
      expect(mockFileService.exists).toHaveBeenCalledWith(
        '/test/project/.claude/stacks-registry.json'
      );
      expect(mockFileService.readJsonFile).toHaveBeenCalledWith(
        '/test/project/.claude/stacks-registry.json'
      );
    });

    it('should create new registry when file does not exist', async () => {
      mockFileService.exists.mockResolvedValue(false);

      const result = await registryService.getRegistry();

      expect(result).toEqual({
        version: '1.0.0',
        lastUpdated: expect.any(String),
        stacks: {},
      });
      expect(mockFileService.exists).toHaveBeenCalledWith(
        '/test/project/.claude/stacks-registry.json'
      );
      expect(mockFileService.readJsonFile).not.toHaveBeenCalled();
    });
  });

  describe('saveRegistry', () => {
    it('should save registry with updated timestamp', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {},
      };

      await registryService.saveRegistry(registry);

      expect(mockFileService.ensureDir).toHaveBeenCalledWith('/test/project/.claude');
      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        '/test/project/.claude/stacks-registry.json',
        expect.objectContaining({
          ...registry,
          lastUpdated: expect.any(String),
        })
      );
    });
  });

  describe('registerStack', () => {
    it('should register a new stack', async () => {
      mockFileService.exists.mockResolvedValue(false);

      const stackEntry: Omit<StackRegistryEntry, 'installedAt'> = {
        stackId: 'org/new-stack',
        name: 'New Test Stack',
        source: 'commands.com',
        version: '2.0.0',
        components: {
          commands: [],
          agents: [],
          mcpServers: [],
          settings: [],
          claudeMd: [],
        },
      };

      await registryService.registerStack(stackEntry);

      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        '/test/project/.claude/stacks-registry.json',
        expect.objectContaining({
          stacks: {
            'org/new-stack': expect.objectContaining({
              ...stackEntry,
              installedAt: expect.any(String),
            }),
          },
        })
      );
    });

    it('should register a stack with permissions in settings', async () => {
      mockFileService.exists.mockResolvedValue(false);

      const stackEntry: Omit<StackRegistryEntry, 'installedAt'> = {
        stackId: 'org/stack-with-permissions',
        name: 'Stack with Permissions',
        source: 'commands.com',
        version: '1.0.0',
        components: {
          commands: [],
          agents: [],
          hooks: [],
          mcpServers: [],
          settings: [
            {
              type: 'global',
              fields: ['permissions'],
              permissions: {
                allow: ['file:read', 'network:access'],
                deny: ['file:write'],
                ask: ['system:info'],
              },
            },
          ],
          claudeMd: [],
        },
      };

      await registryService.registerStack(stackEntry);

      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        '/test/project/.claude/stacks-registry.json',
        expect.objectContaining({
          stacks: {
            'org/stack-with-permissions': expect.objectContaining({
              ...stackEntry,
              installedAt: expect.any(String),
              components: expect.objectContaining({
                settings: [
                  expect.objectContaining({
                    type: 'global',
                    fields: ['permissions'],
                    permissions: {
                      allow: ['file:read', 'network:access'],
                      deny: ['file:write'],
                      ask: ['system:info'],
                    },
                  }),
                ],
              }),
            }),
          },
        })
      );
    });
  });

  describe('unregisterStack', () => {
    it('should remove stack from registry', async () => {
      const initialRegistry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/stack1': {
            stackId: 'org/stack1',
            name: 'Test Stack',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            components: {
              commands: [],
              agents: [],
              mcpServers: [],
              settings: [],
              claudeMd: [],
            },
          },
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(initialRegistry);

      await registryService.unregisterStack('org/stack1');

      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        '/test/project/.claude/stacks-registry.json',
        expect.objectContaining({
          stacks: {},
          version: '1.0.0',
        })
      );
    });
  });

  describe('getStackEntry', () => {
    it('should return stack entry when exists', async () => {
      const stackEntry = {
        stackId: 'org/stack1',
        name: 'Test Stack',
        installedAt: '2023-01-01T00:00:00.000Z',
        source: 'commands.com' as const,
        components: {
          commands: [],
          agents: [],
          mcpServers: [],
          settings: [],
          claudeMd: [],
        },
      };

      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: { 'org/stack1': stackEntry },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.getStackEntry('org/stack1');

      expect(result).toEqual(stackEntry);
    });

    it('should return null when stack does not exist', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {},
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.getStackEntry('org/non-existent');

      expect(result).toBeNull();
    });

    it('should return stack entry with permissions when exists', async () => {
      const stackEntry = {
        stackId: 'org/stack-with-perms',
        name: 'Test Stack with Permissions',
        installedAt: '2023-01-01T00:00:00.000Z',
        source: 'commands.com' as const,
        components: {
          commands: [],
          agents: [],
          mcpServers: [],
          settings: [
            {
              type: 'global' as const,
              fields: ['permissions'],
              permissions: {
                allow: ['file:read'],
                deny: ['file:write'],
                ask: ['network:access'],
              },
            },
          ],
          claudeMd: [],
        },
      };

      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: { 'org/stack-with-perms': stackEntry },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.getStackEntry('org/stack-with-perms');

      expect(result).toEqual(stackEntry);
      expect(result?.components.settings[0].permissions).toEqual({
        allow: ['file:read'],
        deny: ['file:write'],
        ask: ['network:access'],
      });
    });
  });

  describe('getAllStacks', () => {
    it('should return all stack entries', async () => {
      const stackEntry = {
        stackId: 'org/stack1',
        name: 'Test Stack',
        installedAt: '2023-01-01T00:00:00.000Z',
        source: 'commands.com' as const,
        components: {
          commands: [],
          agents: [],
          mcpServers: [],
          settings: [],
          claudeMd: [],
        },
      };

      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: { 'org/stack1': stackEntry },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.getAllStacks();

      expect(result).toEqual([stackEntry]);
    });
  });

  describe('isStackInstalled', () => {
    it('should return true when stack is installed', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/stack1': {
            stackId: 'org/stack1',
            name: 'Test Stack',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            components: {
              commands: [],
              agents: [],
              mcpServers: [],
              settings: [],
              claudeMd: [],
            },
          },
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.isStackInstalled('org/stack1');

      expect(result).toBe(true);
    });

    it('should return false when stack is not installed', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {},
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.isStackInstalled('org/non-existent');

      expect(result).toBe(false);
    });
  });

  describe('updateStackEntry', () => {
    it('should update existing stack entry', async () => {
      const initialRegistry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/stack1': {
            stackId: 'org/stack1',
            name: 'Test Stack',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            version: '1.0.0',
            components: {
              commands: [],
              agents: [],
              mcpServers: [],
              settings: [],
              claudeMd: [],
            },
          },
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(initialRegistry);

      const updates = { version: '2.0.0', name: 'Updated Stack' };
      await registryService.updateStackEntry('org/stack1', updates);

      expect(mockFileService.writeJsonFile).toHaveBeenCalledWith(
        '/test/project/.claude/stacks-registry.json',
        expect.objectContaining({
          stacks: {
            'org/stack1': expect.objectContaining({
              ...initialRegistry.stacks['org/stack1'],
              ...updates,
            }),
          },
        })
      );
    });
  });

  describe('findStacksUsingMcpServer', () => {
    it('should find stacks using specific MCP server', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/stack1': {
            stackId: 'org/stack1',
            name: 'Stack 1',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            version: '1.0.0',
            components: {
              commands: [],
              agents: [],
              mcpServers: ['server-a', 'server-b'],
              settings: [],
              claudeMd: [],
            },
          },
          'org/stack2': {
            stackId: 'org/stack2',
            name: 'Stack 2',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            version: '1.0.0',
            components: {
              commands: [],
              agents: [],
              mcpServers: ['server-a', 'server-c'],
              settings: [],
              claudeMd: [],
            },
          },
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.findStacksUsingMcpServer('server-a');

      expect(result).toHaveLength(2);
      expect(result[0].stackId).toBe('org/stack1');
      expect(result[1].stackId).toBe('org/stack2');
    });

    it('should return empty array when no stacks use the MCP server', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {},
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.findStacksUsingMcpServer('nonexistent-server');

      expect(result).toHaveLength(0);
    });
  });

  describe('findStacksWithComponent', () => {
    it('should find stacks with specific command', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/stack1': {
            stackId: 'org/stack1',
            name: 'Stack 1',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            version: '1.0.0',
            components: {
              commands: [
                { name: 'test-cmd', path: '/path/cmd1', isGlobal: false },
                { name: 'shared-cmd', path: '/path/shared', isGlobal: true },
              ],
              agents: [],
              mcpServers: [],
              settings: [],
              claudeMd: [],
            },
          },
          'org/stack2': {
            stackId: 'org/stack2',
            name: 'Stack 2',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            version: '1.0.0',
            components: {
              commands: [{ name: 'shared-cmd', path: '/path/shared2', isGlobal: false }],
              agents: [],
              mcpServers: [],
              settings: [],
              claudeMd: [],
            },
          },
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.findStacksWithComponent('shared-cmd', 'commands');

      expect(result).toHaveLength(2);
      expect(result[0].stackId).toBe('org/stack1');
      expect(result[1].stackId).toBe('org/stack2');
    });

    it('should find stacks with specific agent', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/stack1': {
            stackId: 'org/stack1',
            name: 'Stack 1',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            version: '1.0.0',
            components: {
              commands: [],
              agents: [{ name: 'shared-agent', path: '/path/shared-agent', isGlobal: true }],
              mcpServers: [],
              settings: [],
              claudeMd: [],
            },
          },
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.findStacksWithComponent('shared-agent', 'agents');

      expect(result).toHaveLength(1);
      expect(result[0].stackId).toBe('org/stack1');
    });

    it('should return empty array when no stacks have the component', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {},
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      const result = await registryService.findStacksWithComponent('nonexistent-cmd', 'commands');

      expect(result).toHaveLength(0);
    });
  });

  describe('cleanupRegistry', () => {
    it('should remove stacks with no existing components', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/stack1': {
            stackId: 'org/stack1',
            name: 'Stack 1',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            version: '1.0.0',
            components: {
              commands: [{ name: 'test-cmd', path: '/path/cmd1', isGlobal: false }],
              agents: [],
              mcpServers: [],
              settings: [],
              claudeMd: [],
            },
          },
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      // Mock hasExistingComponents to return false (no existing components)
      const hasExistingComponentsSpy = jest.spyOn(registryService as any, 'hasExistingComponents');
      hasExistingComponentsSpy.mockResolvedValue(false);

      const result = await registryService.cleanupRegistry();

      expect(result.removed).toEqual(['org/stack1']);
      expect(result.errors).toHaveLength(0);
      expect(mockFileService.writeJsonFile).toHaveBeenCalled();

      hasExistingComponentsSpy.mockRestore();
    });

    it('should not save registry when no stacks are removed', async () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/stack1': {
            stackId: 'org/stack1',
            name: 'Stack 1',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com' as const,
            version: '1.0.0',
            components: {
              commands: [],
              agents: [],
              mcpServers: ['server-a'],
              settings: [],
              claudeMd: [],
            },
          },
        },
      };

      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockResolvedValue(registry);

      // Mock hasExistingComponents to return true (has existing components)
      const hasExistingComponentsSpy = jest.spyOn(registryService as any, 'hasExistingComponents');
      hasExistingComponentsSpy.mockResolvedValue(true);

      const result = await registryService.cleanupRegistry();

      expect(result.removed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockFileService.writeJsonFile).not.toHaveBeenCalled();

      hasExistingComponentsSpy.mockRestore();
    });
  });

  describe('hasExistingComponents', () => {
    it('should return true when command files exist', async () => {
      const entry = {
        stackId: 'org/test',
        name: 'Test',
        installedAt: '2023-01-01T00:00:00.000Z',
        source: 'commands.com' as const,
        version: '1.0.0',
        components: {
          commands: [{ name: 'test-cmd', path: '/path/cmd', isGlobal: false }],
          agents: [],
          mcpServers: [],
          settings: [],
          claudeMd: [],
        },
      };

      mockFileService.exists.mockResolvedValue(true);

      const result = await (registryService as any).hasExistingComponents(entry);

      expect(result).toBe(true);
      expect(mockFileService.exists).toHaveBeenCalledWith('/path/cmd');
    });

    it('should return true when agent files exist', async () => {
      const entry = {
        stackId: 'org/test',
        name: 'Test',
        installedAt: '2023-01-01T00:00:00.000Z',
        source: 'commands.com' as const,
        version: '1.0.0',
        components: {
          commands: [],
          agents: [{ name: 'test-agent', path: '/path/agent', isGlobal: false }],
          mcpServers: [],
          settings: [],
          claudeMd: [],
        },
      };

      // First call for agent file should return true
      mockFileService.exists.mockResolvedValue(true);

      const result = await (registryService as any).hasExistingComponents(entry);

      expect(result).toBe(true);
      expect(mockFileService.exists).toHaveBeenCalledWith('/path/agent');
    });

    it('should return true when claudeMd files exist', async () => {
      const entry = {
        stackId: 'org/test',
        name: 'Test',
        installedAt: '2023-01-01T00:00:00.000Z',
        source: 'commands.com' as const,
        version: '1.0.0',
        components: {
          commands: [],
          agents: [],
          mcpServers: [],
          settings: [],
          claudeMd: [{ type: 'local' as const, path: '/path/claude.md' }],
        },
      };

      mockFileService.exists
        .mockResolvedValue(false)
        .mockResolvedValue(false)
        .mockResolvedValue(true);

      const result = await (registryService as any).hasExistingComponents(entry);

      expect(result).toBe(true);
    });

    it('should return true when MCP servers exist', async () => {
      const entry = {
        stackId: 'org/test',
        name: 'Test',
        installedAt: '2023-01-01T00:00:00.000Z',
        source: 'commands.com' as const,
        version: '1.0.0',
        components: {
          commands: [],
          agents: [],
          mcpServers: ['server-a'],
          settings: [],
          claudeMd: [],
        },
      };

      mockFileService.exists.mockResolvedValue(false);

      const result = await (registryService as any).hasExistingComponents(entry);

      expect(result).toBe(true);
    });

    it('should return false when no components exist', async () => {
      const entry = {
        stackId: 'org/test',
        name: 'Test',
        installedAt: '2023-01-01T00:00:00.000Z',
        source: 'commands.com' as const,
        version: '1.0.0',
        components: {
          commands: [],
          agents: [],
          mcpServers: [],
          settings: [],
          claudeMd: [],
        },
      };

      mockFileService.exists.mockResolvedValue(false);

      const result = await (registryService as any).hasExistingComponents(entry);

      expect(result).toBe(false);
    });
  });

  describe('migrateRegistryFormat', () => {
    it('should add version when missing', () => {
      const registry = {
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {},
      } as any;

      const result = (registryService as any).migrateRegistryFormat(registry);

      expect(result.version).toBe('1.0.0');
    });

    it('should add components when missing', () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/test': {
            stackId: 'org/test',
            name: 'Test',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com',
          },
        },
      } as any;

      const result = (registryService as any).migrateRegistryFormat(registry);

      expect(result.stacks['org/test'].components).toEqual({
        commands: [],
        agents: [],
        mcpServers: [],
        settings: [],
        claudeMd: [],
        hooks: [],
      });
    });

    it('should ensure all component arrays exist', () => {
      const registry = {
        version: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        stacks: {
          'org/test': {
            stackId: 'org/test',
            name: 'Test',
            installedAt: '2023-01-01T00:00:00.000Z',
            source: 'commands.com',
            components: {
              commands: [{ name: 'cmd', path: '/path', isGlobal: false }],
              // Missing agents, mcpServers, settings, claudeMd
            },
          },
        },
      } as any;

      const result = (registryService as any).migrateRegistryFormat(registry);

      const { components } = result.stacks['org/test'];
      expect(components.agents).toEqual([]);
      expect(components.mcpServers).toEqual([]);
      expect(components.settings).toEqual([]);
      expect(components.claudeMd).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted registry file gracefully', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockRejectedValue(new Error('Invalid JSON'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const registry = await registryService.getRegistry();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Stack registry corrupted, creating new one: Invalid JSON')
      );
      expect(registry).toEqual({
        version: '1.0.0',
        lastUpdated: expect.any(String),
        stacks: {},
      });

      consoleSpy.mockRestore();
    });

    it('should handle non-Error exceptions in registry corruption', async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readJsonFile.mockRejectedValue('string error');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const registry = await registryService.getRegistry();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Warning: Stack registry corrupted, creating new one: unknown error'
        )
      );
      expect(registry).toEqual({
        version: '1.0.0',
        lastUpdated: expect.any(String),
        stacks: {},
      });

      consoleSpy.mockRestore();
    });
  });
});
