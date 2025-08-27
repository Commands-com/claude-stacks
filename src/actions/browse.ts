import fetch from 'node-fetch';

import type { RemoteStack } from '../types/index.js';
import type { ApiStackResponse } from '../types/api.js';
import { isApiSearchResponse } from '../types/api.js';
import { UIService } from '../services/UIService.js';
import { AuthService } from '../services/AuthService.js';
import { ApiService } from '../services/ApiService.js';

// Create service instances
const ui = new UIService();
const auth = new AuthService();
const api = new ApiService();
import { installAction } from './install.js';
import { deleteAction } from './delete.js';

import { navigationService } from '../services/NavigationService.js';
import { colors } from '../utils/colors.js';
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
  const apiConfig = api.getConfig();

  console.log(ui.colorInfo('🔍 Fetching stacks from Commands.com...'));
  if (api.isLocalDev()) {
    console.log(ui.colorMeta(`   Using local backend: ${apiConfig.baseUrl}`));
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
  console.log(`\n${ui.colorInfo('🌐 Browse Development Stacks')}`);
  console.log(ui.colorMeta('Discover and manage Claude Code configurations from the community\n'));

  // Show navigation breadcrumb if available
  const breadcrumb = navigationService.getBreadcrumb();
  if (breadcrumb) {
    console.log(ui.colorMeta(`Navigation: ${breadcrumb}\n`));
  }

  console.log(ui.colorStackName('📚 Browse Options:'));
  console.log(
    `  ${ui.colorHighlight('(a)')} ${ui.colorInfo('All Stacks')} - ${ui.colorDescription('Discover public stacks from the community')}`
  );
  console.log(
    `  ${ui.colorHighlight('(m)')} ${ui.colorInfo('My Stacks')} - ${ui.colorDescription('Manage your published stacks')}`
  );
  console.log(
    `  ${ui.colorHighlight('(s)')} ${ui.colorInfo('Search')} - ${ui.colorDescription('Find stacks by keyword or functionality')}`
  );
  console.log(
    `  ${ui.colorHighlight('(l)')} ${ui.colorInfo('Local')} - ${ui.colorDescription('View your local development stacks')}`
  );
  console.log(
    `  ${ui.colorHighlight('(q)')} ${ui.colorMeta('Quit')} - ${ui.colorDescription('Return to main menu')}`
  );

  return await ui.readSingleChar(ui.colorStackName('\nWhat would you like to do? '));
}

async function showStackList(
  stacks: RemoteStack[],
  state: BrowseState,
  title: string,
  isMyStacks: boolean = false
): Promise<string | null> {
  if (stacks.length === 0) {
    console.log(ui.colorWarning('\nNo stacks found matching your criteria.'));
    console.log('Press any key to continue...');
    await ui.readSingleChar('');
    return null;
  }

  console.log(`\n🌐 ${title}`);
  console.log(ui.colorMeta(`Found ${stacks.length} remote stack(s):\n`));

  stacks.forEach((stack: RemoteStack, index: number) => {
    const components =
      (stack.commandCount ?? 0) + (stack.agentCount ?? 0) + (stack.mcpServerCount ?? 0);
    const version = stack.version ? `v${stack.version}, ` : '';
    const stats = `${version}${components} items, ${stack.installCount ?? 0} installs`;
    const ownershipIndicator = isMyStacks ? '★ ' : '';
    console.log(
      `${ui.colorNumber(`${index + 1}.`)} ${ownershipIndicator}${ui.colorStackName(stack.name)} ${ui.colorMeta(`by ${stack.author ?? 'Unknown'}`)} ${ui.colorInfo(`(${stats})`)}`
    );
  });

  return await handleStackSelection(stacks, state, isMyStacks);
}

