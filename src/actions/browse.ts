import fetch from 'node-fetch';

import { BrowseOptions } from '../types';
import { colors } from '../utils/colors';
import { readSingleChar } from '../utils/input';
import { authenticate } from '../utils/auth';
import { getApiConfig, isLocalDev } from '../utils/api';
import { installAction } from './install';
import { deleteAction } from './delete';
import open from 'open';

interface BrowseState {
  currentUser?: string;
  accessToken?: string | null;
}

// Helper function to determine stack path from API response
function getStackPath(stack: any): string {
  // API returns author (org) and name (already slugified)
  if (stack.author && stack.name) {
    return `${stack.author}/${stack.name}`;
  }
  
  return 'unknown-stack';
}

async function fetchStacks(options: { search?: string; myStacks?: boolean } = {}, accessToken: string | null): Promise<any[]> {
  const params = new URLSearchParams();
  if (options.search) params.set('search', options.search);
  if (options.myStacks) params.set('myStacks', 'true');
  
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
  return result.stacks || [];
}

async function showMainBrowseMenu(): Promise<string> {
  console.log('\n' + colors.info('🌐 Browse Development Stacks'));
  console.log(colors.meta('Discover and manage Claude Code configurations from the community\n'));
  
  console.log(colors.stackName('📚 Browse Options:'));
  console.log(`  ${colors.highlight('(a)')} ${colors.info('All Stacks')} - ${colors.description('Discover public stacks from the community')}`);
  console.log(`  ${colors.highlight('(m)')} ${colors.info('My Stacks')} - ${colors.description('Manage your published stacks')}`);
  console.log(`  ${colors.highlight('(s)')} ${colors.info('Search')} - ${colors.description('Find stacks by keyword or functionality')}`);
  console.log(`  ${colors.highlight('(q)')} ${colors.meta('Quit')} - ${colors.description('Return to main menu')}`);
  
  return await readSingleChar(colors.stackName('\nWhat would you like to do? '));
}

async function showStackList(stacks: any[], state: BrowseState, title: string, isMyStacks: boolean = false): Promise<string | null> {
  if (stacks.length === 0) {
    console.log(colors.warning('\nNo stacks found matching your criteria.'));
    console.log('Press any key to continue...');
    await readSingleChar('');
    return null;
  }

  console.log(`\n📋 ${title}`);
  console.log(colors.meta(`Found ${stacks.length} stack(s):\n`));
  
  stacks.forEach((stack: any, index: number) => {
    const components = (stack.commandCount || 0) + (stack.agentCount || 0) + (stack.mcpServerCount || 0);
    const version = stack.version ? `v${stack.version}, ` : '';
    const stats = `${version}${components} items, ${stack.installCount || 0} installs`;
    const ownershipIndicator = isMyStacks ? '★ ' : '';
    console.log(`${colors.number(`${index + 1}.`)} ${ownershipIndicator}${colors.stackName(stack.name)} ${colors.meta(`by ${stack.author || 'Unknown'}`)} ${colors.info(`(${stats})`)}`);
  });
  
  const selection = await readSingleChar(colors.meta('\nEnter a number (1-' + stacks.length + ') or (b)ack: '));
  
  if (selection === 'b' || selection === '') {
    return null; // Go back to main menu
  }
  
  const selectedIndex = parseInt(selection) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= stacks.length) {
    console.log(colors.error('Invalid selection. Please enter a number between 1 and ' + stacks.length));
    return 'retry'; // Retry current list
  }
  
  const selectedStack = stacks[selectedIndex];
  return await showStackActions(selectedStack, state, isMyStacks);
}

