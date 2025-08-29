import type { RestoreOptions } from '../types/index.js';
import { BaseAction } from './BaseAction.js';

/**
 * Action class for restoring stacks from backup files
 *
 * @since 1.2.3
 * @public
 */
import * as path from 'path';

export class RestoreAction extends BaseAction {
  /**
   * Execute the restore action
   */
  async execute(stackFilePath: string, options: RestoreOptions = {}): Promise<void> {
    try {
      this.validateRequired(stackFilePath, 'stackFilePath');

      // Always generate tracking information for restore operations
      const stackName = path.basename(stackFilePath, '.json');
      const trackInstallation = {
        stackId: options.trackInstallation?.stackId ?? `local/${stackName}`,
        source: options.trackInstallation?.source ?? ('local-file' as const),
      };

      // Use the StackOperationService for the core logic
      await this.stackOperations.performRestore(stackFilePath, options, trackInstallation);
    } catch (error) {
      this.handleError(error, 'Restore');
    }
  }
}

// Create instance for backward compatibility
const restoreActionInstance = new RestoreAction();

/**
 * Restore a development stack from a stack file
 *
 * @param stackFilePath - Path to the stack file (absolute, relative, or filename in ~/.claude/stacks/)
 * @param options - Restore options
 *
 * @returns Promise that resolves when restoration is complete
 *
 * @throws {Error} When stack file is not found or restoration fails
 *
 * @example
 * ```typescript
 * // Restore from absolute path
 * await restoreAction('/path/to/my-stack.json');
 *
 * // Restore from stacks directory (filename only)
 * await restoreAction('my-stack.json');
 *
 * // Restore with options
 * await restoreAction('my-stack.json', {
 *   localOnly: true,
 *   overwrite: false
 * });
 * ```
 *
 * @remarks
 * Restores global commands, local commands, agents, MCP servers, settings,
 * and Claude.md files based on the provided options. Validates MCP server
 * dependencies before restoration.
 *
 * @since 1.0.0
 * @public
 */
export async function restoreAction(
  stackFilePath: string,
  options: RestoreOptions = {}
): Promise<void> {
  await restoreActionInstance.execute(stackFilePath, options);
}
