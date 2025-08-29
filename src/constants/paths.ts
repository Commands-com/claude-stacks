import * as path from 'path';
import * as os from 'os';

/**
 * Central configuration for all file paths used by Claude Stacks CLI
 *
 * This is the root directory where Claude Code stores all its configuration,
 * stacks, and user data. Located at ~/.claude on all platforms.
 *
 * @since 1.0.0
 * @public
 */
export const CLAUDE_CONFIG_PATH = path.join(os.homedir(), '.claude');

/**
 * Get the stacks directory path, with support for test environment override
 * @returns Path to the stacks directory
 */
function getStacksPath(): string {
  // Allow test environment to override the stacks path
  if (process.env.CLAUDE_STACKS_TEST_STACKS_PATH) {
    return process.env.CLAUDE_STACKS_TEST_STACKS_PATH;
  }
  return path.join(CLAUDE_CONFIG_PATH, 'stacks');
}

// Export function for dynamic resolution and static constant
export { getStacksPath };

/**
 * Path to the stacks directory where all installed stacks are stored
 *
 * This directory contains subdirectories for each installed stack,
 * with each stack's files and metadata organized within its own folder.
 * Supports test environment override via CLAUDE_STACKS_TEST_STACKS_PATH.
 *
 * @example /Users/username/.claude/stacks
 * @since 1.0.0
 * @public
 */
export const STACKS_PATH = getStacksPath();

/**
 * Path to the main Claude Code configuration file
 *
 * This JSON file stores global CLI configuration settings including
 * user preferences, default behaviors, and application state.
 *
 * @example /Users/username/.claude/config.json
 * @since 1.0.0
 * @public
 */
export const CONFIG_FILE = path.join(CLAUDE_CONFIG_PATH, 'config.json');

// Additional frequently used paths

/**
 * Path to the legacy Claude configuration file in user's home directory
 *
 * This file maintains compatibility with existing Claude installations
 * and may contain global Claude settings that predate Claude Code.
 * Located directly in the home directory rather than the .claude subdirectory.
 *
 * @example /Users/username/.claude.json
 * @since 1.0.0
 * @public
 */
export const CLAUDE_JSON_PATH = path.join(os.homedir(), '.claude.json');

/**
 * Path to the authentication token storage file
 *
 * This JSON file securely stores authentication tokens for Commands.com API access.
 * Contains encrypted or hashed credentials used for publishing and managing stacks.
 * Should be kept private and never committed to version control.
 *
 * @example /Users/username/.claude/.claude-stacks-auth.json
 * @since 1.0.0
 * @public
 */
export const AUTH_TOKEN_PATH = path.join(CLAUDE_CONFIG_PATH, '.claude-stacks-auth.json');

/**
 * Path to the CLI metadata and cache file
 *
 * This JSON file stores runtime metadata, cache data, and temporary state
 * used by the CLI for performance optimization and session management.
 * May include cached stack information, API responses, and usage statistics.
 *
 * @example /Users/username/.claude/.claude-stacks-meta.json
 * @since 1.0.0
 * @public
 */
export const METADATA_FILE_PATH = path.join(CLAUDE_CONFIG_PATH, '.claude-stacks-meta.json');