async function showStackActions(stack: any, state: BrowseState, isMyStack: boolean = false): Promise<string | null> {
  // Show detailed stack information
  console.log(`\n📦 ${colors.stackName(stack.name)}`);
  console.log(`${colors.info('Description:')} ${colors.description(stack.description)}`);
  console.log(`${colors.info('Author:')} ${colors.author(stack.author || 'Unknown')}`);
  if (stack.version) {
    console.log(`${colors.info('Version:')} ${colors.meta(stack.version)}`);
  }
  
  const totalComponents = (stack.commandCount || 0) + (stack.agentCount || 0) + (stack.mcpServerCount || 0);
  console.log(`${colors.info('Components:')} ${colors.componentCount(totalComponents)} items`);
  console.log(`   ${colors.bullet('•')} Commands: ${colors.componentCount(stack.commandCount || 0)}`);
  console.log(`   ${colors.bullet('•')} Agents: ${colors.componentCount(stack.agentCount || 0)}`);
  console.log(`   ${colors.bullet('•')} MCP Servers: ${colors.componentCount(stack.mcpServerCount || 0)}`);
  
  console.log(`${colors.info('Stats:')} ${colors.meta(`${stack.viewCount || 0} views, ${stack.installCount || 0} installs`)}`);
  console.log(`${colors.info('Created:')} ${colors.meta(stack.createdAt ? new Date(stack.createdAt).toLocaleDateString() : 'Unknown')}`);
  
  // Show visibility for owned stacks
  if (isMyStack) {
    const visibility = stack.public ? 'Public (discoverable by others)' : 'Private (only visible to you)';
    console.log(`${colors.info('Visibility:')} ${colors.meta(visibility)}`);
  }
  
  // Determine stack identifier from available data
  const stackPath = getStackPath(stack);
  
  
  console.log(`${colors.info('Stack ID:')} ${colors.id(stackPath)}`);
  console.log(`${colors.info('URL:')} ${colors.url(`https://commands.com/stacks/${stackPath}`)}`);
  
  // Show action menu with single letter shortcuts
  let actionPrompt = `\nActions: ${colors.highlight('(i)')}nstall, ${colors.highlight('(v)')}iew in browser`;
  
  // Show additional options for owned stacks
  if (isMyStack && state.accessToken) {
    const visibilityAction = stack.public ? `${colors.highlight('(m)')}ake private` : `${colors.highlight('(m)')}ake public`;
    actionPrompt += `, ${colors.highlight('(r)')}ename, ${visibilityAction}, ${colors.highlight('(d)')}elete`;
  }
  actionPrompt += `, ${colors.highlight('(b)')}ack`;
  console.log(actionPrompt);
  
  const action = await readSingleChar(colors.meta('Choose an action: '));
  
  switch (action.toLowerCase()) {
    case 'i':
      console.log(colors.info('\n📦 Installing stack...'));
      try {
        await installAction(getStackPath(stack), {});
        console.log('\nPress any key to continue...');
        await readSingleChar('');
      } catch (error) {
        console.error(colors.error('Install failed:'), error instanceof Error ? error.message : String(error));
        console.log('\nPress any key to continue...');
        await readSingleChar('');
      }
      return 'retry'; // Stay on same stack
      
    case 'v': {
      const stackPath = getStackPath(stack);
      const url = `https://commands.com/stacks/${stackPath}`;
      console.log(colors.info(`\n🌐 Opening ${url}...`));
      try {
        await open(url);
        console.log(colors.success('✅ Opened in browser!'));
      } catch (error) {
        console.error(colors.error('Failed to open browser:'), error instanceof Error ? error.message : String(error));
        console.log(colors.meta(`Please open manually: ${url}`));
      }
      console.log('\nPress any key to continue...');
      await readSingleChar('');
      return 'retry'; // Stay on same stack
    }
      
    case 'm':
      // Make public/private toggle
      if (isMyStack && state.accessToken) {
        if (stack.public) {
          // Currently public, offer to make private
          const confirmAction = await readSingleChar(colors.warning(`\nMake "${stack.name}" private? It will no longer be discoverable by others. (y/N): `));
          if (confirmAction.toLowerCase() === 'y') {
            try {
              console.log(colors.info('\n🔒 Making stack private...'));
              
              const apiConfig = getApiConfig();
              const stackPath = getStackPath(stack);
              const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${stackPath}`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${state.accessToken}`,
                  'Content-Type': 'application/json',
                  'User-Agent': 'claude-stacks-cli/1.0.0'
                },
                body: JSON.stringify({ public: false })
              });

              if (!response.ok) {
                let errorDetails = '';
                try {
                  const errorBody = await response.text();
                  errorDetails = errorBody ? `\n${errorBody}` : '';
                } catch {}
                throw new Error(`Failed to update visibility: ${response.status} ${response.statusText}${errorDetails}`);
              }

              const result = await response.json() as any;
              stack.public = result.public; // Update local state
              
              console.log(colors.success('✅ Stack is now private!'));
              console.log(colors.meta('Only you can see and access this stack.'));
              console.log('\nPress any key to continue...');
              await readSingleChar('');
            } catch (error) {
              console.error(colors.error('Failed to change visibility:'), error instanceof Error ? error.message : String(error));
              console.log('\nPress any key to continue...');
              await readSingleChar('');
            }
          } else {
            console.log(colors.meta('Visibility change cancelled.'));
          }
        } else {
          // Currently private, offer to make public
          const confirmAction = await readSingleChar(colors.stackName(`\nMake "${stack.name}" public? Others will be able to discover and install it. (y/N): `));
          if (confirmAction.toLowerCase() === 'y') {
            try {
              console.log(colors.info('\n🌐 Making stack public...'));
              
              const apiConfig = getApiConfig();
              const stackPath = getStackPath(stack);
              const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${stackPath}`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${state.accessToken}`,
                  'Content-Type': 'application/json',
                  'User-Agent': 'claude-stacks-cli/1.0.0'
                },
                body: JSON.stringify({ public: true })
              });

              if (!response.ok) {
                let errorDetails = '';
                try {
                  const errorBody = await response.text();
                  errorDetails = errorBody ? `\n${errorBody}` : '';
                } catch {}
                throw new Error(`Failed to update visibility: ${response.status} ${response.statusText}${errorDetails}`);
              }

              const result = await response.json() as any;
              stack.public = result.public; // Update local state
              
              console.log(colors.success('✅ Stack is now public!'));
              console.log(colors.meta('Others can now discover and install your stack.'));
              console.log('\nPress any key to continue...');
              await readSingleChar('');
            } catch (error) {
              console.error(colors.error('Failed to change visibility:'), error instanceof Error ? error.message : String(error));
              console.log('\nPress any key to continue...');
              await readSingleChar('');
            }
          } else {
            console.log(colors.meta('Visibility change cancelled.'));
          }
        }
      }
      return 'retry'; // Stay on same stack
      
    case 'r':
      // Rename stack
      if (isMyStack && state.accessToken) {
        console.log(colors.info(`\n🏷️  Current name: "${stack.name}"`));
        const newTitle = await new Promise<string>((resolve) => {
          process.stdin.resume();
          process.stdin.setEncoding('utf8');
          console.log(colors.meta('Enter new title (or press Enter to cancel): '));
          process.stdin.once('data', (data) => {
            resolve(data.toString().trim());
          });
        });
        
        if (newTitle && newTitle !== stack.name) {
          try {
            console.log(colors.info('\n📝 Renaming stack...'));
            
            // Get current stack path
            const currentStackPath = getStackPath(stack);
            const [org, name] = currentStackPath.split('/');
            
            if (!org || !name) {
              throw new Error('Invalid stack path for rename operation.');
            }
            
            // Call rename API
            const apiConfig = getApiConfig();
            const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${org}/${name}/rename`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.accessToken}`,
                'User-Agent': 'claude-stacks-cli/1.0.0'
              },
              body: JSON.stringify({
                title: newTitle
              })
            });
            
            if (!response.ok) {
              let errorDetails = '';
              try {
                const errorBody = await response.text();
                errorDetails = errorBody ? `\n${errorBody}` : '';
              } catch {}
              throw new Error(`Rename failed: ${response.status} ${response.statusText}${errorDetails}`);
            }
            
            const result = await response.json() as any;
            
            // Update the local stack object for display
            stack.title = newTitle;
            if (result.organizationUsername && result.name) {
              stack.author = result.organizationUsername;
              stack.name = result.name;
            }
            
            console.log(colors.success('✅ Stack renamed successfully!'));
            console.log(colors.meta(`  New title: ${newTitle}`));
            if (result.newUrl) {
              console.log(colors.meta(`  New URL: ${result.newUrl}`));
            }
            console.log('\nPress any key to continue...');
            await readSingleChar('');
          } catch (error) {
            console.error(colors.error('Rename failed:'), error instanceof Error ? error.message : String(error));
            console.log('\nPress any key to continue...');
            await readSingleChar('');
          }
        } else {
          console.log(colors.meta('Rename cancelled.'));
        }
      }
      return 'retry'; // Stay on same stack
      
    case 'd':
      if (isMyStack && state.accessToken) {
        const confirmAction = await readSingleChar(colors.warning(`\nDelete "${stack.name}"? This cannot be undone. (y/N): `));
        if (confirmAction.toLowerCase() === 'y') {
          try {
            await deleteAction(getStackPath(stack));
            console.log('\nStack deleted. Press any key to continue...');
            await readSingleChar('');
            return null; // Go back to main menu (stack is gone)
          } catch (error) {
            console.error(colors.error('Delete failed:'), error instanceof Error ? error.message : String(error));
            console.log('\nPress any key to continue...');
            await readSingleChar('');
          }
        } else {
          console.log(colors.meta('Delete cancelled.'));
        }
      }
      return 'retry'; // Stay on same stack
      
    case 'b':
    case '':
      return null; // Go back to stack list
      
    default:
      console.log(colors.error('Invalid action. Please try again.'));
      return 'retry'; // Stay on same stack
  }
}

