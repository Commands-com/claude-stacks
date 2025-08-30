import fs from 'fs-extra';
import * as path from 'path';
import {
  CLAUDE_JSON_PATH,
  getGlobalAgentsDir,
  getGlobalCommandsDir,
  getGlobalSettingsPath,
  getLocalAgentsDir,
  getLocalCommandsDir,
  getLocalMainSettingsPath,
  getLocalSettingsPath,
  getStacksPath,
} from '../constants/paths.js';
import { HookScannerService } from '../services/HookScannerService.js';
import { FileService } from '../services/FileService.js';
import { type StackRegistry, StackRegistryService } from '../services/StackRegistryService.js';

import type {
  DeveloperStack,
  ExportOptions,
  StackAgent,
  StackCommand,
  StackHook,
  StackMcpServer,
} from '../types/index.js';
import type { PublishedStackMetadata } from '../utils/metadata.js';
import { UIService } from '../services/UIService.js';
import { MetadataService } from '../services/MetadataService.js';

// Create service instances
const ui = new UIService();
const metadata = new MetadataService();

/**
 * Stack metadata containing essential information for stack identification
 *
 * Represents the core metadata required for stack creation and identification,
 * combining user input with auto-generated or derived values.
 *
 * @since 1.0.0
 * @public
 */
export interface StackMetadata {
  /** Stack name (often derived from directory name) */
  name: string;
  /** Stack description (from user input, package.json, or auto-generated) */
  description: string;
  /** Stack version following semantic versioning */
  version: string;
}

/**
 * Truncates a description string to 80 characters or less
 *
 * Ensures descriptions remain readable in UI displays by limiting length
 * and adding ellipsis for truncated content.
 *
 * @param description - The description string to potentially truncate
 * @returns The original string if ≤80 chars, otherwise truncated with "..." suffix
 *
 * @example
 * ```typescript
 * const short = truncateDescription("Brief desc");
 * // Returns: "Brief desc"
 *
 * const long = truncateDescription("This is a very long description that exceeds eighty characters and needs truncation");
 * // Returns: "This is a very long description that exceeds eighty characters and ne..."
 * ```
 *
 * @since 1.0.0
 * @public
 */
function truncateDescription(description: string): string {
  return description.length > 80 ? `${description.substring(0, 77)}...` : description;
}

/**
 * Extracts description from YAML frontmatter in markdown content
 *
 * Parses YAML frontmatter blocks (delimited by ---) to find and extract
 * the description field value, automatically truncating if needed.
 *
 * @param content - The markdown content that may contain YAML frontmatter
 * @returns The extracted and truncated description, or null if no frontmatter/description found
 *
 * @example
 * ```typescript
 * const markdown = `---
 * description: "This is a command description"
 * author: "Claude"
 * ---
 * # Command Content`;
 *
 * const desc = extractFromYamlFrontmatter(markdown);
 * // Returns: "This is a command description"
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * Extracts description from the first meaningful content line
 *
 * Scans through content line by line to find the first non-empty line
 * that isn't a comment, heading, or frontmatter delimiter.
 *
 * @param content - The content to scan for meaningful text
 * @returns The first meaningful line truncated to appropriate length, or default message
 *
 * @example
 * ```typescript
 * const content = `# Title
 * <!-- Comment -->
 * This is the first meaningful line of content.`;
 *
 * const desc = extractFromFirstMeaningfulLine(content);
 * // Returns: "This is the first meaningful line of content."
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
 * Recursively scans a directory for markdown files and creates typed items
 *
 * Performs deep directory traversal to find all .md files, reading their content
 * and converting them to typed objects using the provided factory function.
 * Supports nested directory structures with relative path tracking.
 *
 * @param dirPath - The directory path to scan recursively
 * @param itemFactory - Factory function to convert filename and content into typed objects
 * @param basePath - Base path for relative naming (used internally for recursion)
 * @returns Promise resolving to Map of item names to created objects
 *
 * @throws {Error} When directory access fails or file reading encounters errors
 *
 * @example
 * ```typescript
 * // Scan commands directory
 * const commands = await scanDirectory(
 *   '/path/to/commands',
 *   (name, content) => ({
 *     name,
 *     content,
 *     description: extractDescriptionFromContent(content)
 *   })
 * );
 *
 * // Access nested command: subdirs/command-name
 * const nestedCommand = commands.get('subdirs/command-name');
 * ```
 *
 * @since 1.0.0
 * @public
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

/**
 * Gets directory entries with compatibility for both Dirent objects and strings
 *
 * Handles different return types from fs.readdir() to ensure consistent
 * string array output regardless of the underlying implementation.
 *
 * @param dirPath - The directory path to read entries from
 * @returns Promise resolving to object containing entries array and type indicator
 *
 * @example
 * ```typescript
 * const { entries, usesDirent } = await getDirectoryEntries('/path/to/dir');
 * // entries: ["file1.md", "file2.md", "subdir"]
 * // usesDirent: true (if Dirent objects were used)
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * Processes directory entries and categorizes them into files and subdirectories
 *
 * Separates directory entries into files and subdirectories for parallel processing,
 * creating appropriate promises for each type to enable efficient scanning.
 *
 * @param entries - Array of entry names to process
 * @param context - Processing context containing paths, factory function, and results map
 * @param context.dirPath - The directory path being processed
 * @param context.basePath - The base path for relative naming
 * @param context.itemFactory - Factory function to create items from file content
 * @param context.itemsMap - Map to store created items
 * @returns Promise resolving to arrays of directory and file processing promises
 *
 * @example
 * ```typescript
 * const context = {
 *   dirPath: '/path/to/commands',
 *   basePath: '',
 *   itemFactory: (name, content) => ({ name, content }),
 *   itemsMap: new Map()
 * };
 * const { directoryPromises, filePromises } = await processEntries(entries, context);
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * Determines the type of a file system entry (directory or file)
 *
 * Uses fs.stat() to safely determine if a path represents a directory
 * or file, with graceful error handling for inaccessible paths.
 *
 * @param fullPath - The absolute path to check
 * @returns Promise resolving to object with boolean flags for directory and file types
 *
 * @example
 * ```typescript
 * const { isDirectory, isFile } = await getEntryType('/path/to/item');
 * if (isDirectory) {
 *   // Handle directory
 * } else if (isFile) {
 *   // Handle file
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
 *
 * Creates essential stack metadata by combining user-provided options with
 * auto-generated values from the current directory and package.json.
 *
 * @param options - Configuration options for metadata generation
 * @param options.name - Optional stack name (defaults to directory name)
 * @param options.description - Optional stack description (auto-generated from package.json or directory)
 * @param options.stackVersion - Optional version override
 * @returns {Promise<StackMetadata>} Complete stack metadata for export
 *
 * @since 1.0.0
 * @public
 */
