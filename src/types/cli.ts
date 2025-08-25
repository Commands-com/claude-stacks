/**
 * Strong typing for CLI arguments and operations
 */

export interface BaseCommandArgs {
  force?: boolean;
  verbose?: boolean;
}

export interface CreateStackArgs extends BaseCommandArgs {
  name: string;
  description?: string;
  template?: string;
}

export interface PublishStackArgs extends BaseCommandArgs {
  stackName: string;
  version?: string;
  message?: string;
}

export interface InstallStackArgs extends BaseCommandArgs {
  stackIdentifier: string;
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
export interface ExportStackArgs extends BaseCommandArgs {
  stackName: string;
  outputPath: string;
  format?: 'zip' | 'tar';
}

export interface ListStacksArgs extends BaseCommandArgs {
  remote?: boolean;
  format?: 'table' | 'json';
}

export interface RenameStackArgs extends BaseCommandArgs {
  oldName: string;
  newName: string;
}

export interface DeleteStackArgs extends BaseCommandArgs {
  stackName: string;
  confirm?: boolean;
}

export interface BrowseStackArgs extends BaseCommandArgs {
  stackName: string;
}

export interface RestoreStackArgs extends BaseCommandArgs {
  backupPath: string;
  stackName?: string;
}

export interface CleanArgs extends BaseCommandArgs {
  all?: boolean;
  cache?: boolean;
  temp?: boolean;
}
