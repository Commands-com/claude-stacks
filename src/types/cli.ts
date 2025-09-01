/**
 * Strong typing for CLI arguments and operations
 */

/**
 * Base interface for all CLI command arguments
 *
 * @remarks
 * Provides common command-line flags that are available across all CLI commands.
 * These flags control operation behavior and output verbosity. The force flag
 * bypasses interactive confirmations, while verbose enables detailed logging.
 * All command-specific interfaces extend this base to inherit common functionality.
 *
 * @example
 * ```typescript
 * // Basic usage with common flags
 * const args: BaseCommandArgs = {
 *   force: true,    // Skip confirmations
 *   verbose: true   // Enable detailed output
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface BaseCommandArgs {
  /**
   * Skip interactive confirmations and prompts
   *
   * @remarks
   * When true, commands will proceed without user confirmation for potentially
   * destructive operations like overwriting files, deleting stacks, or replacing
   * existing configurations. Use with caution in automated scripts.
   *
   * @default false
   */
  force?: boolean;

  /**
   * Enable verbose logging and detailed output
   *
   * @remarks
   * When true, commands will display additional information including debug
   * messages, API request details, file operations, and step-by-step progress.
   * Useful for troubleshooting and understanding command execution flow.
   *
   * @default false
   */
  verbose?: boolean;
}

/**
 * Command arguments for creating new development stacks
 *
 * @remarks
 * Extends base command arguments with creation-specific options. Used by the
 * CLI parser to validate and type create commands. The stack name must be unique
 * within the local workspace and follow naming conventions for CLI tools.
 * Template parameter allows initialization from predefined stack templates.
 *
 * @example
 * ```typescript
 * // Creating a basic stack
 * const args: CreateStackArgs = {
 *   name: 'my-project',
 *   description: 'A sample development stack',
 *   force: true
 * };
 *
 * // Creating from template
 * const templatedArgs: CreateStackArgs = {
 *   name: 'web-app',
 *   template: 'react-typescript',
 *   verbose: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CreateStackArgs extends BaseCommandArgs {
  /**
   * Name of the stack to create
   *
   * @remarks
   * Must be a valid identifier that will be used as the stack directory name
   * and internal reference. Should follow kebab-case convention and be unique
   * within the local workspace. The name cannot contain spaces or special
   * characters except hyphens and underscores.
   */
  name: string;

  /**
   * Optional human-readable description of the stack
   *
   * @remarks
   * Provides context about the stack's purpose and functionality. This description
   * is stored in stack metadata and displayed in list commands. Can include spaces
   * and special characters for better readability.
   *
   * @default undefined
   */
  description?: string;

  /**
   * Optional template identifier to initialize the stack
   *
   * @remarks
   * References a predefined stack template that provides initial structure,
   * configuration files, and boilerplate code. Template names are resolved
   * from the available template registry. If not specified, creates an empty stack.
   *
   * @default undefined
   */
  template?: string;
}

/**
 * Command arguments for publishing stacks to the remote registry
 *
 * @remarks
 * Extends base command arguments with publishing-specific options. Used by the
 * CLI parser to validate and type publish commands. Publishing makes stacks
 * available in the remote registry for installation by other users. Requires
 * authentication and proper stack validation before publication.
 *
 * @example
 * ```typescript
 * // Publishing with automatic version increment
 * const args: PublishStackArgs = {
 *   stackName: 'my-awesome-stack',
 *   message: 'Added new features and bug fixes',
 *   force: true
 * };
 *
 * // Publishing with specific version
 * const versionedArgs: PublishStackArgs = {
 *   stackName: 'web-components',
 *   version: '2.1.0',
 *   message: 'Major API improvements',
 *   verbose: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PublishStackArgs extends BaseCommandArgs {
  /**
   * Name of the local stack to publish
   *
   * @remarks
   * Must reference an existing local development stack. The stack name is used
   * to locate the stack directory and metadata. After publication, the stack
   * becomes available in the remote registry using the same name identifier.
   */
  stackName: string;

  /**
   * Optional semantic version for the published stack
   *
   * @remarks
   * Specifies the version to assign to the published stack. Must follow semantic
   * versioning (semver) format like '1.2.3' or '2.0.0-beta.1'. If not provided,
   * the system will automatically increment the version based on existing versions
   * in the registry or use '1.0.0' for first publication.
   *
   * @default Auto-incremented from existing versions
   */
  version?: string;

  /**
   * Optional commit message describing the changes
   *
   * @remarks
   * Provides a human-readable description of what changed in this version.
   * Similar to git commit messages, this helps users understand the evolution
   * of the stack. The message is stored with the published version and displayed
   * in version history and installation prompts.
   *
   * @default undefined
   */
  message?: string;
}