async function getStackDescription(
  options: { description?: string },
  publishedMeta: PublishedStackMetadata | null,
  dirName: string
): Promise<string> {
  // Use explicit description first, then published, then default
  let stackDescription =
    options.description ?? publishedMeta?.description ?? `${dirName} configuration`;

  // Try to read package.json for better description (only if no published description exists)
  if (!options.description && !publishedMeta?.description) {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = (await fs.readJson(packageJsonPath)) as { description?: string };
        if (packageJson.description) {
          stackDescription = packageJson.description;
        }
      } catch {
        // Ignore package.json parsing errors
      }
    }
  }

  return stackDescription;
}

function getStackVersion(
  options: { stackVersion?: string },
  publishedMeta: PublishedStackMetadata | null
): string {
  const { stackVersion: optionsStackVersion } = options;

  if (optionsStackVersion) {
    if (!metadata.isValidVersion(optionsStackVersion)) {
      throw new Error(`Invalid version format: ${optionsStackVersion}. Expected format: X.Y.Z`);
    }
    return optionsStackVersion;
  }

  if (publishedMeta) {
    const suggestedVersion = metadata.generateSuggestedVersion(
      publishedMeta.last_published_version
    );
    console.log(
      ui.colorInfo(
        `📌 Previously published as "${publishedMeta.stack_name}" (v${publishedMeta.last_published_version})`
      )
    );
    console.log(
      ui.colorMeta(`   Auto-suggesting version: ${suggestedVersion} (use --version to override)`)
    );
    return suggestedVersion;
  }

  return '1.0.0';
}

async function generateStackMetadata(options: {
  name?: string;
  description?: string;
  stackVersion?: string;
}): Promise<StackMetadata> {
  const currentDir = process.cwd();
  const dirName = path.basename(currentDir);

  // Get published metadata first to use for name/description continuity
  const publishedMeta = await metadata.getPublishedStackMetadata(currentDir);

  // Use published name if available and no explicit name provided
  const stackName = options.name ?? publishedMeta?.stack_name ?? dirName;

  // Get description using helper function
  const stackDescription = await getStackDescription(options, publishedMeta, dirName);

  // Get version using helper function
  const stackVersion = getStackVersion(options, publishedMeta);

  return { name: stackName, description: stackDescription, version: stackVersion };
}

/**
 * Scan and collect commands from global and local directories
 */
async function collectCommands(
  includeGlobal: boolean,
  includeInstalled: boolean = true
): Promise<Map<string, StackCommand>> {
  const commandsMap = new Map<string, StackCommand>();

  // Get registry to filter out installed components if needed
  let registry: StackRegistry | null = null;
  if (!includeInstalled) {
    const fileService = new FileService();
    const registryService = new StackRegistryService(fileService);
    registry = await registryService.getRegistry();
  }

  if (includeGlobal) {
    const globalCommands = await scanDirectory(getGlobalCommandsDir(), (name, content) => ({
      name,
      filePath: `~/.claude/commands/${name}.md`,
      content,
      description: extractDescriptionFromContent(content),
    }));
    globalCommands.forEach((command, name) => {
      if (includeInstalled || !registry || !isInstalledCommand(name, command.filePath, registry)) {
        commandsMap.set(name, command);
      }
    });
  }

  const localCommands = await scanDirectory(getLocalCommandsDir(), (name, content) => ({
    name,
    filePath: `./.claude/commands/${name}.md`,
    content,
    description: extractDescriptionFromContent(content),
  }));
  localCommands.forEach((command, name) => {
    if (includeInstalled || !registry || !isInstalledCommand(name, command.filePath, registry)) {
      commandsMap.set(name, command);
    }
  });

  return commandsMap;
}

