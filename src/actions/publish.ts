import fs from 'fs-extra';
import * as path from 'path';
import { STACKS_PATH } from '../constants/paths.js';
import fetch from 'node-fetch';

import type {
  DeveloperStack,
  PublishOptions,
  StackAgent,
  StackCommand,
  StackMcpServer,
  StackSettings,
} from '../types/index.js';
import { colors } from '../utils/colors.js';
import { authenticate } from '../utils/auth.js';
import { getApiConfig, isLocalDev } from '../utils/api.js';
import { getAllPublishedStacks, savePublishedStackMetadata } from '../utils/metadata.js';
import { readSingleChar } from '../utils/input.js';

/**
 * Publishes a development stack to Commands.com for sharing with the community
 *
 * @param stackFilePath - Optional path to stack file (defaults to current directory's stack)
 * @param options - Publishing options including visibility and metadata overrides
 *
 * @returns Promise that resolves when publishing is complete
 *
 * @throws {@link Error} When authentication fails, stack validation fails, or upload errors occur
 *
 * @example
 * ```typescript
 * // Publish current directory's stack
 * await publishAction();
 *
 * // Publish specific stack file as public
 * await publishAction('my-stack.json', {
 *   public: true
 * });
 * ```
 *
 * @remarks
 * Handles both new stack creation and updates to existing published stacks.
 * Requires authentication with Commands.com and validates stack content before upload.
 * Updates local metadata with published stack information.
 *
 * @since 1.0.0
 * @public
 */
