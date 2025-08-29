import path from 'path';
import type { FileService } from './FileService.js';

/**
 * Registry entry representing an installed stack and its components
 *
 * @remarks
 * This interface tracks all information about a stack installation including
 * its metadata, installation source, version information, and detailed component
 * mapping. Used by StackRegistryService to manage stack lifecycles and enable
 * proper uninstallation, conflict detection, and component tracking.
 *
 * @example
 * ```typescript
 * // Registry entry tracks all installed components for a stack
 * const entry = await registryService.getStackEntry('myorg/awesome-stack');
 * if (entry) {
 *   console.log('Stack name:', entry.name);
 *   console.log('Commands installed:', entry.components.commands.length);
 * }
 * ```
 * @since 1.4.0
 * @public
 */
export interface StackRegistryEntry {
  /** Unique identifier for the stack in org/name format (e.g., 'myorg/stack-name') */
  stackId: string;
  /** Human-readable name of the stack, typically the last part of the stackId */
  name: string;
  /** ISO timestamp indicating when the stack was installed (e.g., '2024-01-15T10:30:00Z') */
  installedAt: string;
  /** Source from which the stack was installed - remote registry, local file, or restore operation */
  source: 'commands.com' | 'local-file' | 'restore';
  /** Semantic version of the installed stack (e.g., '1.2.0'), if available from source */
  version?: string;
  /** Detailed mapping of all components installed by this stack, organized by type */
  components: {
    /** Command files (.md) installed by the stack with their locations and scope */
    commands: {
      /** Name of the command as it appears in the CLI */
      name: string;
      /** Absolute or relative path to the command markdown file */
      path: string;
      /** Whether the command is globally accessible or project-specific */
      isGlobal: boolean;
    }[];
    /** Agent files installed by the stack with their locations and scope */
    agents: {
      /** Name of the agent as it appears in the system */
      name: string;
      /** Absolute or relative path to the agent file */
      path: string;
      /** Whether the agent is globally accessible or project-specific */
      isGlobal: boolean;
    }[];
    /** Hook scripts installed by the stack with their metadata and execution type */
    hooks: {
      /** Name/identifier of the hook (e.g., 'pre-commit', 'post-deploy') */
      name: string;
      /** Absolute or relative path to the hook script file */
      path: string;
      /** Programming language or execution type of the hook (e.g., 'python', 'bash', 'javascript') */
      type: string;
    }[];
    /** Names of MCP (Model Context Protocol) servers installed or configured by this stack */
    mcpServers: string[];
    /** Configuration settings and permissions installed by the stack */
    settings: {
      /** Scope of the settings - global (system-wide) or local (project-specific) */
      type: 'global' | 'local';
      /** List of configuration field names managed by these settings */
      fields: string[];
      /** Optional permission configuration for allowed, denied, and prompted actions */
      permissions?: {
        /** Actions explicitly allowed without prompting */
        allow: string[];
        /** Actions explicitly denied */
        deny: string[];
        /** Actions that require user confirmation */
        ask: string[];
      };
      /** Optional metadata associated with hooks for this settings configuration */
      hooksMetadata?: Record<string, unknown>;
    }[];
    /** CLAUDE.md configuration files installed by the stack with their scope and location */
    claudeMd: {
      /** Scope of the CLAUDE.md file - global (system-wide) or local (project-specific) */
      type: 'global' | 'local';
      /** Absolute or relative path to the CLAUDE.md file */
      path: string;
    }[];
  };
}

/**
 * Main registry structure containing all installed stacks for a project
 *
 * @remarks
 * The registry is persisted as a JSON file at `.claude/stacks-registry.json` and tracks
 * all stack installations within a project. It includes versioning information for
 * migration support and maintains a complete inventory of installed stacks with their
 * components and metadata.
 *
 * @example
 * ```typescript
 * const registry: StackRegistry = {
 *   version: '1.0.0',
 *   lastUpdated: '2024-01-15T10:30:00Z',
 *   stacks: {}
 * };
 * ```
 * @since 1.4.0
 * @public
 */
