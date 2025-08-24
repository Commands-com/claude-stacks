import fetch from 'node-fetch';

import { BrowseOptions } from '../types';
import { colors } from '../utils/colors';
import { readSingleChar } from '../utils/input';
import { authenticate } from '../utils/auth';
import { getApiConfig, isLocalDev } from '../utils/api';
import { showStackDetailsAndActions } from '../ui/menus';

async function showStackList(stacks: any[], accessToken: string | null): Promise<boolean> {
  console.log(`\n📋 Found ${colors.componentCount(stacks.length)} stack(s):\n`);
  
  stacks.forEach((stack: any, index: number) => {
    const components = (stack.commandCount || 0) + (stack.agentCount || 0) + (stack.mcpServerCount || 0);
    const stats = `${components} items, ${stack.installCount || 0} installs`;
    console.log(`${colors.number(`${index + 1}.`)} ${colors.stackName(stack.name)} ${colors.meta(`by ${stack.author || 'Unknown'}`)} ${colors.info(`(${stats})`)}`);
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
  await showStackDetailsAndActions(selectedStack, accessToken);
  return true; // Continue showing list
}

export async function browseAction(options: BrowseOptions = {}): Promise<void> {
  let accessToken: string | null = null;
  
  // Only authenticate if viewing private stacks
  if (options.myStacks) {
    accessToken = await authenticate();
  }
  
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.myStacks) params.set('myStacks', 'true');
    // Note: category not supported in current API, removing for now
    
    const headers: Record<string, string> = {
      'User-Agent': 'claude-stacks-cli/1.0.0'
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const apiConfig = getApiConfig();
    console.log(colors.info('🔍 Fetching stacks from Commands.com...'));
    if (isLocalDev()) {
      console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
    }
    
    const response = await fetch(`${apiConfig.baseUrl}/v1/stacks?${params.toString()}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody ? `\n${errorBody}` : '';
      } catch {}
      throw new Error(`Browse failed: ${response.status} ${response.statusText}${errorDetails}`);
    }
    
    const result = await response.json() as any;
    const stacks = result.stacks || [];
    
    if (stacks.length === 0) {
      console.log(colors.warning('No stacks found matching your criteria.'));
      return;
    }
    
    // Keep showing the list until user exits
    let continueShowing = true;
    while (continueShowing) {
      continueShowing = await showStackList(stacks, accessToken);
      if (continueShowing) {
        // Clear screen and show list again
        console.log('\n' + '─'.repeat(50) + '\n');
      }
    }
    
  } catch (error) {
    console.error(colors.error('Browse failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}