import fs from 'fs-extra';
import { realpathSync } from 'fs';
import { type StackRegistryEntry, StackRegistryService } from './StackRegistryService.js';
import * as os from 'os';
import * as path from 'path';
import { getStacksPath } from '../constants/paths.js';
import type {
  DeveloperStack,
  InstallOptions,
  RestoreOptions,
  StackAgent,
  StackCommand,
  StackHook,
  StackMcpServer,
  StackSettings,
} from '../types/index.js';
import type { UIService } from './UIService.js';
import type { DependencyService } from './DependencyService.js';
import type { FileService } from './FileService.js';

/**
 * Service for shared stack operations
 *
 * @remarks
 * Contains common logic used by multiple actions to eliminate
 * circular dependencies and reduce code duplication.
 *
 * @since 1.2.3
 * @public
 */
export class StackOperationService {
  private readonly stackRegistry: StackRegistryService;
  constructor(
    private readonly ui: UIService, // eslint-disable-line no-unused-vars
    private readonly dependencies: DependencyService, // eslint-disable-line no-unused-vars
    private readonly fileService: FileService
  ) {
    this.stackRegistry = new StackRegistryService(fileService);
  }

  /**
   * Resolve a stack file path, handling relative paths and filenames
   */
  async resolveStackPath(stackFilePath: string): Promise<string> {
    let resolvedPath = stackFilePath;

    // If it's just a filename, look in ~/.claude/stacks/
    if (!path.isAbsolute(stackFilePath) && !stackFilePath.includes('/')) {
      const stacksDir = getStacksPath();
      resolvedPath = path.join(stacksDir, stackFilePath);
    }

    if (!(await fs.pathExists(resolvedPath))) {
      throw new Error(`Stack file not found: ${resolvedPath}`);
    }

    return resolvedPath;
  }

  /**
   * Check MCP server dependencies for a stack
   */
  async checkDependencies(stack: DeveloperStack): Promise<void> {
    this.ui.info('🔍 Checking dependencies...');
    const allMissingDeps = [];

    // Check MCP server dependencies
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      const mcpDeps = await this.dependencies.checkMcpDependencies(stack.mcpServers);
      allMissingDeps.push(...mcpDeps);
    }

    // Check statusLine dependencies
    if (stack.settings?.statusLine) {
      const statusLineDeps = await this.dependencies.checkStatusLineDependencies(
        stack.settings.statusLine
      );
      allMissingDeps.push(...statusLineDeps);
    }

