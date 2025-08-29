import path from 'path';
import type { FileService } from './FileService.js';

export interface StackRegistryEntry {
  stackId: string;
  name: string;
  installedAt: string;
  source: 'commands.com' | 'local-file' | 'restore';
  version?: string;
  components: {
    commands: { name: string; path: string; isGlobal: boolean }[];
    agents: { name: string; path: string; isGlobal: boolean }[];
    hooks: { name: string; path: string; type: string }[];
    mcpServers: string[];
    settings: {
      type: 'global' | 'local';
      fields: string[];
      permissions?: { allow: string[]; deny: string[]; ask: string[] };
      hooksMetadata?: Record<string, unknown>;
    }[];
    claudeMd: { type: 'global' | 'local'; path: string }[];
  };
}

export interface StackRegistry {
  version: string;
  lastUpdated: string;
  stacks: Record<string, StackRegistryEntry>;
}

/**
 * Service for tracking installed stacks in a project
 *
 * @remarks
 * Maintains a registry file (.claude/stacks-registry.json) that tracks
 * which stacks have been installed and what components they added.
 * This enables proper uninstallation and prevents conflicts.
 *
 * @since 1.4.0
 * @public
 */
export class StackRegistryService {
  private readonly registryPath: string;

  constructor(
    // eslint-disable-next-line no-unused-vars
    private readonly fileService: FileService,
    projectPath: string = process.cwd()
  ) {
    this.registryPath = path.join(projectPath, '.claude', 'stacks-registry.json');
  }

  /**
   * Initialize or load the stack registry
   */
  async getRegistry(): Promise<StackRegistry> {
    if (await this.fileService.exists(this.registryPath)) {
      try {
        const registry = (await this.fileService.readJsonFile(this.registryPath)) as StackRegistry;
        // Migrate old format if needed
        return this.migrateRegistryFormat(registry);
      } catch (error) {
        // If registry is corrupted, create a new one
        console.warn(
          `Warning: Stack registry corrupted, creating new one: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }
    }

    return this.createEmptyRegistry();
  }

  /**
   * Save the registry to disk
   */
  async saveRegistry(registry: StackRegistry): Promise<void> {
    await this.fileService.ensureDir(path.dirname(this.registryPath));
    registry.lastUpdated = new Date().toISOString();
    await this.fileService.writeJsonFile(this.registryPath, registry);
  }

  /**
   * Register a new stack installation
   */
  async registerStack(entry: Omit<StackRegistryEntry, 'installedAt'>): Promise<void> {
    const registry = await this.getRegistry();

    const fullEntry: StackRegistryEntry = {
      ...entry,
      installedAt: new Date().toISOString(),
    };

    registry.stacks[entry.stackId] = fullEntry;
    await this.saveRegistry(registry);
  }

  /**
   * Unregister a stack (remove from registry)
   */
  async unregisterStack(stackId: string): Promise<void> {
    const registry = await this.getRegistry();
    delete registry.stacks[stackId];
    await this.saveRegistry(registry);
  }

  /**
   * Get information about an installed stack
   */
  async getStackEntry(stackId: string): Promise<StackRegistryEntry | null> {
    const registry = await this.getRegistry();
    return registry.stacks[stackId] ?? null;
  }

  /**
   * Get all installed stacks
   */
  async getAllStacks(): Promise<StackRegistryEntry[]> {
    const registry = await this.getRegistry();
    return Object.values(registry.stacks);
  }

  /**
   * Check if a stack is installed
   */
  async isStackInstalled(stackId: string): Promise<boolean> {
    const registry = await this.getRegistry();
    return stackId in registry.stacks;
  }

  /**
   * Find stacks that use a specific MCP server
   */
  async findStacksUsingMcpServer(serverName: string): Promise<StackRegistryEntry[]> {
    const registry = await this.getRegistry();
    return Object.values(registry.stacks).filter(stack =>
      stack.components.mcpServers.includes(serverName)
    );
  }

  /**
   * Find stacks that have a specific command or agent
   */
  /**
   * Find stacks that have a specific command, agent, or hook
   */
  async findStacksWithComponent(
    componentName: string,
    componentType: 'commands' | 'agents' | 'hooks'
  ): Promise<StackRegistryEntry[]> {
    const registry = await this.getRegistry();
    return Object.values(registry.stacks).filter(stack =>
      stack.components[componentType].some(comp => comp.name === componentName)
    );
  }

  /**
   * Find stacks that have a specific hook
   */
  async findStacksWithHook(hookName: string): Promise<StackRegistryEntry[]> {
    const registry = await this.getRegistry();
    return Object.values(registry.stacks).filter(stack =>
      (stack.components.hooks || []).some(hook => hook.name === hookName)
    );
  }

  /**
   * Update a stack entry (useful for tracking updates)
   */
  async updateStackEntry(stackId: string, updates: Partial<StackRegistryEntry>): Promise<void> {
    const registry = await this.getRegistry();
    if (registry.stacks[stackId]) {
      registry.stacks[stackId] = { ...registry.stacks[stackId], ...updates };
      await this.saveRegistry(registry);
    }
  }

  /**
   * Clean up registry by removing entries for stacks whose components no longer exist
   */
  async cleanupRegistry(): Promise<{ removed: string[]; errors: string[] }> {
    const registry = await this.getRegistry();
    const removed: string[] = [];
    const errors: string[] = [];

    // Sequential processing required for proper error handling
    for (const [stackId, entry] of Object.entries(registry.stacks)) {
      try {
        // Check if any components still exist
        // eslint-disable-next-line no-await-in-loop
        const hasExistingComponents = await this.hasExistingComponents(entry);

        if (!hasExistingComponents) {
          delete registry.stacks[stackId];
          removed.push(stackId);
        }
      } catch (error) {
        errors.push(
          `Failed to check ${stackId}: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }
    }

    if (removed.length > 0) {
      await this.saveRegistry(registry);
    }

    return { removed, errors };
  }

  /**
   * Create an empty registry with default structure
   */
  private createEmptyRegistry(): StackRegistry {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      stacks: {},
    };
  }

