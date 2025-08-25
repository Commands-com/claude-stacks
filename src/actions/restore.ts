import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { STACKS_PATH } from '../constants/paths.js';

import type {
  DeveloperStack,
  RestoreOptions,
  StackAgent,
  StackCommand,
  StackMcpServer,
} from '../types/index.js';
import { colors } from '../utils/colors.js';
import { checkMcpDependencies, displayMissingDependencies } from '../utils/dependencies.js';

async function resolveStackPath(stackFilePath: string): Promise<string> {
  let resolvedPath = stackFilePath;

  // If it's just a filename, look in ~/.claude/stacks/
  if (!path.isAbsolute(stackFilePath) && !stackFilePath.includes('/')) {
    const stacksDir = STACKS_PATH;
    resolvedPath = path.join(stacksDir, stackFilePath);
  }

  if (!(await fs.pathExists(resolvedPath))) {
    throw new Error(`Stack file not found: ${resolvedPath}`);
  }

  return resolvedPath;
}

async function checkDependencies(stack: DeveloperStack): Promise<void> {
  if (stack.mcpServers && stack.mcpServers.length > 0) {
    console.log(colors.info('🔍 Checking MCP server dependencies...'));
    const missingDeps = await checkMcpDependencies(stack.mcpServers);
    displayMissingDependencies(missingDeps);
  }
}

interface ClaudeConfig {
  projects?: Record<string, ProjectConfig>;
  [key: string]: unknown;
}

