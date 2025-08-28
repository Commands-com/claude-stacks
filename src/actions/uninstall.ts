import fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import type { UninstallOptions } from '../types/index.js';
import type { StackRegistryEntry } from '../services/StackRegistryService.js';
import { BaseAction } from './BaseAction.js';
import { StackRegistryService } from '../services/StackRegistryService.js';

/**
 * Action class for uninstalling previously installed stacks
 *
 * @since 1.4.0
 * @public
 */
export class UninstallAction extends BaseAction {
  private readonly stackRegistry: StackRegistryService;

  constructor(services?: ConstructorParameters<typeof BaseAction>[0]) {
    super(services);
    this.stackRegistry = new StackRegistryService(this.fileService);
  }

  /**
   * Execute the uninstall action
   */
  async execute(stackId?: string, options: UninstallOptions = {}): Promise<void> {
    try {
      const targetStackId = await this.resolveTargetStackId(stackId);
      if (!targetStackId) {
        this.ui.info('Uninstallation cancelled.');
        return;
      }

      const stackEntry = await this.validateStackInstalled(targetStackId);
      if (!stackEntry) {
        return;
      }

      await this.displayUninstallInfo(stackEntry);
      await this.showUninstallPreview(stackEntry, options);

      const shouldProceed = await this.confirmUninstallation(options);
      if (!shouldProceed) {
        return;
      }

      if (options.dryRun) {
        this.ui.info('\n[DRY RUN] No changes were made.');
        return;
      }

      await this.performUninstallation(stackEntry, options);
      await this.stackRegistry.unregisterStack(targetStackId);

      this.ui.success(`\n✅ Stack "${stackEntry.name}" uninstalled successfully!`);
    } catch (error) {
      this.handleError(error, 'Uninstallation');
    }
  }

  /**
   * Resolve the target stack ID, either from parameter or interactive selection
   */
  private async resolveTargetStackId(stackId?: string): Promise<string | null> {
    if (stackId) {
      return stackId;
    }

    // No stack ID provided - show interactive selection
    const selectedStackId = await this.showStackSelection();
    return selectedStackId;
  }

  /**
   * Validate that the stack is installed and return stack entry
   */
  private async validateStackInstalled(stackId: string): Promise<StackRegistryEntry | null> {
    const stackEntry = await this.stackRegistry.getStackEntry(stackId);
    if (!stackEntry) {
      this.ui.error(`Stack "${stackId}" is not installed in this project.`);
      this.ui.info('Use "claude-stacks list" to see available stacks.');
      return null;
    }
    return stackEntry;
  }

  /**
   * Display uninstall information header
   */
  private async displayUninstallInfo(stackEntry: StackRegistryEntry): Promise<void> {
    this.ui.info(`🗑️  Preparing to uninstall stack: ${this.ui.colorStackName(stackEntry.name)}`);
    this.ui.meta(`   Source: ${stackEntry.source}`);
    this.ui.meta(`   Installed: ${new Date(stackEntry.installedAt).toLocaleDateString()}`);
  }

  /**
   * Get user confirmation for uninstallation
   */
  private async confirmUninstallation(options: UninstallOptions): Promise<boolean> {
    if (options.force || options.dryRun) {
      return true;
    }

    const confirmChar = await this.ui.readSingleChar('\nProceed with uninstallation? (y/N): ');
    const confirmed = confirmChar.toLowerCase() === 'y';
    if (!confirmed) {
      this.ui.info('Uninstallation cancelled.');
    }
    return confirmed;
  }