/**
 * Command arguments for installing stacks from the remote registry
 *
 * @remarks
 * Extends base command arguments with installation-specific options. Used by the
 * CLI parser to validate and type install commands. Installs published stacks
 * from the remote registry into the local workspace. Supports various stack
 * identifier formats including org/name, name@version, and URLs.
 *
 * @example
 * ```typescript
 * // Installing latest version of a stack
 * const args: InstallStackArgs = {
 *   stackIdentifier: 'awesome-org/web-components',
 *   targetPath: './my-projects/web-app',
 *   verbose: true
 * };
 *
 * // Installing specific version
 * const versionedArgs: InstallStackArgs = {
 *   stackIdentifier: 'react-utils@2.1.0',
 *   force: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface InstallStackArgs extends BaseCommandArgs {
  /**
   * Stack identifier for installation
   *
   * @remarks
   * Specifies which stack to install from the remote registry. Supports multiple
   * formats: 'org/stack-name' for latest version, 'stack-name@version' for specific
   * version, or full URLs for external repositories. The identifier is resolved
   * against the configured registry to locate and download the stack.
   */
  stackIdentifier: string;

  /**
   * Optional target directory path for installation
   *
   * @remarks
   * Specifies where to install the stack within the local workspace. If not
   * provided, uses the current working directory or a default location based on
   * stack configuration. The path can be relative or absolute, and parent
   * directories will be created if they don't exist.
   *
   * @default Current working directory or stack-specific default
   */
  targetPath?: string;
}

/**
 * Command arguments for exporting development stacks
 *
 * @remarks
 * Extends base command arguments with export-specific options.
 * Used by the CLI parser to validate and type export commands.
 *
 * @example
 * ```typescript
 * const args: ExportStackArgs = {
 *   stackName: 'my-project',
 *   outputPath: './exports/my-project.zip',
 *   format: 'zip'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
/**
 * Command arguments for exporting development stacks
 *
 * @remarks
 * Extends base command arguments with export-specific options. Used by the
 * CLI parser to validate and type export commands. Exports create portable
 * archive files containing stack configuration, metadata, and associated files.
 * Supports multiple archive formats for different deployment scenarios.
 *
 * @example
 * ```typescript
 * // Basic zip export
 * const args: ExportStackArgs = {
 *   stackName: 'my-project',
 *   outputPath: './exports/my-project.zip',
 *   format: 'zip',
 *   verbose: true
 * };
 *
 * // Tar archive export
 * const tarArgs: ExportStackArgs = {
 *   stackName: 'web-components',
 *   outputPath: '/tmp/exports/components.tar',
 *   format: 'tar',
 *   force: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ExportStackArgs extends BaseCommandArgs {
  /**
   * Name of the local stack to export
   *
   * @remarks
   * Must reference an existing local development stack. The stack name is used
   * to locate the stack directory, configuration files, and associated metadata
   * for inclusion in the export archive.
   */
  stackName: string;

  /**
   * Target path for the exported archive file
   *
   * @remarks
   * Specifies where to save the exported archive. The path should include the
   * desired filename and extension. Parent directories will be created if they
   * don't exist. The file extension should match the specified format.
   */
  outputPath: string;

  /**
   * Optional archive format for the export
   *
   * @remarks
   * Determines the compression and archive format for the exported stack.
   * 'zip' provides better cross-platform compatibility, while 'tar' offers
   * better compression and preserves Unix file permissions. If not specified,
   * format is inferred from the output path extension.
   *
   * @default Inferred from outputPath extension or 'zip'
   */
  format?: 'zip' | 'tar';
}

/**
 * Command arguments for listing available stacks
 *
 * @remarks
 * Extends base command arguments with listing-specific options. Used by the
 * CLI parser to validate and type list commands. Provides options to list
 * either local development stacks or remote registry stacks, with configurable
 * output formatting for different use cases including human-readable tables
 * and machine-readable JSON.
 *
 * @example
 * ```typescript
 * // List local stacks in table format
 * const args: ListStacksArgs = {
 *   remote: false,
 *   format: 'table',
 *   verbose: true
 * };
 *
 * // List remote registry stacks as JSON
 * const remoteArgs: ListStacksArgs = {
 *   remote: true,
 *   format: 'json',
 *   force: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ListStacksArgs extends BaseCommandArgs {
  /**
   * Whether to list remote registry stacks instead of local stacks
   *
   * @remarks
   * When true, queries the remote registry for published stacks available for
   * installation. When false or undefined, lists local development stacks in
   * the current workspace. Remote listing requires network access and may need
   * authentication for private registries.
   *
   * @default false (list local stacks)
   */
  remote?: boolean;

  /**
   * Output format for the stack listing
   *
   * @remarks
   * 'table' provides human-readable formatted output with columns for stack
   * information. 'json' provides machine-readable structured data suitable
   * for scripting and integration with other tools. Table format includes
   * visual formatting and colors when supported by the terminal.
   *
   * @default 'table'
   */
  format?: 'table' | 'json';
}

