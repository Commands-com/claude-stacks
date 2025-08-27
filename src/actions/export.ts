import fs from 'fs-extra';
import * as path from 'path';
import {
  CLAUDE_JSON_PATH,
  getGlobalAgentsDir,
  getGlobalCommandsDir,
  getGlobalSettingsPath,
  getLocalAgentsDir,
  getLocalCommandsDir,
  getLocalSettingsPath,
  getStacksPath,
} from '../constants/paths.js';

import type {
  DeveloperStack,
  ExportOptions,
  StackAgent,
  StackCommand,
  StackMcpServer,
} from '../types/index.js';
import { UIService } from '../services/UIService.js';
import { MetadataService } from '../services/MetadataService.js';

// Create service instances
const ui = new UIService();
const metadata = new MetadataService();

function truncateDescription(description: string): string {
  return description.length > 80 ? `${description.substring(0, 77)}...` : description;
}

function extractFromYamlFrontmatter(content: string): string | null {
  if (!content.startsWith('---')) {
    return null;
  }

  const frontmatterEnd = content.indexOf('\n---\n', 4);
  if (frontmatterEnd === -1) {
    return null;
  }

  const frontmatterContent = content.substring(4, frontmatterEnd);
  const descriptionMatch = frontmatterContent.match(/^description:\s*(.+)$/m);
  if (descriptionMatch) {
    const description = descriptionMatch[1].trim().replace(/^['"]|['"]$/g, '');
    return truncateDescription(description);
  }

  return null;
}

function extractFromFirstMeaningfulLine(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('<!--') &&
      !trimmed.startsWith('---')
    ) {
      return truncateDescription(trimmed);
    }
  }
  return 'No description available';
}

/**
 * Extract description from markdown content by looking for first paragraph
 */
function extractDescriptionFromContent(content: string): string {
  const fromYaml = extractFromYamlFrontmatter(content);
  if (fromYaml) {
    return fromYaml;
  }

  return extractFromFirstMeaningfulLine(content);
}

/**
 * Generic directory scanner for .md files
 */
async function scanDirectory<T>(
  dirPath: string,
  // eslint-disable-next-line no-unused-vars
  itemFactory: (filename: string, fileContent: string) => T,
  basePath: string = ''
): Promise<Map<string, T>> {
  const itemsMap = new Map<string, T>();

  if (!(await fs.pathExists(dirPath))) {
    return itemsMap;
  }

  const entries = await getDirectoryEntries(dirPath);
  const { directoryPromises, filePromises } = await processEntries(entries.entries, {
    dirPath,
    basePath,
    itemFactory,
    itemsMap,
  });

  // Wait for all operations to complete
  await Promise.all([...directoryPromises, ...filePromises]);

  return itemsMap;
}

async function getDirectoryEntries(
  dirPath: string
): Promise<{ entries: string[]; usesDirent: boolean }> {
  try {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    // Check if we actually got Dirent objects or strings (in case mock returns strings)
    if (dirents.length > 0 && typeof dirents[0] === 'string') {
      return { entries: dirents as unknown as string[], usesDirent: false };
    }
    // Type assertion for Dirent objects - we know they have name property
    return { entries: (dirents as Array<{ name: string }>).map(d => d.name), usesDirent: true };
  } catch {
    // Fallback to old behavior for compatibility
    const entries = await fs.readdir(dirPath);
    return { entries, usesDirent: false };
  }
}

