import fetch from 'node-fetch';

import type { RemoteStack } from '../types/index.js';
import type { ApiStackResponse } from '../types/api.js';
import { isApiSearchResponse } from '../types/api.js';
import { colors } from '../utils/colors.js';
import { readSingleChar } from '../utils/input.js';
import { authenticate } from '../utils/auth.js';
import { getApiConfig, isLocalDev } from '../utils/api.js';
import { installAction } from './install.js';
import { deleteAction } from './delete.js';
import open from 'open';

interface BrowseState {
  currentUser?: string;
  accessToken?: string | null;
}

// Helper function to determine stack path from API response
function getStackPath(stack: RemoteStack): string {
  // API returns org and name (already slugified)
  if (stack.org && stack.name) {
    return `${stack.org}/${stack.name}`;
  }
  // Fallback to author if org not available
  if (stack.author && stack.name) {
    return `${stack.author}/${stack.name}`;
  }

  return 'unknown-stack';
}

function buildFetchHeaders(accessToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'claude-stacks-cli/1.0.0',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

function convertApiStackToRemoteStack(apiStack: ApiStackResponse): RemoteStack {
  return {
    org: apiStack.org,
    name: apiStack.name,
    title: apiStack.title,
    description: apiStack.description,
    version: apiStack.version,
    author: apiStack.author,
    public: apiStack.public,
    commands: apiStack.commands,
    agents: apiStack.agents,
    mcpServers: apiStack.mcpServers,
    settings: apiStack.settings,
    metadata: apiStack.metadata,
    createdAt: apiStack.createdAt,
    updatedAt: apiStack.updatedAt,
    viewCount: apiStack.viewCount,
    installCount: apiStack.installCount,
    commandCount: apiStack.commandCount,
    agentCount: apiStack.agentCount,
    mcpServerCount: apiStack.mcpServerCount,
  };
}

async function fetchStacks(
  options: { search?: string; myStacks?: boolean } = {},
  accessToken: string | null
): Promise<RemoteStack[]> {
  const params = new URLSearchParams();
  if (options.search) params.set('search', options.search);
  if (options.myStacks) params.set('myStacks', 'true');

  const headers = buildFetchHeaders(accessToken);
  const apiConfig = getApiConfig();

  console.log(colors.info('🔍 Fetching stacks from Commands.com...'));
  if (isLocalDev()) {
    console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
  }

  const response = await fetch(`${apiConfig.baseUrl}/v1/stacks?${params.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody ? `\n${errorBody}` : '';
    } catch {
      // Ignore error when reading response body for error details
    }
    throw new Error(`Browse failed: ${response.status} ${response.statusText}${errorDetails}`);
  }

  const result = (await response.json()) as unknown;

  if (!isApiSearchResponse(result)) {
    console.warn('Warning: Unexpected API response format');
    return [];
  }

  return result.stacks.map(convertApiStackToRemoteStack);
}

async function showMainBrowseMenu(): Promise<string> {
  console.log(`\n${colors.info('🌐 Browse Development Stacks')}`);
  console.log(colors.meta('Discover and manage Claude Code configurations from the community\n'));

  console.log(colors.stackName('📚 Browse Options:'));
  console.log(
    `  ${colors.highlight('(a)')} ${colors.info('All Stacks')} - ${colors.description('Discover public stacks from the community')}`
  );
  console.log(
    `  ${colors.highlight('(m)')} ${colors.info('My Stacks')} - ${colors.description('Manage your published stacks')}`
  );
  console.log(
    `  ${colors.highlight('(s)')} ${colors.info('Search')} - ${colors.description('Find stacks by keyword or functionality')}`
  );
  console.log(
    `  ${colors.highlight('(q)')} ${colors.meta('Quit')} - ${colors.description('Return to main menu')}`
  );

  return await readSingleChar(colors.stackName('\nWhat would you like to do? '));
}

async function showStackList(
  stacks: RemoteStack[],
  state: BrowseState,
  title: string,
  isMyStacks: boolean = false
): Promise<string | null> {
  if (stacks.length === 0) {
    console.log(colors.warning('\nNo stacks found matching your criteria.'));
    console.log('Press any key to continue...');
    await readSingleChar('');
    return null;
  }

  console.log(`\n📋 ${title}`);
  console.log(colors.meta(`Found ${stacks.length} stack(s):\n`));

  stacks.forEach((stack: RemoteStack, index: number) => {
    const components =
      (stack.commandCount ?? 0) + (stack.agentCount ?? 0) + (stack.mcpServerCount ?? 0);
    const version = stack.version ? `v${stack.version}, ` : '';
    const stats = `${version}${components} items, ${stack.installCount ?? 0} installs`;
    const ownershipIndicator = isMyStacks ? '★ ' : '';
    console.log(
      `${colors.number(`${index + 1}.`)} ${ownershipIndicator}${colors.stackName(stack.name)} ${colors.meta(`by ${stack.author ?? 'Unknown'}`)} ${colors.info(`(${stats})`)}`
    );
  });

  const selection = await readSingleChar(
    colors.meta(`\nEnter a number (1-${stacks.length}) or (b)ack: `)
  );

  if (selection === 'b' || selection === '') {
    return null; // Go back to main menu
  }

  const selectedIndex = parseInt(selection) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= stacks.length) {
    console.log(
      colors.error(`Invalid selection. Please enter a number between 1 and ${stacks.length}`)
    );
    return 'retry'; // Retry current list
  }

  const selectedStack = stacks[selectedIndex];
  return await showStackActions(selectedStack, state, isMyStacks);
}

function displayStackBasicInfo(stack: RemoteStack): void {
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

function displayStackMetadata(stack: RemoteStack, isMyStack: boolean): void {
  console.log(
    `${colors.info('Stats:')} ${colors.meta(`${stack.viewCount ?? 0} views, ${stack.installCount ?? 0} installs`)}`
  );
  console.log(
    `${colors.info('Created:')} ${colors.meta(stack.createdAt ? new Date(stack.createdAt).toLocaleDateString() : 'Unknown')}`
  );

  if (isMyStack) {
    const visibility = stack.public
      ? 'Public (discoverable by others)'
      : 'Private (only visible to you)';
    console.log(`${colors.info('Visibility:')} ${colors.meta(visibility)}`);
  }

  const stackPath = getStackPath(stack);
  console.log(`${colors.info('Stack ID:')} ${colors.id(stackPath)}`);
  console.log(`${colors.info('URL:')} ${colors.url(`https://commands.com/stacks/${stackPath}`)}`);
}

function displayStackInfo(stack: RemoteStack, isMyStack: boolean): void {
  displayStackBasicInfo(stack);
  displayStackComponents(stack);
  displayStackMetadata(stack, isMyStack);
}

function showActionPrompt(isMyStack: boolean, state: BrowseState, stack: RemoteStack): void {
  let actionPrompt = `\nActions: ${colors.highlight('(i)')}nstall, ${colors.highlight('(v)')}iew in browser`;

  if (isMyStack && state.accessToken) {
    const visibilityAction = stack.public
      ? `${colors.highlight('(m)')}ake private`
      : `${colors.highlight('(m)')}ake public`;
    actionPrompt += `, ${colors.highlight('(r)')}ename, ${visibilityAction}, ${colors.highlight('(d)')}elete`;
  }
  actionPrompt += `, ${colors.highlight('(b)')}ack`;
  console.log(actionPrompt);
}

async function handleInstallAction(stack: RemoteStack): Promise<string> {
  console.log(colors.info('\n📦 Installing stack...'));
  try {
    await installAction(getStackPath(stack), {});
    console.log('\nPress any key to continue...');
    await readSingleChar('');
  } catch (error) {
    console.error(
      colors.error('Install failed:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log('\nPress any key to continue...');
    await readSingleChar('');
  }
  return 'retry';
}

async function handleViewAction(stack: RemoteStack): Promise<string> {
  const stackUrl = getStackPath(stack);
  const url = `https://commands.com/stacks/${stackUrl}`;
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
  console.log('\nPress any key to continue...');
  await readSingleChar('');
  return 'retry';
}

async function updateStackVisibility(
  stack: RemoteStack,
  makePublic: boolean,
  accessToken: string
): Promise<void> {
  const apiConfig = getApiConfig();
  const stackEndpoint = getStackPath(stack);
  const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${stackEndpoint}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'claude-stacks-cli/1.0.0',
    },
    body: JSON.stringify({ public: makePublic }),
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody ? `\n${errorBody}` : '';
    } catch {
      // Ignore error when reading response body for error details
    }
    throw new Error(
      `Failed to update visibility: ${response.status} ${response.statusText}${errorDetails}`
    );
  }

  const result = (await response.json()) as unknown;

  if (typeof result === 'object' && result !== null && 'public' in result) {
    stack.public = Boolean((result as Record<string, unknown>).public);
  }
}

