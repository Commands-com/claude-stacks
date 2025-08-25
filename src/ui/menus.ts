import fs from 'fs-extra';
import * as path from 'path';

import type { DeveloperStack, RemoteStack } from '../types/index.js';
import { colors } from '../utils/colors.js';
import { readSingleChar } from '../utils/input.js';
import { showStackInfo } from './display.js';
import { deleteAction } from '../actions/delete.js';
import { restoreAction } from '../actions/restore.js';
import { installAction } from '../actions/install.js';
import { publishAction } from '../actions/publish.js';
import open from 'open';

function displayLocalStackDetails(stack: DeveloperStack): void {
  const filename = path.basename(stack.filePath ?? '');

  console.log(`\n📦 ${colors.stackName(stack.name)}`);
  console.log(`${colors.info('Description:')} ${colors.description(stack.description)}`);
  console.log(`${colors.info('File:')} ${colors.author(filename)}`);
  if (stack.version) {
    console.log(`${colors.info('Version:')} ${colors.meta(stack.version)}`);
  }
}

function getComponentCount(components: unknown[] | undefined): number {
  return components?.length ?? 0;
}

function displayLocalStackComponents(stack: DeveloperStack): void {
  const commandCount = getComponentCount(stack.commands);
  const agentCount = getComponentCount(stack.agents);
  const mcpCount = getComponentCount(stack.mcpServers);
  const totalComponents = commandCount + agentCount + mcpCount;

  console.log(`${colors.info('Components:')} ${colors.componentCount(totalComponents)} items`);
  console.log(`   ${colors.bullet('•')} Commands: ${colors.componentCount(commandCount)}`);
  console.log(`   ${colors.bullet('•')} Agents: ${colors.componentCount(agentCount)}`);
  console.log(`   ${colors.bullet('•')} MCP Servers: ${colors.componentCount(mcpCount)}`);
}

function displayLocalStackMetadata(stack: DeveloperStack): void {
  if (stack.metadata?.created_at) {
    console.log(
      `${colors.info('Created:')} ${colors.meta(new Date(stack.metadata.created_at).toLocaleString())}`
    );
  }
  if (stack.metadata?.exported_from) {
    console.log(`${colors.info('Exported from:')} ${colors.meta(stack.metadata.exported_from)}`);
  }
  console.log(`${colors.info('File path:')} ${colors.path(stack.filePath)}`);
}