async function handleStackSelection(
  stacks: RemoteStack[],
  state: BrowseState,
  isMyStacks: boolean
): Promise<string | null> {
  const selection = await ui.readSingleChar(
    ui.colorMeta(`\nEnter a number `) +
      colors.highlight(`(1-${stacks.length})`) +
      ui.colorMeta(` or `) +
      colors.highlight(`(b)ack`) +
      ui.colorMeta(`: `)
  );

  if (selection === 'b' || selection === '') {
    return null; // Go back to main menu
  }

  const selectedIndex = parseInt(selection) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= stacks.length) {
    console.log(
      ui.colorError(`Invalid selection. Please enter a number between 1 and ${stacks.length}`)
    );
    return 'retry'; // Retry current list
  }

  const selectedStack = stacks[selectedIndex];
  return await showStackActions(selectedStack, state, isMyStacks);
}

function displayStackBasicInfo(stack: RemoteStack): void {
  console.log(`\n📦 ${ui.colorStackName(stack.name)}`);
  console.log(`${ui.colorInfo('Description:')} ${ui.colorDescription(stack.description)}`);
  console.log(`${ui.colorInfo('Author:')} ${ui.colorMeta(stack.author ?? 'Unknown')}`);
  if (stack.version) {
    console.log(`${ui.colorInfo('Version:')} ${ui.colorMeta(stack.version)}`);
  }
}

function displayStackComponents(stack: RemoteStack): void {
  const totalComponents =
    (stack.commandCount ?? 0) + (stack.agentCount ?? 0) + (stack.mcpServerCount ?? 0);
  console.log(`${ui.colorInfo('Components:')} ${ui.colorNumber(totalComponents)} items`);
  console.log(`   ${ui.colorMeta('•')} Commands: ${ui.colorNumber(stack.commandCount ?? 0)}`);
  console.log(`   ${ui.colorMeta('•')} Agents: ${ui.colorNumber(stack.agentCount ?? 0)}`);
  console.log(`   ${ui.colorMeta('•')} MCP Servers: ${ui.colorNumber(stack.mcpServerCount ?? 0)}`);
}

function displayStackMetadata(stack: RemoteStack, isMyStack: boolean): void {
  console.log(
    `${ui.colorInfo('Stats:')} ${ui.colorMeta(`${stack.viewCount ?? 0} views, ${stack.installCount ?? 0} installs`)}`
  );
  console.log(
    `${ui.colorInfo('Created:')} ${ui.colorMeta(stack.createdAt ? new Date(stack.createdAt).toLocaleDateString() : 'Unknown')}`
  );

  if (isMyStack) {
    const visibility = stack.public
      ? 'Public (discoverable by others)'
      : 'Private (only visible to you)';
    console.log(`${ui.colorInfo('Visibility:')} ${ui.colorMeta(visibility)}`);
  }

  const stackPath = getStackPath(stack);
  console.log(`${ui.colorInfo('Stack ID:')} ${ui.colorInfo(stackPath)}`);
  console.log(
    `${ui.colorInfo('URL:')} ${ui.colorInfo(`https://commands.com/stacks/${stackPath}`)}`
  );
}

function displayStackInfo(stack: RemoteStack, isMyStack: boolean): void {
  displayStackBasicInfo(stack);
  displayStackComponents(stack);
  displayStackMetadata(stack, isMyStack);
}

function showActionPrompt(isMyStack: boolean, state: BrowseState, stack: RemoteStack): void {
  let actionPrompt = `\nActions: ${ui.colorHighlight('(i)')}nstall, ${ui.colorHighlight('(v)')}iew in browser`;

  if (isMyStack && state.accessToken) {
    const visibilityAction = stack.public
      ? `${ui.colorHighlight('(m)')}ake private`
      : `${ui.colorHighlight('(m)')}ake public`;
    actionPrompt += `, ${ui.colorHighlight('(r)')}ename, ${visibilityAction}, ${ui.colorHighlight('(d)')}elete`;
  }
  actionPrompt += `, ${ui.colorHighlight('(b)')}ack`;
  console.log(actionPrompt);
}