    this.dependencies.displayMissingDependencies(allMissingDeps);
  }

  /**
   * Perform stack restoration from a stack file
   */
  async performRestore(
    stackFilePath: string,
    options: RestoreOptions = {},
    trackInstallation?: { stackId: string; source: 'commands.com' | 'local-file' | 'restore' }
  ): Promise<void> {
    const resolvedPath = await this.resolveStackPath(stackFilePath);
    const stack = (await fs.readJson(resolvedPath)) as DeveloperStack;

    this.ui.info(`📦 Restoring stack: ${this.ui.colorStackName(stack.name)}`);
    this.ui.log(`Description: ${this.ui.colorDescription(stack.description)}\n`);

    // Check dependencies
    await this.checkDependencies(stack);

    // Restore components based on options and get tracking info
    const { addedSettingsFields, addedPermissions } = await this.restoreComponents(stack, options);

    // Track installation if requested
    if (trackInstallation) {
      await this.trackStackInstallation({
        stackId: trackInstallation.stackId,
        stack,
        source: trackInstallation.source,
        restoreOptions: options,
        addedSettingsFields,
        addedPermissions,
      });
    }

    this.ui.success(`\n✅ Stack "${stack.name}" restored successfully!`);

    // Display summary
    await this.displayRestoreSummary(stack, options);
  }

  /**
   * Perform stack installation using temporary file approach
   */
  async performInstallation(
    stack: DeveloperStack,
    remoteStack: { author?: string },
    stackId: string,
    options: InstallOptions
  ): Promise<void> {
    // Create temporary file for installation
    const safeStackId = stackId.replace(/\//g, '-');
    const tempStackPath = path.join(os.tmpdir(), `remote-stack-${safeStackId}.json`);

    try {
      await fs.writeJson(tempStackPath, stack, { spaces: 2 });

      // Use restore logic for installation with tracking
      await this.performRestore(tempStackPath, options, {
        stackId,
        source: 'commands.com',
      });

      this.ui.success(`\n✅ Successfully installed "${stack.name}" from Commands.com!`);
      this.ui.meta(`   Stack ID: ${stackId}`);
      this.ui.meta(`   Author: ${remoteStack.author ?? 'Unknown'}`);
    } finally {
      // Clean up temporary file
      try {
        await fs.remove(tempStackPath);
      } catch {
        // Ignore cleanup error - file may not exist
      }
    }
  }

  /**
   * Track a stack installation in the registry
   */
  async trackStackInstallation(options: {
    stackId: string;
    stack: DeveloperStack;
    source: 'commands.com' | 'local-file' | 'restore';
    restoreOptions?: RestoreOptions;
    addedSettingsFields?: string[];
    addedPermissions?: { allow: string[]; deny: string[]; ask: string[] };
  }): Promise<void> {
    const {
      stackId,
      stack,
      source,
      restoreOptions = {},
      addedSettingsFields,
      addedPermissions,
    } = options;

    const components = await this.buildComponentsTracking(
      stack,
      restoreOptions,
      addedSettingsFields,
      addedPermissions
    );

    await this.stackRegistry.registerStack({
      stackId,
      name: stack.name,
      source,
      version: stack.version,
      components,
    });
  }

  /**
   * Build the components tracking data structure
   */
  private async buildComponentsTracking(
    stack: DeveloperStack,
    options: RestoreOptions,
    addedSettingsFields?: string[],
    addedPermissions?: { allow: string[]; deny: string[]; ask: string[] }
  ): Promise<StackRegistryEntry['components']> {
    return {
      commands: this.buildCommandsTracking(stack, options),
      agents: this.buildAgentsTracking(stack, options),
      hooks: this.buildHooksTracking(stack),
      mcpServers: this.buildMcpServersTracking(stack),
      settings: this.buildSettingsTracking(stack, options, addedSettingsFields, addedPermissions),
      claudeMd: this.buildClaudeMdTracking(stack, options),
    };
  }

  private buildCommandsTracking(
    stack: DeveloperStack,
    options: RestoreOptions
  ): { name: string; path: string; isGlobal: boolean }[] {
    const commands: { name: string; path: string; isGlobal: boolean }[] = [];
    if (!stack.commands) return commands;

    for (const command of stack.commands) {
      const isGlobal = !command.filePath?.startsWith('./.claude');

      if (this.shouldIncludeComponent(isGlobal, options)) {
        commands.push(this.createCommandEntry(command.name, isGlobal));
      }
    }

    return commands;
  }

  private buildAgentsTracking(
    stack: DeveloperStack,
    options: RestoreOptions
  ): { name: string; path: string; isGlobal: boolean }[] {
    const agents: { name: string; path: string; isGlobal: boolean }[] = [];
    if (!stack.agents) return agents;

    for (const agent of stack.agents) {
      const isGlobal = !agent.filePath?.startsWith('./.claude');

      if (this.shouldIncludeComponent(isGlobal, options)) {
        agents.push(this.createAgentEntry(agent.name, isGlobal));
      }
    }

    return agents;
  }

  private buildHooksTracking(
    stack: DeveloperStack
  ): { name: string; path: string; type: string }[] {
    if (!stack.hooks) {
      return [];
    }

    return stack.hooks.map(hook => {
      const hookFileName = this.getHookFileName(hook);
      // Use canonical path resolution to match installation location
      const canonicalCwd = realpathSync(process.cwd());
      const localHooksDir = path.join(canonicalCwd, '.claude', 'hooks');
      const hookFilePath = path.join(localHooksDir, hookFileName);

      return {
        name: hook.name,
        path: hookFilePath,
        type: hook.type,
      };
    });
  }

  private buildMcpServersTracking(stack: DeveloperStack): string[] {
    return stack.mcpServers?.map(server => server.name) ?? [];
  }

  private buildSettingsTracking(
    stack: DeveloperStack,
    options: RestoreOptions,
    addedSettingsFields?: string[],
    addedPermissions?: { allow: string[]; deny: string[]; ask: string[] }
  ): {
    type: 'global' | 'local';
    fields: string[];
    permissions?: { allow: string[]; deny: string[]; ask: string[] };
  }[] {
    // Use the actual added fields if provided, otherwise fall back to all stack fields
    const fieldsToTrack = addedSettingsFields ?? Object.keys(stack.settings ?? {});

    if (fieldsToTrack.length === 0) {
      return [];
    }

    const settingsType = options.globalOnly ? 'global' : 'local';
    const trackingEntry: {
      type: 'global' | 'local';
      fields: string[];
      permissions?: { allow: string[]; deny: string[]; ask: string[] };
    } = {
      type: settingsType,
      fields: fieldsToTrack,
    };

    // If we have specific permissions that were added, track those
    if (
      addedPermissions &&
      (addedPermissions.allow.length > 0 ||
        addedPermissions.deny.length > 0 ||
        addedPermissions.ask.length > 0)
    ) {
      trackingEntry.permissions = addedPermissions;
    }

    return [trackingEntry];
  }

  private buildClaudeMdTracking(
    stack: DeveloperStack,
    options: RestoreOptions
  ): { type: 'global' | 'local'; path: string }[] {
    const claudeMd: { type: 'global' | 'local'; path: string }[] = [];
    if (!stack.claudeMd) return claudeMd;

    if (stack.claudeMd.global && !options.localOnly) {
      claudeMd.push({
        type: 'global',
        path: path.join(os.homedir(), '.claude', 'CLAUDE.md'),
      });
    }

    if (stack.claudeMd.local && !options.globalOnly) {
      claudeMd.push({
        type: 'local',
        path: path.join(process.cwd(), '.claude', 'CLAUDE.md'),
      });
    }

    return claudeMd;
  }

  private shouldIncludeComponent(isGlobal: boolean, options: RestoreOptions): boolean {
    return (!options.localOnly && isGlobal) || (!options.globalOnly && !isGlobal);
  }

  private createCommandEntry(
    name: string,
    isGlobal: boolean
  ): { name: string; path: string; isGlobal: boolean } {
    const cleanName = name.replace(/ \((local|global)\)/g, '');
    const commandsDir = isGlobal
      ? path.join(os.homedir(), '.claude', 'commands')
      : path.join(process.cwd(), '.claude', 'commands');
    const filePath = path.join(commandsDir, `${cleanName}.md`);

    return { name: cleanName, path: filePath, isGlobal };
  }

  private createAgentEntry(
    name: string,
    isGlobal: boolean
  ): { name: string; path: string; isGlobal: boolean } {
    const cleanName = name.replace(/ \((local|global)\)/g, '');
    const agentsDir = isGlobal
      ? path.join(os.homedir(), '.claude', 'agents')
      : path.join(process.cwd(), '.claude', 'agents');
    const filePath = path.join(agentsDir, `${cleanName}.md`);

    return { name: cleanName, path: filePath, isGlobal };
  }

  /**
   * Restore stack components based on options
   */
  private async restoreComponents(
    stack: DeveloperStack,
    options: RestoreOptions
  ): Promise<{
    addedSettingsFields: string[];
    addedPermissions?: { allow: string[]; deny: string[]; ask: string[] };
  }> {
    await this.restoreCommandComponents(stack, options);
    await this.restoreAgentComponents(stack, options);
    await this.restoreHookComponents(stack);
    const result = await this.restoreOtherComponents(stack, options);
    return result;
  }

  private async restoreCommandComponents(
    stack: DeveloperStack,
    options: RestoreOptions
  ): Promise<void> {
    const { globalOnly, localOnly } = options;

    if (!localOnly && stack.commands) {
      const globalCommands = stack.commands.filter(cmd => !cmd.filePath?.startsWith('./.claude'));
      if (globalCommands.length > 0) {
        await this.restoreGlobalCommands(globalCommands, options);
      }
    }

    if (!globalOnly && stack.commands) {
      const localCommands = stack.commands.filter(cmd => cmd.filePath?.startsWith('./.claude'));
      if (localCommands.length > 0) {
        await this.restoreLocalCommands(localCommands, options);
      }
    }
  }

  private async restoreAgentComponents(
    stack: DeveloperStack,
    options: RestoreOptions
  ): Promise<void> {
    const { globalOnly, localOnly } = options;

    if (!localOnly && stack.agents) {
      const globalAgents = stack.agents.filter(agent => !agent.filePath?.startsWith('./.claude'));
      if (globalAgents.length > 0) {
        await this.restoreGlobalAgents(globalAgents, options);
      }
    }

    if (!globalOnly && stack.agents) {
      const localAgents = stack.agents.filter(agent => agent.filePath?.startsWith('./.claude'));
      if (localAgents.length > 0) {
        await this.restoreLocalAgents(localAgents, options);
      }
    }
  }

  private async restoreHookComponents(stack: DeveloperStack): Promise<void> {
    if (!stack.hooks || stack.hooks.length === 0) {
      return;
    }

    this.ui.info(`📎 Installing ${stack.hooks.length} hook(s)...`);

    try {
      // Use canonical path resolution to ensure consistency with tracking
      const canonicalCwd = realpathSync(process.cwd());
      const localHooksDir = path.join(canonicalCwd, '.claude', 'hooks');
      await this.fileService.ensureDir(localHooksDir);

      // Process hooks in parallel for better performance
      await Promise.all(
        stack.hooks.map(async hook => {
          const hookFileName = this.getHookFileName(hook);
          const hookFilePath = path.join(localHooksDir, hookFileName);

          // Write hook file
          await this.fileService.writeTextFile(hookFilePath, hook.content, canonicalCwd);

          // Set executable permissions for script files
          await this.setExecutablePermissions(hookFilePath);

          this.ui.success(`✓ Installed hook: ${hook.name} (${hook.type})`);
        })
      );

      this.ui.success(`✅ Successfully installed ${stack.hooks.length} hook(s)`);
    } catch (error) {
      this.ui.error(
        `Failed to restore hooks: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Generate appropriate filename for a hook based on its original file path
   */
  private getHookFileName(hook: StackHook): string {
    // If the hook has a filePath, extract just the filename
    if (hook.filePath) {
      const fileName = path.basename(hook.filePath);
      if (fileName && fileName !== hook.filePath) {
        return fileName;
      }
    }

    // Otherwise, generate filename from hook name and infer extension
    const extension = this.inferHookExtension(hook.content);
    return `${hook.name}${extension}`;
  }

  /**
   * Infer file extension from hook content
   */
  private inferHookExtension(content: string): string {
    // Check shebang line first
    const shebangExtension = this.getExtensionFromShebang(content);
    if (shebangExtension) {
      return shebangExtension;
    }

    // Check content patterns
    const contentExtension = this.getExtensionFromContent(content);
    if (contentExtension) {
      return contentExtension;
    }

    // Default to .py since most hooks are Python
    return '.py';
  }

  /**
   * Get file extension from shebang line
   */
  private getExtensionFromShebang(content: string): string | null {
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim() || '';

    if (!firstLine.startsWith('#!')) {
      return null;
    }

    if (firstLine.includes('python')) return '.py';
    if (firstLine.includes('node') || firstLine.includes('javascript')) return '.js';
    if (firstLine.includes('bash') || firstLine.includes('sh')) return '.sh';

    return null;
  }

  /**
   * Get file extension from content patterns
   */
  private getExtensionFromContent(content: string): string | null {
    const contentStart = content.substring(0, 500).toLowerCase();

    if (this.isPythonContent(contentStart)) {
      return '.py';
    }

    if (this.isJavaScriptContent(contentStart)) {
      return '.js';
    }

    return null;
  }

  /**
   * Check if content appears to be Python
   */
  private isPythonContent(contentStart: string): boolean {
    return (
      contentStart.includes('import ') ||
      contentStart.includes('from ') ||
      contentStart.includes('def ')
    );
  }

  /**
   * Check if content appears to be JavaScript
   */
  private isJavaScriptContent(contentStart: string): boolean {
    return (
      contentStart.includes('require(') ||
      contentStart.includes('module.exports') ||
      contentStart.includes('const ')
    );
  }

  /**
   * Set executable permissions on a hook file
   */
  private async setExecutablePermissions(filePath: string): Promise<void> {
    try {
      const fsModule = await import('fs');
      const stats = await fsModule.promises.stat(filePath);
      const mode = stats.mode | parseInt('755', 8); // Add execute permissions
      await fsModule.promises.chmod(filePath, mode);
    } catch {
      // Don't fail the entire restoration if permissions can't be set
      this.ui.warning(
        `Warning: Could not set executable permissions for ${path.basename(filePath)}`
      );
    }
  }

  private async restoreOtherComponents(
    stack: DeveloperStack,
    options: RestoreOptions
  ): Promise<{
    addedSettingsFields: string[];
    addedPermissions?: { allow: string[]; deny: string[]; ask: string[] };
  }> {
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      await this.restoreMcpServers(stack.mcpServers, options);
    }

    let addedSettingsFields: string[] = [];
    let addedPermissions: { allow: string[]; deny: string[]; ask: string[] } | undefined;

    if (stack.settings && Object.keys(stack.settings).length > 0) {
      const { addedFields, addedPermissions: permissions } = await this.restoreSettings(
        stack.settings,
        options
      );
      addedSettingsFields = addedFields;
      addedPermissions = permissions;
    }

    if (stack.claudeMd) {
      await this.restoreClaudeMdFiles(stack.claudeMd, options);
    }

    return { addedSettingsFields, addedPermissions };
  }

  private async restoreGlobalCommands(
    commands: StackCommand[],
    options: RestoreOptions = {}
  ): Promise<void> {
    const globalCommandsDir = path.join(os.homedir(), '.claude', 'commands');

    try {
      // Ensure directory exists
      await this.fileService.ensureDir(globalCommandsDir);

      // Process commands in parallel for better performance
      await Promise.all(
        commands.map(async command => {
          const cleanName = command.name.replace(/ \((local|global)\)/g, '');
          const fileName = `${cleanName}.md`;
          const filePath = path.join(globalCommandsDir, fileName);

          // Ensure nested directory exists for commands with paths (e.g., "pm/init" -> "pm/" subdirectory)
          const fileDir = path.dirname(filePath);
          if (fileDir !== globalCommandsDir) {
            await this.fileService.ensureDir(fileDir);
          }

          // Check if file exists and handle based on options
          if (!options.overwrite && (await this.fileService.exists(filePath))) {
            this.ui.warning(`Skipped existing global command: ${command.name}`);
            return;
          }

          // Write command file
          await this.fileService.writeTextFile(filePath, command.content, os.homedir());
          this.ui.success(`✓ Added global command: ${command.name}`);
        })
      );
    } catch (error) {
      this.ui.error(
        `Failed to restore global commands: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async restoreLocalCommands(
    commands: StackCommand[],
    options: RestoreOptions = {}
  ): Promise<void> {
    const localCommandsDir = path.join(process.cwd(), '.claude', 'commands');

    try {
      // Ensure directory exists
      await this.fileService.ensureDir(localCommandsDir);

      // Process commands in parallel for better performance
      await Promise.all(
        commands.map(async command => {
          const cleanName = command.name.replace(/ \((local|global)\)/g, '');
          const fileName = `${cleanName}.md`;
          const filePath = path.join(localCommandsDir, fileName);

          // Ensure nested directory exists for commands with paths (e.g., "pm/init" -> "pm/" subdirectory)
          const fileDir = path.dirname(filePath);
          if (fileDir !== localCommandsDir) {
            await this.fileService.ensureDir(fileDir);
          }

          // Check if file exists and handle based on options
          if (!options.overwrite && (await this.fileService.exists(filePath))) {
            this.ui.warning(`Skipped existing local command: ${command.name}`);
            return;
          }

          // Write command file
          await this.fileService.writeTextFile(filePath, command.content, process.cwd());
          this.ui.success(`✓ Added local command: ${command.name}`);
        })
      );
    } catch (error) {
      this.ui.error(
        `Failed to restore local commands: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async restoreGlobalAgents(
    agents: StackAgent[],
    options: RestoreOptions = {}
  ): Promise<void> {
    const globalAgentsDir = path.join(os.homedir(), '.claude', 'agents');

    try {
      // Ensure directory exists
      await this.fileService.ensureDir(globalAgentsDir);

      // Process agents in parallel for better performance
      await Promise.all(
        agents.map(async agent => {
          const fileName = `${agent.name.replace(/ \((local|global)\)/g, '')}.md`;
          const filePath = path.join(globalAgentsDir, fileName);

          // Check if file exists and handle based on options
          if (!options.overwrite && (await this.fileService.exists(filePath))) {
            this.ui.warning(`Skipped existing global agent: ${agent.name}`);
            return;
          }

          // Write agent file
          await this.fileService.writeTextFile(filePath, agent.content, os.homedir());
          this.ui.success(`✓ Added global agent: ${agent.name}`);
        })
      );
    } catch (error) {
      this.ui.error(
        `Failed to restore global agents: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async restoreLocalAgents(
    agents: StackAgent[],
    options: RestoreOptions = {}
  ): Promise<void> {
    const localAgentsDir = path.join(process.cwd(), '.claude', 'agents');

    try {
      // Ensure directory exists
      await this.fileService.ensureDir(localAgentsDir);

      // Process agents in parallel for better performance
      await Promise.all(
        agents.map(async agent => {
          const fileName = `${agent.name.replace(/ \((local|global)\)/g, '')}.md`;
          const filePath = path.join(localAgentsDir, fileName);

          // Check if file exists and handle based on options
          if (!options.overwrite && (await this.fileService.exists(filePath))) {
            this.ui.warning(`Skipped existing local agent: ${agent.name}`);
            return;
          }

          // Write agent file
          await this.fileService.writeTextFile(filePath, agent.content, process.cwd());
          this.ui.success(`✓ Added local agent: ${agent.name}`);
        })
      );
    } catch (error) {
      this.ui.error(
        `Failed to restore local agents: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async restoreMcpServers(
    servers: StackMcpServer[],
    options: RestoreOptions = {}
  ): Promise<void> {
    const claudeJsonPath = path.join(os.homedir(), '.claude.json');

    try {
      // Always read the existing config first to preserve all other data
      const claudeConfig = await this.readClaudeConfig(claudeJsonPath);
      const projectConfig = this.setupProjectConfig(claudeConfig, process.cwd());
      this.configureMcpServers(projectConfig, servers, options);

      // Only write if the file didn't exist or if we're in overwrite mode
      // For existing files, we need to preserve all existing data
      await this.safeWriteClaudeConfig(claudeJsonPath, claudeConfig);
    } catch (error) {
      this.ui.error(
        `Failed to restore MCP servers: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async readClaudeConfig(claudeJsonPath: string): Promise<Record<string, unknown>> {
    let claudeConfig: Record<string, unknown> = {};

    if (await this.fileService.exists(claudeJsonPath)) {
      try {
        // Use home directory as allowedBase since .claude.json is in ~/
        claudeConfig = (await this.fileService.readJsonFile(claudeJsonPath, {
          allowedBase: os.homedir(),
        })) as Record<string, unknown>;
      } catch (error) {
        this.ui.warning(
          `Warning: Could not read existing .claude.json (${error instanceof Error ? error.message : 'unknown error'}), creating new one`
        );
      }
    }

    return claudeConfig;
  }

  private setupProjectConfig(
    claudeConfig: Record<string, unknown>,
    projectPath: string
  ): Record<string, unknown> {
    // Ensure projects object exists
    claudeConfig.projects ??= {};

    const projects = claudeConfig.projects as Record<string, unknown>;

    // ONLY create project config if it doesn't exist
    projects[projectPath] ??= {
      allowedTools: [], // Required field for new projects
    };

    return projects[projectPath] as Record<string, unknown>;
  }

  /**
   * Check if a value appears to be a sanitized placeholder that needs user configuration
   */
  private isPlaceholderPath(value: string): boolean {
    return typeof value === 'string' && value.startsWith('/path/to/');
  }

  /**
   * Check MCP server for placeholder values and warn user
   */
  private checkForPlaceholders(mcpServer: StackMcpServer): string[] {
    const placeholders: string[] = [];

    if (mcpServer.command && this.isPlaceholderPath(mcpServer.command)) {
      placeholders.push(`command: ${mcpServer.command}`);
    }

    if (mcpServer.args) {
      mcpServer.args.forEach((arg, index) => {
        if (this.isPlaceholderPath(arg)) {
          placeholders.push(`args[${index}]: ${arg}`);
        }
      });
    }

    if (mcpServer.env) {
      Object.entries(mcpServer.env).forEach(([key, value]) => {
        if (typeof value === 'string' && this.isPlaceholderPath(value)) {
          placeholders.push(`env.${key}: ${value}`);
        }
      });
    }

    return placeholders;
  }

  /**
   * Display helpful message about configuring placeholder values
   */
  private displayPlaceholderWarning(serverName: string, placeholders: string[]): void {
    this.ui.warning(`⚠️  MCP server "${serverName}" contains placeholder values:`);
    placeholders.forEach(placeholder => {
      this.ui.meta(`   • ${placeholder}`);
    });
    this.ui.meta("   💡 You'll need to update these paths in your claude_desktop_config.json");
    this.ui.meta('   💡 to point to your actual files/credentials\n');
  }

  /**
   * Initialize MCP servers configuration in project config
   */
  private initializeMcpServersConfig(
    projectConfig: Record<string, unknown>,
    options: RestoreOptions
  ): Record<string, unknown> {
    if (options.overwrite) {
      projectConfig.mcpServers = {};
    } else {
      projectConfig.mcpServers ??= {};
    }
    return projectConfig.mcpServers as Record<string, unknown>;
  }

  /**
   * Process a single MCP server configuration
   */
  private processSingleMcpServer(
    mcpServer: StackMcpServer,
    mcpServers: Record<string, unknown>,
    options: RestoreOptions
  ): void {
    if (!options.overwrite && mcpServers[mcpServer.name]) {
      this.ui.warning(`Skipped existing MCP server: ${mcpServer.name}`);
      return;
    }

    // Check for placeholder values and warn user
    const placeholders = this.checkForPlaceholders(mcpServer);
    if (placeholders.length > 0) {
      this.displayPlaceholderWarning(mcpServer.name, placeholders);
    }

    mcpServers[mcpServer.name] = {
      type: mcpServer.type,
      ...(mcpServer.command && { command: mcpServer.command }),
      ...(mcpServer.args && { args: mcpServer.args }),
      ...(mcpServer.url && { url: mcpServer.url }),
      ...(mcpServer.env && { env: mcpServer.env }),
    };

    this.ui.success(`✓ Added MCP server: ${mcpServer.name}`);
  }

  private configureMcpServers(
    projectConfig: Record<string, unknown>,
    servers: StackMcpServer[],
    options: RestoreOptions
  ): void {
    const mcpServers = this.initializeMcpServersConfig(projectConfig, options);

    // Process each MCP server
    for (const mcpServer of servers) {
      this.processSingleMcpServer(mcpServer, mcpServers, options);
    }
  }

  private async safeWriteClaudeConfig(
    claudeJsonPath: string,
    updatedConfig: Record<string, unknown>
  ): Promise<void> {
    try {
      // Use fs-extra directly with atomic write to prevent corruption
      const tempPath = `${claudeJsonPath}.tmp`;

      // Write to temporary file first
      await fs.writeJson(tempPath, updatedConfig, { spaces: 2 });

      // Atomically move temp file to final location
      await fs.move(tempPath, claudeJsonPath, { overwrite: true });
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.remove(`${claudeJsonPath}.tmp`);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(
        `Failed to write file at [USER_DIR]/.claude.json: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async restoreSettings(
    settings: StackSettings,
    options: RestoreOptions = {}
  ): Promise<{
    addedFields: string[];
    addedPermissions?: { allow: string[]; deny: string[]; ask: string[] };
  }> {
    try {
      const { targetPath, settingsType, allowedBase } = this.getSettingsPath(options);
      await this.fileService.ensureDir(path.dirname(targetPath));

      if (options.overwrite) {
        await this.replaceSettings(targetPath, settings, settingsType, allowedBase);
        // When overwriting, consider all fields as "added"
        return { addedFields: Object.keys(settings) };
      } else {
        const result = await this.mergeSettings(targetPath, settings, settingsType, allowedBase);
        return result;
      }
    } catch (error) {
      this.ui.error(
        `Failed to restore settings: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private getSettingsPath(options: RestoreOptions) {
    const localSettingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
    const globalSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');

    const targetPath = options.globalOnly ? globalSettingsPath : localSettingsPath;
    const settingsType = options.globalOnly ? 'global' : 'local';
    const allowedBase = options.globalOnly ? os.homedir() : process.cwd();

    return { targetPath, settingsType, allowedBase };
  }

  private async replaceSettings(
    targetPath: string,
    settings: StackSettings,
    settingsType: string,
    allowedBase: string
  ): Promise<void> {
    // Read existing settings first to preserve non-stack fields
    let existingSettings: Record<string, unknown> = {};
    if (await this.fileService.exists(targetPath)) {
      try {
        existingSettings = (await this.fileService.readJsonFile(targetPath)) as Record<
          string,
          unknown
        >;
      } catch {
        this.ui.warning(`Warning: Could not read existing ${settingsType} settings`);
      }
    }

    // Selectively overwrite only the fields that exist in the stack
    const updatedSettings: Record<string, unknown> = { ...existingSettings };
    for (const key in settings) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        updatedSettings[key] = (settings as Record<string, unknown>)[key];
      }
    }

    await this.fileService.writeJsonFile(targetPath, updatedSettings, { allowedBase });
    this.ui.success(`✓ Overwritten ${settingsType} settings (selective)`);
  }

  private async loadExistingSettings(
    targetPath: string,
    settingsType: string
  ): Promise<Record<string, unknown>> {
    if (!(await this.fileService.exists(targetPath))) {
      return {};
    }

    try {
      return await this.fileService.readJsonFile(targetPath);
    } catch {
      this.ui.warning(`Warning: Could not read existing ${settingsType} settings`);
      return {};
    }
  }

  private mergeSettingsField(
    key: string,
    value: unknown,
    existingSettings: Record<string, unknown>,
    mergedSettings: Record<string, unknown>
  ): {
    fieldAdded: boolean;
    addedPermissions?: { allow: string[]; deny: string[]; ask: string[] };
  } {
    if (!(key in existingSettings)) {
      mergedSettings[key] = value;
      return { fieldAdded: true };
    }

    if (key === 'permissions' && this.isObject(value) && this.isObject(existingSettings[key])) {
      const result = this.mergePermissions(
        existingSettings[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
      mergedSettings[key] = result.merged;
      return {
        fieldAdded: result.hasNewItems,
        addedPermissions: result.hasNewItems ? result.addedPermissions : undefined,
      };
    }

    if (this.isObject(value) && this.isObject(existingSettings[key])) {
      return this.mergeObjectField(key, value, existingSettings, mergedSettings);
    }
    return { fieldAdded: false };
  }

  private mergeObjectField(
    key: string,
    value: unknown,
    existingSettings: Record<string, unknown>,
    mergedSettings: Record<string, unknown>
  ): { fieldAdded: boolean } {
    const existingObj = existingSettings[key] as Record<string, unknown>;
    const stackObj = value as Record<string, unknown>;

    const mergedObj = { ...existingObj };
    let hasNewSubFields = false;

    for (const [subKey, subValue] of Object.entries(stackObj)) {
      if (!(subKey in existingObj)) {
        mergedObj[subKey] = subValue;
        hasNewSubFields = true;
      }
    }

    mergedSettings[key] = mergedObj;
    return { fieldAdded: hasNewSubFields };
  }

  private async mergeSettings(
    targetPath: string,
    settings: StackSettings,
    settingsType: string,
    allowedBase: string
  ): Promise<{
    addedFields: string[];
    addedPermissions?: { allow: string[]; deny: string[]; ask: string[] };
  }> {
    const existingSettings = await this.loadExistingSettings(targetPath, settingsType);
    const addedFields: string[] = [];
    let addedPermissions: { allow: string[]; deny: string[]; ask: string[] } | undefined;
    const mergedSettings = { ...existingSettings };

    for (const [key, value] of Object.entries(settings)) {
      const result = this.mergeSettingsField(key, value, existingSettings, mergedSettings);

      if (result.fieldAdded) {
        addedFields.push(key);
      }

      if (result.addedPermissions) {
        ({ addedPermissions } = { addedPermissions: result.addedPermissions });
      }
    }
    await this.fileService.writeJsonFile(targetPath, mergedSettings, { allowedBase });
    this.ui.success(`✓ Merged ${settingsType} settings (added ${addedFields.length} new fields)`);

    return { addedFields, addedPermissions };
  }

  private mergePermissions(
    existing: Record<string, unknown>,
    stack: Record<string, unknown>
  ): {
    merged: Record<string, unknown>;
    hasNewItems: boolean;
    addedPermissions: { allow: string[]; deny: string[]; ask: string[] };
  } {
    const merged = { ...existing };
    let hasNewItems = false;
    const addedPermissions = { allow: [] as string[], deny: [] as string[], ask: [] as string[] };

    for (const [category, stackItems] of Object.entries(stack)) {
      if (Array.isArray(stackItems)) {
        const existingItems = Array.isArray(existing[category])
          ? (existing[category] as string[])
          : [];

        // Ensure all items are strings and filter for new ones
        const stringStackItems = stackItems.filter(
          (item): item is string => typeof item === 'string'
        );
        const newItems = stringStackItems.filter(item => !existingItems.includes(item));

        if (newItems.length > 0) {
          merged[category] = [...existingItems, ...newItems];
          hasNewItems = true;

          // Track the specific permissions added
          if (category === 'allow' || category === 'deny' || category === 'ask') {
            addedPermissions[category as keyof typeof addedPermissions] = newItems;
          }
        }
      } else if (!(category in existing)) {
        merged[category] = stackItems;
        hasNewItems = true;
      }
    }

    return { merged, hasNewItems, addedPermissions };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private async restoreClaudeMdFiles(
    claudeMd: {
      global?: { path: string; content: string };
      local?: { path: string; content: string };
    },
    options: RestoreOptions = {}
  ): Promise<void> {
    try {
      if (claudeMd.global && !options.localOnly) {
        await this.restoreGlobalClaudeMd(claudeMd.global, options);
      }

      if (claudeMd.local && !options.globalOnly) {
        await this.restoreLocalClaudeMd(claudeMd.local, options);
      }
    } catch (error) {
      this.ui.error(
        `Failed to restore CLAUDE.md files: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async restoreGlobalClaudeMd(
    global: { path: string; content: string },
    options: RestoreOptions
  ): Promise<void> {
    const globalClaudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');

    // Ensure directory exists
    await this.fileService.ensureDir(path.dirname(globalClaudeMdPath));

    if (!options.overwrite && (await this.fileService.exists(globalClaudeMdPath))) {
      this.ui.warning('Skipped existing global CLAUDE.md');
    } else {
      await this.fileService.writeTextFile(globalClaudeMdPath, global.content, os.homedir());
      this.ui.success('✓ Added global CLAUDE.md');
    }
  }

  private async restoreLocalClaudeMd(
    local: { path: string; content: string },
    options: RestoreOptions
  ): Promise<void> {
    const localClaudeMdPath = path.join(process.cwd(), '.claude', 'CLAUDE.md');

    // Ensure directory exists
    await this.fileService.ensureDir(path.dirname(localClaudeMdPath));

    if (!options.overwrite && (await this.fileService.exists(localClaudeMdPath))) {
      this.ui.warning('Skipped existing local CLAUDE.md');
    } else {
      await this.fileService.writeTextFile(localClaudeMdPath, local.content, process.cwd());
      this.ui.success('✓ Added local CLAUDE.md');
    }
  }

  private async displayRestoreSummary(
    stack: DeveloperStack,
    options: RestoreOptions
  ): Promise<void> {
    const summary = this.getComponentSummary(stack, options);

    this.ui.info('\n📊 Restoration Summary:');
    if (summary.globalCommands > 0) {
      this.ui.meta(`   Global commands: ${summary.globalCommands}`);
    }
    if (summary.localCommands > 0) {
      this.ui.meta(`   Local commands: ${summary.localCommands}`);
    }
    if (summary.globalAgents > 0) {
      this.ui.meta(`   Global agents: ${summary.globalAgents}`);
    }
    if (summary.localAgents > 0) {
      this.ui.meta(`   Local agents: ${summary.localAgents}`);
    }
    if (summary.hooks > 0) {
      this.ui.meta(`   Hooks: ${summary.hooks}`);
    }
    if (summary.mcpServers > 0) {
      this.ui.meta(`   MCP servers: ${summary.mcpServers}`);
    }
  }

  private getComponentSummary(stack: DeveloperStack, options: RestoreOptions) {
    const { globalOnly, localOnly } = options;

    return {
      globalCommands: this.countGlobalCommands(stack, localOnly ?? false),
      localCommands: this.countLocalCommands(stack, globalOnly ?? false),
      globalAgents: this.countGlobalAgents(stack, localOnly ?? false),
      localAgents: this.countLocalAgents(stack, globalOnly ?? false),
      hooks: stack.hooks?.length ?? 0,
      mcpServers: stack.mcpServers?.length ?? 0,
    };
  }

  private countGlobalCommands(stack: DeveloperStack, localOnly: boolean): number {
    return !localOnly && stack.commands
      ? stack.commands.filter(cmd => !cmd.filePath?.startsWith('./.claude')).length
      : 0;
  }

  private countLocalCommands(stack: DeveloperStack, globalOnly: boolean): number {
    return !globalOnly && stack.commands
      ? stack.commands.filter(cmd => cmd.filePath?.startsWith('./.claude')).length
      : 0;
  }

  private countGlobalAgents(stack: DeveloperStack, localOnly: boolean): number {
    return !localOnly && stack.agents
      ? stack.agents.filter(agent => !agent.filePath?.startsWith('./.claude')).length
      : 0;
  }

  private countLocalAgents(stack: DeveloperStack, globalOnly: boolean): number {
    return !globalOnly && stack.agents
      ? stack.agents.filter(agent => agent.filePath?.startsWith('./.claude')).length
      : 0;
  }
}
