import fetch from 'node-fetch';

import { BaseAction } from './BaseAction.js';

/**
 * Action class for deleting stacks from Commands.com
 *
 * @since 1.2.3
 * @public
 */
export class DeleteAction extends BaseAction {
  /**
   * Execute the delete action
   */
  async execute(stackId: string): Promise<void> {
    try {
      this.validateRequired(stackId, 'stackId');

      this.ui.warning(`🗑️ Deleting stack ${stackId}...`);
      this.displayApiEnvironment();

      const accessToken = await this.auth.authenticate();
      const { org, name } = this.validateStackId(stackId);

      await this.performStackDeletion(org, name, accessToken);
      await this.cleanupLocalMetadata(org, name);

      const finalStackId = `${org}/${name}`;
      this.ui.success(`✅ Stack deleted successfully!`);
      this.ui.meta(`   Stack ID: ${finalStackId}`);
    } catch (error) {
      this.handleError(error, 'Delete');
    }
  }

  private validateStackId(stackId: string): { org: string; name: string } {
    if (!stackId.includes('/')) {
      throw new Error(
        `Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: ${stackId}`
      );
    }

    const [org, name] = stackId.split('/');
    if (!org || !name) {
      throw new Error(
        `Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: ${stackId}`
      );
    }

    return { org, name };
  }

  private async performStackDeletion(
    org: string,
    name: string,
    accessToken: string
  ): Promise<void> {
    const response = await fetch(`${this.api.getBaseUrl()}/v1/stacks/${org}/${name}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'claude-stacks-cli/1.0.0',
      },
    });

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody ? `\n${errorBody}` : '';
      } catch {
        // Ignore error parsing response body
      }
      throw new Error(
        `Failed to delete stack: ${response.status} ${response.statusText}${errorDetails}`
      );
    }
  }

  private async cleanupLocalMetadata(org: string, name: string): Promise<void> {
    const finalStackId = `${org}/${name}`;
    const stackMetadata = await this.metadata.findStackByStackId(finalStackId);
    if (stackMetadata) {
      await this.metadata.removePublishedStackMetadata(stackMetadata.projectPath);
      this.ui.meta(`   Cleared local metadata for ${stackMetadata.projectPath}`);
    }
  }
}

// Create instance for backward compatibility
const deleteActionInstance = new DeleteAction();

/**
 * Delete a stack from Commands.com
 *
 * @param stackId - Stack identifier in org/name format
 *
 * @returns Promise that resolves when deletion is complete
 *
 * @throws {Error} When stack is not found or deletion fails
 *
 * @example
 * ```typescript
 * // Delete a stack
 * await deleteAction('org/stack-name');
 * ```
 *
 * @remarks
 * Removes stack from Commands.com and cleans up local metadata.
 * This operation cannot be undone.
 *
 * @since 1.0.0
 * @public
 */
export async function deleteAction(stackId: string): Promise<void> {
  await deleteActionInstance.execute(stackId);
}
