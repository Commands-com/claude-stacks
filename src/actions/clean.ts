import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

import { CleanOptions } from '../types/index.js';
import { colors } from '../utils/colors.js';

export async function cleanAction(options: CleanOptions = {}): Promise<void> {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  
  try {
    if (!await fs.pathExists(claudeJsonPath)) {
      console.log(colors.warning('No ~/.claude.json file found.'));
      return;
    }
    
    const claudeConfig = await fs.readJson(claudeJsonPath);
    if (!claudeConfig.projects || typeof claudeConfig.projects !== 'object') {
      console.log(colors.info('No project configurations found in ~/.claude.json'));
      return;
    }
    
    const allProjects = Object.keys(claudeConfig.projects);
    if (allProjects.length === 0) {
      console.log(colors.info('No projects configured in ~/.claude.json'));
      return;
    }
    
    console.log(colors.info('🧹 Cleaning up project configurations...'));
    if (options.dryRun) {
      console.log(colors.warning('DRY RUN - No changes will be made'));
    }
    console.log(colors.meta(`Checking ${allProjects.length} project paths...\n`));
    
    // Check which directories exist
    const missingProjects: string[] = [];
    const existingProjects: string[] = [];
    
    for (const projectPath of allProjects) {
      const exists = await fs.pathExists(projectPath);
      if (exists) {
        existingProjects.push(projectPath);
        console.log(colors.success(`✓ ${projectPath}`));
      } else {
        missingProjects.push(projectPath);
        console.log(colors.error(`✗ ${projectPath}`));
      }
    }
    
    if (missingProjects.length === 0) {
      console.log(colors.success('\n✅ All project paths exist - no cleanup needed!'));
      return;
    }
    
    console.log(colors.warning(`\nFound ${missingProjects.length} missing project(s):`));
    missingProjects.forEach(p => console.log(colors.meta(`  • ${p}`)));
    
    if (options.dryRun) {
      console.log(colors.warning('\n🔍 DRY RUN - No changes made'));
      console.log(colors.meta('Run without --dry-run to actually remove these entries'));
      return;
    }
    
    // Remove missing projects from config
    const updatedConfig = { ...claudeConfig };
    missingProjects.forEach(projectPath => {
      delete updatedConfig.projects[projectPath];
    });
    
    // Calculate file size savings
    const oldSize = JSON.stringify(claudeConfig, null, 2).length;
    const newSize = JSON.stringify(updatedConfig, null, 2).length;
    const savedBytes = oldSize - newSize;
    const oldSizeKB = Math.round(oldSize / 1024 * 100) / 100;
    const newSizeKB = Math.round(newSize / 1024 * 100) / 100;
    const savedKB = Math.round(savedBytes / 1024 * 100) / 100;
    
    // Write updated config
    await fs.writeJson(claudeJsonPath, updatedConfig, { spaces: 2 });
    
    console.log(colors.success('\n✅ Cleanup complete!'));
    console.log(colors.meta(`Removed ${missingProjects.length} project entries`));
    console.log(colors.meta(`File size: ${oldSizeKB} KB → ${newSizeKB} KB (saved ${savedKB} KB)`));
    
  } catch (error) {
    console.error(colors.error('Clean failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}