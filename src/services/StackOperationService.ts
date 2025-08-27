import fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { getStacksPath } from '../constants/paths.js';
import type {
  DeveloperStack,
  InstallOptions,
  RestoreOptions,
  StackAgent,
  StackCommand,
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
  constructor(
    private readonly ui: UIService, // eslint-disable-line no-unused-vars
    private readonly dependencies: DependencyService, // eslint-disable-line no-unused-vars
    private readonly fileService: FileService // eslint-disable-line no-unused-vars
  ) {}

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
  async performRestore(stackFilePath: string, options: RestoreOptions = {}): Promise<void> {
    const resolvedPath = await this.resolveStackPath(stackFilePath);
    const stack = (await fs.readJson(resolvedPath)) as DeveloperStack;

    this.ui.info(`📦 Restoring stack: ${this.ui.colorStackName(stack.name)}`);
    this.ui.log(`Description: ${this.ui.colorDescription(stack.description)}\n`);

    // Check dependencies
    await this.checkDependencies(stack);

    // Restore components based on options
    await this.restoreComponents(stack, options);

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

      // Use restore logic for installation
      await this.performRestore(tempStackPath, options);

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
   * Restore stack components based on options
   */
  private async restoreComponents(stack: DeveloperStack, options: RestoreOptions): Promise<void> {
    await this.restoreCommandComponents(stack, options);
    await this.restoreAgentComponents(stack, options);
    await this.restoreOtherComponents(stack, options);
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

  private async restoreOtherComponents(
    stack: DeveloperStack,
    options: RestoreOptions
  ): Promise<void> {
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      await this.restoreMcpServers(stack.mcpServers, options);
    }

    if (stack.settings && Object.keys(stack.settings).length > 0) {
      await this.restoreSettings(stack.settings, options);
    }

    if (stack.claudeMd) {
      await this.restoreClaudeMdFiles(stack.claudeMd, options);
    }
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
          const fileName = `${command.name.replace(/ \((local|global)\)/g, '')}.md`;
          const filePath = path.join(globalCommandsDir, fileName);

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
          const fileName = `${command.name.replace(/ \((local|global)\)/g, '')}.md`;
          const filePath = path.join(localCommandsDir, fileName);

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

  private configureMcpServers(
    projectConfig: Record<string, unknown>,
    servers: StackMcpServer[],
    options: RestoreOptions
  ): void {
    // ONLY touch the mcpServers field - preserve everything else in project config
    if (options.overwrite) {
      projectConfig.mcpServers = {};
    } else {
      // Initialize mcpServers if it doesn't exist, but don't overwrite existing ones
      projectConfig.mcpServers ??= {};
    }

    const mcpServers = projectConfig.mcpServers as Record<string, unknown>;

    // Add stack's MCP servers - only append to mcpServers
    for (const mcpServer of servers) {
      if (!options.overwrite && mcpServers[mcpServer.name]) {
        this.ui.warning(`Skipped existing MCP server: ${mcpServer.name}`);
        continue;
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
  ): Promise<void> {
    try {
      const { targetPath, settingsType, allowedBase } = this.getSettingsPath(options);
      await this.fileService.ensureDir(path.dirname(targetPath));

      if (options.overwrite) {
        await this.replaceSettings(targetPath, settings, settingsType, allowedBase);
      } else {
        await this.mergeSettings(targetPath, settings, settingsType, allowedBase);
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
    await this.fileService.writeJsonFile(targetPath, settings, { allowedBase });
    this.ui.success(`✓ Replaced ${settingsType} settings`);
  }

  private async mergeSettings(
    targetPath: string,
    settings: StackSettings,
    settingsType: string,
    allowedBase: string
  ): Promise<void> {
    let existingSettings = {};
    if (await this.fileService.exists(targetPath)) {
      try {
        existingSettings = await this.fileService.readJsonFile(targetPath);
      } catch {
        this.ui.warning(`Warning: Could not read existing ${settingsType} settings`);
      }
    }

    const mergedSettings = { ...existingSettings, ...settings };
    await this.fileService.writeJsonFile(targetPath, mergedSettings, { allowedBase });
    this.ui.success(`✓ Merged ${settingsType} settings`);
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
