import fs from 'fs-extra';
import { CLAUDE_JSON_PATH } from '../constants/paths.js';
import type { CleanOptions } from '../types/index.js';
import { BaseAction } from './BaseAction.js';

interface ClaudeConfig {
  projects?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Action class for cleaning up orphaned project configurations
 *
 * @since 1.2.3
 * @public
 */
export class CleanAction extends BaseAction {
  /**
   * Execute the clean action
   */
  async execute(options: CleanOptions = {}): Promise<void> {
    const claudeJsonPath = CLAUDE_JSON_PATH;

    try {
      const validation = await this.validateClaudeConfig(claudeJsonPath);
      if (!validation) {
        return;
      }

      const { config: claudeConfig, projects: allProjects } = validation;

      this.ui.info('🧹 Cleaning up project configurations...');
      if (options.dryRun) {
        this.ui.warning('DRY RUN - No changes will be made');
      }
      this.ui.meta(`Checking ${allProjects.length} project paths...\n`);

      const { missing: missingProjects } = await this.checkProjectsExistence(allProjects);

      if (missingProjects.length === 0) {
        this.ui.success('\n✅ All project paths exist - no cleanup needed!');
        return;
      }

      this.ui.warning(`\nFound ${missingProjects.length} missing project(s):`);
      missingProjects.forEach(p => this.ui.log(this.ui.colorMeta(`  • ${p}`)));

      await this.performCleanup(claudeJsonPath, claudeConfig, missingProjects, options);
    } catch (error) {
      this.handleError(error, 'Clean');
    }
  }

  private async checkProjectsExistence(
    projects: string[]
  ): Promise<{ missing: string[]; existing: string[] }> {
    const missingProjects: string[] = [];
    const existingProjects: string[] = [];

    const existenceChecks = await Promise.all(
      projects.map(async projectPath => ({
        projectPath,
        exists: await fs.pathExists(projectPath),
      }))
    );

    for (const { projectPath, exists } of existenceChecks) {
      if (exists) {
        existingProjects.push(projectPath);
        this.ui.log(this.ui.colorSuccess(`✓ ${projectPath}`));
      } else {
        missingProjects.push(projectPath);
        this.ui.log(this.ui.colorError(`✗ ${projectPath}`));
      }
    }

    return { missing: missingProjects, existing: existingProjects };
  }

  private calculateFileSavings(
    oldConfig: Record<string, unknown>,
    newConfig: Record<string, unknown>
  ): { oldSizeKB: number; newSizeKB: number; savedKB: number } {
    const oldSize = JSON.stringify(oldConfig, null, 2).length;
    const newSize = JSON.stringify(newConfig, null, 2).length;
    const savedBytes = oldSize - newSize;

    return {
      oldSizeKB: Math.round((oldSize / 1024) * 100) / 100,
      newSizeKB: Math.round((newSize / 1024) * 100) / 100,
      savedKB: Math.round((savedBytes / 1024) * 100) / 100,
    };
  }

  private async validateClaudeConfig(
    claudeJsonPath: string
  ): Promise<{ config: ClaudeConfig; projects: string[] } | null> {
    if (!(await fs.pathExists(claudeJsonPath))) {
      this.ui.warning('No ~/.claude.json file found.');
      return null;
    }

    const claudeConfig = (await fs.readJson(claudeJsonPath)) as ClaudeConfig;
    if (!claudeConfig.projects || typeof claudeConfig.projects !== 'object') {
      this.ui.info('No project configurations found in ~/.claude.json');
      return null;
    }

    const allProjects = Object.keys(claudeConfig.projects);
    if (allProjects.length === 0) {
      this.ui.info('No projects configured in ~/.claude.json');
      return null;
    }

    return { config: claudeConfig, projects: allProjects };
  }

  private async performCleanup(
    claudeJsonPath: string,
    claudeConfig: ClaudeConfig,
    missingProjects: string[],
    options: CleanOptions
  ): Promise<void> {
    if (options.dryRun) {
      this.ui.warning('\n🔍 DRY RUN - No changes made');
      this.ui.meta('Run without --dry-run to actually remove these entries');
      return;
    }

    const updatedConfig = { ...claudeConfig };
    if (updatedConfig.projects) {
      missingProjects.forEach(projectPath => {
        delete updatedConfig.projects![projectPath];
      });
    }

    const { oldSizeKB, newSizeKB, savedKB } = this.calculateFileSavings(
      claudeConfig,
      updatedConfig
    );

    await fs.writeJson(claudeJsonPath, updatedConfig, { spaces: 2 });

    this.ui.success('\n✅ Cleanup complete!');
    this.ui.meta(`Removed ${missingProjects.length} project entries`);
    this.ui.meta(`File size: ${oldSizeKB} KB → ${newSizeKB} KB (saved ${savedKB} KB)`);
  }
}

// Create instance for backward compatibility
const cleanActionInstance = new CleanAction();

/**
 * Cleans up orphaned project configurations from Claude.json
 *
 * @param options - Cleanup options including dry run mode
 *
 * @returns Promise that resolves when cleanup is complete
 *
 * @throws {@link Error} When configuration file is corrupted or file system errors occur
 *
 * @example
 * ```typescript
 * // Preview cleanup without making changes
 * await cleanAction({ dryRun: true });
 *
 * // Perform actual cleanup
 * await cleanAction();
 * ```
 *
 * @remarks
 * Scans ~/.claude.json for project configurations pointing to non-existent directories.
 * Removes orphaned entries to keep the configuration file clean and performant.
 * Provides detailed reporting of cleanup operations and space savings.
 *
 * @since 1.0.0
 * @public
 */
export async function cleanAction(options: CleanOptions = {}): Promise<void> {
  await cleanActionInstance.execute(options);
}
