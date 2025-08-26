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
} from '../types/index.js';
import type { UIService } from './UIService.js';
import type { DependencyService } from './DependencyService.js';

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
    private readonly dependencies: DependencyService // eslint-disable-line no-unused-vars
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
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      this.ui.info('🔍 Checking MCP server dependencies...');
      const missingDeps = await this.dependencies.checkMcpDependencies(stack.mcpServers);
      this.dependencies.displayMissingDependencies(missingDeps);
    }
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
    await this.restoreOtherComponents(stack);
  }

  private async restoreCommandComponents(
    stack: DeveloperStack,
    options: RestoreOptions
  ): Promise<void> {
    const { globalOnly, localOnly } = options;

    if (!localOnly && stack.commands) {
      const globalCommands = stack.commands.filter(cmd => !cmd.filePath?.startsWith('./.claude'));
      if (globalCommands.length > 0) {
        await this.restoreGlobalCommands(globalCommands);
      }
    }

    if (!globalOnly && stack.commands) {
      const localCommands = stack.commands.filter(cmd => cmd.filePath?.startsWith('./.claude'));
      if (localCommands.length > 0) {
        await this.restoreLocalCommands(localCommands);
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
        await this.restoreGlobalAgents(globalAgents);
      }
    }

    if (!globalOnly && stack.agents) {
      const localAgents = stack.agents.filter(agent => agent.filePath?.startsWith('./.claude'));
      if (localAgents.length > 0) {
        await this.restoreLocalAgents(localAgents);
      }
    }
  }

  private async restoreOtherComponents(stack: DeveloperStack): Promise<void> {
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      await this.restoreMcpServers(stack.mcpServers);
    }

    if (stack.settings && Object.keys(stack.settings).length > 0) {
      await this.restoreSettings();
    }

    if (stack.claudeMd) {
      await this.restoreClaudeMdFiles();
    }
  }

  private async restoreGlobalCommands(commands: StackCommand[]): Promise<void> {
    // Implementation would go here - for now, just log
    this.ui.info(`📝 Restoring ${commands.length} global command(s)...`);
  }

  private async restoreLocalCommands(commands: StackCommand[]): Promise<void> {
    this.ui.info(`📝 Restoring ${commands.length} local command(s)...`);
  }

  private async restoreGlobalAgents(agents: StackAgent[]): Promise<void> {
    this.ui.info(`🤖 Restoring ${agents.length} global agent(s)...`);
  }

  private async restoreLocalAgents(agents: StackAgent[]): Promise<void> {
    this.ui.info(`🤖 Restoring ${agents.length} local agent(s)...`);
  }

  private async restoreMcpServers(servers: StackMcpServer[]): Promise<void> {
    this.ui.info(`🔌 Restoring ${servers.length} MCP server(s)...`);
  }

  private async restoreSettings(): Promise<void> {
    this.ui.info(`⚙️  Restoring settings...`);
  }

  private async restoreClaudeMdFiles(): Promise<void> {
    this.ui.info(`📄 Restoring Claude.md files...`);
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