/**
 * Get the path to a specific stack directory
 *
 * @param stackName - Name of the stack directory
 * @returns Full path to the stack directory in ~/.claude/stacks/
 *
 * @example
 * ```typescript
 * const stackPath = getStackPath('my-project');
 * // Returns: /Users/username/.claude/stacks/my-project
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getStackPath(stackName: string): string {
  return path.join(getStacksPath(), stackName);
}

/**
 * Get the path to a stack's metadata file
 *
 * @param stackName - Name of the stack
 * @returns Full path to the stack's metadata JSON file
 *
 * @example
 * ```typescript
 * const metaPath = getStackMetadataPath('my-project');
 * // Returns: /Users/username/.claude/stacks/my-project/stack.json
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getStackMetadataPath(stackName: string): string {
  return path.join(getStackPath(stackName), 'stack.json');
}

/**
 * Get the path to a stack's files directory
 *
 * @param stackName - Name of the stack
 * @returns Full path to the stack's files directory
 *
 * @example
 * ```typescript
 * const filesPath = getStackFilesPath('my-project');
 * // Returns: /Users/username/.claude/stacks/my-project/files
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getStackFilesPath(stackName: string): string {
  return path.join(getStackPath(stackName), 'files');
}

/**
 * Get the path to the local .claude directory (project-specific)
 *
 * @param projectPath - Optional project path (defaults to current working directory)
 * @returns Full path to the local .claude directory
 *
 * @example
 * ```typescript
 * const localDir = getLocalClaudeDir();
 * // Returns: /current/project/.claude
 *
 * const customDir = getLocalClaudeDir('/path/to/project');
 * // Returns: /path/to/project/.claude
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getLocalClaudeDir(projectPath?: string): string {
  const basePath = projectPath ?? process.cwd();
  return path.join(basePath, '.claude');
}

/**
 * Get the path to local project commands directory
 *
 * @param projectPath - Optional project path (defaults to current working directory)
 * @returns Full path to the local commands directory
 *
 * @example
 * ```typescript
 * const commandsDir = getLocalCommandsDir();
 * // Returns: /current/project/.claude/commands
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getLocalCommandsDir(projectPath?: string): string {
  return path.join(getLocalClaudeDir(projectPath), 'commands');
}

/**
 * Get the path to local project hooks directory
 *
 * Hooks are custom scripts that can be executed at various points in the
 * Claude Code lifecycle (before/after installation, on stack activation, etc.).
 * Local hooks are project-specific and take precedence over global hooks.
 *
 * @param projectPath - Optional project path (defaults to current working directory)
 * @returns Full path to the local hooks directory
 *
 * @example
 * ```typescript
 * const hooksDir = getLocalHooksDir();
 * // Returns: /current/project/.claude/hooks
 *
 * const customHooks = getLocalHooksDir('/path/to/project');
 * // Returns: /path/to/project/.claude/hooks
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getLocalHooksDir(projectPath?: string): string {
  return path.join(getLocalClaudeDir(projectPath), 'hooks');
}

/**
 * Get the path to local project agents directory
 *
 * @param projectPath - Optional project path (defaults to current working directory)
 * @returns Full path to the local agents directory
 *
 * @example
 * ```typescript
 * const agentsDir = getLocalAgentsDir();
 * // Returns: /current/project/.claude/agents
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getLocalAgentsDir(projectPath?: string): string {
  return path.join(getLocalClaudeDir(projectPath), 'agents');
}

/**
 * Get the path to global CLAUDE.md
 *
 * @returns Full path to the global CLAUDE.md file
 *
 * @example
 * ```typescript
 * const globalClaudeMd = getGlobalClaudeMdPath();
 * // Returns: /Users/username/.claude/CLAUDE.md
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getGlobalClaudeMdPath(): string {
  return path.join(CLAUDE_CONFIG_PATH, 'CLAUDE.md');
}

/**
 * Get the path to local CLAUDE.md
 *
 * @param projectPath - Optional project path (defaults to current working directory)
 * @returns Full path to the local CLAUDE.md file
 *
 * @example
 * ```typescript
 * const localClaudeMd = getLocalClaudeMdPath();
 * // Returns: /current/project/.claude/CLAUDE.md
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getLocalClaudeMdPath(projectPath?: string): string {
  return path.join(getLocalClaudeDir(projectPath), 'CLAUDE.md');
}

/**
 * Get the path to local settings file
 *
 * @param projectPath - Optional project path (defaults to current working directory)
 * @returns Full path to the local settings.local.json file
 *
 * @example
 * ```typescript
 * const settingsPath = getLocalSettingsPath();
 * // Returns: /current/project/.claude/settings.local.json
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getLocalSettingsPath(projectPath?: string): string {
  return path.join(getLocalClaudeDir(projectPath), 'settings.local.json');
}

/**
 * Get the path to local main settings file
 *
 * @param projectPath - Optional project path (defaults to current working directory)
 * @returns Full path to the local settings.json file
 *
 * @example
 * ```typescript
 * const mainSettingsPath = getLocalMainSettingsPath();
 * // Returns: /current/project/.claude/settings.json
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getLocalMainSettingsPath(projectPath?: string): string {
  return path.join(getLocalClaudeDir(projectPath), 'settings.json');
}

/**
 * Get the path to global commands directory
 *
 * @returns Full path to the global commands directory
 *
 * @example
 * ```typescript
 * const globalCommands = getGlobalCommandsDir();
 * // Returns: /Users/username/.claude/commands
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getGlobalCommandsDir(): string {
  return path.join(CLAUDE_CONFIG_PATH, 'commands');
}

/**
 * Get the path to global hooks directory
 *
 * Global hooks are system-wide scripts that apply to all Claude Code operations
 * regardless of the current project. These hooks provide consistent behavior
 * across all stacks and projects, and serve as fallbacks when local hooks
 * are not available.
 *
 * @returns Full path to the global hooks directory
 *
 * @example
 * ```typescript
 * const globalHooks = getGlobalHooksDir();
 * // Returns: /Users/username/.claude/hooks
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getGlobalHooksDir(): string {
  return path.join(CLAUDE_CONFIG_PATH, 'hooks');
}

/**
 * Get the path to global agents directory
 *
 * @returns Full path to the global agents directory
 *
 * @example
 * ```typescript
 * const globalAgents = getGlobalAgentsDir();
 * // Returns: /Users/username/.claude/agents
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getGlobalAgentsDir(): string {
  return path.join(CLAUDE_CONFIG_PATH, 'agents');
}

/**
 * Get the path to global settings file
 *
 * @returns Full path to the global settings.json file
 *
 * @example
 * ```typescript
 * const globalSettings = getGlobalSettingsPath();
 * // Returns: /Users/username/.claude/settings.json
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getGlobalSettingsPath(): string {
  return path.join(CLAUDE_CONFIG_PATH, 'settings.json');
}
