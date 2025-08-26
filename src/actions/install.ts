import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';

import type { DeveloperStack, InstallOptions, RemoteStack } from '../types/index.js';
import { colors } from '../utils/colors.js';
import { getApiConfig, isLocalDev } from '../utils/api.js';
import { checkMcpDependencies, displayMissingDependencies } from '../utils/dependencies.js';

import { restoreAction } from './restore.js';

function validateStackId(stackId: string): { org: string; name: string } {
  if (!stackId.includes('/')) {
    throw new Error(
      `Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: ${stackId}`
    );
  }

  const [org, name] = stackId.split('/');
  if (!org || !name) {
    throw new Error(
      `Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: ${stackId}`
    );
  }

  return { org, name };
}

async function fetchStackFromApi(stackId: string, org: string, name: string): Promise<RemoteStack> {
  const apiConfig = getApiConfig();
  const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${org}/${name}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'claude-stacks-cli/1.0.0',
    },
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody ? `\n${errorBody}` : '';
    } catch {
      // Ignore error parsing response body
    }

    if (response.status === 404) {
      throw new Error(`Stack ${stackId} not found. It may be private or not exist.${errorDetails}`);
    }
    throw new Error(
      `Failed to fetch stack: ${response.status} ${response.statusText}${errorDetails}`
    );
  }

  return (await response.json()) as RemoteStack;
}

function convertToLocalStack(remoteStack: RemoteStack, stackId: string): DeveloperStack {
  return {
    name: remoteStack.title ?? remoteStack.name,
    description: remoteStack.description,
    version: remoteStack.version ?? '1.0.0',
    commands: remoteStack.commands ?? [],
    agents: remoteStack.agents ?? [],
    mcpServers: remoteStack.mcpServers ?? [],
    settings: remoteStack.settings ?? {},
    metadata: {
      ...((remoteStack.metadata as Record<string, unknown>) || {}),
      installed_from: `commands.com/${stackId}`,
      installed_at: new Date().toISOString(),
    },
  };
}

async function trackInstallation(org: string, name: string): Promise<void> {
  try {
    const apiConfig = getApiConfig();
    const trackResponse = await fetch(`${apiConfig.baseUrl}/v1/stacks/${org}/${name}/install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-stacks-cli/1.0.0',
      },
    });

    if (!trackResponse.ok) {
      console.log(colors.meta('   (Install tracking unavailable)'));
    }
  } catch {
    console.log(colors.meta('   (Install tracking unavailable)'));
  }
}

async function performStackInstallation(
  stack: DeveloperStack,
  remoteStack: { author?: string },
  stackId: string,
  options: InstallOptions
): Promise<void> {
  const { org, name } = validateStackId(stackId);

  // Use the existing restore function to install the stack
  // First, save it as a temporary file
  const safeStackId = stackId.replace(/\//g, '-');
  const tempStackPath = path.join(os.tmpdir(), `remote-stack-${safeStackId}.json`);
  await fs.writeJson(tempStackPath, stack, { spaces: 2 });

  try {
    await restoreAction(tempStackPath, options);
    await trackInstallation(org, name);

    console.log(colors.success(`\n✅ Successfully installed "${stack.name}" from Commands.com!`));
    console.log(colors.meta(`   Stack ID: ${stackId}`));
    console.log(colors.meta(`   Author: ${remoteStack.author ?? 'Unknown'}`));
  } finally {
    // Clean up temporary file
    try {
      await fs.remove(tempStackPath);
    } catch {
      // Ignore cleanup error - file may not exist
    }
  }
}

/**
 * Installs a published development stack from Commands.com
 *
 * @param stackId - Stack identifier in format "org/name" (e.g., "claude/typescript-tools")
 * @param options - Installation options including scope filters and overwrite behavior
 *
 * @returns Promise that resolves when installation is complete
 *
 * @throws {@link Error} When stack is not found, network errors occur, or installation fails
 *
 * @example
 * ```typescript
 * // Install a public stack
 * await installAction('claude/typescript-tools');
 *
 * // Install with specific options
 * await installAction('org/stack-name', {
 *   localOnly: true,
 *   overwrite: false
 * });
 * ```
 *
 * @remarks
 * Fetches stack metadata and content from Commands.com API.
 * Validates MCP server dependencies before installation.
 * Tracks installation statistics with the remote service.
 *
 * @since 1.0.0
 * @public
 */
export async function installAction(stackId: string, options: InstallOptions = {}): Promise<void> {
  const apiConfig = getApiConfig();
  console.log(colors.info(`📥 Fetching stack ${stackId} from Commands.com...`));
  if (isLocalDev()) {
    console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
  }

  try {
    const { org, name } = validateStackId(stackId);
    const remoteStack = await fetchStackFromApi(stackId, org, name);
    const stack = convertToLocalStack(remoteStack, stackId);

    console.log(colors.stackName(`Installing: ${stack.name}`));
    console.log(colors.meta(`By: ${remoteStack.author ?? 'Unknown'}`));
    console.log(`Description: ${colors.description(stack.description)}\n`);

    // Check for missing MCP server dependencies
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      console.log(colors.info('🔍 Checking MCP server dependencies...'));
      const missingDeps = await checkMcpDependencies(stack.mcpServers);
      displayMissingDependencies(missingDeps);
    }

    await performStackInstallation(stack, remoteStack, stackId, options);
  } catch (error) {
    console.error(
      colors.error('Installation failed:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