  /**
   * Migrate registry format if needed (for future compatibility)
   */
  private migrateRegistryFormat(registry: StackRegistry): StackRegistry {
    // Add any future migration logic here
    if (!registry.version) {
      registry.version = '1.0.0';
    }

    // Ensure all entries have required fields
    for (const [, entry] of Object.entries(registry.stacks)) {
      if (!entry.components) {
        entry.components = {
          commands: [],
          agents: [],
          hooks: [],
          mcpServers: [],
          settings: [],
          claudeMd: [],
        };
      }

      // Ensure all component arrays exist
      entry.components.commands ??= [];
      entry.components.agents ??= [];
      entry.components.hooks ??= [];
      entry.components.mcpServers ??= [];
      entry.components.settings ??= [];
      entry.components.claudeMd ??= [];
    }

    return registry;
  }

  /**
   * Check if any components from a stack entry still exist
   */
  private async hasExistingComponents(entry: StackRegistryEntry): Promise<boolean> {
    // Collect all file paths to check
    const filePaths = [
      ...(entry.components.commands || []).map(c => c.path),
      ...(entry.components.agents || []).map(a => a.path),
      ...(entry.components.hooks || []).map(h => h.path),
      ...(entry.components.claudeMd || []).map(md => md.path),
    ];

    // Check all files in parallel and return true if any exist
    const existsChecks = await Promise.all(
      filePaths.map(filePath => this.fileService.exists(filePath))
    );

    // Return true if any file exists, or if there are MCP servers/settings
    return (
      existsChecks.some(exists => exists) ||
      entry.components.mcpServers.length > 0 ||
      entry.components.settings.length > 0
    );
  }
}
