import * as fs from 'fs-extra';
import * as path from 'path';

import { DeveloperStack } from '../types';
import { colors } from '../utils/colors';
import { readSingleChar } from '../utils/input';
import { showStackInfo } from './display';
import { deleteAction } from '../actions/delete';
import { restoreAction } from '../actions/restore';
import { installAction } from '../actions/install';
import { publishAction } from '../actions/publish';
import open from 'open';

export async function showLocalStackDetailsAndActions(stack: DeveloperStack): Promise<void> {
  const filename = path.basename(stack.filePath || '');
  
  // Show detailed stack information
  console.log(`\n📦 ${colors.stackName(stack.name)}`);
  console.log(`${colors.info('Description:')} ${colors.description(stack.description)}`);
  console.log(`${colors.info('File:')} ${colors.author(filename)}`);
  if (stack.version) {
    console.log(`${colors.info('Version:')} ${colors.meta(stack.version)}`);
  }
  
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
  const actionPrompt = `\nActions: ${colors.highlight('(r)')}estore, ${colors.highlight('(o)')}verwrite, ${colors.highlight('(p)')}ublish, ${colors.highlight('(s)')}how details, ${colors.highlight('(d)')}elete file, ${colors.highlight('(b)')}ack`;
  console.log(actionPrompt);
  
  const action = await readSingleChar(colors.meta('Choose an action: '));
  
  switch (action.toLowerCase()) {
    case 'r':
      console.log(colors.info('\n🔄 Restoring stack to current project...'));
      try {
        await restoreAction(stack.filePath!, {});
        console.log(colors.success('✅ Stack restored successfully!'));
      } catch (error) {
        console.error(colors.error('Restore failed:'), error instanceof Error ? error.message : String(error));
      }
      break;
      
    case 'o':
      const confirmOverwrite = await readSingleChar(colors.warning(`\nOverwrite current project with "${stack.name}"? This will replace existing configurations. (y/N): `));
      if (confirmOverwrite.toLowerCase() === 'y') {
        console.log(colors.info('\n🔄 Overwriting current project with stack...'));
        try {
          await restoreAction(stack.filePath!, { overwrite: true });
          console.log(colors.success('✅ Stack overwrite completed successfully!'));
        } catch (error) {
          console.error(colors.error('Overwrite failed:'), error instanceof Error ? error.message : String(error));
        }
      } else {
        console.log(colors.meta('Overwrite cancelled.'));
      }
      break;
      
    case 'p':
      console.log(colors.info('\n📤 Publishing stack to Commands.com...'));
      const makePublic = await readSingleChar(colors.stackName('Make this stack publicly discoverable? (y/N): '));
      const publishOptions = { public: makePublic.toLowerCase() === 'y' };
      
      console.log(colors.meta(`Publishing as ${publishOptions.public ? 'public' : 'private'} stack...`));
      try {
        await publishAction(stack.filePath!, publishOptions);
        console.log(colors.success('✅ Stack published successfully!'));
        console.log(colors.meta(`Visibility: ${publishOptions.public ? 'Public (discoverable by others)' : 'Private (only visible to you)'}`));
        console.log(colors.meta('\nPress any key to continue...'));
        await readSingleChar('');
      } catch (error) {
        console.error(colors.error('Publish failed:'), error instanceof Error ? error.message : String(error));
        console.log(colors.meta('\nPress any key to continue...'));
        await readSingleChar('');
      }
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
        try {
          await fs.remove(stack.filePath!);
          console.log(colors.success(`✅ Deleted ${filename} successfully!`));
          return; // Exit back to list
        } catch (error) {
          console.error(colors.error('Failed to delete file:'), error instanceof Error ? error.message : String(error));
        }
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
      try {
        await installAction(stack.stackId, {});
        console.log(colors.success('✅ Stack installed successfully!'));
      } catch (error) {
        console.error(colors.error('Install failed:'), error instanceof Error ? error.message : String(error));
      }
      break;
      
    case 'v':
      const url = `https://commands.com/stacks/${stack.stackId}`;
      console.log(colors.info(`\n🌐 Opening ${url}...`));
      try {
        await open(url);
        console.log(colors.success('✅ Opened in browser!'));
      } catch (error) {
        console.error(colors.error('Failed to open browser:'), error instanceof Error ? error.message : String(error));
        console.log(colors.meta(`Please open manually: ${url}`));
      }
      break;
      
    case 'c':
      console.log(colors.success(`\n📋 Stack ID: ${stack.stackId}`));
      console.log(colors.meta('Copy the ID above to install with: claude-stacks install ' + stack.stackId));
      break;
      
    case 'd':
      if (accessToken) {
        const confirmAction = await readSingleChar(colors.warning(`\nDelete "${stack.name}"? This cannot be undone. (y/N): `));
        if (confirmAction.toLowerCase() === 'y') {
          try {
            await deleteAction(stack.stackId);
            return; // Exit back to list
          } catch (error) {
            console.error(colors.error('Delete failed:'), error instanceof Error ? error.message : String(error));
          }
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