async function processEntries<T>(
  entries: string[],
  context: {
    dirPath: string;
    basePath: string;
    // eslint-disable-next-line no-unused-vars
    itemFactory: (filename: string, fileContent: string) => T;
    itemsMap: Map<string, T>;
  }
): Promise<{ directoryPromises: Promise<void>[]; filePromises: Promise<void>[] }> {
  const { dirPath, basePath, itemFactory, itemsMap } = context;
  const directoryPromises: Promise<void>[] = [];
  const filePromises: Promise<void>[] = [];

  const entryPromises = entries.map(async entryName => {
    const fullPath = path.join(dirPath, entryName);
    const { isDirectory, isFile } = await getEntryType(fullPath);

    if (isDirectory) {
      const subPath = basePath ? `${basePath}/${entryName}` : entryName;
      const promise = scanDirectory(fullPath, itemFactory, subPath).then(subItems => {
        for (const [key, value] of subItems) {
          itemsMap.set(key, value);
        }
      });
      directoryPromises.push(promise);
    } else if (isFile && entryName.endsWith('.md')) {
      const promise = fs.readFile(fullPath, 'utf-8').then(content => {
        const name = entryName.replace('.md', '');
        const fullName = basePath ? `${basePath}/${name}` : name;
        itemsMap.set(fullName, itemFactory(fullName, content));
      });
      filePromises.push(promise);
    }
  });

  await Promise.all(entryPromises);
  return { directoryPromises, filePromises };
}

async function getEntryType(fullPath: string): Promise<{ isDirectory: boolean; isFile: boolean }> {
  // Both cases need to check the file system since mocks may not behave like real Dirent objects
  try {
    const stat = await fs.stat(fullPath);
    return {
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
    };
  } catch {
    return { isDirectory: false, isFile: false };
  }
}

/**
 * Generate stack metadata (name, description, version)
 */
async function generateStackMetadata(options: {
  name?: string;
  description?: string;
  stackVersion?: string;
}): Promise<{ name: string; description: string; version: string }> {
  const currentDir = process.cwd();
  const dirName = path.basename(currentDir);

  // Auto-generate stack name and description from current directory
  const stackName = options.name ?? `${dirName} Stack`;
  let stackDescription = options.description ?? `Stack for ${dirName} project`;

  // Try to read package.json for better description
  const packageJsonPath = path.join(currentDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = (await fs.readJson(packageJsonPath)) as { description?: string };
      if (packageJson.description && !options.description) {
        stackDescription = packageJson.description;
      }
    } catch {
      // Ignore package.json parsing errors
    }
  }

  // Determine version from previous publication
  const publishedMeta = await metadata.getPublishedStackMetadata(currentDir);
  let stackVersion = '1.0.0';

  const { stackVersion: optionsStackVersion } = options;
  if (optionsStackVersion) {
    if (!metadata.isValidVersion(optionsStackVersion)) {
      throw new Error(`Invalid version format: ${optionsStackVersion}. Expected format: X.Y.Z`);
    }
    stackVersion = optionsStackVersion;
  } else if (publishedMeta) {
    stackVersion = metadata.generateSuggestedVersion(publishedMeta.last_published_version);
    console.log(
      ui.colorInfo(
        `📌 Previously published as "${publishedMeta.stack_name}" (v${publishedMeta.last_published_version})`
      )
    );
    console.log(
      ui.colorMeta(`   Auto-suggesting version: ${stackVersion} (use --version to override)`)
    );
  }

  return { name: stackName, description: stackDescription, version: stackVersion };
}

/**
 * Scan and collect commands from global and local directories
 */
async function collectCommands(includeGlobal: boolean): Promise<Map<string, StackCommand>> {
  const commandsMap = new Map<string, StackCommand>();

  if (includeGlobal) {
    const globalCommands = await scanDirectory(getGlobalCommandsDir(), (name, content) => ({
      name,
      filePath: `~/.claude/commands/${name}.md`,
      content,
      description: extractDescriptionFromContent(content),
    }));
    globalCommands.forEach((command, name) => commandsMap.set(name, command));
  }

  const localCommands = await scanDirectory(getLocalCommandsDir(), (name, content) => ({
    name,
    filePath: `./.claude/commands/${name}.md`,
    content,
    description: extractDescriptionFromContent(content),
  }));
  localCommands.forEach((command, name) => commandsMap.set(name, command));

  return commandsMap;
}

/**
 * Scan and collect agents from global and local directories
 */
