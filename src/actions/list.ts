import fs from 'fs-extra';
import * as path from 'path';
import { STACKS_PATH } from '../constants/paths.js';

import type { DeveloperStack } from '../types/index.js';
import { BaseAction } from './BaseAction.js';
import { showLocalStackDetailsAndActions } from '../ui/menus.js';

/**
 * Action class for listing and managing local stacks
 *
 * @since 1.2.3
 * @public
 */
export class ListAction extends BaseAction {
  /**
   * Execute the list action
   */
  async execute(): Promise<void> {
    try {
      // Keep showing the list until user exits
      let continueShowing = true;
      while (continueShowing) {
        // Refresh stack list on each iteration
        // eslint-disable-next-line no-await-in-loop
        const stacks = await this.listLocalStacks();

        if (stacks.length === 0) {
          this.ui.info('📋 Local Development Stacks\n');
          this.ui.warning('No stacks found in ~/.claude/stacks/');
          this.ui.meta('Export your first stack with:');
          this.ui.meta('  claude-stacks export');
          return;
        }

        // eslint-disable-next-line no-await-in-loop
        continueShowing = await this.showStackList(stacks);
        if (continueShowing) {
          // Clear screen and show list again
          console.log(`\n${'─'.repeat(50)}\n`);
        }
      }
    } catch (error) {
      this.handleError(error, 'List');
    }
  }

  public async listLocalStacks(): Promise<DeveloperStack[]> {
    const stacksDir = STACKS_PATH;

    if (!(await fs.pathExists(stacksDir))) {
      return [];
    }

    const files = await fs.readdir(stacksDir);
    const stackFiles = files.filter(f => f.endsWith('.json'));

    // Read all stack files in parallel
    const stackPromises = stackFiles.map(async file => {
      try {
        const stackPath = path.join(stacksDir, file);
        const stack = (await fs.readJson(stackPath)) as DeveloperStack;
        stack.filePath = stackPath; // Add file path for reference
        return stack;
      } catch {
        // Skip invalid stack files
        return null;
      }
    });

    const stackResults = await Promise.all(stackPromises);
    const stacks: DeveloperStack[] = stackResults.filter(
      (stack): stack is DeveloperStack => stack !== null
    );

    // Sort by creation date (newest first)
    return stacks.sort((a, b) => {
      const dateA = new Date(a.metadata?.created_at ?? 0);
      const dateB = new Date(b.metadata?.created_at ?? 0);
      return dateB.getTime() - dateA.getTime();
    });
  }

  private async showStackList(stacks: DeveloperStack[]): Promise<boolean> {
    this.ui.info('📋 Local Development Stacks\n');
    this.ui.meta(`Found ${stacks.length} local stack(s):\n`);

    stacks.forEach((stack, index) => {
      const filename = path.basename(stack.filePath ?? '');
      const components =
        (stack.commands?.length ?? 0) +
        (stack.agents?.length ?? 0) +
        (stack.mcpServers?.length ?? 0);
      const version = stack.version ?? '1.0.0';
      const stats = `v${version}, ${components} items`;
      this.ui.log(
        `${this.ui.colorNumber(`${index + 1}.`)} ${this.ui.colorStackName(stack.name)} ${this.ui.colorMeta(`(${filename})`)} ${this.ui.colorInfo(`- ${stats}`)}`
      );
    });

    const selection = await this.ui.readSingleChar(
      this.ui.colorMeta(`\nEnter a number (1-${stacks.length}) or press Enter to exit: `)
    );

    if (!selection || selection === '') {
      return false; // Exit
    }

    const selectedIndex = parseInt(selection) - 1;
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= stacks.length) {
      this.ui.error(`Invalid selection. Please enter a number between 1 and ${stacks.length}`);
      return true; // Continue showing list
    }

    const selectedStack = stacks[selectedIndex];
    await showLocalStackDetailsAndActions(selectedStack);
    return true; // Continue showing list
  }
}

// Export the standalone function that was used in list.ts for other parts of the codebase
export async function listLocalStacks(): Promise<DeveloperStack[]> {
  const listActionInstance = new ListAction();
  return listActionInstance.listLocalStacks();
}

// Create instance for backward compatibility
const listActionInstance = new ListAction();

/**
 * Lists and manages local development stacks with interactive navigation
 *
 * @returns Promise that resolves when user exits the list interface
 *
 * @throws {@link Error} When file system errors occur reading stack files
 *
 * @example
 * ```typescript
 * // Show interactive stack list
 * await listAction();
 * // User can browse, select, and manage stacks
 * ```
 *
 * @remarks
 * Provides an interactive terminal interface for browsing local stacks.
 * Automatically refreshes the list after stack operations.
 * Shows helpful messages when no stacks are found.
 *
 * @since 1.0.0
 * @public
 */
export async function listAction(): Promise<void> {
  await listActionInstance.execute();
}