async function handleRestoreAction(filePath: string): Promise<void> {
  console.log(colors.info('\n🔄 Restoring stack to current project...'));
  try {
    await restoreAction(filePath, {});
    console.log(colors.success('✅ Stack restored successfully!'));
  } catch (error) {
    console.error(
      colors.error('Restore failed:'),
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function handleOverwriteAction(stack: DeveloperStack): Promise<void> {
  const confirmOverwrite = await readSingleChar(
    colors.warning(
      `\nOverwrite current project with "${stack.name}"? This will replace existing configurations. (y/N): `
    )
  );
  if (confirmOverwrite.toLowerCase() === 'y') {
    console.log(colors.info('\n🔄 Overwriting current project with stack...'));
    try {
      await restoreAction(stack.filePath!, { overwrite: true });
      console.log(colors.success('✅ Stack overwrite completed successfully!'));
    } catch (error) {
      console.error(
        colors.error('Overwrite failed:'),
        error instanceof Error ? error.message : String(error)
      );
    }
  } else {
    console.log(colors.meta('Overwrite cancelled.'));
  }
}

async function handlePublishAction(filePath: string): Promise<void> {
  console.log(colors.info('\n📤 Publishing stack to Commands.com...'));
  const makePublic = await readSingleChar(
    colors.stackName('Make this stack publicly discoverable? (y/N): ')
  );
  const publishOptions = { public: makePublic.toLowerCase() === 'y' };

  console.log(
    colors.meta(`Publishing as ${publishOptions.public ? 'public' : 'private'} stack...`)
  );
  try {
    await publishAction(filePath, publishOptions);
    console.log(colors.success('✅ Stack published successfully!'));
    console.log(
      colors.meta(
        `Visibility: ${publishOptions.public ? 'Public (discoverable by others)' : 'Private (only visible to you)'}`
      )
    );
    console.log(colors.meta('\nPress any key to continue...'));
    await readSingleChar('');
  } catch (error) {
    console.error(
      colors.error('Publish failed:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log(colors.meta('\nPress any key to continue...'));
    await readSingleChar('');
  }
}

async function handleShowDetailsAction(stack: DeveloperStack): Promise<void> {
  console.log(colors.info('\n📋 Detailed stack information:'));
  await showStackInfo(stack.filePath);
  console.log(colors.meta('\nPress any key to return to actions menu...'));
  await readSingleChar('');
  await showLocalStackDetailsAndActions(stack);
}

async function handleDeleteAction(stack: DeveloperStack): Promise<boolean> {
  const filename = path.basename(stack.filePath ?? '');
  const confirmAction = await readSingleChar(
    colors.warning(`\nDelete local file "${filename}"? This cannot be undone. (y/N): `)
  );
  if (confirmAction.toLowerCase() === 'y') {
    try {
      await fs.remove(stack.filePath!);
      console.log(colors.success(`✅ Deleted ${filename} successfully!`));
      return true; // Exit back to list
    } catch (error) {
      console.error(
        colors.error('Failed to delete file:'),
        error instanceof Error ? error.message : String(error)
      );
    }
  } else {
    console.log(colors.meta('Delete cancelled.'));
  }
  return false;
}

export async function showLocalStackDetailsAndActions(stack: DeveloperStack): Promise<void> {
  displayLocalStackDetails(stack);
  displayLocalStackComponents(stack);
  displayLocalStackMetadata(stack);

  const actionPrompt = `\nActions: ${colors.highlight('(r)')}estore, ${colors.highlight('(o)')}verwrite, ${colors.highlight('(p)')}ublish, ${colors.highlight('(s)')}how details, ${colors.highlight('(d)')}elete file, ${colors.highlight('(b)')}ack`;
  console.log(actionPrompt);

  const action = await readSingleChar(colors.meta('Choose an action: '));

  switch (action.toLowerCase()) {
    case 'r':
      await handleRestoreAction(stack.filePath!);
      break;
    case 'o':
      await handleOverwriteAction(stack);
      break;
    case 'p':
      await handlePublishAction(stack.filePath!);
      break;
    case 's':
      await handleShowDetailsAction(stack);
      break;
    case 'd':
      if (await handleDeleteAction(stack)) {
        return;
      }
      break;
    case 'b':
    case '':
      return;
    default:
      console.log(colors.error('Invalid action. Please try again.'));
      break;
  }
}

function displayStackDetails(stack: RemoteStack): void {
  console.log(`\n📦 ${colors.stackName(stack.name)}`);
  console.log(`${colors.info('Description:')} ${colors.description(stack.description)}`);
  console.log(`${colors.info('Author:')} ${colors.author(stack.author ?? 'Unknown')}`);
  if (stack.version) {
    console.log(`${colors.info('Version:')} ${colors.meta(stack.version)}`);
  }
}

function displayStackComponents(stack: RemoteStack): void {
  const totalComponents =
    (stack.commandCount ?? 0) + (stack.agentCount ?? 0) + (stack.mcpServerCount ?? 0);
  console.log(`${colors.info('Components:')} ${colors.componentCount(totalComponents)} items`);
  console.log(
    `   ${colors.bullet('•')} Commands: ${colors.componentCount(stack.commandCount ?? 0)}`
  );
  console.log(`   ${colors.bullet('•')} Agents: ${colors.componentCount(stack.agentCount ?? 0)}`);
  console.log(
    `   ${colors.bullet('•')} MCP Servers: ${colors.componentCount(stack.mcpServerCount ?? 0)}`
  );
}

function displayStackStats(stack: RemoteStack): void {
  console.log(
    `${colors.info('Stats:')} ${colors.meta(`${stack.viewCount ?? 0} views, ${stack.installCount ?? 0} installs`)}`
  );
  console.log(
    `${colors.info('Created:')} ${colors.meta(stack.createdAt ? new Date(stack.createdAt).toLocaleDateString() : 'Unknown')}`
  );
  const stackPath = `${stack.org}/${stack.name}`;
  console.log(`${colors.info('Stack ID:')} ${colors.id(stackPath)}`);
  console.log(`${colors.info('URL:')} ${colors.url(`https://commands.com/stacks/${stackPath}`)}`);
}

function displayActionPrompt(hasAccessToken: boolean): void {
  let actionPrompt = `\nActions: ${colors.highlight('(i)')}nstall, ${colors.highlight('(v)')}iew in browser`;
  if (hasAccessToken) {
    actionPrompt += `, ${colors.highlight('(d)')}elete`;
  }
  actionPrompt += `, ${colors.highlight('(b)')}ack`;
  console.log(actionPrompt);
}

async function handleInstallAction(stackPath: string): Promise<void> {
  console.log(colors.info('\n📦 Installing stack...'));
  try {
    await installAction(stackPath, {});
    console.log(colors.success('✅ Stack installed successfully!'));
  } catch (error) {
    console.error(
      colors.error('Install failed:'),
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function handleViewAction(stackPath: string): Promise<void> {
  const url = `https://commands.com/stacks/${stackPath}`;
  console.log(colors.info(`\n🌐 Opening ${url}...`));
  try {
    await open(url);
    console.log(colors.success('✅ Opened in browser!'));
  } catch (error) {
    console.error(
      colors.error('Failed to open browser:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log(colors.meta(`Please open manually: ${url}`));
  }
}

async function handleRemoteDeleteAction(stack: RemoteStack): Promise<boolean> {
  const confirmAction = await readSingleChar(
    colors.warning(`\nDelete "${stack.name}"? This cannot be undone. (y/N): `)
  );
  if (confirmAction.toLowerCase() === 'y') {
    try {
      const deleteStackPath = `${stack.org}/${stack.name}`;
      await deleteAction(deleteStackPath);
      return true; // Indicate exit back to list
    } catch (error) {
      console.error(
        colors.error('Delete failed:'),
        error instanceof Error ? error.message : String(error)
      );
    }
  } else {
    console.log(colors.meta('Delete cancelled.'));
  }
  return false;
}

export async function showStackDetailsAndActions(
  stack: RemoteStack,
  accessToken: string | null
): Promise<void> {
  const stackPath = `${stack.org}/${stack.name}`;

  displayStackDetails(stack);
  displayStackComponents(stack);
  displayStackStats(stack);
  displayActionPrompt(!!accessToken);

  const action = await readSingleChar(colors.meta('Choose an action: '));

  switch (action.toLowerCase()) {
    case 'i':
      await handleInstallAction(stackPath);
      break;
    case 'v':
      await handleViewAction(stackPath);
      break;
    case 'd':
      if (accessToken && (await handleRemoteDeleteAction(stack))) {
        return;
      }
      break;
    case 'b':
    case '':
      return;
    default:
      console.log(colors.error('Invalid action. Please try again.'));
      break;
  }
}
