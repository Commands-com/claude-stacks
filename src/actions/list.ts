import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

import { DeveloperStack } from '../types';
import { colors } from '../utils/colors';
import { readSingleChar } from '../utils/input';
import { showLocalStackDetailsAndActions } from '../ui/menus';

export async function listLocalStacks(): Promise<DeveloperStack[]> {
  const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
  
  if (!(await fs.pathExists(stacksDir))) {
    return [];
  }
  
  const files = await fs.readdir(stacksDir);
  const stackFiles = files.filter(f => f.endsWith('.json'));
  
  const stacks: DeveloperStack[] = [];
  for (const file of stackFiles) {
    try {
      const stackPath = path.join(stacksDir, file);
      const stack = await fs.readJson(stackPath);
      stack.filePath = stackPath; // Add file path for reference
      stacks.push(stack);
    } catch (error) {
      // Skip invalid stack files
      continue;
    }
  }
  
  // Sort by creation date (newest first)
  return stacks.sort((a, b) => {
    const dateA = new Date(a.metadata?.created_at || 0);
    const dateB = new Date(b.metadata?.created_at || 0);
    return dateB.getTime() - dateA.getTime();
  });
}

async function showStackList(stacks: DeveloperStack[]): Promise<boolean> {
  console.log(colors.info('📋 Local Development Stacks\n'));
  console.log(colors.meta(`Found ${stacks.length} local stack(s):\n`));
  
  stacks.forEach((stack, index) => {
    const filename = path.basename(stack.filePath || '');
    const components = (stack.commands?.length || 0) + (stack.agents?.length || 0) + (stack.mcpServers?.length || 0);
    const version = stack.version || '1.0.0';
    const stats = `v${version}, ${components} items`;
    console.log(`${colors.number(`${index + 1}.`)} ${colors.stackName(stack.name)} ${colors.meta(`(${filename})`)} ${colors.info(`- ${stats}`)}`);
  });
  
  const selection = await readSingleChar(colors.meta('\nEnter a number (1-' + stacks.length + ') or press Enter to exit: '));
  
  if (!selection || selection === '') {
    return false; // Exit
  }
  
  const selectedIndex = parseInt(selection) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= stacks.length) {
    console.log(colors.error('Invalid selection. Please enter a number between 1 and ' + stacks.length));
    return true; // Continue showing list
  }
  
  const selectedStack = stacks[selectedIndex];
  await showLocalStackDetailsAndActions(selectedStack);
  return true; // Continue showing list
}

export async function listAction(): Promise<void> {
  try {
    // Keep showing the list until user exits
    let continueShowing = true;
    while (continueShowing) {
      // Refresh stack list on each iteration
      const stacks = await listLocalStacks();
      
      if (stacks.length === 0) {
        console.log(colors.info('📋 Local Development Stacks\n'));
        console.log(colors.warning('No stacks found in ~/.claude/stacks/'));
        console.log(colors.meta('Export your first stack with:'));
        console.log(colors.meta('  claude-stacks export'));
        return;
      }
      
      continueShowing = await showStackList(stacks);
      if (continueShowing) {
        // Clear screen and show list again
        console.log('\n' + '─'.repeat(50) + '\n');
      }
    }
    
  } catch (error) {
    console.error(colors.error('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}