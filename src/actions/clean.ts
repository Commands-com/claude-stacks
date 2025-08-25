import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

import type { CleanOptions } from '../types/index.js';
import { colors } from '../utils/colors.js';

async function checkProjectsExistence(
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
      console.log(colors.success(`✓ ${projectPath}`));
    } else {
      missingProjects.push(projectPath);
      console.log(colors.error(`✗ ${projectPath}`));
    }
  }

  return { missing: missingProjects, existing: existingProjects };
}

function calculateFileSavings(
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

interface ClaudeConfig {
  projects?: Record<string, unknown>;
  [key: string]: unknown;
}

async function validateClaudeConfig(
  claudeJsonPath: string
): Promise<{ config: ClaudeConfig; projects: string[] } | null> {
  if (!(await fs.pathExists(claudeJsonPath))) {
    console.log(colors.warning('No ~/.claude.json file found.'));
    return null;
  }

  const claudeConfig = (await fs.readJson(claudeJsonPath)) as ClaudeConfig;
  if (!claudeConfig.projects || typeof claudeConfig.projects !== 'object') {
    console.log(colors.info('No project configurations found in ~/.claude.json'));
    return null;
  }

  const allProjects = Object.keys(claudeConfig.projects);
  if (allProjects.length === 0) {
    console.log(colors.info('No projects configured in ~/.claude.json'));
    return null;
  }

  return { config: claudeConfig, projects: allProjects };
}

async function performCleanup(
  claudeJsonPath: string,
  claudeConfig: ClaudeConfig,
  missingProjects: string[],
  options: CleanOptions
): Promise<void> {
  if (options.dryRun) {
    console.log(colors.warning('\n🔍 DRY RUN - No changes made'));
    console.log(colors.meta('Run without --dry-run to actually remove these entries'));
    return;
  }

  const updatedConfig = { ...claudeConfig };
  if (updatedConfig.projects) {
    missingProjects.forEach(projectPath => {
      delete updatedConfig.projects![projectPath];
    });
  }

  const { oldSizeKB, newSizeKB, savedKB } = calculateFileSavings(claudeConfig, updatedConfig);

  await fs.writeJson(claudeJsonPath, updatedConfig, { spaces: 2 });

  console.log(colors.success('\n✅ Cleanup complete!'));
  console.log(colors.meta(`Removed ${missingProjects.length} project entries`));
  console.log(colors.meta(`File size: ${oldSizeKB} KB → ${newSizeKB} KB (saved ${savedKB} KB)`));
}

export async function cleanAction(options: CleanOptions = {}): Promise<void> {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');

  try {
    const validation = await validateClaudeConfig(claudeJsonPath);
    if (!validation) {
      return;
    }

    const { config: claudeConfig, projects: allProjects } = validation;

    console.log(colors.info('🧹 Cleaning up project configurations...'));
    if (options.dryRun) {
      console.log(colors.warning('DRY RUN - No changes will be made'));
    }
    console.log(colors.meta(`Checking ${allProjects.length} project paths...\n`));

    const { missing: missingProjects } = await checkProjectsExistence(allProjects);

    if (missingProjects.length === 0) {
      console.log(colors.success('\n✅ All project paths exist - no cleanup needed!'));
      return;
    }

    console.log(colors.warning(`\nFound ${missingProjects.length} missing project(s):`));
    missingProjects.forEach(p => console.log(colors.meta(`  • ${p}`)));

    await performCleanup(claudeJsonPath, claudeConfig, missingProjects, options);
  } catch (error) {
    console.error(
      colors.error('Clean failed:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
