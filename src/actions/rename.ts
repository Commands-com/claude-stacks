import fs from 'fs-extra';
import * as path from 'path';
import { getStacksPath } from '../constants/paths.js';
import fetch from 'node-fetch';

import type { DeveloperStack } from '../types/index.js';
import { BaseAction } from './BaseAction.js';

interface RenameApiResponse {
  organizationUsername: string;
  name: string;
  newUrl: string;
  oldUrl: string;
}

/**
 * Action class for renaming stacks on Commands.com
 *
 * @since 1.2.3
 * @public
 */
export class RenameAction extends BaseAction {
  /**
   * Execute the rename action
   */
  async execute(newTitle: string): Promise<void> {
    try {
      this.validateRequired(newTitle, 'newTitle');

      const { stack, stackPath, org, oldName, currentDir } = await this.loadPublishedStack();

      this.ui.info(`🏷️  Renaming stack "${stack.name}" → "${newTitle}"`);
      this.ui.meta(`   Current URL: https://commands.com/stacks/${org}/${oldName}`);
      this.displayApiEnvironment();

      const accessToken = await this.auth.authenticate();
      const result = await this.callRenameApi(accessToken, org, oldName, newTitle);

      // Update local stack file
      stack.name = newTitle; // Update the display name
      if (stack.metadata) {
        stack.metadata.published_stack_id = `${result.organizationUsername}/${result.name}`;
        stack.metadata.updated_at = new Date().toISOString();
      }

      await fs.writeJson(stackPath, stack, { spaces: 2 });

      // Update global metadata
      await this.metadata.savePublishedStackMetadata(currentDir, {
        stack_id: `${result.organizationUsername}/${result.name}`,
        stack_name: newTitle,
        last_published_version: stack.version ?? '1.0.0',
        last_published_at: new Date().toISOString(),
      });

      this.ui.success('✅ Stack renamed successfully!');
      this.ui.meta(`  New title: ${newTitle}`);
      this.ui.meta(`  New URL: ${result.newUrl}`);
      if (result.oldUrl !== result.newUrl) {
        this.ui.meta(`  Old URL: ${result.oldUrl} (will redirect)`);
      }
    } catch (error) {
      this.handleError(error, 'Rename');
    }
  }

  private async loadPublishedStack(): Promise<{
    stack: DeveloperStack;
    stackPath: string;
    org: string;
    oldName: string;
    currentDir: string;
  }> {
    const currentDir = process.cwd();
    const stacksDir = getStacksPath();
    const defaultStackFile = `${path.basename(currentDir)}-stack.json`;
    const stackPath = path.join(stacksDir, defaultStackFile);

    if (!(await fs.pathExists(stackPath))) {
      throw new Error(
        `Stack file not found: ${stackPath}. Make sure you're in the correct directory and have exported a stack.`
      );
    }

    const stack = (await fs.readJson(stackPath)) as DeveloperStack;

    if (!stack.metadata?.published_stack_id) {
      throw new Error('Stack is not published. Use "claude-stacks publish" first.');
    }

    const [org, oldName] = stack.metadata.published_stack_id.split('/');
    if (!org || !oldName) {
      throw new Error('Invalid published stack ID format. Expected "org/name".');
    }

    return { stack, stackPath, org, oldName, currentDir };
  }

  private async callRenameApi(
    accessToken: string,
    org: string,
    oldName: string,
    newTitle: string
  ): Promise<RenameApiResponse> {
    const response = await fetch(`${this.api.getBaseUrl()}/v1/stacks/${org}/${oldName}/rename`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'claude-stacks-cli/1.0.0',
      },
      body: JSON.stringify({
        title: newTitle,
      }),
    });

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody ? `\n${errorBody}` : '';
      } catch {
        // Ignore error parsing response body
      }
      throw new Error(`Rename failed: ${response.status} ${response.statusText}${errorDetails}`);
    }

    const result = (await response.json()) as unknown;

    if (typeof result === 'object' && result !== null) {
      const resultObj = result as Record<string, unknown>;
      return {
        organizationUsername: String(resultObj.organizationUsername ?? ''),
        name: String(resultObj.name ?? ''),
        newUrl: String(resultObj.newUrl ?? ''),
        oldUrl: String(resultObj.oldUrl ?? ''),
      };
    }

    throw new Error('Invalid API response format');
  }
}

// Create instance for backward compatibility
const renameActionInstance = new RenameAction();

/**
 * Renames a published development stack on Commands.com
 *
 * @param newTitle - New title for the published stack
 *
 * @returns Promise that resolves when rename is complete
 *
 * @throws {@link Error} When stack is not published, authentication fails, or API errors occur
 *
 * @example
 * ```typescript
 * // Rename published stack
 * await renameAction('My Awesome Stack v2');
 * ```
 *
 * @remarks
 * Only works with previously published stacks that have a published_stack_id.
 * Updates both remote stack title and local metadata files.
 * Maintains URL redirects from old to new stack names.
 *
 * @since 1.0.0
 * @public
 */
export async function renameAction(newTitle: string): Promise<void> {
  await renameActionInstance.execute(newTitle);
}