async function collectAgents(includeGlobal: boolean): Promise<Map<string, StackAgent>> {
  const agentsMap = new Map<string, StackAgent>();

  if (includeGlobal) {
    const globalAgents = await scanDirectory(getGlobalAgentsDir(), (name, content) => ({
      name,
      filePath: `~/.claude/agents/${name}.md`,
      content,
      description: extractDescriptionFromContent(content),
    }));
    globalAgents.forEach((agent, name) => agentsMap.set(name, agent));
  }

  const localAgents = await scanDirectory(getLocalAgentsDir(), (name, content) => ({
    name,
    filePath: `./.claude/agents/${name}.md`,
    content,
    description: extractDescriptionFromContent(content),
  }));
  localAgents.forEach((agent, name) => agentsMap.set(name, agent));

  return agentsMap;
}

/**
 * Read and merge settings files
 */
async function collectSettings(includeGlobal: boolean): Promise<Record<string, unknown>> {
  const settings: Record<string, unknown> = {};

  if (includeGlobal) {
    const globalSettings = await readSettingsFile(getGlobalSettingsPath(), 'global settings.json');
    Object.assign(settings, globalSettings);
  }

  const localSettings = await readSettingsFile(getLocalSettingsPath(), 'local settings.local.json');
  Object.assign(settings, localSettings);

  return settings;
}

/**
 * Helper function to read a settings file safely
 */
async function readSettingsFile(
  filePath: string,
  description: string
): Promise<Record<string, unknown>> {
  if (!(await fs.pathExists(filePath))) {
    return {};
  }

  try {
    return (await fs.readJson(filePath)) as Record<string, unknown>;
  } catch {
    console.warn(`Warning: Could not read ${description}`);
    return {};
  }
}

/**
 * Get MCP server configuration for current project
 */
interface ClaudeConfig {
  projects?: Record<
    string,
    {
      mcpServers?: Record<
        string,
        {
          type?: 'stdio' | 'http' | 'sse';
          command?: string;
          args?: string[];
          url?: string;
          env?: Record<string, string>;
        }
      >;
    }
  >;
}

function convertMcpConfig(
  mcpServers: Record<
    string,
    {
      type?: 'stdio' | 'http' | 'sse';
      command?: string;
      args?: string[];
      url?: string;
      env?: Record<string, string>;
    }
  >
): StackMcpServer[] {
  const servers: StackMcpServer[] = [];
  Object.entries(mcpServers).forEach(([name, config]) => {
    servers.push({
      name,
      type: config.type ?? 'stdio',
      command: config.command,
      args: config.args,
      url: config.url,
      env: config.env,
    });
  });
  return servers;
}

async function collectMcpServers(): Promise<StackMcpServer[]> {
  const claudeJsonPath = CLAUDE_JSON_PATH;
  if (!(await fs.pathExists(claudeJsonPath))) {
    return [];
  }

  try {
    const claudeConfig = (await fs.readJson(claudeJsonPath)) as ClaudeConfig;
    const mcpProjects = claudeConfig.projects ?? {};
    const currentProjectPath = process.cwd();
    const projectConfig = mcpProjects[currentProjectPath];

    if (!projectConfig?.mcpServers) {
      return [];
    }

    return convertMcpConfig(projectConfig.mcpServers);
  } catch {
    return [];
  }
}

async function createBaseStack(options: {
  name: string;
  description: string;
  version: string;
  currentDir: string;
  publishedMeta: { stack_id: string; last_published_version: string } | null;
}): Promise<DeveloperStack> {
  return {
    name: options.name,
    description: options.description,
    version: options.version,
    commands: [],
    agents: [],
    mcpServers: [],
    settings: {},
    metadata: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      exported_from: options.currentDir,
      // Include published metadata if it exists to maintain publish continuity
      ...(options.publishedMeta && {
        published_stack_id: options.publishedMeta.stack_id,
        published_version: options.publishedMeta.last_published_version,
      }),
    },
  };
}

async function populateStackComponents(
  stack: DeveloperStack,
  includeGlobal: boolean
): Promise<void> {
  const [commandsMap, agentsMap, settings, mcpServers] = await Promise.all([
    collectCommands(includeGlobal),
    collectAgents(includeGlobal),
    collectSettings(includeGlobal),
    collectMcpServers(),
  ]);

  stack.commands = Array.from(commandsMap.values());
  stack.agents = Array.from(agentsMap.values());
  stack.settings = settings;
  stack.mcpServers = mcpServers;
}