/**
 * Command arguments for renaming local development stacks
 *
 * @remarks
 * Extends base command arguments with renaming-specific options. Used by the
 * CLI parser to validate and type rename commands. Renaming updates both the
 * stack directory name and internal metadata references while preserving all
 * configuration and associated files. The operation is atomic and will fail
 * safely if conflicts are detected.
 *
 * @example
 * ```typescript
 * // Basic stack rename
 * const args: RenameStackArgs = {
 *   oldName: 'prototype-app',
 *   newName: 'production-ready-app',
 *   force: false
 * };
 *
 * // Force rename with verbose output
 * const forceArgs: RenameStackArgs = {
 *   oldName: 'temp-stack',
 *   newName: 'permanent-solution',
 *   force: true,
 *   verbose: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface RenameStackArgs extends BaseCommandArgs {
  /**
   * Current name of the stack to rename
   *
   * @remarks
   * Must reference an existing local development stack. The old name is used
   * to locate the stack directory and associated metadata files. If the stack
   * doesn't exist, the rename operation will fail with an appropriate error.
   */
  oldName: string;

  /**
   * New name to assign to the stack
   *
   * @remarks
   * Must be a valid identifier that will become the new stack directory name
   * and internal reference. Should follow kebab-case convention and be unique
   * within the local workspace. The new name cannot conflict with existing
   * stacks unless the force flag is used.
   */
  newName: string;
}

/**
 * Command arguments for deleting local development stacks
 *
 * @remarks
 * Extends base command arguments with deletion-specific options. Used by the
 * CLI parser to validate and type delete commands. Deletion permanently removes
 * the stack directory, configuration files, and all associated metadata. This
 * operation is destructive and cannot be undone without backups.
 *
 * @example
 * ```typescript
 * // Delete with confirmation prompt
 * const args: DeleteStackArgs = {
 *   stackName: 'obsolete-project',
 *   confirm: false,
 *   verbose: true
 * };
 *
 * // Force delete without confirmation
 * const forceArgs: DeleteStackArgs = {
 *   stackName: 'temp-stack',
 *   confirm: true,
 *   force: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface DeleteStackArgs extends BaseCommandArgs {
  /**
   * Name of the local stack to delete
   *
   * @remarks
   * Must reference an existing local development stack. The stack name is used
   * to locate the stack directory and associated metadata for permanent removal.
   * If the stack doesn't exist, the delete operation will fail with an error.
   */
  stackName: string;

  /**
   * Whether to skip confirmation prompt for deletion
   *
   * @remarks
   * When true, bypasses the interactive confirmation prompt that normally warns
   * users about the permanent nature of stack deletion. Should be used carefully
   * in automated scripts to prevent accidental data loss.
   *
   * @default false
   */
  confirm?: boolean;
}

/**
 * Command arguments for browsing and discovering stacks
 *
 * @remarks
 * Extends base command arguments with browsing-specific options. Used by the
 * CLI parser to validate and type browse commands. Opens an interactive interface
 * for exploring available stacks, viewing details, and performing stack operations
 * like installation and management from the Commands.com registry.
 *
 * @example
 * ```typescript
 * // Browse specific stack
 * const args: BrowseStackArgs = {
 *   stackName: 'awesome-org/web-components',
 *   verbose: true
 * };
 *
 * // General browsing without specific stack
 * const generalArgs: BrowseStackArgs = {
 *   stackName: '',
 *   force: false
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface BrowseStackArgs extends BaseCommandArgs {
  /**
   * Optional stack name or identifier to browse directly
   *
   * @remarks
   * When provided, opens the browse interface focused on the specified stack.
   * Can be a simple name, org/name format, or full identifier. If empty or
   * undefined, opens the general stack discovery interface for exploring
   * available stacks in the registry.
   *
   * @default undefined (general browsing mode)
   */
  stackName: string;
}

/**
 * Command arguments for restoring stacks from backup archives
 *
 * @remarks
 * Extends base command arguments with restoration-specific options. Used by the
 * CLI parser to validate and type restore commands. Restores stack configuration
 * and files from previously created backup archives, enabling recovery from data
 * loss or restoration to previous states.
 *
 * @example
 * ```typescript
 * // Restore from backup with original name
 * const args: RestoreStackArgs = {
 *   backupPath: './backups/my-project-backup.zip',
 *   verbose: true
 * };
 *
 * // Restore with custom name
 * const customArgs: RestoreStackArgs = {
 *   backupPath: './exports/web-components.tar',
 *   stackName: 'restored-components',
 *   force: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface RestoreStackArgs extends BaseCommandArgs {
  /**
   * Path to the backup archive file to restore from
   *
   * @remarks
   * Must be a valid path to a backup archive created by the export command or
   * another compatible backup tool. Supports common archive formats like ZIP
   * and TAR. The archive should contain stack configuration, metadata, and
   * associated files in the expected structure.
   */
  backupPath: string;

  /**
   * Optional custom name for the restored stack
   *
   * @remarks
   * When provided, the restored stack will use this name instead of the original
   * name stored in the backup archive. Useful for avoiding conflicts with
   * existing stacks or creating multiple instances from the same backup.
   * If not specified, uses the original stack name from the backup.
   *
   * @default Original name from backup archive
   */
  stackName?: string;
}