async function handleInstallAction(stack: RemoteStack): Promise<string> {
  console.log(ui.colorInfo('\n📦 Installing stack...'));
  try {
    await installAction(getStackPath(stack), {});
    console.log('\nPress any key to continue...');
    await ui.readSingleChar('');
  } catch (error) {
    console.error(
      ui.colorError('Install failed:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log('\nPress any key to continue...');
    await ui.readSingleChar('');
  }
  return 'retry';
}

async function handleViewAction(stack: RemoteStack): Promise<string> {
  const stackUrl = getStackPath(stack);
  const url = `https://commands.com/stacks/${stackUrl}`;
  console.log(ui.colorInfo(`\n🌐 Opening ${url}...`));
  try {
    await open(url);
    console.log(ui.colorSuccess('✅ Opened in browser!'));
  } catch (error) {
    console.error(
      ui.colorError('Failed to open browser:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log(ui.colorMeta(`Please open manually: ${url}`));
  }
  console.log('\nPress any key to continue...');
  await ui.readSingleChar('');
  return 'retry';
}

async function updateStackVisibility(
  stack: RemoteStack,
  makePublic: boolean,
  accessToken: string
): Promise<void> {
  const apiConfig = api.getConfig();
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
    ? ui.colorStackName(
        `\nMake "${stack.name}" public? Others will be able to discover and install it. (y/N): `
      )
    : ui.colorWarning(
        `\nMake "${stack.name}" private? It will no longer be discoverable by others. (y/N): `
      );
  const successMessage = makePublic
    ? 'Others can now discover and install your stack.'
    : 'Only you can see and access this stack.';

  const confirmAction = await ui.readSingleChar(confirmMessage);
  if (confirmAction.toLowerCase() === 'y') {
    try {
      console.log(ui.colorInfo(`${icon} Making stack ${action}...`));
      await updateStackVisibility(stack, makePublic, accessToken);
      console.log(ui.colorSuccess(`${successIcon} Stack is now ${action}!`));
      console.log(ui.colorMeta(successMessage));
      console.log('\nPress any key to continue...');
      await ui.readSingleChar('');
    } catch (error) {
      console.error(
        ui.colorError('Failed to change visibility:'),
        error instanceof Error ? error.message : String(error)
      );
      console.log('\nPress any key to continue...');
      await ui.readSingleChar('');
    }
  } else {
    console.log(ui.colorMeta('Visibility change cancelled.'));
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
    console.log(ui.colorMeta('Enter new title (or press Enter to cancel): '));
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
  const apiConfig = api.getConfig();
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

  console.log(ui.colorSuccess('✅ Stack renamed successfully!'));
  console.log(ui.colorMeta(`  New title: ${newTitle}`));
  if (result.newUrl) {
    console.log(ui.colorMeta(`  New URL: ${result.newUrl}`));
  }
}

async function handleRenameAction(stack: RemoteStack, state: BrowseState): Promise<string> {
  if (!state.accessToken) return 'retry';

  console.log(ui.colorInfo(`\n🏷️  Current name: "${stack.name}"`));
  const newTitle = await promptForNewTitle();

  if (newTitle && newTitle !== stack.name) {
    try {
      console.log(ui.colorInfo('\n📝 Renaming stack...'));
      await performStackRename(stack, newTitle, state.accessToken);
      console.log('\nPress any key to continue...');
      await ui.readSingleChar('');
    } catch (error) {
      console.error(
        ui.colorError('Rename failed:'),
        error instanceof Error ? error.message : String(error)
      );
      console.log('\nPress any key to continue...');
      await ui.readSingleChar('');
    }
  } else {
    console.log(ui.colorMeta('Rename cancelled.'));
  }
  return 'retry';
}

async function handleDeleteAction(stack: RemoteStack): Promise<string | null> {
  const confirmAction = await ui.readSingleChar(
    ui.colorWarning(`\nDelete "${stack.name}"? This cannot be undone. (y/N): `)
  );
  if (confirmAction.toLowerCase() === 'y') {
    try {
      await deleteAction(getStackPath(stack));
      console.log('\nStack deleted. Press any key to continue...');
      await ui.readSingleChar('');
      return null;
    } catch (error) {
      console.error(
        ui.colorError('Delete failed:'),
        error instanceof Error ? error.message : String(error)
      );
      console.log('\nPress any key to continue...');
      await ui.readSingleChar('');
    }
  } else {
    console.log(ui.colorMeta('Delete cancelled.'));
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

  console.log(ui.colorError('Invalid action. Please try again.'));
  return 'retry';
}

async function showStackActions(
  stack: RemoteStack,
  state: BrowseState,
  isMyStack: boolean = false
): Promise<string | null> {
  displayStackInfo(stack, isMyStack);
  showActionPrompt(isMyStack, state, stack);

  const action = await ui.readSingleChar(ui.colorMeta('Choose an action: '));
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
      ui.colorError('Failed to fetch stacks:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log('\nPress any key to continue...');
    await ui.readSingleChar('');
  }
}

async function handleMyStacksAction(state: BrowseState): Promise<void> {
  try {
    state.accessToken ??= await auth.authenticate();

    const myStacks = await fetchStacks({ myStacks: true }, state.accessToken);
    let stackAction: string | null = 'retry';
    while (stackAction === 'retry') {
      // eslint-disable-next-line no-await-in-loop
      stackAction = await showStackList(myStacks, state, 'My Published Stacks', true);
    }
  } catch (error) {
    console.error(
      ui.colorError('Failed to fetch your stacks:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log('\nPress any key to continue...');
    await ui.readSingleChar('');
  }
}

async function handleSearchAction(state: BrowseState): Promise<void> {
  console.log(ui.colorInfo('\n🔍 Search Stacks'));
  const searchTerm = await new Promise<string>(resolve => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    console.log(ui.colorMeta('Enter search term (or press Enter to cancel): '));
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
        ui.colorError('Search failed:'),
        error instanceof Error ? error.message : String(error)
      );
      console.log('\nPress any key to continue...');
      await ui.readSingleChar('');
    }
  }
}

async function handleLocalStacksAction(): Promise<void> {
  const { listAction } = await import('./list.js');
  await listAction();
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
async function handleMainAction(action: string, state: BrowseState): Promise<boolean> {
  switch (action.toLowerCase()) {
    case 'a':
      await handleAllStacksAction(state);
      return true;

    case 'm':
      await handleMyStacksAction(state);
      return true;

    case 's':
      await handleSearchAction(state);
      return true;

    case 'l':
      await handleLocalStacksAction();
      return true;

    case 'q':
    case '':
      return false;

    default:
      console.log(ui.colorError('Invalid option. Please try again.'));
      return true;
  }
}

export async function browseAction(): Promise<void> {
  const state: BrowseState = {};
  navigationService.pushContext({ source: 'browse' });

  try {
    let continueShowing = true;
    while (continueShowing) {
      console.log(`\n${'─'.repeat(50)}\n`);
      // eslint-disable-next-line no-await-in-loop
      const mainAction = await showMainBrowseMenu();
      // eslint-disable-next-line no-await-in-loop
      continueShowing = await handleMainAction(mainAction, state);
    }
  } catch (error) {
    handleBrowseError(error);
  } finally {
    navigationService.popContext();
  }
}

/**
 * Handle browse action errors consistently
 */
function handleBrowseError(error: unknown): never {
  console.error(
    ui.colorError('Browse failed:'),
    error instanceof Error ? error.message : String(error)
  );

  // In test environment, throw error instead of exiting
  if (process.env.NODE_ENV === 'test') {
    throw new Error(error instanceof Error ? error.message : String(error));
  }

  process.exit(1);
}