interface ProjectConfig {
  allowedTools: string[];
  mcpServers: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

interface McpServerConfig {
  type: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  [key: string]: unknown;
}

async function loadClaudeConfig(claudeJsonPath: string): Promise<ClaudeConfig> {
  if (!(await fs.pathExists(claudeJsonPath))) {
    return {};
  }

  try {
    return (await fs.readJson(claudeJsonPath)) as ClaudeConfig;
  } catch {
    console.warn(colors.warning('Warning: Could not read existing .claude.json, creating new one'));
    return {};
  }
}

function setupProjectConfig(claudeConfig: ClaudeConfig, options: RestoreOptions): ProjectConfig {
  claudeConfig.projects ??= {};
  const currentProjectPath = process.cwd();
  const { projects } = claudeConfig;
  projects[currentProjectPath] ??= { allowedTools: [], mcpServers: {} };
  const projectConfig = projects[currentProjectPath];
  projectConfig.allowedTools ??= [];

  if (options.overwrite) {
    projectConfig.mcpServers = {};
  } else {
    projectConfig.mcpServers ??= {};
  }

  return projectConfig;
}

function shouldSkipMcpServer(
  mcpServer: StackMcpServer,
  options: RestoreOptions,
  projectConfig: ProjectConfig
): boolean {
  return !options.overwrite && Boolean(projectConfig.mcpServers[mcpServer.name]);
}

function buildMcpServerConfig(mcpServer: StackMcpServer): McpServerConfig {
  return {
    type: mcpServer.type,
    ...(mcpServer.command && { command: mcpServer.command }),
    ...(mcpServer.args && { args: mcpServer.args }),
    ...(mcpServer.url && { url: mcpServer.url }),
    ...(mcpServer.env && { env: mcpServer.env }),
  };
}

async function restoreMcpServers(stack: DeveloperStack, options: RestoreOptions): Promise<void> {
  if (!stack.mcpServers || stack.mcpServers.length === 0) return;

  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  const claudeConfig = await loadClaudeConfig(claudeJsonPath);
  const projectConfig = setupProjectConfig(claudeConfig, options);

  // Add stack's MCP servers
  for (const mcpServer of stack.mcpServers) {
    if (shouldSkipMcpServer(mcpServer, options, projectConfig)) {
      console.log(colors.warning(`Skipped existing MCP server: ${mcpServer.name}`));
      continue;
    }

    projectConfig.mcpServers[mcpServer.name] = buildMcpServerConfig(mcpServer);
    console.log(colors.success(`✓ Added MCP server: ${mcpServer.name}`));
  }

  await fs.writeJson(claudeJsonPath, claudeConfig, { spaces: 2 });
}

async function restoreClaudeMd(
  stack: DeveloperStack,
  claudeDir: string,
  localClaudeDir: string,
  options: RestoreOptions
): Promise<void> {
  if (!stack.claudeMd) return;

  if (stack.claudeMd.global) {
    const globalClaudeMdPath = path.join(claudeDir, 'CLAUDE.md');
    if (!options.overwrite && (await fs.pathExists(globalClaudeMdPath))) {
      console.log(colors.warning('Skipped existing global CLAUDE.md'));
    } else {
      await fs.writeFile(globalClaudeMdPath, stack.claudeMd.global.content, 'utf-8');
      console.log(colors.success('✓ Added global CLAUDE.md'));
    }
  }

  if (stack.claudeMd.local) {
    const localClaudeMdPath = path.join(localClaudeDir, 'CLAUDE.md');
    if (!options.overwrite && (await fs.pathExists(localClaudeMdPath))) {
      console.log(colors.warning('Skipped existing local CLAUDE.md'));
    } else {
      await fs.writeFile(localClaudeMdPath, stack.claudeMd.local.content, 'utf-8');
      console.log(colors.success('✓ Added local CLAUDE.md'));
    }
  }
}

interface RestoreResults {
  stack: DeveloperStack;
  globalCommands: StackCommand[];
  localCommands: StackCommand[];
  globalAgents: StackAgent[];
  localAgents: StackAgent[];
}

function displayResults(results: RestoreResults): void {
  const { stack, globalCommands, localCommands, globalAgents, localAgents } = results;
  console.log();
  console.log(colors.success('✅ Stack restoration completed successfully!'));

  const restoredItems = [
    `Commands: ${globalCommands.length} global, ${localCommands.length} local`,
    `Agents: ${globalAgents.length} global, ${localAgents.length} local`,
    `MCP Servers: ${stack.mcpServers?.length ?? 0} configurations`,
    `Settings: ${stack.settings ? 'Yes' : 'None'}`,
    `CLAUDE.md: ${(stack.claudeMd?.global ? 1 : 0) + (stack.claudeMd?.local ? 1 : 0)} files`,
  ];

  console.log(colors.info('Restored:'));
  restoredItems.forEach(item => console.log(colors.meta(`  ${item}`)));
}

export async function restoreAction(
  stackFilePath: string,
  options: RestoreOptions = {}
): Promise<void> {
  try {
    const resolvedPath = await resolveStackPath(stackFilePath);
    const stack = (await fs.readJson(resolvedPath)) as DeveloperStack;

    console.log(colors.stackName(`Restoring stack: ${stack.name}`));
    console.log(`Description: ${colors.description(stack.description)}`);
    console.log(colors.meta(`Mode: ${options.overwrite ? 'Overwrite' : 'Add/Merge'}`));
    console.log();

    await checkDependencies(stack);

    const claudeDir = path.join(os.homedir(), '.claude');
    const currentDir = process.cwd();
    const localClaudeDir = path.join(currentDir, '.claude');

    await fs.ensureDir(claudeDir);
    await fs.ensureDir(localClaudeDir);

    const { globalCommands, localCommands } = categorizeComponents(stack.commands ?? []);
    const { globalCommands: globalAgents, localCommands: localAgents } = categorizeComponents(
      stack.agents ?? []
    );

    await restoreGlobalCommands(globalCommands, claudeDir, options);
    await restoreLocalCommands(localCommands, localClaudeDir, options);
    await restoreGlobalAgents(globalAgents, claudeDir, options);
    await restoreLocalAgents(localAgents, localClaudeDir, options);

    await restoreMcpServers(stack, options);
    await restoreSettings(stack, localClaudeDir, options);
    await restoreClaudeMd(stack, claudeDir, localClaudeDir, options);

    displayResults({ stack, globalCommands, localCommands, globalAgents, localAgents });
  } catch (error) {
    console.error(
      colors.error('Restore failed:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

async function restoreSettings(
  stack: DeveloperStack,
  localClaudeDir: string,
  options: RestoreOptions
): Promise<void> {
  if (!stack.settings || Object.keys(stack.settings).length === 0) {
    return;
  }

  // Check if settings contain global vs local by examining the structure
  // For now, assume all settings go to local unless we can detect otherwise
  const localSettingsPath = path.join(localClaudeDir, 'settings.local.json');

  if (options.overwrite) {
    // Replace settings entirely
    await fs.writeJson(localSettingsPath, stack.settings, { spaces: 2 });
    console.log(colors.success('✓ Replaced local settings'));
  } else {
    // Merge with existing settings
    const existingSettings = await readExistingSettings(localSettingsPath);
    const mergedSettings = { ...existingSettings, ...stack.settings };
    await fs.writeJson(localSettingsPath, mergedSettings, { spaces: 2 });
    console.log(colors.success('✓ Merged local settings'));
  }
}

async function readExistingSettings(localSettingsPath: string): Promise<Record<string, unknown>> {
  if (!(await fs.pathExists(localSettingsPath))) {
    return {};
  }

  try {
    return (await fs.readJson(localSettingsPath)) as Record<string, unknown>;
  } catch {
    console.warn(colors.warning('Warning: Could not read existing local settings'));
    return {};
  }
}

function categorizeComponents<T extends { filePath?: string }>(components: T[]) {
  const global = components.filter(c => c.filePath?.startsWith('~'));
  const local = components.filter(c => c.filePath?.startsWith('.'));
  return { globalCommands: global, localCommands: local };
}

async function restoreGlobalCommands(
  commands: StackCommand[],
  claudeDir: string,
  options: RestoreOptions
): Promise<void> {
  if (commands.length === 0) return;

  const targetDir = path.join(claudeDir, 'commands');
  await restoreComponents(commands, targetDir, 'global command', options);
}

async function restoreLocalCommands(
  commands: StackCommand[],
  localClaudeDir: string,
  options: RestoreOptions
): Promise<void> {
  if (commands.length === 0) return;

  const targetDir = path.join(localClaudeDir, 'commands');
  await restoreComponents(commands, targetDir, 'local command', options);
}

async function restoreGlobalAgents(
  agents: StackAgent[],
  claudeDir: string,
  options: RestoreOptions
): Promise<void> {
  if (agents.length === 0) return;

  const targetDir = path.join(claudeDir, 'agents');
  await restoreComponents(agents, targetDir, 'global agent', options);
}

async function restoreLocalAgents(
  agents: StackAgent[],
  localClaudeDir: string,
  options: RestoreOptions
): Promise<void> {
  if (agents.length === 0) return;

  const targetDir = path.join(localClaudeDir, 'agents');
  await restoreComponents(agents, targetDir, 'local agent', options);
}

async function restoreComponents(
  components: (StackCommand | StackAgent)[],
  targetDir: string,
  componentType: string,
  options: RestoreOptions
): Promise<void> {
  if (options.overwrite && (await fs.pathExists(targetDir))) {
    await fs.emptyDir(targetDir);
  }

  await fs.ensureDir(targetDir);

  const componentPromises = components.map(async component => {
    const fileName = `${component.name.replace(' (local)', '').replace(' (global)', '')}.md`;
    const filePath = path.join(targetDir, fileName);

    if (!options.overwrite && (await fs.pathExists(filePath))) {
      console.log(colors.warning(`Skipped existing ${componentType}: ${component.name}`));
      return;
    }

    await fs.writeFile(filePath, component.content, 'utf-8');
    console.log(colors.success(`✓ Added ${componentType}: ${component.name}`));
  });

  await Promise.all(componentPromises);
}