/**
 * Scan and collect agents from global and local directories
 */
async function collectAgents(
  includeGlobal: boolean,
  includeInstalled: boolean = true
): Promise<Map<string, StackAgent>> {
  const agentsMap = new Map<string, StackAgent>();

  // Get registry to filter out installed components if needed
  let registry: StackRegistry | null = null;
  if (!includeInstalled) {
    const fileService = new FileService();
    const registryService = new StackRegistryService(fileService);
    registry = await registryService.getRegistry();
  }

  if (includeGlobal) {
    const globalAgents = await scanDirectory(getGlobalAgentsDir(), (name, content) => ({
      name,
      filePath: `~/.claude/agents/${name}.md`,
      content,
      description: extractDescriptionFromContent(content),
    }));
    globalAgents.forEach((agent, name) => {
      if (includeInstalled || !registry || !isInstalledAgent(name, agent.filePath, registry)) {
        agentsMap.set(name, agent);
      }
    });
  }

  const localAgents = await scanDirectory(getLocalAgentsDir(), (name, content) => ({
    name,
    filePath: `./.claude/agents/${name}.md`,
    content,
    description: extractDescriptionFromContent(content),
  }));
  localAgents.forEach((agent, name) => {
    if (includeInstalled || !registry || !isInstalledAgent(name, agent.filePath, registry)) {
      agentsMap.set(name, agent);
    }
  });

  return agentsMap;
}

/**
 * Read and merge settings files
 */
/**
 * Gets the set of settings fields that were installed by stacks
 */
async function getInstalledSettingsFields(includeInstalled: boolean): Promise<Set<string>> {
  const installedFields = new Set<string>();

  if (includeInstalled) {
    return installedFields; // Return empty set if including installed components
  }

  const fileService = new FileService();
  const registryService = new StackRegistryService(fileService);
  const registry = await registryService.getRegistry();

  // Collect all field names from installed stacks
  for (const stackEntry of Object.values(registry.stacks)) {
    for (const settingsEntry of stackEntry.components.settings) {
      for (const field of settingsEntry.fields) {
        installedFields.add(field);
      }
    }
  }

  return installedFields;
}

/**
 * Filters out settings fields that were installed by stacks
 */
function filterInstalledSettingsFields(
  settings: Record<string, unknown>,
  installedFields: Set<string>
): Record<string, unknown> {
  if (installedFields.size === 0) {
    return settings; // No filtering needed
  }

  const filteredSettings: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(settings)) {
    if (!installedFields.has(key)) {
      filteredSettings[key] = value;
    }
  }

  return filteredSettings;
}

async function collectSettings(
  includeGlobal: boolean,
  includeInstalled: boolean = true
): Promise<Record<string, unknown>> {
  let settings: Record<string, unknown> = {};

  // Get the set of fields that were installed by stacks
  const installedFields = await getInstalledSettingsFields(includeInstalled);

  if (includeGlobal) {
    const globalSettings = await readSettingsFile(getGlobalSettingsPath(), 'global settings.json');
    Object.assign(settings, globalSettings);
  }

  // Read main local settings file (.claude/settings.json)
  const mainLocalSettings = await readSettingsFile(
    getLocalMainSettingsPath(),
    'local settings.json'
  );
  Object.assign(settings, mainLocalSettings);

  // Read override settings file (.claude/settings.local.json) - these take precedence
  const localSettings = await readSettingsFile(getLocalSettingsPath(), 'local settings.local.json');
  Object.assign(settings, localSettings);

  // Filter out settings fields that were installed by stacks
  settings = filterInstalledSettingsFields(settings, installedFields);

  return settings;
}

/**
 * Infers the hook type from filename patterns and conventions
 *
 * Analyzes the hook filename to determine the appropriate hook type based
 * on naming patterns and keywords, with fallback to PreToolUse for unknown patterns.
 *
 * @param name - The hook filename (without extension)
 * @returns The inferred hook type based on filename analysis
 *
 * @example
 * ```typescript
 * const type1 = inferHookType('post-tool-cleanup');
 * // Returns: "PostToolUse"
 *
 * const type2 = inferHookType('session-start-logger');
 * // Returns: "SessionStart"
 *
 * const type3 = inferHookType('unknown-hook');
 * // Returns: "PreToolUse" (default fallback)
 * ```
 *
 * @since 1.0.0
 * @public
 */
function inferHookType(name: string): StackHook['type'] {
  const lowerName = name.toLowerCase();

  // Check for post-tool patterns
  if (containsPostToolPattern(lowerName)) return 'PostToolUse';

  // Check for pre-tool patterns
  if (containsPreToolPattern(lowerName)) return 'PreToolUse';

  // Check for session patterns
  const sessionType = getSessionHookType(lowerName);
  if (sessionType) return sessionType;

  // Check for other patterns
  const otherType = getOtherHookType(lowerName);
  if (otherType) return otherType;

  // Default to PreToolUse if can't determine
  return 'PreToolUse';
}