export interface StackRegistry {
  /** Schema version of the registry format for migration compatibility (e.g., '1.0.0') */
  version: string;
  /** ISO timestamp of the last registry modification (e.g., '2024-01-15T10:30:00Z') */
  lastUpdated: string;
  /** Map of stack IDs to their registry entries, providing O(1) lookup by stackId */
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
   * Initialize or load the stack registry from disk
   *
   * Attempts to load the existing registry file, handles corruption gracefully by creating
   * a new registry, and performs format migration if needed. This method ensures a valid
   * registry is always returned, even if the stored file is corrupted or missing.
   *
   * @returns Promise resolving to a valid StackRegistry, either loaded from disk or newly created
   * @throws {Error} Never throws - corruption and missing files are handled gracefully with warnings
   * @example
   * ```typescript
   * const registryService = new StackRegistryService(fileService);
   * const registry = await registryService.getRegistry();
   * console.log(Object.keys(registry.stacks).length);
   * ```
   * @since 1.4.0
   * @public
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
   * Save the registry to disk with timestamp update
   *
   * Persists the registry to the `.claude/stacks-registry.json` file, ensuring the parent
   * directory exists and automatically updating the lastUpdated timestamp to the current time.
   *
   * @param registry - The registry object to persist to disk
   * @returns Promise that resolves when the registry is successfully written
   * @throws {Error} If file system operations fail (directory creation or file writing)
   * @example
   * ```typescript
   * const registry = await registryService.getRegistry();
   * registry.stacks['new/stack'] = newStackEntry;
   * await registryService.saveRegistry(registry);
   * ```
   * @since 1.4.0
   * @public
   */
  async saveRegistry(registry: StackRegistry): Promise<void> {
    await this.fileService.ensureDir(path.dirname(this.registryPath));
    registry.lastUpdated = new Date().toISOString();
    await this.fileService.writeJsonFile(this.registryPath, registry);
  }

  /**
   * Register a new stack installation in the registry
   *
   * Adds a new stack entry to the registry with an automatically generated installation
   * timestamp. If a stack with the same ID already exists, it will be replaced with
   * the new entry.
   *
   * @param entry - Stack entry without installedAt field (will be auto-generated)
   * @returns Promise that resolves when the stack is registered and registry is saved
   * @throws {Error} If registry loading or saving fails
   * @example
   * ```typescript
   * await registryService.registerStack({
   *   stackId: 'myorg/awesome-stack',
   *   name: 'awesome-stack',
   *   source: 'commands.com',
   *   version: '1.2.0',
   *   components: { commands: [], agents: [], hooks: [], mcpServers: [], settings: [], claudeMd: [] }
   * });
   * ```
   * @since 1.4.0
   * @public
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
   * Unregister a stack by removing it from the registry
   *
   * Removes the specified stack entry from the registry completely. This operation
   * does not delete any actual files or components - it only removes the tracking
   * information from the registry.
   *
   * @param stackId - Unique identifier of the stack to remove (e.g., 'myorg/stack-name')
   * @returns Promise that resolves when the stack is removed and registry is saved
   * @throws {Error} If registry loading or saving fails
   * @example
   * ```typescript
   * await registryService.unregisterStack('myorg/old-stack');
   * ```
   * @since 1.4.0
   * @public
   */
  async unregisterStack(stackId: string): Promise<void> {
    const registry = await this.getRegistry();
    delete registry.stacks[stackId];
    await this.saveRegistry(registry);
  }