async function exportCurrentStack(options: {
  name?: string;
  description?: string;
  includeGlobal?: boolean;
  includeClaudeMd?: boolean;
  stackVersion?: string;
}): Promise<DeveloperStack> {
  const currentDir = process.cwd();
  const { name, description, version } = await generateStackMetadata(options);
  const publishedMeta = await metadata.getPublishedStackMetadata(currentDir);

  const stack = await createBaseStack({ name, description, version, currentDir, publishedMeta });
  await populateStackComponents(stack, options.includeGlobal ?? false);

  return stack;
}

/**
 * Exports the current project configuration as a development stack
 *
 * @param filename - Optional output filename for the stack file (defaults to directory name)
 * @param options - Export configuration options including global/local scope and metadata
 *
 * @returns Promise that resolves when export is complete
 *
 * @throws {@link Error} When stack export fails due to file system or validation errors
 *
 * @example
 * ```typescript
 * // Export with default settings
 * await exportAction();
 *
 * // Export with custom filename and options
 * await exportAction('my-stack.json', {
 *   includeGlobal: true,
 *   name: 'Custom Stack',
 *   description: 'Custom development stack'
 * });
 * ```
 *
 * @remarks
 * Creates a JSON file containing commands, agents, MCP servers, and settings
 * from both global (~/.claude) and local (./.claude) directories
 *
 * @since 1.0.0
 * @public
 */
export async function exportAction(filename?: string, options: ExportOptions = {}): Promise<void> {
  try {
    const stack = await exportCurrentStack({
      name: options.name,
      description: options.description,
      includeGlobal: options.includeGlobal ?? false,
      includeClaudeMd: options.includeClaudeMd ?? false,
      stackVersion: options.stackVersion,
    });

    const outputFilename = resolveOutputFilename(filename);
    await writeStackToFile(stack, outputFilename);
    displayExportSuccess(stack, outputFilename);
  } catch (error) {
    handleExportError(error);
  }
}

function resolveOutputFilename(filename?: string): string {
  let outputFilename = filename;
  if (!outputFilename) {
    const dirName = path.basename(process.cwd());
    outputFilename = `${dirName}-stack.json`;
  }

  return outputFilename.endsWith('.json') ? outputFilename : `${outputFilename}.json`;
}

async function writeStackToFile(stack: DeveloperStack, filename: string): Promise<void> {
  const stacksDir = getStacksPath();
  await fs.ensureDir(stacksDir);
  const outputPath = path.join(stacksDir, filename);
  await fs.writeJson(outputPath, stack, { spaces: 2 });
}

function displayExportSuccess(stack: DeveloperStack, filename: string): void {
  const totalComponents =
    (stack.commands?.length ?? 0) + (stack.agents?.length ?? 0) + (stack.mcpServers?.length ?? 0);

  console.log(ui.colorSuccess('✅ Stack exported successfully!'));
  console.log(ui.colorMeta(`  File: ~/.claude/stacks/${filename}`));
  console.log(ui.colorMeta(`  Version: ${stack.version}`));
  console.log(ui.colorMeta(`  Components: ${totalComponents} items`));
  console.log(ui.colorMeta(`  MCP Servers: ${stack.mcpServers?.length ?? 0} items`));
}

function handleExportError(error: unknown): never {
  console.error(
    ui.colorError('Export failed:'),
    error instanceof Error ? error.message : String(error)
  );

  // In test environment, throw error instead of exiting
  if (process.env.NODE_ENV === 'test') {
    throw new Error(error instanceof Error ? error.message : String(error));
  }

  process.exit(1);
}

// Export helper functions for testing
export const exportHelpers = {
  truncateDescription,
  extractFromYamlFrontmatter,
  extractFromFirstMeaningfulLine,
  extractDescriptionFromContent,
  scanDirectory,
  generateStackMetadata,
  collectCommands,
  collectAgents,
  collectSettings,
  readSettingsFile,
  convertMcpConfig,
  collectMcpServers,
  exportCurrentStack,
  resolveOutputFilename,
  writeStackToFile,
  displayExportSuccess,
  handleExportError,
};