  /**
   * Show interactive stack selection menu
   */
  private async showStackSelection(): Promise<string | null> {
    const installedStacks = await this.stackRegistry.getAllStacks();

    if (installedStacks.length === 0) {
      this.ui.info('No stacks are currently installed in this project.');
      this.ui.meta('Install a stack first with: claude-stacks install <stack-id>');
      return null;
    }

    this.ui.info('\n📦 Installed Stacks:');
    this.ui.info('');

    installedStacks.forEach((stack, index) => {
      const installedDate = new Date(stack.installedAt).toLocaleDateString();
      const componentCount =
        stack.components.commands.length +
        stack.components.agents.length +
        stack.components.mcpServers.length;

      this.ui.info(
        `${this.ui.colorNumber(`${index + 1}.`)} ${this.ui.colorStackName(stack.name)} ` +
          `${this.ui.colorMeta(`by ${stack.source}`)} ` +
          `${this.ui.colorInfo(`(${componentCount} components, installed ${installedDate})`)}`
      );
    });

    this.ui.info('');
    const selection = await this.ui.readSingleChar(
      this.ui.colorMeta('Enter a number ') +
        this.ui.colorHighlight(`(1-${installedStacks.length})`) +
        this.ui.colorMeta(' or ') +
        this.ui.colorHighlight('(q)uit') +
        this.ui.colorMeta(': ')
    );

    if (selection === 'q' || selection === '') {
      return null;
    }

    const selectedIndex = parseInt(selection) - 1;
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= installedStacks.length) {
      this.ui.error(
        `Invalid selection. Please enter a number between 1 and ${installedStacks.length}`
      );
      // Retry selection
      return await this.showStackSelection();
    }