/**
 * Checks if filename contains post-tool execution patterns
 *
 * Detects naming patterns that indicate the hook should run after tool execution,
 * including hyphenated and non-hyphenated variations.
 *
 * @param lowerName - The lowercase hook filename to analyze
 * @returns True if filename contains post-tool patterns
 *
 * @example
 * ```typescript
 * const isPostTool1 = containsPostToolPattern('post-tool-cleanup');
 * // Returns: true
 *
 * const isPostTool2 = containsPostToolPattern('posttool-handler');
 * // Returns: true
 *
 * const isPostTool3 = containsPostToolPattern('pre-tool-setup');
 * // Returns: false
 * ```
 *
 * @since 1.0.0
 * @public
 */
function containsPostToolPattern(lowerName: string): boolean {
  return lowerName.includes('post-tool') || lowerName.includes('posttool');
}

/**
 * Checks if filename contains pre-tool execution patterns
 *
 * Detects naming patterns that indicate the hook should run before tool execution,
 * including hyphenated and non-hyphenated variations.
 *
 * @param lowerName - The lowercase hook filename to analyze
 * @returns True if filename contains pre-tool patterns
 *
 * @example
 * ```typescript
 * const isPreTool1 = containsPreToolPattern('pre-tool-validation');
 * // Returns: true
 *
 * const isPreTool2 = containsPreToolPattern('pretool-setup');
 * // Returns: true
 *
 * const isPreTool3 = containsPreToolPattern('post-tool-cleanup');
 * // Returns: false
 * ```
 *
 * @since 1.0.0
 * @public
 */
function containsPreToolPattern(lowerName: string): boolean {
  return lowerName.includes('pre-tool') || lowerName.includes('pretool');
}

/**
 * Extracts session-related hook types from filename patterns
 *
 * Identifies session lifecycle hook types (SessionStart, SessionEnd) based on
 * filename patterns, supporting both hyphenated and non-hyphenated formats.
 *
 * @param lowerName - The lowercase hook filename to analyze
 * @returns The session hook type if detected, null if no session patterns found
 *
 * @example
 * ```typescript
 * const sessionType1 = getSessionHookType('session-start-init');
 * // Returns: "SessionStart"
 *
 * const sessionType2 = getSessionHookType('sessionend-cleanup');
 * // Returns: "SessionEnd"
 *
 * const sessionType3 = getSessionHookType('tool-handler');
 * // Returns: null
 * ```
 *
 * @since 1.0.0
 * @public
 */
function getSessionHookType(lowerName: string): StackHook['type'] | null {
  if (lowerName.includes('session-start') || lowerName.includes('sessionstart')) {
    return 'SessionStart';
  }
  if (lowerName.includes('session-end') || lowerName.includes('sessionend')) {
    return 'SessionEnd';
  }
  return null;
}

/**
 * Extracts miscellaneous hook types from filename patterns
 *
 * Identifies various hook types beyond session and tool hooks, including
 * user prompt, notification, subagent, compaction, and stop hooks.
 *
 * @param lowerName - The lowercase hook filename to analyze
 * @returns The hook type if recognized pattern found, null otherwise
 *
 * @example
 * ```typescript
 * const hookType1 = getOtherHookType('user-prompt-validator');
 * // Returns: "UserPromptSubmit"
 *
 * const hookType2 = getOtherHookType('notification-handler');
 * // Returns: "Notification"
 *
 * const hookType3 = getOtherHookType('subagent-stop-monitor');
 * // Returns: "SubagentStop"
 * ```
 *
 * @since 1.0.0
 * @public
 */
function getOtherHookType(lowerName: string): StackHook['type'] | null {
  if (lowerName.includes('user-prompt') || lowerName.includes('prompt')) {
    return 'UserPromptSubmit';
  }
  if (lowerName.includes('notification')) {
    return 'Notification';
  }
  if (lowerName.includes('subagent-stop') || lowerName.includes('subagentstop')) {
    return 'SubagentStop';
  }
  if (lowerName.includes('pre-compact') || lowerName.includes('precompact')) {
    return 'PreCompact';
  }
  if (lowerName.includes('stop')) {
    return 'Stop';
  }
  return null;
}

/**
 * Converts numeric risk score to categorical risk level
 *
 * Maps hook security scan scores to human-readable risk categories
 * to help users understand potential security implications.
 *
 * @param score - Numeric risk score from hook security scanning (0-100)
 * @returns Risk level category based on score thresholds
 *
 * @example
 * ```typescript
 * const risk1 = getRiskLevel(10);
 * // Returns: "safe" (score < 30)
 *
 * const risk2 = getRiskLevel(45);
 * // Returns: "warning" (30 <= score < 70)
 *
 * const risk3 = getRiskLevel(85);
 * // Returns: "dangerous" (score >= 70)
 * ```
 *
 * @since 1.0.0
 * @public
 */
function getRiskLevel(score: number): 'safe' | 'warning' | 'dangerous' {
  if (score >= 70) return 'dangerous';
  if (score >= 30) return 'warning';
  return 'safe';
}

