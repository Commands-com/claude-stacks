/**
 * MCP Sync Action
 *
 * Synchronizes MCP server configurations from Claude to other AI tools
 * like Codex and Gemini, handling format conversion and config management.
 *
 * @since 1.4.9
 * @public
 */

import fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { BaseAction } from './BaseAction.js';
import { readSingleChar } from '../utils/input.js';
import type { SyncMcpArgs } from '../types/cli.js';
import type { StackMcpServer } from '../types/index.js';
import { CLAUDE_JSON_PATH } from '../constants/paths.js';
import type { CodexMcpServer, GeminiConfig, GeminiMcpServer } from '../utils/mcp-converters.js';

interface ClaudeConfigMcpServer {
  type?: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface ClaudeProjectConfig {
  mcpServers?: Record<string, ClaudeConfigMcpServer>;
}

interface ClaudeConfig {
  projects?: Record<string, ClaudeProjectConfig>;
}
import {
  convertToCodexFormat,
  convertToGeminiFormat,
  generateCodexToml,
} from '../utils/mcp-converters.js';

/**
 * Action class for syncing MCP server configurations to external AI tools
 *
 * @since 1.4.9
 * @public
 */
export class SyncMcpAction extends BaseAction {
  /**
   * Execute the sync MCP command
   *
   * @param options - Command options for the sync operation
   */
  async execute(options: SyncMcpArgs): Promise<void> {
    try {
      const mcpServers = await this.validateAndPrepare(options);

      if (mcpServers.length === 0) {
        this.ui.warning('No MCP servers found in current Claude project');
        this.ui.info('Make sure you have MCP servers configured in your Claude project');
        return;
      }

      this.displayServers(mcpServers);

      // Sync to Codex (unless gemini-only)
      if (!options.geminiOnly) {
        await this.syncToCodex(mcpServers, options);
      }

      // Sync to Gemini (unless codex-only)
      if (!options.codexOnly) {
        await this.syncToGemini(mcpServers, options);
      }

      if (!options.dryRun) {
        this.ui.success(`✓ Successfully synced ${mcpServers.length} MCP servers`);
      } else {
        this.ui.info('Dry run complete - no changes were made');
      }
    } catch (error) {
      this.ui.error(
        'Failed to sync MCP servers:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  /**
   * Read MCP servers from Claude configuration for current project
   */
  /**
   * Validate options and prepare MCP servers data
   */
  private async validateAndPrepare(options: SyncMcpArgs): Promise<StackMcpServer[]> {
    // Validate mutually exclusive options
    if (options.codexOnly && options.geminiOnly) {
      this.ui.error('Cannot use both --codex-only and --gemini-only flags together');
      process.exit(1);
    }

    this.ui.info('📤 Syncing MCP servers from current project...');

    const currentProjectPath = process.cwd();
    this.ui.meta(`Current project: ${currentProjectPath}`);

    // Read MCP servers from Claude config
    return await this.readClaudeMcpServers(currentProjectPath);
  }

  /**
   * Display the servers that will be synced
   */
  private displayServers(mcpServers: StackMcpServer[]): void {
    this.ui.success(`MCP Servers to sync (${mcpServers.length}):`);
    mcpServers.forEach(server => {
      const typeInfo =
        server.type === 'stdio'
          ? `${server.type}: ${server.command}`
          : `${server.type}: ${server.url ?? 'no-url'}`;
      this.ui.info(`  • ${server.name} (${typeInfo})`);
    });
    console.log();
  }

  private async readClaudeMcpServers(projectPath: string): Promise<StackMcpServer[]> {
    const claudeJsonPath = CLAUDE_JSON_PATH;

    if (!(await fs.pathExists(claudeJsonPath))) {
      this.ui.warning(`Claude config file not found at ${claudeJsonPath}`);
      return [];
    }

    try {
      const claudeConfig = (await fs.readJson(claudeJsonPath)) as ClaudeConfig;
      const projects = (claudeConfig.projects ?? {}) as Record<string, ClaudeProjectConfig>;
      const projectConfig = projects[projectPath] as ClaudeProjectConfig | undefined;

      if (!projectConfig?.mcpServers) {
        return [];
      }

      // Convert from Claude config format to StackMcpServer format
      const servers: StackMcpServer[] = [];
      Object.entries(projectConfig.mcpServers).forEach(
        ([name, config]: [string, ClaudeConfigMcpServer]) => {
          servers.push({
            name,
            type: (config.type as 'stdio' | 'http' | 'sse') ?? 'stdio',
            command: config.command,
            args: config.args,
            url: config.url,
            env: config.env,
          });
        }
      );

      return servers;
    } catch (error) {
      throw new Error(
        `Failed to read Claude config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Sync MCP servers to Codex configuration
   */

  /**
   * Confirm overwrite operation with user
   */
  private async confirmOverwrite(
    target: string,
    existingCount: number,
    newCount: number,
    options: SyncMcpArgs
  ): Promise<boolean> {
    // Skip confirmation if force flag is set, append mode, or dry run
    if (options.force || options.append || options.dryRun) {
      return true;
    }

    // Skip confirmation if no existing servers would be overwritten
    if (existingCount === 0) {
      return true;
    }

    this.ui.warning(`⚠️  This will overwrite ${existingCount} existing MCP servers in ${target}`);
    this.ui.info(`   Current servers: ${existingCount}`);
    this.ui.info(`   After sync: ${newCount}`);
    console.log();

    const response = await readSingleChar(
      'Continue with overwrite? This will replace existing MCP server configurations. (y/N): '
    );

    if (response.toLowerCase() !== 'y') {
      this.ui.info(`${target} sync cancelled by user`);
      return false;
    }

    return true;
  }

  private async syncToCodex(mcpServers: StackMcpServer[], options: SyncMcpArgs): Promise<void> {
    const codexConfigPath = path.join(os.homedir(), '.codex', 'config.toml');
    const codexServers = convertToCodexFormat(mcpServers);

    // Filter to only stdio servers for Codex
    const stdioCount = Object.keys(codexServers).length;
    const skippedCount = mcpServers.length - stdioCount;

    this.ui.info(`Codex (~/.codex/config.toml):`);

    try {
      let existingCount = 0;

      if (await fs.pathExists(codexConfigPath)) {
        // For simplicity, we'll parse basic TOML manually
        // In a production app, you'd want to use a proper TOML parser
        const existingContent = await fs.readFile(codexConfigPath, 'utf8');
        const serverMatches = existingContent.match(/\[mcp_servers\.([^\]]+)\]/g);
        existingCount = serverMatches ? serverMatches.length : 0;
      }

      const newCount = options.append ? existingCount + stdioCount : stdioCount;

      this.ui.meta(`  Current MCP servers: ${existingCount}`);
      this.ui.meta(`  After sync: ${newCount} (${options.append ? 'append' : 'overwrite'} mode)`);

      if (skippedCount > 0) {
        this.ui.warning(`  Skipped ${skippedCount} non-stdio servers (Codex only supports stdio)`);
      }

      // Ask for confirmation before overwriting
      if (!(await this.confirmOverwrite('Codex config', existingCount, newCount, options))) {
        this.ui.info('  Skipped Codex sync');
        return;
      }

      if (!options.dryRun) {
        await this.writeCodexConfig(codexConfigPath, codexServers, options);
        this.ui.success('  ✓ Codex config updated');
      } else {
        this.ui.info('  (dry run - no changes made)');
      }
    } catch (error) {
      throw new Error(
        `Failed to sync to Codex: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.log();
  }

  /**
   * Sync MCP servers to Gemini configuration
   */
  private async syncToGemini(mcpServers: StackMcpServer[], options: SyncMcpArgs): Promise<void> {
    const geminiConfigPath = path.join(os.homedir(), '.gemini', 'settings.json');
    const geminiServers = convertToGeminiFormat(mcpServers);

    this.ui.info(`Gemini (~/.gemini/settings.json):`);

    try {
      // Read existing config
      let existingConfig: GeminiConfig = {};
      let existingCount = 0;

      if (await fs.pathExists(geminiConfigPath)) {
        existingConfig = (await fs.readJson(geminiConfigPath)) as GeminiConfig;
        existingCount = existingConfig.mcpServers
          ? Object.keys(existingConfig.mcpServers).length
          : 0;
      }

      const newCount = options.append ? existingCount + mcpServers.length : mcpServers.length;

      this.ui.meta(`  Current MCP servers: ${existingCount}`);
      this.ui.meta(`  After sync: ${newCount} (${options.append ? 'append' : 'overwrite'} mode)`);

      // Ask for confirmation before overwriting
      if (!(await this.confirmOverwrite('Gemini config', existingCount, newCount, options))) {
        this.ui.info('  Skipped Gemini sync');
        return;
      }

      if (!options.dryRun) {
        await this.writeGeminiConfig(geminiConfigPath, existingConfig, geminiServers, options);
        this.ui.success('  ✓ Gemini config updated');
      } else {
        this.ui.info('  (dry run - no changes made)');
      }
    } catch (error) {
      throw new Error(
        `Failed to sync to Gemini: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.log();
  }

  /**
   * Write Codex configuration file
   */
  private async writeCodexConfig(
    configPath: string,
    newServers: Record<string, CodexMcpServer>,
    options: SyncMcpArgs
  ): Promise<void> {
    // Ensure directory exists
    await fs.ensureDir(path.dirname(configPath));

    let finalContent = '';

    if (options.append && (await fs.pathExists(configPath))) {
      // Read existing content and append new servers
      const existingContent = await fs.readFile(configPath, 'utf8');
      finalContent = existingContent.trim();

      if (finalContent && !finalContent.endsWith('\n')) {
        finalContent += '\n';
      }
      if (finalContent) {
        finalContent += '\n';
      }
    }

    // Generate new TOML content
    const newToml = generateCodexToml(newServers);
    finalContent += newToml;

    await fs.writeFile(configPath, finalContent);
  }

  /**
   * Write Gemini configuration file
   */
  private async writeGeminiConfig(
    configPath: string,
    existingConfig: GeminiConfig,
    newServers: Record<string, GeminiMcpServer>,
    options: SyncMcpArgs
  ): Promise<void> {
    // Ensure directory exists
    await fs.ensureDir(path.dirname(configPath));

    const finalConfig: GeminiConfig = { ...existingConfig };

    if (options.append) {
      // Merge with existing servers
      finalConfig.mcpServers = {
        ...(existingConfig.mcpServers ?? {}),
        ...newServers,
      };
    } else {
      // Replace servers
      finalConfig.mcpServers = newServers;
    }

    await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
  }
}

/**
 * Sync MCP action factory function
 *
 * @param options - Sync command options
 */
export async function syncMcpAction(options: SyncMcpArgs): Promise<void> {
  const action = new SyncMcpAction();
  await action.execute(options);
}
