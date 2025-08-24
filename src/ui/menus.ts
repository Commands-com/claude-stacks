import * as path from 'path';

import { DeveloperStack } from '../types';
import { colors } from '../utils/colors';
import { readSingleChar } from '../utils/input';
import { showStackInfo } from './display';

export async function showLocalStackDetailsAndActions(stack: DeveloperStack): Promise<void> {
  const filename = path.basename(stack.filePath || '');
  
  // Show detailed stack information
  console.log(`\n📦 ${colors.stackName(stack.name)}`);
  console.log(`${colors.info('Description:')} ${colors.description(stack.description)}`);
  console.log(`${colors.info('File:')} ${colors.author(filename)}`);
  
  const totalComponents = (stack.commands?.length || 0) + (stack.agents?.length || 0) + (stack.mcpServers?.length || 0);
  console.log(`${colors.info('Components:')} ${colors.componentCount(totalComponents)} items`);
  console.log(`   ${colors.bullet('•')} Commands: ${colors.componentCount(stack.commands?.length || 0)}`);
  console.log(`   ${colors.bullet('•')} Agents: ${colors.componentCount(stack.agents?.length || 0)}`);
  console.log(`   ${colors.bullet('•')} MCP Servers: ${colors.componentCount(stack.mcpServers?.length || 0)}`);
  
  if (stack.metadata?.created_at) {
    console.log(`${colors.info('Created:')} ${colors.meta(new Date(stack.metadata.created_at).toLocaleString())}`);
  }
  if (stack.metadata?.exported_from) {
    console.log(`${colors.info('Exported from:')} ${colors.meta(stack.metadata.exported_from)}`);
  }
  console.log(`${colors.info('File path:')} ${colors.path(stack.filePath)}`);
  
  // Show action menu with single letter shortcuts
  const actionPrompt = `\nActions: ${colors.highlight('(r)')}estore, ${colors.highlight('(s)')}how details, ${colors.highlight('(d)')}elete file, ${colors.highlight('(b)')}ack`;
  console.log(actionPrompt);
  
  const action = await readSingleChar(colors.meta('Choose an action: '));
  
  switch (action.toLowerCase()) {
    case 'r':
      console.log(colors.info('\n🔄 Restoring stack to current project...'));
      console.log(colors.warning('Restore action not yet implemented in refactored version'));
      // TODO: await restoreStack(filename, {});
      break;
      
    case 's':
      console.log(colors.info('\n📋 Detailed stack information:'));
      await showStackInfo(stack.filePath);
      
      // Return to menu after showing details
      console.log(colors.meta('\nPress any key to return to actions menu...'));
      await readSingleChar('');
      await showLocalStackDetailsAndActions(stack);
      break;
      
    case 'd':
      const confirmAction = await readSingleChar(colors.warning(`\nDelete local file "${filename}"? This cannot be undone. (y/N): `));
      if (confirmAction.toLowerCase() === 'y') {
        console.log(colors.warning('Delete action not yet implemented in refactored version'));
        // TODO: await deleteLocalStack(stack.filePath!);
      } else {
        console.log(colors.meta('Delete cancelled.'));
      }
      break;
      
    case 'b':
    case '':
      // Back to list or exit
      return;
      
    default:
      console.log(colors.error('Invalid action. Please try again.'));
      break;
  }
}

export async function showStackDetailsAndActions(stack: any, accessToken: string | null): Promise<void> {
  // Show detailed stack information
  console.log(`\n📦 ${colors.stackName(stack.name)}`);
  console.log(`${colors.info('Description:')} ${colors.description(stack.description)}`);
  console.log(`${colors.info('Author:')} ${colors.author(stack.author || 'Unknown')}`);
  
  const totalComponents = (stack.commandCount || 0) + (stack.agentCount || 0) + (stack.mcpServerCount || 0);
  console.log(`${colors.info('Components:')} ${colors.componentCount(totalComponents)} items`);
  console.log(`   ${colors.bullet('•')} Commands: ${colors.componentCount(stack.commandCount || 0)}`);
  console.log(`   ${colors.bullet('•')} Agents: ${colors.componentCount(stack.agentCount || 0)}`);
  console.log(`   ${colors.bullet('•')} MCP Servers: ${colors.componentCount(stack.mcpServerCount || 0)}`);
  
  console.log(`${colors.info('Stats:')} ${colors.meta(`${stack.viewCount || 0} views, ${stack.installCount || 0} installs`)}`);
  console.log(`${colors.info('Created:')} ${colors.meta(stack.createdAt ? new Date(stack.createdAt).toLocaleDateString() : 'Unknown')}`);
  console.log(`${colors.info('Stack ID:')} ${colors.id(stack.stackId)}`);
  console.log(`${colors.info('URL:')} ${colors.url(`https://commands.com/stacks/${stack.stackId}`)}`);
  
  // Show action menu with single letter shortcuts
  let actionPrompt = `\nActions: ${colors.highlight('(i)')}nstall, ${colors.highlight('(v)')}iew in browser, ${colors.highlight('(c)')}opy ID`;
  if (accessToken) {
    actionPrompt += `, ${colors.highlight('(d)')}elete`;
  }
  actionPrompt += `, ${colors.highlight('(b)')}ack`;
  console.log(actionPrompt);
  
  const action = await readSingleChar(colors.meta('Choose an action: '));
  
  switch (action.toLowerCase()) {
    case 'i':
      console.log(colors.info('\n📦 Installing stack...'));
      console.log(colors.warning('Install action not yet implemented in refactored version'));
      // TODO: await installRemoteStack(stack.stackId, {});
      break;
      
    case 'v':
      const url = `https://commands.com/stacks/${stack.stackId}`;
      console.log(colors.info(`\n🌐 Opening ${url}...`));
      console.log(colors.warning('Browser open not yet implemented in refactored version'));
      // TODO: await open(url);
      break;
      
    case 'c':
      console.log(colors.success(`\n📋 Stack ID: ${stack.stackId}`));
      console.log(colors.meta('Copy the ID above to install with: claude-stacks install ' + stack.stackId));
      break;
      
    case 'd':
      if (accessToken) {
        const confirmAction = await readSingleChar(colors.warning(`\nDelete "${stack.name}"? This cannot be undone. (y/N): `));
        if (confirmAction.toLowerCase() === 'y') {
          console.log(colors.warning('Delete action not yet implemented in refactored version'));
          // TODO: await deleteStack(stack.stackId);
        } else {
          console.log(colors.meta('Delete cancelled.'));
        }
      }
      break;
      
    case 'b':
    case '':
      // Back to list or exit
      return;
      
    default:
      console.log(colors.error('Invalid action. Please try again.'));
      break;
  }
}