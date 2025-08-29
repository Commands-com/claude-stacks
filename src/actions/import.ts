import type { RestoreOptions } from '../types/index.js';
import { restoreAction } from './restore.js';

/**
 * Import a development stack from a stack file
 *
 * @param stackFilePath - Path to the stack file (absolute, relative, or filename in ~/.claude/stacks/)
 * @param options - Import options
 *
 * @returns Promise that resolves when import is complete
 *
 * @throws {Error} When stack file is not found or import fails
 *
 * @example
 * ```typescript
 * // Import from absolute path
 * await importAction('/path/to/my-stack.json');
 *
 * // Import from stacks directory (filename only)
 * await importAction('my-stack.json');
 *
 * // Import with options
 * await importAction('my-stack.json', {
 *   localOnly: true,
 *   overwrite: false
 * });
 * ```
 *
 * @remarks
 * Imports global commands, local commands, agents, MCP servers, settings,
 * and Claude.md files based on the provided options. Validates MCP server
 * dependencies before import.
 *
 * @since 1.4.4
 * @public
 */
export async function importAction(
  stackFilePath: string,
  options: RestoreOptions = {}
): Promise<void> {
  await restoreAction(stackFilePath, options);
}

/**
 * Configuration options for stack import operations
 *
 * @remarks
 * Type alias for RestoreOptions that provides better semantic naming for the
 * import command API. Controls import behavior including conflict resolution,
 * component scope, and installation tracking.
 *
 * @since 1.4.4
 * @public
 */
export type ImportOptions = RestoreOptions;
