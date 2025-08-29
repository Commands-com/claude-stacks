import fs from 'fs-extra';
import * as path from 'path';
import { getStacksPath } from '../constants/paths.js';
import { colors } from '../utils/colors.js';

import type { DeveloperStack } from '../types/index.js';
import { BaseAction } from './BaseAction.js';
import { showLocalStackDetailsAndActions } from '../ui/menus.js';
import { navigationService } from '../services/NavigationService.js';

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
    // Set navigation context
    navigationService.pushContext({ source: 'list' });

    try {
      // Keep showing the list until user exits
      let continueShowing = true;
      while (continueShowing) {
        // Refresh stack list on each iteration
        // eslint-disable-next-line no-await-in-loop
        const stacks = await this.listLocalStacks();

        if (stacks.length === 0) {
          this.ui.info('💾 Local Development Stacks\n');
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
    } finally {
      // Clean up navigation context
      navigationService.popContext();
    }
  }

  /**
   * Scans and loads all local development stacks from the filesystem
   *
   * Reads stack definition files from the user's ~/.claude/stacks directory,
   * validates them as DeveloperStack objects, and returns them sorted by
   * creation date. Gracefully handles missing directories and corrupted files.
   *
   * @returns Promise resolving to array of DeveloperStack objects sorted by creation date (newest first)
   *
   * @throws {Error} When filesystem access fails or JSON parsing encounters critical errors
   *
   * @example
   * ```typescript
   * const listAction = new ListAction();
   * const stacks = await listAction.listLocalStacks();
   *
   * // Process each stack
   * for (const stack of stacks) {
   *   console.log(`Stack: ${stack.name} (${stack.commands?.length} commands)`);
   * }
   * ```
   *
   * @remarks
   * This method performs several important operations:
   * - Checks for existence of stacks directory (~/.claude/stacks)
   * - Filters for .json files only to avoid processing other file types
   * - Reads all stack files in parallel for optimal performance
   * - Adds filePath property to each stack for file operations
   * - Skips corrupted or invalid stack files without throwing errors
   * - Sorts results by metadata.created_at timestamp (newest first)
   *
   * The method is designed to be resilient and won't fail due to individual
   * corrupted stack files, making it suitable for user-facing operations.
   *
   * @since 1.2.3
   * @public
   */
  public async listLocalStacks(): Promise<DeveloperStack[]> {
    const stacksDir = getStacksPath();

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
    this.ui.info('💾 Local Development Stacks\n');
    this.ui.meta(`Found ${stacks.length} local stack(s):\n`);

    // Show navigation breadcrumb if available
    const breadcrumb = navigationService.getBreadcrumb();
    if (breadcrumb) {
      this.ui.meta(`Navigation: ${breadcrumb}\n`);
    }

    stacks.forEach((stack, index) => {
      const filename = path.basename(stack.filePath ?? '');
      const components = this.calculateComponentCount(stack);
      const version = stack.version ?? '1.0.0';
      const stats = `v${version}, ${components} items`;
      this.ui.log(
        `${this.ui.colorNumber(`${index + 1}.`)} ${this.ui.colorStackName(stack.name)} ${this.ui.colorMeta(`(${filename})`)} ${this.ui.colorInfo(`- ${stats}`)}`
      );
    });

    return await this.handleUserSelection(stacks);
  }

  private calculateComponentCount(stack: DeveloperStack): number {
    return (
      (stack.commands?.length ?? 0) +
      (stack.agents?.length ?? 0) +
      (stack.mcpServers?.length ?? 0) +
      (stack.hooks?.length ?? 0)
    );
  }

  private async handleUserSelection(stacks: DeveloperStack[]): Promise<boolean> {
    const selection = await this.ui.readSingleChar(
      this.ui.colorMeta(`
Enter a number `) +
        colors.highlight(`(1-${stacks.length})`) +
        this.ui.colorMeta(', ') +
        colors.highlight('(b)') +
        this.ui.colorMeta('rowse published stacks, or press Enter to exit: ')
    );

    if (!selection || selection === '') {
      return false; // Exit
    }

    if (selection.toLowerCase() === 'b') {
      // Import and call browseAction
      const { browseAction } = await import('./browse.js');
      await browseAction();
      return true; // Continue showing list
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

/**
 * Standalone function to list local development stacks for backward compatibility
 *
 * Provides a simple functional interface for listing local stacks without requiring
 * instantiation of the ListAction class. Delegates to the ListAction class method
 * to maintain consistency and reduce code duplication.
 *
 * @returns Promise resolving to array of DeveloperStack objects sorted by creation date (newest first)
 *
 * @throws {Error} When filesystem access fails or JSON parsing encounters critical errors
 *
 * @example
 * ```typescript
 * // Simple functional usage
 * import { listLocalStacks } from './actions/list.js';
 *
 * const stacks = await listLocalStacks();
 * console.log(`Found ${stacks.length} local stacks`);
 *
 * // Process each stack
 * stacks.forEach(stack => {
 *   console.log(`- ${stack.name}: ${stack.description}`);
 * });
 * ```
 *
 * @remarks
 * This function exists for backward compatibility with existing code that expects
 * a standalone function rather than a class method. It creates a temporary
 * ListAction instance and delegates to its listLocalStacks method.
 *
 * For new code, consider using the ListAction class directly for better
 * performance when making multiple operations.
 *
 * @since 1.0.0
 * @public
 */
export async function listLocalStacks(): Promise<DeveloperStack[]> {
  const listActionInstance = new ListAction();
  return listActionInstance.listLocalStacks();
}

// Create instance for backward compatibility
const listActionInstance = new ListAction();

/**
 * Lists and manages local development stacks with interactive navigation
 *
 * Provides a comprehensive terminal-based interface for viewing, selecting, and managing
 * local Claude Code development stacks. Users can browse their exported stacks, view
 * detailed information, and navigate to published stack browser when needed.
 *
 * @returns Promise that resolves when user exits the list interface
 *
 * @throws {Error} When file system errors occur reading stack files from ~/.claude/stacks
 * @throws {Error} When navigation between list and browse actions fails
 * @throws {Error} When stack file parsing encounters critical JSON errors
 *
 * @example
 * ```typescript
 * // Show interactive local stack list
 * await listAction();
 *
 * // User can:
 * // - View numbered list of local stacks
 * // - Select a stack by number to see details
 * // - Type 'b' to browse published stacks
 * // - Press Enter to exit
 *
 * // Example output:
 * // 💾 Local Development Stacks
 * // Found 3 local stack(s):
 * // 1. my-tools (my-tools-v1.json) - v1.0.0, 5 items
 * // 2. api-stack (api-config.json) - v2.1.0, 3 items
 * ```
 *
 * @remarks
 * The list action maintains navigation context and integrates seamlessly with
 * the browse action for a complete stack management experience. It provides:
 *
 * - Interactive numbered stack selection
 * - Real-time stack information display (version, component count, file name)
 * - Integration with stack detail views and management operations
 * - Automatic list refresh after stack operations
 * - Helpful messages when no stacks are found with export guidance
 * - Navigation to published stack browser via 'b' option
 *
 * The interface is designed to be user-friendly with clear prompts and
 * consistent visual formatting using the UIService for colored output.
 *
 * @since 1.0.0
 * @public
 */
export async function listAction(): Promise<void> {
  await listActionInstance.execute();
}