async function confirmAndUpdateVisibility(
  stack: RemoteStack,
  makePublic: boolean,
  accessToken: string
): Promise<void> {
  const action = makePublic ? 'public' : 'private';
  const icon = makePublic ? '🌐' : '🔒';
  const successIcon = '✅';
  const confirmMessage = makePublic
    ? colors.stackName(
        `\nMake "${stack.name}" public? Others will be able to discover and install it. (y/N): `
      )
    : colors.warning(
        `\nMake "${stack.name}" private? It will no longer be discoverable by others. (y/N): `
      );
  const successMessage = makePublic
    ? 'Others can now discover and install your stack.'
    : 'Only you can see and access this stack.';

  const confirmAction = await readSingleChar(confirmMessage);
  if (confirmAction.toLowerCase() === 'y') {
    try {
      console.log(colors.info(`${icon} Making stack ${action}...`));
      await updateStackVisibility(stack, makePublic, accessToken);
      console.log(colors.success(`${successIcon} Stack is now ${action}!`));
      console.log(colors.meta(successMessage));
      console.log('\nPress any key to continue...');
      await readSingleChar('');
    } catch (error) {
      console.error(
        colors.error('Failed to change visibility:'),
        error instanceof Error ? error.message : String(error)
      );
      console.log('\nPress any key to continue...');
      await readSingleChar('');
    }
  } else {
    console.log(colors.meta('Visibility change cancelled.'));
  }
}