/**
 * Checks if a command was installed from a stack in the registry
 *
 * Compares the command name and file path against all installed stacks
 * to determine if the command originated from a stack installation.
 *
 * @param name - The command name
 * @param filePath - The command file path
 * @param registry - The stack registry containing installed stack information
 * @returns True if the command was installed from a stack, false if it's local
 *
 * @since 1.0.0
 * @public
 */
function isInstalledCommand(name: string, filePath: string, registry: StackRegistry): boolean {
  for (const stackEntry of Object.values(registry.stacks)) {
    for (const command of stackEntry.components.commands) {
      if (command.name === name && command.path === filePath) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if an agent was installed from a stack in the registry
 *
 * Compares the agent name and file path against all installed stacks
 * to determine if the agent originated from a stack installation.
 *
 * @param name - The agent name
 * @param filePath - The agent file path
 * @param registry - The stack registry containing installed stack information
 * @returns True if the agent was installed from a stack, false if it's local
 *
 * @since 1.0.0
 * @public
 */
function isInstalledAgent(name: string, filePath: string, registry: StackRegistry): boolean {
  for (const stackEntry of Object.values(registry.stacks)) {
    for (const agent of stackEntry.components.agents) {
      if (agent.name === name && agent.path === filePath) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a hook was installed from a stack in the registry
 *
 * Compares the hook name and file path against all installed stacks
 * to determine if the hook originated from a stack installation.
 *
 * @param name - The hook name
 * @param filePath - The hook file path
 * @param registry - The stack registry containing installed stack information
 * @returns True if the hook was installed from a stack, false if it's local
 *
 * @since 1.0.0
 * @public
 */
function isInstalledHook(name: string, filePath: string, registry: StackRegistry): boolean {
  for (const stackEntry of Object.values(registry.stacks)) {
    for (const hook of stackEntry.components.hooks) {
      if (hook.name === name && hook.path === filePath) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if an MCP server was installed from a stack in the registry
 *
 * Compares the MCP server name against all installed stacks
 * to determine if the server originated from a stack installation.
 *
 * @param name - The MCP server name
 * @param registry - The stack registry containing installed stack information
 * @returns True if the MCP server was installed from a stack, false if it's local
 *
 * @since 1.0.0
 * @public
 */
function isInstalledMcpServer(name: string, registry: StackRegistry): boolean {
  for (const stackEntry of Object.values(registry.stacks)) {
    if (stackEntry.components.mcpServers.includes(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Collects and analyzes hook files from the local .claude/hooks directory
 *
 * Scans for JavaScript, TypeScript, and Python hook files, determines their
 * hook type from filename patterns, and performs security analysis to assess
 * risk levels before including them in the stack export.
 *
 * @returns Promise resolving to array of StackHook objects with security analysis
 *
 * @throws {Error} When hook file reading or security scanning fails
 *
 * @example
 * ```typescript
 * const hooks = await collectHooks();
 * // Returns: [{
 * //   name: "pre-tool-security",
 * //   type: "PreToolUse",
 * //   filePath: ".claude/hooks/pre-tool-security.js",
 * //   content: "...",
 * //   riskLevel: "safe",
 * //   scanResults: { riskScore: 10, ... }
 * // }]
 * ```
 *
 * @since 1.0.0
 * @public
 */
/**
 * Processes a single hook file and creates a StackHook object
 *
 * @param file - The hook filename
 * @param localHooksDir - The hooks directory path
 * @param fileService - File service instance
 * @param hookScanner - Hook scanner service instance
 * @returns Promise resolving to a StackHook object
 *
 * @since 1.0.0
 * @internal
 */
async function processHookFile(
  file: string,
  localHooksDir: string,
  fileService: FileService,
  hookScanner: HookScannerService
): Promise<StackHook> {
  const filePath = `${localHooksDir}/${file}`;
  const content = await fileService.readTextFile(filePath);
  const hookName = file.replace(/\.(js|ts|py)$/, '');

  // Determine hook type from filename
  const hookType = inferHookType(hookName);

  // Scan for security issues
  const scanResults = await hookScanner.scanHook(content, { filename: filePath });
  const riskLevel = getRiskLevel(scanResults.riskScore);

  return {
    name: hookName,
    type: hookType,
    filePath,
    content,
    riskLevel,
    scanResults,
  };
}

/**
 * Gets the registry for filtering installed components
 */
async function getRegistryForFiltering(
  includeInstalled: boolean,
  fileService: FileService
): Promise<StackRegistry | null> {
  if (includeInstalled) {
    return null;
  }
  const registryService = new StackRegistryService(fileService);
  return registryService.getRegistry();
}

/**
 * Processes hook files in the hooks directory
 */
async function processHookFiles(
  hookFiles: string[],
  options: {
    localHooksDir: string;
    registry: StackRegistry | null;
    includeInstalled: boolean;
    fileService: FileService;
    hookScanner: HookScannerService;
  }
): Promise<StackHook[]> {
  const hooks: StackHook[] = [];
  const { localHooksDir, registry, includeInstalled, fileService, hookScanner } = options;

  for (const file of hookFiles) {
    if (!file.endsWith('.js') && !file.endsWith('.ts') && !file.endsWith('.py')) {
      continue;
    }

    const filePath = `${localHooksDir}/${file}`;
    const hookName = file.replace(/\.(js|ts|py)$/, '');

    // Skip installed hooks if not including them
    if (!includeInstalled && registry && isInstalledHook(hookName, filePath, registry)) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const hook = await processHookFile(file, localHooksDir, fileService, hookScanner);
    hooks.push(hook);
  }

  return hooks;
}

async function collectHooks(includeInstalled: boolean = true): Promise<StackHook[]> {
  const fileService = new FileService();
  const hookScanner = new HookScannerService();
  const localHooksDir = '.claude/hooks';

  if (!(await fileService.exists(localHooksDir))) {
    return [];
  }

  const registry = await getRegistryForFiltering(includeInstalled, fileService);
  const hookFiles = await fileService.listFiles(localHooksDir);

  return processHookFiles(hookFiles, {
    localHooksDir,
    registry,
    includeInstalled,
    fileService,
    hookScanner,
  });
}

/**
 * Safely reads and parses a JSON settings file with error handling
 *
 * Attempts to read and parse a JSON file, returning an empty object
 * if the file doesn't exist or parsing fails. Provides user-friendly
 * warning messages for debugging.
 *
 * @param filePath - The absolute path to the settings file
 * @param description - Human-readable description for error messages
 * @returns Promise resolving to parsed JSON object or empty object on failure
 *
 * @example
 * ```typescript
 * const settings = await readSettingsFile('/path/to/settings.json', 'user settings');
 * // Returns: { key: "value" } or {} if file doesn't exist/invalid
 * ```
 *
 * @since 1.0.0
 * @public
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
 * Configuration structure for claude_desktop_config.json file
 *
 * Defines the expected structure of the Claude desktop configuration file,
 * specifically focusing on project-specific MCP server configurations.
 *
 * @interface ClaudeConfig
 * @since 1.0.0
 * @public
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

/**
 * Converts raw MCP server configuration to StackMcpServer array format
 *
 * Transforms the claude_desktop_config.json MCP server format into the
 * standardized StackMcpServer format used by the stack export system.
 *
 * @param mcpServers - Raw MCP server configurations from claude_desktop_config.json
 * @returns Array of StackMcpServer objects with normalized configuration
 *
 * @example
 * ```typescript
 * const rawConfig = {
 *   "filesystem": {
 *     "type": "stdio",
 *     "command": "npx",
 *     "args": ["@modelcontextprotocol/server-filesystem", "/path"]
 *   }
 * };
 *
 * const servers = convertMcpConfig(rawConfig);
 * // Returns: [{ name: "filesystem", type: "stdio", command: "npx", args: [...] }]
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * Collects MCP server configurations from the current project
 *
 * Reads the claude_desktop_config.json file and extracts MCP server
 * configurations specific to the current project directory.
 *
 * @returns Promise resolving to array of StackMcpServer objects for the current project
 *
 * @example
 * ```typescript
 * const mcpServers = await collectMcpServers();
 * // Returns: [{ name: "filesystem", type: "stdio", command: "npx", ... }]
 * ```
 *
 * @since 1.0.0
 * @public
 */
async function collectMcpServers(includeInstalled: boolean = true): Promise<StackMcpServer[]> {
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

    const servers = convertMcpConfig(projectConfig.mcpServers);

    // Filter out installed servers if not including them
    if (!includeInstalled) {
      const fileService = new FileService();
      const registryService = new StackRegistryService(fileService);
      const registry = await registryService.getRegistry();

      return servers.filter(server => !isInstalledMcpServer(server.name, registry));
    }

    return servers;
  } catch {
    return [];
  }
}

/**
 * Creates a base DeveloperStack object with minimal required properties
 *
 * Initializes a new stack object with metadata, empty component arrays,
 * and optional published stack continuity information for version tracking.
 *
 * @param options - Configuration object for stack creation
 * @param options.name - The stack name
 * @param options.description - The stack description
 * @param options.version - The stack version
 * @param options.currentDir - The current directory path for metadata
 * @param options.publishedMeta - Optional published stack metadata for continuity
 * @returns Promise resolving to initialized DeveloperStack object
 *
 * @example
 * ```typescript
 * const baseStack = await createBaseStack({
 *   name: 'my-stack',
 *   description: 'My development stack',
 *   version: '1.0.0',
 *   currentDir: '/path/to/project',
 *   publishedMeta: null
 * });
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * Populates a DeveloperStack with all available components from the file system
 *
 * Concurrently collects commands, agents, settings, MCP servers, and hooks
 * from both global and local directories, then assigns them to the stack object.
 *
 * @param stack - The DeveloperStack object to populate
 * @param includeGlobal - Whether to include global components from ~/.claude directories
 * @param includeHooks - Whether to scan and include hook files (defaults to true)
 * @returns Promise that resolves when all components are collected and assigned
 *
 * @throws {Error} When component collection fails due to file system or parsing errors
 *
 * @example
 * ```typescript
 * const stack = await createBaseStack(options);
 * await populateStackComponents(stack, true, true);
 * // stack now contains all commands, agents, settings, etc.
 * ```
 *
 * @since 1.0.0
 * @public
 */
async function populateStackComponents(
  stack: DeveloperStack,
  includeGlobal: boolean,
  includeHooks: boolean = true,
  includeInstalled: boolean = true
): Promise<void> {
  const [commandsMap, agentsMap, settings, mcpServers, hooks] = await Promise.all([
    collectCommands(includeGlobal, includeInstalled),
    collectAgents(includeGlobal, includeInstalled),
    collectSettings(includeGlobal, includeInstalled),
    collectMcpServers(includeInstalled),
    includeHooks ? collectHooks(includeInstalled) : Promise.resolve([]),
  ]);

  stack.commands = Array.from(commandsMap.values());
  stack.agents = Array.from(agentsMap.values());
  stack.settings = settings;
  stack.mcpServers = mcpServers;
  stack.hooks = hooks;
}

/**
 * Exports the current project directory as a complete development stack
 *
 * Orchestrates the full export process by generating metadata, creating a base stack,
 * and populating it with all available components based on the provided options.
 *
 * @param options - Export configuration options
 * @param options.name - Optional custom stack name (defaults to directory name)
 * @param options.description - Optional custom description (defaults to auto-generated)
 * @param options.includeGlobal - Whether to include global ~/.claude components
 * @param options.includeClaudeMd - Whether to include CLAUDE.md file (unused in current implementation)
 * @param options.stackVersion - Optional custom version (defaults to auto-generated)
 * @param options.hooks - Whether to include hook files (defaults to true)
 * @returns Promise resolving to complete DeveloperStack object ready for export
 *
 * @throws {Error} When metadata generation, stack creation, or component collection fails
 *
 * @example
 * ```typescript
 * const stack = await exportCurrentStack({
 *   name: 'my-project-stack',
 *   includeGlobal: true,
 *   stackVersion: '2.0.0'
 * });
 * // Returns: DeveloperStack with all components populated
 * ```
 *
 * @since 1.0.0
 * @public
 */
async function exportCurrentStack(options: {
  name?: string;
  description?: string;
  includeGlobal?: boolean;
  includeClaudeMd?: boolean;
  stackVersion?: string;
  hooks?: boolean;
  includeInstalled?: boolean;
}): Promise<DeveloperStack> {
  const currentDir = process.cwd();
  const { name, description, version } = await generateStackMetadata(options);
  const publishedMeta = await metadata.getPublishedStackMetadata(currentDir);

  const stack = await createBaseStack({ name, description, version, currentDir, publishedMeta });
  await populateStackComponents(
    stack,
    options.includeGlobal ?? false,
    options.hooks ?? true,
    options.includeInstalled ?? false
  );

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
 * @throws {Error} When stack export fails due to file system or validation errors
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
      hooks: options.hooks ?? true,
      includeInstalled: options.includeInstalled ?? false,
    });

    const outputFilename = resolveOutputFilename(filename);
    await writeStackToFile(stack, outputFilename);
    displayExportSuccess(stack, outputFilename);
  } catch (error) {
    handleExportError(error);
  }
}

/**
 * Resolves and normalizes the output filename for stack export
 *
 * Generates a default filename based on the current directory name if none provided,
 * and ensures the filename has a .json extension for proper file handling.
 *
 * @param filename - Optional custom filename for the exported stack
 * @returns Resolved filename with .json extension guaranteed
 *
 * @example
 * ```typescript
 * // With custom filename
 * const name1 = resolveOutputFilename('my-stack');
 * // Returns: "my-stack.json"
 *
 * // With filename already having extension
 * const name2 = resolveOutputFilename('my-stack.json');
 * // Returns: "my-stack.json"
 *
 * // Without filename (uses current directory)
 * const name3 = resolveOutputFilename();
 * // Returns: "project-name-stack.json" (where project-name is cwd basename)
 * ```
 *
 * @since 1.0.0
 * @public
 */
function resolveOutputFilename(filename?: string): string {
  let outputFilename = filename;
  if (!outputFilename) {
    const dirName = path.basename(process.cwd());
    outputFilename = `${dirName}-stack.json`;
  }

  return outputFilename.endsWith('.json') ? outputFilename : `${outputFilename}.json`;
}

/**
 * Writes a DeveloperStack object to a JSON file in the stacks directory
 *
 * Ensures the stacks directory exists and writes the stack data as formatted JSON
 * to the specified filename within the ~/.claude/stacks directory.
 *
 * @param stack - The DeveloperStack object to write to file
 * @param filename - The filename to save the stack as (will be placed in ~/.claude/stacks/)
 * @returns Promise that resolves when file write is complete
 *
 * @throws {Error} When directory creation or file writing fails
 *
 * @example
 * ```typescript
 * const stack = await exportCurrentStack(options);
 * await writeStackToFile(stack, 'my-project-stack.json');
 * // File saved to: ~/.claude/stacks/my-project-stack.json
 * ```
 *
 * @since 1.0.0
 * @public
 */
async function writeStackToFile(stack: DeveloperStack, filename: string): Promise<void> {
  const stacksDir = getStacksPath();
  await fs.ensureDir(stacksDir);
  const outputPath = path.join(stacksDir, filename);
  await fs.writeJson(outputPath, stack, { spaces: 2 });
}

/**
 * Displays formatted success message with export summary statistics
 *
 * Shows a user-friendly success message including file location, version,
 * and component counts to confirm successful stack export.
 *
 * @param stack - The exported DeveloperStack object for statistics
 * @param filename - The filename the stack was saved as
 *
 * @example
 * ```typescript
 * const stack = await exportCurrentStack(options);
 * await writeStackToFile(stack, filename);
 * displayExportSuccess(stack, filename);
 * // Outputs:
 * // ✅ Stack exported successfully!
 * //   File: ~/.claude/stacks/my-stack.json
 * //   Version: 1.0.0
 * //   Components: 15 items
 * //   MCP Servers: 3 items
 * ```
 *
 * @since 1.0.0
 * @public
 */
function displayExportSuccess(stack: DeveloperStack, filename: string): void {
  const totalComponents =
    (stack.commands?.length ?? 0) + (stack.agents?.length ?? 0) + (stack.mcpServers?.length ?? 0);

  console.log(ui.colorSuccess('✅ Stack exported successfully!'));
  console.log(ui.colorMeta(`  File: ~/.claude/stacks/${filename}`));
  console.log(ui.colorMeta(`  Version: ${stack.version}`));
  console.log(ui.colorMeta(`  Components: ${totalComponents} items`));
  console.log(ui.colorMeta(`  MCP Servers: ${stack.mcpServers?.length ?? 0} items`));
}

/**
 * Handles export errors with appropriate logging and process termination
 *
 * Displays formatted error messages and either throws (in test environment)
 * or exits the process (in production) based on NODE_ENV detection.
 *
 * @param error - The error that occurred during export
 * @returns Never returns (always throws or exits)
 *
 * @throws {Error} When in test environment, re-throws error for test handling
 *
 * @example
 * ```typescript
 * try {
 *   await exportCurrentStack(options);
 * } catch (error) {
 *   handleExportError(error);
 *   // In production: process.exit(1)
 *   // In test: throws Error with original message
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * Collection of utility functions for stack export functionality
 *
 * Provides access to all internal export helper functions for testing,
 * debugging, and modular usage. Contains functions for content extraction,
 * directory scanning, metadata generation, component collection, hook analysis,
 * and export workflow management.
 *
 * @namespace exportHelpers
 *
 * @property {Function} truncateDescription - Truncates description text to 80 characters with ellipsis
 * @property {Function} extractFromYamlFrontmatter - Extracts description from YAML frontmatter
 * @property {Function} extractFromFirstMeaningfulLine - Gets description from first non-empty line
 * @property {Function} extractDescriptionFromContent - Main function to extract description from content
 * @property {Function} scanDirectory - Recursively scans directory for stack components
 * @property {Function} generateStackMetadata - Creates metadata object for stack export
 * @property {Function} collectCommands - Gathers all command configurations from Claude files
 * @property {Function} collectAgents - Gathers all agent configurations from Claude files
 * @property {Function} collectSettings - Collects settings from configuration files
 * @property {Function} collectHooks - Analyzes and collects hook scripts with security scanning
 * @property {Function} readSettingsFile - Reads and parses settings files safely
 * @property {Function} convertMcpConfig - Converts MCP configuration to stack format
 * @property {Function} collectMcpServers - Gathers MCP server configurations
 * @property {Function} exportCurrentStack - Main function to export current directory as stack
 * @property {Function} resolveOutputFilename - Determines appropriate output filename
 * @property {Function} writeStackToFile - Writes stack data to JSON file
 * @property {Function} displayExportSuccess - Shows success message to user
 * @property {Function} handleExportError - Handles and displays export errors
 * @property {Function} inferHookType - Determines hook type from file content analysis
 * @property {Function} containsPostToolPattern - Checks for post-tool execution patterns
 * @property {Function} containsPreToolPattern - Checks for pre-tool execution patterns
 * @property {Function} getSessionHookType - Determines session-based hook type
 * @property {Function} getOtherHookType - Determines non-session hook type
 * @property {Function} getRiskLevel - Converts risk score to categorical risk level
 *
 * @example
 * ```typescript
 * import { exportHelpers } from './export.js';
 *
 * // Extract description from markdown content
 * const desc = exportHelpers.extractDescriptionFromContent(content);
 *
 * // Scan directory for commands
 * const commands = await exportHelpers.collectCommands(true);
 *
 * // Analyze hook security
 * const riskLevel = exportHelpers.getRiskLevel(scanScore);
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
  collectHooks,
  readSettingsFile,
  convertMcpConfig,
  collectMcpServers,
  exportCurrentStack,
  resolveOutputFilename,
  writeStackToFile,
  displayExportSuccess,
  handleExportError,
  // Hook-related helper functions
  inferHookType,
  containsPostToolPattern,
  containsPreToolPattern,
  getSessionHookType,
  getOtherHookType,
  getRiskLevel,
};