    return installedStacks[selectedIndex].stackId;
  }

  private async showUninstallPreview(
    stackEntry: StackRegistryEntry,
    options: UninstallOptions
  ): Promise<void> {
    this.ui.info('\n📋 Components to be removed:');

    const { commands, agents, hooks = [], mcpServers, settings, claudeMd } = stackEntry.components;

    await this.showCommandsPreview(commands, options);
    await this.showAgentsPreview(agents, options);
    await this.showHooksPreview(hooks, options);
    this.showMcpServersPreview(mcpServers, options);
    this.showSettingsPreview(settings, options);
    await this.showClaudeMdPreview(claudeMd, options);

    // Check for dependencies
    await this.checkDependencies(stackEntry);
  }

  private async showCommandsPreview(
    commands: { name: string; path: string; isGlobal: boolean }[],
    options: UninstallOptions
  ): Promise<void> {
    if (this.shouldShowCommands(options, commands)) {
      this.ui.info('\n  📄 Commands:');
      await this.displayComponentList(commands, options);
    }
  }

  private shouldShowCommands(
    options: UninstallOptions,
    commands: { name: string; path: string; isGlobal: boolean }[]
  ): boolean {
    return !options.agentsOnly && !options.mcpOnly && !options.settingsOnly && commands.length > 0;
  }

  private async displayComponentList(
    components: { name: string; path: string; isGlobal: boolean }[],
    options: UninstallOptions
  ): Promise<void> {
    const validComponents = components.filter(
      component => !this.shouldSkipComponent(component, options)
    );

    const componentDisplays = await Promise.all(
      validComponents.map(async component => {
        const scope = component.isGlobal ? '(global)' : '(local)';
        const status = await this.getFileStatus(component.path);
        return { name: component.name, scope, status };
      })
    );

    componentDisplays.forEach(({ name, scope, status }) => {
      this.ui.meta(`     • ${name} ${scope} ${status}`);
    });
  }

  private shouldSkipComponent(
    component: { isGlobal: boolean } | string,
    options: UninstallOptions
  ): boolean {
    // Handle string component types (like 'hooks')
    if (typeof component === 'string') {
      // Hooks don't have global/local distinction, so never skip based on scope
      return false;
    }

    // Handle component objects with isGlobal property
    if (options.global && !component.isGlobal) return true;
    if (options.local && component.isGlobal) return true;
    return false;
  }

  private async showAgentsPreview(
    agents: { name: string; path: string; isGlobal: boolean }[],
    options: UninstallOptions
  ): Promise<void> {
    if (this.shouldShowAgents(options, agents)) {
      this.ui.info('\n  🤖 Agents:');
      await this.displayComponentList(agents, options);
    }
  }

  private async showHooksPreview(
    hooks: { name: string; path: string; type: string }[],
    options: UninstallOptions
  ): Promise<void> {
    if (!this.shouldShowHooks(hooks, options)) {
      return;
    }

    this.ui.info('\n📎 Hooks:');
    await this.displayHooksList(hooks, options);
  }

  private shouldShowHooks(
    hooks: { name: string; path: string; type: string }[],
    options: UninstallOptions
  ): boolean {
    return (
      hooks.length > 0 &&
      !this.shouldSkipComponent('hooks', options) &&
      this.shouldRemoveHooks(options)
    );
  }

  private async displayHooksList(
    hooks: { name: string; path: string; type: string }[],
    options: UninstallOptions
  ): Promise<void> {
    for (const hook of hooks) {
      if (this.shouldSkipComponent('hooks', options)) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const status = await this.getFileStatus(hook.path);
      const statusText =
        status === 'exists' ? this.ui.colorSuccess(status) : this.ui.colorWarning(status);

      this.ui.meta(
        `   • ${hook.name} (${hook.type}): ${this.ui.colorMeta(hook.path)} [${statusText}]`
      );
    }
  }

  private shouldShowAgents(
    options: UninstallOptions,
    agents: { name: string; path: string; isGlobal: boolean }[]
  ): boolean {
    return !options.commandsOnly && !options.mcpOnly && !options.settingsOnly && agents.length > 0;
  }

  private showMcpServersPreview(mcpServers: string[], options: UninstallOptions): void {
    if (
      !options.commandsOnly &&
      !options.agentsOnly &&
      !options.settingsOnly &&
      mcpServers.length > 0
    ) {
      this.ui.info('\n  🔌 MCP Servers:');
      for (const serverName of mcpServers) {
        this.ui.meta(`     • ${serverName}`);
      }
    }
  }

  private showSettingsPreview(
    settings: { type: 'global' | 'local'; fields: string[] }[],
    options: UninstallOptions
  ): void {
    if (!options.commandsOnly && !options.agentsOnly && !options.mcpOnly && settings.length > 0) {
      this.ui.info('\n  ⚙️  Settings:');
      for (const setting of settings) {
        if (options.global && setting.type !== 'global') continue;
        if (options.local && setting.type !== 'local') continue;

        this.ui.meta(`     • ${setting.type} settings: ${setting.fields.join(', ')}`);
      }
    }
  }

  private async showClaudeMdPreview(
    claudeMd: { type: 'global' | 'local'; path: string }[],
    options: UninstallOptions
  ): Promise<void> {
    if (this.shouldShowClaudeMd(options, claudeMd)) {
      this.ui.info('\n  📝 CLAUDE.md files:');
      await this.displayClaudeMdList(claudeMd, options);
    }
  }

  private shouldShowClaudeMd(
    options: UninstallOptions,
    claudeMd: { type: 'global' | 'local'; path: string }[]
  ): boolean {
    return (
      !options.commandsOnly &&
      !options.agentsOnly &&
      !options.mcpOnly &&
      !options.settingsOnly &&
      claudeMd.length > 0
    );
  }

  private async displayClaudeMdList(
    claudeMd: { type: 'global' | 'local'; path: string }[],
    options: UninstallOptions
  ): Promise<void> {
    const validClaudeMd = claudeMd.filter(md => !this.shouldSkipClaudeMd(md, options));

    const claudeMdDisplays = await Promise.all(
      validClaudeMd.map(async md => {
        const status = await this.getFileStatus(md.path);
        return { type: md.type, status };
      })
    );

    claudeMdDisplays.forEach(({ type, status }) => {
      this.ui.meta(`     • ${type} CLAUDE.md ${status}`);
    });
  }

  private shouldSkipClaudeMd(md: { type: 'global' | 'local' }, options: UninstallOptions): boolean {
    if (options.global && md.type !== 'global') return true;
    if (options.local && md.type !== 'local') return true;
    return false;
  }

  private async getFileStatus(filePath: string): Promise<string> {
    try {
      const exists = await this.fileService.exists(filePath);
      return exists ? '' : '(missing)';
    } catch {
      return '(error checking)';
    }
  }

  private async checkDependencies(stackEntry: StackRegistryEntry): Promise<void> {
    const warnings = await this.collectAllDependencyWarnings(stackEntry);
    this.displayDependencyWarnings(warnings);
  }

  private async collectAllDependencyWarnings(stackEntry: StackRegistryEntry): Promise<string[]> {
    const [mcpWarnings, commandWarnings, agentWarnings] = await Promise.all([
      this.checkMcpServerDependencies(stackEntry),
      this.checkCommandDependencies(stackEntry),
      this.checkAgentDependencies(stackEntry),
    ]);

    return [
      ...mcpWarnings.filter((warning): warning is string => Boolean(warning)),
      ...commandWarnings.filter((warning): warning is string => Boolean(warning)),
      ...agentWarnings.filter((warning): warning is string => Boolean(warning)),
    ];
  }

  private async checkMcpServerDependencies(
    stackEntry: StackRegistryEntry
  ): Promise<(string | null)[]> {
    return Promise.all(
      stackEntry.components.mcpServers.map(async mcpServer => {
        const dependentStacks = await this.stackRegistry.findStacksUsingMcpServer(mcpServer);
        const otherStacks = dependentStacks.filter(s => s.stackId !== stackEntry.stackId);

        return otherStacks.length > 0
          ? `MCP server "${mcpServer}" is used by: ${otherStacks.map(s => s.name).join(', ')}`
          : null;
      })
    );
  }

  private async checkCommandDependencies(
    stackEntry: StackRegistryEntry
  ): Promise<(string | null)[]> {
    return Promise.all(
      stackEntry.components.commands.map(async command => {
        const dependentStacks = await this.stackRegistry.findStacksWithComponent(
          command.name,
          'commands'
        );
        const otherStacks = dependentStacks.filter(s => s.stackId !== stackEntry.stackId);

        return otherStacks.length > 0
          ? `Command "${command.name}" is also provided by: ${otherStacks.map(s => s.name).join(', ')}`
          : null;
      })
    );
  }

  private async checkAgentDependencies(stackEntry: StackRegistryEntry): Promise<(string | null)[]> {
    return Promise.all(
      stackEntry.components.agents.map(async agent => {
        const dependentStacks = await this.stackRegistry.findStacksWithComponent(
          agent.name,
          'agents'
        );
        const otherStacks = dependentStacks.filter(s => s.stackId !== stackEntry.stackId);

        return otherStacks.length > 0
          ? `Agent "${agent.name}" is also provided by: ${otherStacks.map(s => s.name).join(', ')}`
          : null;
      })
    );
  }

  private displayDependencyWarnings(warnings: string[]): void {
    if (warnings.length > 0) {
      this.ui.warning('\n⚠️  Dependency warnings:');
      warnings.forEach(warning => this.ui.meta(`   • ${warning}`));
    }
  }

  private async performUninstallation(
    stackEntry: StackRegistryEntry,
    options: UninstallOptions
  ): Promise<void> {
    const removedCount = await this.removeAllComponents(stackEntry, options);
    this.ui.info(`\n📊 Removed ${removedCount} component(s)`);
  }

  private async removeAllComponents(
    stackEntry: StackRegistryEntry,
    options: UninstallOptions
  ): Promise<number> {
    let removedCount = 0;

    if (this.shouldRemoveCommands(options)) {
      removedCount += await this.removeCommands(stackEntry.components.commands, options);
    }

    if (this.shouldRemoveAgents(options)) {
      removedCount += await this.removeAgents(stackEntry.components.agents, options);
    }

    if (this.shouldRemoveHooks(options)) {
      removedCount += await this.removeHooks(stackEntry.components.hooks || [], options);
    }

    if (this.shouldRemoveMcpServers(options)) {
      removedCount += await this.removeMcpServers(stackEntry.components.mcpServers);
    }

    if (this.shouldRemoveSettings(options)) {
      removedCount += await this.removeSettings(stackEntry.components.settings, options);
    }

    if (this.shouldRemoveClaudeMd(options)) {
      removedCount += await this.removeClaudeMdFiles(stackEntry.components.claudeMd, options);
    }

    return removedCount;
  }

  private shouldRemoveCommands(options: UninstallOptions): boolean {
    return !options.agentsOnly && !options.mcpOnly && !options.settingsOnly;
  }

  private shouldRemoveAgents(options: UninstallOptions): boolean {
    return !options.commandsOnly && !options.mcpOnly && !options.settingsOnly;
  }

  private shouldRemoveHooks(options: UninstallOptions): boolean {
    return (
      !options.commandsOnly && !options.agentsOnly && !options.mcpOnly && !options.settingsOnly
    );
  }

  private shouldRemoveMcpServers(options: UninstallOptions): boolean {
    return !options.commandsOnly && !options.agentsOnly && !options.settingsOnly;
  }

  private shouldRemoveSettings(options: UninstallOptions): boolean {
    return !options.commandsOnly && !options.agentsOnly && !options.mcpOnly;
  }

  private shouldRemoveClaudeMd(options: UninstallOptions): boolean {
    return (
      !options.commandsOnly && !options.agentsOnly && !options.mcpOnly && !options.settingsOnly
    );
  }

  private async removeCommands(
    commands: { name: string; path: string; isGlobal: boolean }[],
    options: UninstallOptions
  ): Promise<number> {
    let removedCount = 0;

    // Sequential processing required for proper error handling and UI feedback

    for (const command of commands) {
      if (options.global && !command.isGlobal) continue;
      if (options.local && command.isGlobal) continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        if (await this.fileService.exists(command.path)) {
          // eslint-disable-next-line no-await-in-loop
          await fs.remove(command.path);
          this.ui.success(`✓ Removed command: ${command.name}`);
          removedCount++;

          // Try to remove empty parent directories
          // eslint-disable-next-line no-await-in-loop
          await this.removeEmptyDirectories(path.dirname(command.path));
        } else {
          this.ui.warning(`⚠️  Command file not found: ${command.name}`);
        }
      } catch (error) {
        this.ui.warning(
          `⚠️  Failed to remove command "${command.name}": ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }
    }

    return removedCount;
  }

  private async removeAgents(
    agents: { name: string; path: string; isGlobal: boolean }[],
    options: UninstallOptions
  ): Promise<number> {
    let removedCount = 0;

    // Sequential processing required for proper error handling and UI feedback
    for (const agent of agents) {
      if (options.global && !agent.isGlobal) continue;
      if (options.local && agent.isGlobal) continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        if (await this.fileService.exists(agent.path)) {
          // eslint-disable-next-line no-await-in-loop
          await fs.remove(agent.path);
          this.ui.success(`✓ Removed agent: ${agent.name}`);
          removedCount++;

          // Try to remove empty parent directories
          // eslint-disable-next-line no-await-in-loop
          await this.removeEmptyDirectories(path.dirname(agent.path));
        } else {
          this.ui.warning(`⚠️  Agent file not found: ${agent.name}`);
        }
      } catch (error) {
        this.ui.warning(
          `⚠️  Failed to remove agent "${agent.name}": ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }
    }

    return removedCount;
  }

  private async removeHooks(
    hooks: { name: string; path: string; type: string }[],
    options: UninstallOptions
  ): Promise<number> {
    if (hooks.length === 0) {
      return 0;
    }

    let removedCount = 0;
    this.ui.info(`\n🗑️  Removing ${hooks.length} hook(s)...`);

    for (const hook of hooks) {
      // eslint-disable-next-line no-await-in-loop
      const status = await this.getFileStatus(hook.path);

      if (options.dryRun) {
        this.ui.meta(`  🔍 Would remove ${hook.name} (${hook.type}): ${hook.path} [${status}]`);
        if (status === 'exists') {
          removedCount++;
        }
      } else {
        if (status === 'exists') {
          try {
            // eslint-disable-next-line no-await-in-loop
            await this.fileService.remove(hook.path);
            this.ui.success(`  ✅ Removed ${hook.name} (${hook.type}): ${hook.path}`);
            removedCount++;
          } catch (error) {
            this.ui.error(
              `  ❌ Failed to remove ${hook.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        } else {
          this.ui.warning(`  ⚠️  ${hook.name} not found: ${hook.path} [${status}]`);
        }
      }
    }

    return removedCount;
  }

  private async removeMcpServers(mcpServers: string[]): Promise<number> {
    if (mcpServers.length === 0) return 0;

    try {
      const claudeConfig = await this.loadClaudeConfig();
      if (!claudeConfig) return 0;

      const removedCount = this.removeMcpServersFromConfig(mcpServers, claudeConfig);

      if (removedCount > 0) {
        await this.saveClaudeConfig(claudeConfig);
      }

      return removedCount;
    } catch (error) {
      this.ui.warning(
        `⚠️  Failed to remove MCP servers: ${error instanceof Error ? error.message : 'unknown error'}`
      );
      return 0;
    }
  }

  private async loadClaudeConfig(): Promise<Record<string, unknown> | null> {
    const claudeJsonPath = path.join(os.homedir(), '.claude.json');

    if (!(await this.fileService.exists(claudeJsonPath))) {
      this.ui.warning('⚠️  No .claude.json file found');
      return null;
    }

    return (await this.fileService.readJsonFile(claudeJsonPath, {
      allowedBase: os.homedir(),
    })) as Record<string, unknown>;
  }

  private removeMcpServersFromConfig(
    mcpServers: string[],
    claudeConfig: Record<string, unknown>
  ): number {
    const projects = (claudeConfig.projects as Record<string, unknown>) || {};
    const currentProject = (projects[process.cwd()] as Record<string, unknown>) || {};
    const currentMcpServers = (currentProject.mcpServers as Record<string, unknown>) || {};

    let removedCount = 0;
    for (const serverName of mcpServers) {
      if (currentMcpServers[serverName]) {
        delete currentMcpServers[serverName];
        this.ui.success(`✓ Removed MCP server: ${serverName}`);
        removedCount++;
      } else {
        this.ui.warning(`⚠️  MCP server not found in config: ${serverName}`);
      }
    }

    return removedCount;
  }

  private async saveClaudeConfig(claudeConfig: Record<string, unknown>): Promise<void> {
    const claudeJsonPath = path.join(os.homedir(), '.claude.json');
    await this.fileService.writeJsonFile(claudeJsonPath, claudeConfig, {
      allowedBase: os.homedir(),
    });
  }

  private async removeSettings(
    settings: { type: 'global' | 'local'; fields: string[] }[],
    options: UninstallOptions
  ): Promise<number> {
    let removedCount = 0;

    // Sequential processing required for proper error handling and UI feedback
    for (const setting of settings) {
      if (this.shouldSkipSettingByScope(setting, options)) continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        if (await this.removeSingleSetting(setting)) {
          removedCount++;
        }
      } catch (error) {
        this.ui.warning(
          `⚠️  Failed to remove ${setting.type} settings: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }
    }

    return removedCount;
  }

  private shouldSkipSettingByScope(
    setting: { type: 'global' | 'local'; fields: string[] },
    options: UninstallOptions
  ): boolean {
    if (options.global && setting.type !== 'global') return true;
    if (options.local && setting.type !== 'local') return true;
    return false;
  }

  private async removeSingleSetting(setting: {
    type: 'global' | 'local';
    fields: string[];
  }): Promise<boolean> {
    const settingsPath = this.getSettingsPath(setting.type);

    if (!(await this.fileService.exists(settingsPath))) return false;

    const settingsConfig = (await this.fileService.readJsonFile(settingsPath)) as Record<
      string,
      unknown
    >;
    const fieldsRemoved = this.removeSettingFields(settingsConfig, setting.fields);

    if (fieldsRemoved > 0) {
      await this.fileService.writeJsonFile(settingsPath, settingsConfig);
      this.ui.success(`✓ Removed ${fieldsRemoved} ${setting.type} setting(s)`);
      return true;
    }

    return false;
  }

  private getSettingsPath(type: 'global' | 'local'): string {
    return type === 'global'
      ? path.join(os.homedir(), '.claude', 'settings.json')
      : path.join(process.cwd(), '.claude', 'settings.local.json');
  }

  private removeSettingFields(settingsConfig: Record<string, unknown>, fields: string[]): number {
    let fieldsRemoved = 0;
    for (const field of fields) {
      if (settingsConfig[field] !== undefined) {
        delete settingsConfig[field];
        fieldsRemoved++;
      }
    }
    return fieldsRemoved;
  }

  private async removeClaudeMdFiles(
    claudeMdFiles: { type: 'global' | 'local'; path: string }[],
    options: UninstallOptions
  ): Promise<number> {
    let removedCount = 0;

    // Sequential processing required for proper error handling and UI feedback
    for (const claudeMd of claudeMdFiles) {
      if (options.global && claudeMd.type !== 'global') continue;
      if (options.local && claudeMd.type !== 'local') continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        if (await this.fileService.exists(claudeMd.path)) {
          // eslint-disable-next-line no-await-in-loop
          await fs.remove(claudeMd.path);
          this.ui.success(`✓ Removed ${claudeMd.type} CLAUDE.md`);
          removedCount++;
        } else {
          this.ui.warning(`⚠️  CLAUDE.md file not found: ${claudeMd.path}`);
        }
      } catch (error) {
        this.ui.warning(
          `⚠️  Failed to remove ${claudeMd.type} CLAUDE.md: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }
    }

    return removedCount;
  }

  private async removeEmptyDirectories(dirPath: string): Promise<void> {
    try {
      // Don't remove the root .claude directories
      const basename = path.basename(dirPath);
      if (basename === '.claude' || basename === 'commands' || basename === 'agents') {
        return;
      }

      const files = await fs.readdir(dirPath);
      if (files.length === 0) {
        await fs.rmdir(dirPath);
        this.ui.meta(`   Removed empty directory: ${path.basename(dirPath)}`);

        // Recursively try to remove parent if it's also empty
        await this.removeEmptyDirectories(path.dirname(dirPath));
      }
    } catch {
      // Ignore errors when removing directories
    }
  }
}

// Create instance for backward compatibility
const uninstallActionInstance = new UninstallAction();

/**
 * Uninstall a previously installed stack
 *
 * @param stackId - Stack identifier to uninstall
 * @param options - Uninstall options
 *
 * @returns Promise that resolves when uninstallation is complete
 *
 * @throws {@link Error} When stack is not found or uninstallation fails
 *
 * @example
 * ```typescript
 * // Uninstall a complete stack
 * await uninstallAction('anthropic/web-scraper');
 *
 * // Uninstall only commands
 * await uninstallAction('org/stack-name', {
 *   commandsOnly: true,
 *   force: true
 * });
 * ```
 *
 * @remarks
 * Removes all components that were installed by the specified stack.
 * Uses the stack registry to track what was originally installed.
 * Provides options to remove only specific component types.
 *
 * @since 1.4.0
 * @public
 */
export async function uninstallAction(
  stackId?: string,
  options: UninstallOptions = {}
): Promise<void> {
  await uninstallActionInstance.execute(stackId, options);
}