export async function publishAction(
  stackFilePath?: string,
  options: PublishOptions = {}
): Promise<void> {
  try {
    const stackPath = await resolveStackPath(stackFilePath);
    const stack = await loadAndValidateStack(stackPath);

    const { shouldContinue, isUpdate } = await handleUpdateFlow(stack);
    if (!shouldContinue) return; // User cancelled

    const accessToken = await authenticate();
    const stackPayload = prepareStackPayload(stack, isUpdate, options);

    const result = await performUpload(stackPayload, stack, isUpdate, accessToken);
    await saveMetadataAndDisplayResult({
      stack,
      result,
      stackPath,
      isUpdate,
      options,
      stackPayload,
    });
  } catch (error) {
    console.error(
      colors.error('Publish failed:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

async function resolveStackPath(stackFilePath?: string): Promise<string> {
  if (stackFilePath) {
    return path.resolve(stackFilePath);
  }

  const currentDir = process.cwd();
  const dirName = path.basename(currentDir);
  const stacksDir = STACKS_PATH;
  const defaultStackFile = `${dirName}-stack.json`;
  return path.join(stacksDir, defaultStackFile);
}

async function loadAndValidateStack(stackPath: string): Promise<DeveloperStack> {
  if (!(await fs.pathExists(stackPath))) {
    throw new Error(`Stack file not found: ${stackPath}. Run 'claude-stacks export' first.`);
  }

  const stack = (await fs.readJson(stackPath)) as DeveloperStack;
  await validateStackForPublishing(stack);
  return stack;
}

async function validateStackForPublishing(stack: DeveloperStack): Promise<void> {
  if (stack.metadata?.published_stack_id) {
    const globalMeta = await getAllPublishedStacks();
    const currentDir = stack.metadata?.exported_from ?? process.cwd();
    const lastPublished = globalMeta[currentDir];

    if (lastPublished && lastPublished.stack_name !== stack.name) {
      throw new Error(
        `Stack name changed from "${lastPublished.stack_name}" to "${stack.name}".\nUse 'claude-stacks rename "${stack.name}"' to rename the published stack first.`
      );
    }
  }
}

async function handleUpdateFlow(
  stack: DeveloperStack
): Promise<{ shouldContinue: boolean; isUpdate: boolean }> {
  const isUpdate = Boolean(stack.metadata?.published_stack_id);

  if (!isUpdate) {
    return { shouldContinue: true, isUpdate: false };
  }

  console.log(
    colors.info(
      `📦 Updating existing stack "${stack.name}" (${stack.metadata?.published_version} → ${stack.version})`
    )
  );

  const action = await readSingleChar(
    `Actions: ${colors.highlight('(u)')}pdate existing, ${colors.highlight('(n)')}ew stack, ${colors.highlight('(c)')}ancel: `
  );

  switch (action.toLowerCase()) {
    case 'c':
    case '':
      console.log(colors.meta('Publish cancelled.'));
      return { shouldContinue: false, isUpdate: false };
    case 'n':
      console.log(colors.info('Creating new stack instead of updating...'));
      delete stack.metadata?.published_stack_id;
      delete stack.metadata?.published_version;
      return { shouldContinue: true, isUpdate: false };
    case 'u':
      console.log(colors.info('Updating existing stack...'));
      console.log(
        colors.meta(
          '💡 Name/description from website will be preserved, only content will be updated'
        )
      );
      return { shouldContinue: true, isUpdate: true };
    default:
      console.log(colors.error('Invalid action. Cancelling publish.'));
      return { shouldContinue: false, isUpdate: false };
  }
}

interface StackPayload {
  name?: string;
  description?: string;
  version?: string;
  commands?: StackCommand[];
  agents?: StackAgent[];
  mcpServers?: StackMcpServer[];
  settings?: StackSettings;
  claudeMd?: DeveloperStack['claudeMd'];
  public?: boolean;
  metadata?: Record<string, unknown>;
}

interface PublishResponse {
  org?: string;
  name?: string;
  organizationUsername?: string;
  url?: string;
  [key: string]: unknown;
}

function createBasePayload(stack: DeveloperStack): Partial<StackPayload> {
  return {
    version: stack.version,
    commands: stack.commands ?? [],
    agents: stack.agents ?? [],
    mcpServers: stack.mcpServers ?? [],
    settings: stack.settings ?? {},
    ...(stack.claudeMd && { claudeMd: stack.claudeMd }),
  };
}

function createBaseMetadata(stack: DeveloperStack): Record<string, unknown> {
  return {
    ...stack.metadata,
    cli_version: '1.0.0',
    published_at: new Date().toISOString(),
  };
}

function prepareStackPayload(
  stack: DeveloperStack,
  isUpdate: boolean,
  options: PublishOptions
): StackPayload {
  const basePayload = createBasePayload(stack);
  const baseMetadata = createBaseMetadata(stack);

  if (isUpdate) {
    return {
      ...basePayload,
      metadata: baseMetadata,
    };
  }

  return {
    name: stack.name,
    description: stack.description,
    ...basePayload,
    public: options.public ?? false,
    metadata: baseMetadata,
  };
}

async function performUpload(
  stackPayload: StackPayload,
  stack: DeveloperStack,
  isUpdate: boolean,
  accessToken: string
): Promise<PublishResponse> {
  const apiConfig = getApiConfig();
  console.log(colors.info(`📤 ${isUpdate ? 'Updating' : 'Uploading'} stack to Commands.com...`));

  if (isLocalDev()) {
    console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
  }

  const url = isUpdate
    ? `${apiConfig.baseUrl}/v1/stacks/${stack.metadata?.published_stack_id}`
    : `${apiConfig.baseUrl}/v1/stacks`;

  const response = await fetch(url, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'claude-stacks-cli/1.0.0',
    },
    body: JSON.stringify(stackPayload),
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody ? `\n${errorBody}` : '';
    } catch {
      // Ignore error when reading error details
    }
    throw new Error(`Upload failed: ${response.status} ${response.statusText}${errorDetails}`);
  }

  return (await response.json()) as PublishResponse;
}

interface SaveMetadataParams {
  stack: DeveloperStack;
  result: PublishResponse;
  stackPath: string;
  isUpdate: boolean;
  options: PublishOptions;
  stackPayload: StackPayload;
}

async function saveMetadataAndDisplayResult(params: SaveMetadataParams): Promise<void> {
  const { stack, result, isUpdate, options, stackPayload } = params;
  const stackId = extractStackId(result);
  const currentDir = stack.metadata?.exported_from ?? process.cwd();

  await savePublishedStackMetadata(currentDir, {
    stack_id: stackId,
    stack_name: stack.name,
    last_published_version: stack.version ?? '1.0.0',
    last_published_at: new Date().toISOString(),
  });

  // Update and save stack file
  stack.metadata ??= {
    created_at: new Date().toISOString(),
    exported_from: currentDir,
  };

  stack.metadata.published_stack_id = stackId;
  stack.metadata.published_version = stack.version ?? '1.0.0';

  const stacksDir = STACKS_PATH;
  const stackFileName = `${path.basename(currentDir)}-stack.json`;
  const updatedStackFilePath = path.join(stacksDir, stackFileName);
  await fs.writeJson(updatedStackFilePath, stack, { spaces: 2 });

  displayPublishResult({ result, stackId, stack, isUpdate, options, stackPayload });
}

function extractStackId(result: PublishResponse): string {
  if (result.org && result.name) {
    return `${result.org}/${result.name}`;
  }
  if (result.organizationUsername && result.name) {
    return `${result.organizationUsername}/${result.name}`;
  }
  if (result.url) {
    const urlMatch = (result.url as string)?.match(/\/stacks\/([^/]+)\/([^/]+)\/?$/);
    if (urlMatch) {
      return `${urlMatch[1]}/${urlMatch[2]}`;
    }
    throw new Error('Unable to determine stack ID from API response');
  }
  throw new Error('API response missing required org/name information');
}

interface DisplayResultParams {
  result: PublishResponse;
  stackId: string;
  stack: DeveloperStack;
  isUpdate: boolean;
  options: PublishOptions;
  stackPayload: StackPayload;
}

function displayPublishResult(params: DisplayResultParams): void {
  const { result, stackId, stack, isUpdate, options, stackPayload } = params;
  console.log(
    colors.success(`✅ Stack ${isUpdate ? 'content updated' : 'published'} successfully!`)
  );
  console.log(colors.meta(`  Stack ID: ${stackId}`));
  console.log(colors.meta(`  URL: ${result.url ?? `https://commands.com/stacks/${stackId}`}`));
  console.log(colors.meta(`  Version: ${stack.version}`));
  const commandCount = stackPayload.commands?.length ?? 0;
  const agentCount = stackPayload.agents?.length ?? 0;
  console.log(colors.meta(`  Components: ${commandCount + agentCount} items`));

  if (isUpdate) {
    console.log(colors.meta(`  📝 Name/description preserved from website`));
  } else {
    console.log(colors.meta(`  Visibility: ${options.public ? 'Public' : 'Private'}`));
  }
}