/**
 * Command arguments for cleaning up temporary files and caches
 *
 * @remarks
 * Extends base command arguments with cleanup-specific options. Used by the
 * CLI parser to validate and type clean commands. Provides selective cleanup
 * of temporary files, caches, and other non-essential data to free disk space
 * and resolve potential issues caused by stale data.
 *
 * @example
 * ```typescript
 * // Clean only cache files
 * const args: CleanArgs = {
 *   cache: true,
 *   verbose: true
 * };
 *
 * // Clean everything with confirmation
 * const allArgs: CleanArgs = {
 *   all: true,
 *   force: true
 * };
 *
 * // Clean specific categories
 * const selectiveArgs: CleanArgs = {
 *   cache: true,
 *   temp: true,
 *   force: false
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CleanArgs extends BaseCommandArgs {
  /**
   * Whether to clean all categories of temporary data
   *
   * @remarks
   * When true, performs a comprehensive cleanup including all cache files,
   * temporary data, and other non-essential files. This is equivalent to
   * enabling all other cleanup flags simultaneously. Use with caution as
   * this may require rebuilding caches on next operation.
   *
   * @default false
   */
  all?: boolean;

  /**
   * Whether to clean cache files and cached data
   *
   * @remarks
   * When true, removes cached API responses, downloaded stack metadata,
   * and other cached data used to improve performance. Cached data will
   * be regenerated on next access, which may cause slower initial operations.
   *
   * @default false
   */
  cache?: boolean;

  /**
   * Whether to clean temporary files and directories
   *
   * @remarks
   * When true, removes temporary files created during stack operations,
   * incomplete downloads, and temporary directories. This is generally safe
   * and helps recover disk space without affecting functionality.
   *
   * @default false
   */
  temp?: boolean;
}

/**
 * Command arguments for syncing MCP servers to external tools
 *
 * @remarks
 * Extends base command arguments with sync-specific options. Used by the
 * CLI parser to validate and type sync-mcp commands. Syncs MCP server
 * configurations from the current Claude project to other AI tools like
 * Codex and Gemini, converting between different configuration formats.
 *
 * @example
 * ```typescript
 * // Sync to both Codex and Gemini (overwrite mode)
 * const args: SyncMcpArgs = {
 *   verbose: true
 * };
 *
 * // Append to existing configurations
 * const appendArgs: SyncMcpArgs = {
 *   append: true,
 *   force: false
 * };
 *
 * // Sync only to Codex with dry run
 * const codexArgs: SyncMcpArgs = {
 *   codexOnly: true,
 *   dryRun: true,
 *   verbose: true
 * };
 * ```
 *
 * @since 1.4.9
 * @public
 */
export interface SyncMcpArgs extends BaseCommandArgs {
  /**
   * Append to existing MCP servers instead of overwriting
   *
   * @remarks
   * When true, adds MCP servers from Claude to existing configurations
   * without replacing them. When false (default), overwrites existing
   * MCP server configurations in target tools. Append mode preserves
   * existing configurations that aren't present in Claude.
   *
   * @default false (overwrite existing configurations)
   */
  append?: boolean;

  /**
   * Only sync to Codex configuration (~/.codex/config.toml)
   *
   * @remarks
   * When true, skips syncing to Gemini and only updates Codex config.
   * Cannot be used together with geminiOnly flag. Useful when only
   * working with OpenAI Codex and wanting to avoid touching other configs.
   *
   * @default false (sync to both Codex and Gemini)
   */
  codexOnly?: boolean;

  /**
   * Only sync to Gemini configuration (~/.gemini/settings.json)
   *
   * @remarks
   * When true, skips syncing to Codex and only updates Gemini config.
   * Cannot be used together with codexOnly flag. Useful when only
   * working with Google Gemini and wanting to avoid touching other configs.
   *
   * @default false (sync to both Codex and Gemini)
   */
  geminiOnly?: boolean;

  /**
   * Show what would be synced without making changes
   *
   * @remarks
   * When true, displays the planned sync operations without actually
   * modifying any configuration files. Useful for previewing changes
   * and understanding what the sync operation would do before committing.
   *
   * @default false (perform actual sync operations)
   */
  dryRun?: boolean;
}