  /**
   * Get detailed information about a specific installed stack
   *
   * Retrieves the complete registry entry for a stack, including all component
   * information, installation metadata, and version details. Returns null if
   * the stack is not found in the registry.
   *
   * @param stackId - Unique identifier of the stack to retrieve (e.g., 'myorg/stack-name')
   * @returns Promise resolving to the stack entry or null if not found
   * @throws {Error} If registry loading fails
   * @example
   * ```typescript
   * const entry = await registryService.getStackEntry('myorg/awesome-stack');
   * if (entry) {
   *   console.log('Stack installed at:', entry.installedAt);
   *   console.log('Commands:', entry.components.commands.length);
   * }
   * ```
   * @since 1.4.0
   * @public
   */
  async getStackEntry(stackId: string): Promise<StackRegistryEntry | null> {
    const registry = await this.getRegistry();
    return registry.stacks[stackId] ?? null;
  }

  /**
   * Get a list of all installed stacks in the project
   *
   * Returns an array of all stack entries currently registered in the project,
   * providing a complete inventory of installed stacks with their components
   * and metadata.
   *
   * @returns Promise resolving to an array of all registered stack entries
   * @throws {Error} If registry loading fails
   * @example
   * ```typescript
   * const allStacks = await registryService.getAllStacks();
   * console.log('Total stacks installed:', allStacks.length);
   * allStacks.forEach(stack => {
   *   console.log('Stack:', stack.name, stack.source);
   * });
   * ```
   * @since 1.4.0
   * @public
   */
  async getAllStacks(): Promise<StackRegistryEntry[]> {
    const registry = await this.getRegistry();
    return Object.values(registry.stacks);
  }

  /**
   * Check if a specific stack is currently installed
   *
   * Performs a simple lookup to determine if the specified stack ID exists
   * in the registry, indicating whether the stack is currently installed
   * in the project.
   *
   * @param stackId - Unique identifier of the stack to check (e.g., 'myorg/stack-name')
   * @returns Promise resolving to true if the stack is installed, false otherwise
   * @throws {Error} If registry loading fails
   * @example
   * ```typescript
   * const isInstalled = await registryService.isStackInstalled('myorg/awesome-stack');
   * if (isInstalled) {
   *   console.log('Stack is already installed');
   * }
   * ```
   * @since 1.4.0
   * @public
   */
  async isStackInstalled(stackId: string): Promise<boolean> {
    const registry = await this.getRegistry();
    return stackId in registry.stacks;
  }

  /**
   * Find all stacks that use a specific MCP server
   *
   * Searches through all installed stacks to find those that have registered
   * the specified MCP server name in their components. Useful for dependency
   * tracking and conflict resolution.
   *
   * @param serverName - Name of the MCP server to search for
   * @returns Promise resolving to array of stack entries that use the specified MCP server
   * @throws {Error} If registry loading fails
   * @example
   * ```typescript
   * const stacks = await registryService.findStacksUsingMcpServer('docker-server');
   * console.log(stacks.length, 'stacks use docker-server');
   * stacks.forEach(stack => console.log(stack.name));
   * ```
   * @since 1.4.0
   * @public
   */
  async findStacksUsingMcpServer(serverName: string): Promise<StackRegistryEntry[]> {
    const registry = await this.getRegistry();
    return Object.values(registry.stacks).filter(stack =>
      stack.components.mcpServers.includes(serverName)
    );
  }