async function handleVisibilityToggle(stack: RemoteStack, state: BrowseState): Promise<string> {
  if (!state.accessToken) return 'retry';

  await confirmAndUpdateVisibility(stack, !stack.public, state.accessToken);
  return 'retry';
}

async function promptForNewTitle(): Promise<string> {
  return new Promise<string>(resolve => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    console.log(colors.meta('Enter new title (or press Enter to cancel): '));
    process.stdin.once('data', data => {
      resolve(data.toString().trim());
    });
  });
}

async function callRenameStackAPI(
  org: string,
  name: string,
  newTitle: string,
  accessToken: string
): Promise<{ organizationUsername?: string; name?: string; newUrl?: string }> {
  const apiConfig = getApiConfig();
  const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${org}/${name}/rename`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'claude-stacks-cli/1.0.0',
    },
    body: JSON.stringify({
      title: newTitle,
    }),
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody ? `\n${errorBody}` : '';
    } catch {
      // Ignore error when reading response body for error details
    }
    throw new Error(`Rename failed: ${response.status} ${response.statusText}${errorDetails}`);
  }

  const result = (await response.json()) as unknown;

  if (typeof result === 'object' && result !== null) {
    const resultObj = result as Record<string, unknown>;
    return {
      organizationUsername:
        typeof resultObj.organizationUsername === 'string'
          ? resultObj.organizationUsername
          : undefined,
      name: typeof resultObj.name === 'string' ? resultObj.name : undefined,
      newUrl: typeof resultObj.newUrl === 'string' ? resultObj.newUrl : undefined,
    };
  }

  return {};
}

async function performStackRename(
  stack: RemoteStack,
  newTitle: string,
  accessToken: string
): Promise<void> {
  const currentStackPath = getStackPath(stack);
  const [org, name] = currentStackPath.split('/');

  if (!org || !name) {
    throw new Error('Invalid stack path for rename operation.');
  }

  const result = await callRenameStackAPI(org, name, newTitle, accessToken);

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
}

async function handleRenameAction(stack: RemoteStack, state: BrowseState): Promise<string> {
  if (!state.accessToken) return 'retry';

  console.log(colors.info(`\n🏷️  Current name: "${stack.name}"`));
  const newTitle = await promptForNewTitle();

  if (newTitle && newTitle !== stack.name) {
    try {
      console.log(colors.info('\n📝 Renaming stack...'));
      await performStackRename(stack, newTitle, state.accessToken);
      console.log('\nPress any key to continue...');
      await readSingleChar('');
    } catch (error) {
      console.error(
        colors.error('Rename failed:'),
        error instanceof Error ? error.message : String(error)
      );
      console.log('\nPress any key to continue...');
      await readSingleChar('');
    }
  } else {
    console.log(colors.meta('Rename cancelled.'));
  }
  return 'retry';
}

async function handleDeleteAction(stack: RemoteStack): Promise<string | null> {
  const confirmAction = await readSingleChar(
    colors.warning(`\nDelete "${stack.name}"? This cannot be undone. (y/N): `)
  );
  if (confirmAction.toLowerCase() === 'y') {
    try {
      await deleteAction(getStackPath(stack));
      console.log('\nStack deleted. Press any key to continue...');
      await readSingleChar('');
      return null;
    } catch (error) {
      console.error(
        colors.error('Delete failed:'),
        error instanceof Error ? error.message : String(error)
      );
      console.log('\nPress any key to continue...');
      await readSingleChar('');
    }
  } else {
    console.log(colors.meta('Delete cancelled.'));
  }
  return 'retry';
}

async function handleAuthenticatedAction(
  isMyStack: boolean,
  accessToken: string | null,
  action: () => Promise<string | null>
): Promise<string | null> {
  if (isMyStack && accessToken) {
    return await action();
  }
  return 'retry';
}

async function executeStackAction(
  action: string,
  stack: RemoteStack,
  state: BrowseState,
  isMyStack: boolean
): Promise<string | null> {
  const actionHandlers = {
    i: () => handleInstallAction(stack),
    v: () => handleViewAction(stack),
    m: () =>
      handleAuthenticatedAction(isMyStack, state.accessToken ?? null, () =>
        handleVisibilityToggle(stack, state)
      ),
    r: () =>
      handleAuthenticatedAction(isMyStack, state.accessToken ?? null, () =>
        handleRenameAction(stack, state)
      ),
    d: () =>
      handleAuthenticatedAction(isMyStack, state.accessToken ?? null, () =>
        handleDeleteAction(stack)
      ),
  } as const;

  const handler = actionHandlers[action as keyof typeof actionHandlers];
  if (handler) {
    return await handler();
  }

  if (action === 'b' || action === '') {
    return null;
  }

  console.log(colors.error('Invalid action. Please try again.'));
  return 'retry';
}

async function showStackActions(
  stack: RemoteStack,
  state: BrowseState,
  isMyStack: boolean = false
): Promise<string | null> {
  displayStackInfo(stack, isMyStack);
  showActionPrompt(isMyStack, state, stack);

  const action = await readSingleChar(colors.meta('Choose an action: '));
  return await executeStackAction(action.toLowerCase(), stack, state, isMyStack);
}

async function handleAllStacksAction(state: BrowseState): Promise<void> {
  try {
    const stacks = await fetchStacks({}, null);
    let stackAction: string | null = 'retry';
    while (stackAction === 'retry') {
      // eslint-disable-next-line no-await-in-loop
      stackAction = await showStackList(stacks, state, 'All Public Stacks', false);
    }
  } catch (error) {
    console.error(
      colors.error('Failed to fetch stacks:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log('\nPress any key to continue...');
    await readSingleChar('');
  }
}

async function handleMyStacksAction(state: BrowseState): Promise<void> {
  try {
    state.accessToken ??= await authenticate();

    const myStacks = await fetchStacks({ myStacks: true }, state.accessToken);
    let stackAction: string | null = 'retry';
    while (stackAction === 'retry') {
      // eslint-disable-next-line no-await-in-loop
      stackAction = await showStackList(myStacks, state, 'My Published Stacks', true);
    }
  } catch (error) {
    console.error(
      colors.error('Failed to fetch your stacks:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log('\nPress any key to continue...');
    await readSingleChar('');
  }
}

async function handleSearchAction(state: BrowseState): Promise<void> {
  console.log(colors.info('\n🔍 Search Stacks'));
  const searchTerm = await new Promise<string>(resolve => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    console.log(colors.meta('Enter search term (or press Enter to cancel): '));
    process.stdin.once('data', data => {
      resolve(data.toString().trim());
    });
  });

  if (searchTerm) {
    try {
      const searchResults = await fetchStacks({ search: searchTerm }, state.accessToken ?? null);
      let stackAction: string | null = 'retry';
      while (stackAction === 'retry') {
        // eslint-disable-next-line no-await-in-loop
        stackAction = await showStackList(
          searchResults,
          state,
          `Search Results for "${searchTerm}"`,
          false
        );
      }
    } catch (error) {
      console.error(
        colors.error('Search failed:'),
        error instanceof Error ? error.message : String(error)
      );
      console.log('\nPress any key to continue...');
      await readSingleChar('');
    }
  }
}

/**
 * Interactive browser for discovering and managing development stacks from Commands.com
 *
 * @returns Promise that resolves when user exits the browse interface
 *
 * @throws {@link Error} When network errors occur or API requests fail
 *
 * @example
 * ```typescript
 * // Start interactive stack browser
 * await browseAction();
 * // User can browse, search, install, and manage stacks
 * ```
 *
 * @remarks
 * Provides a full-featured terminal interface for:
 * - Browsing public stacks from the community
 * - Managing your own published stacks
 * - Searching stacks by keyword
 * - Installing stacks directly
 * - Managing stack visibility and metadata
 *
 * @since 1.0.0
 * @public
 */
export async function browseAction(): Promise<void> {
  const state: BrowseState = {};

  try {
    let continueShowing = true;
    while (continueShowing) {
      console.log(`\n${'─'.repeat(50)}\n`);

      // eslint-disable-next-line no-await-in-loop
      const mainAction = await showMainBrowseMenu();

      switch (mainAction.toLowerCase()) {
        case 'a':
          // eslint-disable-next-line no-await-in-loop
          await handleAllStacksAction(state);
          break;

        case 'm':
          // eslint-disable-next-line no-await-in-loop
          await handleMyStacksAction(state);
          break;

        case 's':
          // eslint-disable-next-line no-await-in-loop
          await handleSearchAction(state);
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
    console.error(
      colors.error('Browse failed:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