export async function browseAction(options: BrowseOptions = {}): Promise<void> {
  let state: BrowseState = {};
  
  try {
    // Main browse loop
    let continueShowing = true;
    while (continueShowing) {
      console.log('\n' + '─'.repeat(50) + '\n');
      
      const mainAction = await showMainBrowseMenu();
      
      switch (mainAction.toLowerCase()) {
        case 'a':
          // Show all stacks
          try {
            const stacks = await fetchStacks({}, null);
            let stackAction: string | null = 'retry';
            while (stackAction === 'retry') {
              stackAction = await showStackList(stacks, state, 'All Public Stacks', false);
            }
          } catch (error) {
            console.error(colors.error('Failed to fetch stacks:'), error instanceof Error ? error.message : String(error));
            console.log('\nPress any key to continue...');
            await readSingleChar('');
          }
          break;
          
        case 'm':
          // Show my stacks (requires authentication)
          try {
            if (!state.accessToken) {
              state.accessToken = await authenticate();
            }
            
            const myStacks = await fetchStacks({ myStacks: true }, state.accessToken);
            let stackAction: string | null = 'retry';
            while (stackAction === 'retry') {
              stackAction = await showStackList(myStacks, state, 'My Published Stacks', true);
            }
          } catch (error) {
            console.error(colors.error('Failed to fetch your stacks:'), error instanceof Error ? error.message : String(error));
            console.log('\nPress any key to continue...');
            await readSingleChar('');
          }
          break;
          
        case 's':
          // Search stacks
          console.log(colors.info('\n🔍 Search Stacks'));
          const searchTerm = await new Promise<string>((resolve) => {
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            console.log(colors.meta('Enter search term (or press Enter to cancel): '));
            process.stdin.once('data', (data) => {
              resolve(data.toString().trim());
            });
          });
          
          if (searchTerm) {
            try {
              const searchResults = await fetchStacks({ search: searchTerm }, state.accessToken || null);
              let stackAction: string | null = 'retry';
              while (stackAction === 'retry') {
                stackAction = await showStackList(searchResults, state, `Search Results for "${searchTerm}"`, false);
              }
            } catch (error) {
              console.error(colors.error('Search failed:'), error instanceof Error ? error.message : String(error));
              console.log('\nPress any key to continue...');
              await readSingleChar('');
            }
          }
          break;
          
        case 'q':
        case '':
          continueShowing = false;
          break;
          
        default:
          console.log(colors.error('Invalid option. Please try again.'));
          break;
      }
    }
    
  } catch (error) {
    console.error(colors.error('Browse failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}