  /**
   * Find stacks that contain a specific component by name and type
   *
   * Searches through all installed stacks to find those that have a component
   * (command, agent, or hook) with the specified name. Useful for identifying
   * conflicts, dependencies, and component ownership.
   *
   * @param componentName - Name of the component to search for
   * @param componentType - Type of component: 'commands', 'agents', or 'hooks'
   * @returns Promise resolving to array of stack entries containing the specified component
   * @throws {Error} If registry loading fails
   * @example
   * ```typescript
   * const stacks = await registryService.findStacksWithComponent('deploy', 'commands');
   * if (stacks.length > 1) {
   *   console.log(`Warning: Multiple stacks provide 'deploy' command`);
   * }
   * ```
   * @since 1.4.0
   * @public
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
   * Find stacks that contain a specific hook by name
   *
   * Searches through all installed stacks to find those that have a hook
   * with the specified name. This is a specialized version of findStacksWithComponent
   * that includes backward compatibility and proper null checking for hook arrays.
   *
   * @param hookName - Name of the hook to search for (e.g., 'pre-commit', 'post-deploy')
   * @returns Promise resolving to array of stack entries containing the specified hook
   * @throws {Error} If registry loading fails
   * @example
   * ```typescript
   * const stacks = await registryService.findStacksWithHook('pre-commit');
   * console.log(stacks.length, 'stacks have pre-commit hooks');
   * ```
   * @since 1.4.0
   * @public
   */
  async findStacksWithHook(hookName: string): Promise<StackRegistryEntry[]> {
    const registry = await this.getRegistry();
    return Object.values(registry.stacks).filter(stack =>
      (stack.components.hooks || []).some(hook => hook.name === hookName)
    );
  }

  /**
   * Update specific fields of an existing stack entry
   *
   * Applies partial updates to an existing stack entry, useful for tracking
   * version updates, component changes, or metadata modifications. Only updates
   * the stack if it exists in the registry.
   *
   * @param stackId - Unique identifier of the stack to update (e.g., 'myorg/stack-name')
   * @param updates - Partial stack entry object with fields to update
   * @returns Promise that resolves when the update is complete and registry is saved
   * @throws {Error} If registry loading or saving fails
   * @example
   * ```typescript
   * await registryService.updateStackEntry('myorg/awesome-stack', {
   *   version: '1.3.0',
   *   components: { ...newComponents }
   * });
   * ```
   * @since 1.4.0
   * @public
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
   *
   * Performs a comprehensive cleanup by checking each registered stack to determine
   * if any of its tracked components still exist on the filesystem. Stacks with no
   * remaining components are removed from the registry. This helps maintain registry
   * accuracy after manual file deletions or incomplete uninstallations.
   *
   * @returns Promise resolving to cleanup results with removed stack IDs and any errors
   * @throws {Error} Never throws at the top level - individual check errors are captured in results
   * @example
   * ```typescript
   * const result = await registryService.cleanupRegistry();
   * console.log('Removed', result.removed.length, 'orphaned stack entries');
   * if (result.errors.length > 0) {
   *   console.warn('Cleanup errors:', result.errors);
   * }
   * ```
   * @since 1.4.0
   * @public
   */
  async cleanupRegistry(): Promise<{
    /** Array of stack IDs that were removed from the registry */
    removed: string[];
    /** Array of error messages for stacks that couldn't be checked */
    errors: string[];
  }> {
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
   * Create an empty registry with default structure and current timestamp
   *
   * Generates a new registry object with the current schema version, empty stacks
   * collection, and current timestamp. Used when no existing registry is found
   * or when the existing registry is corrupted.
   *
   * @returns A new empty StackRegistry with default values
   * @since 1.4.0
   * @private
   */
  private createEmptyRegistry(): StackRegistry {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      stacks: {},
    };
  }

  /**
   * Migrate registry format to current schema version for backward compatibility
   *
   * Ensures registry data conforms to the current schema by adding missing fields,
   * updating version information, and normalizing component structures. This method
   * provides forward compatibility when the registry format evolves.
   *
   * @param registry - The registry object to migrate
   * @returns The migrated registry with current schema format
   * @since 1.4.0
   * @private
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
   * Check if any components from a stack entry still exist on the filesystem
   *
   * Verifies the existence of all file-based components (commands, agents, hooks,
   * CLAUDE.md files) associated with a stack entry. Also considers MCP servers
   * and settings as existing components since they may not have direct file presence.
   * Used by cleanupRegistry to determine if a stack entry should be removed.
   *
   * @param entry - The stack registry entry to check for existing components
   * @returns Promise resolving to true if any components exist, false if none found
   * @throws {Error} If file system access fails during component existence checking
   * @since 1.4.0
   * @private
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
