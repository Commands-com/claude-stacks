import fs from 'fs-extra';
import * as path from 'path';
import { getStacksPath } from '../constants/paths.js';
import fetch from 'node-fetch';

import type {
  DeveloperStack,
  PublishOptions,
  StackAgent,
  StackCommand,
  StackMcpServer,
  StackSettings,
} from '../types/index.js';
import { UIService } from '../services/UIService.js';
import { AuthService } from '../services/AuthService.js';
import { ApiService } from '../services/ApiService.js';
import { MetadataService } from '../services/MetadataService.js';
import {
  containsSensitiveData,
  getSanitizationSummary,
  sanitizeMcpServers,
} from '../utils/sanitize.js';

// Create service instances
const ui = new UIService();
const auth = new AuthService();
const api = new ApiService();
const metadata = new MetadataService();

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

    const accessToken = await auth.authenticate();
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
      ui.colorError('Publish failed:'),
      error instanceof Error ? error.message : String(error)
    );

    // In test environment, throw error instead of exiting
    if (process.env.NODE_ENV === 'test') {
      throw error instanceof Error ? error : new Error(String(error));
    }

    process.exit(1);
  }
}

async function resolveStackPath(stackFilePath?: string): Promise<string> {
  if (stackFilePath) {
    return path.resolve(stackFilePath);
  }

  const currentDir = process.cwd();
  const dirName = path.basename(currentDir);
  const stacksDir = getStacksPath();
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
    const globalMeta = await metadata.getAllPublishedStacks();
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
    ui.colorInfo(
      `📦 Updating existing stack "${stack.name}" (${stack.metadata?.published_version} → ${stack.version})`
    )
  );

  const action = await ui.readSingleChar(
    `Actions: ${ui.colorHighlight('(u)')}pdate existing, ${ui.colorHighlight('(n)')}ew stack, ${ui.colorHighlight('(c)')}ancel: `
  );

  switch (action.toLowerCase()) {
    case 'c':
    case '':
      console.log(ui.colorMeta('Publish cancelled.'));
      return { shouldContinue: false, isUpdate: false };
    case 'n':
      console.log(ui.colorInfo('Creating new stack instead of updating...'));
      delete stack.metadata?.published_stack_id;
      delete stack.metadata?.published_version;
      return { shouldContinue: true, isUpdate: false };
    case 'u':
      console.log(ui.colorInfo('Updating existing stack...'));
      console.log(
        ui.colorMeta(
          '💡 Name/description from website will be preserved, only content will be updated'
        )
      );
      return { shouldContinue: true, isUpdate: true };
    default:
      console.log(ui.colorError('Invalid action. Cancelling publish.'));
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

/**
 * Check for sensitive data in stack and display warnings to user
 */
function checkAndWarnAboutSensitiveData(stack: DeveloperStack, options: PublishOptions): void {
  if (options.skipSanitization) {
    console.log(ui.colorWarning('⚠️  Sanitization skipped - sensitive data may be published!'));
    return;
  }

  const serversWithSensitiveData = (stack.mcpServers ?? [])
    .filter(containsSensitiveData)
    .map(getSanitizationSummary);

  if (serversWithSensitiveData.length > 0) {
    console.log(ui.colorInfo('🔐 Sanitizing sensitive data for publication...'));
    console.log(ui.colorMeta('   The following will be replaced with generic placeholders:'));

    for (const summary of serversWithSensitiveData) {
      console.log(
        ui.colorMeta(`   • ${summary.serverName}: ${summary.sensitiveFields.join(', ')}`)
      );
    }

    console.log(ui.colorMeta('   💡 Your local stack file remains unchanged\n'));
  }
}

/**
 * Create sanitized payload for publishing, replacing sensitive data with placeholders
 */
function createSanitizedBasePayload(
  stack: DeveloperStack,
  options: PublishOptions
): Partial<StackPayload> {
  const basePayload = createBasePayload(stack);

  // Skip sanitization if explicitly requested (with warning)
  if (options.skipSanitization) {
    return basePayload;
  }

  // Sanitize MCP servers to remove sensitive paths
  if (basePayload.mcpServers) {
    basePayload.mcpServers = sanitizeMcpServers(basePayload.mcpServers) ?? [];
  }

  return basePayload;
}

function prepareStackPayload(
  stack: DeveloperStack,
  isUpdate: boolean,
  options: PublishOptions
): StackPayload {
  // Check for sensitive data and warn user about sanitization
  checkAndWarnAboutSensitiveData(stack, options);

  const basePayload = createSanitizedBasePayload(stack, options);
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
  const apiConfig = api.getConfig();
  console.log(ui.colorInfo(`📤 ${isUpdate ? 'Updating' : 'Uploading'} stack to Commands.com...`));

  if (api.isLocalDev()) {
    console.log(ui.colorMeta(`   Using local backend: ${apiConfig.baseUrl}`));
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

  await metadata.savePublishedStackMetadata(currentDir, {
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

  const stacksDir = getStacksPath();
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

function calculateComponentCount(stackPayload: StackPayload): number {
  const commandCount = stackPayload.commands?.length ?? 0;
  const agentCount = stackPayload.agents?.length ?? 0;
  const mcpServerCount = stackPayload.mcpServers?.length ?? 0;
  return commandCount + agentCount + mcpServerCount;
}

function displayPublishResult(params: DisplayResultParams): void {
  const { result, stackId, stack, isUpdate, options, stackPayload } = params;
  const successMessage = isUpdate ? 'content updated' : 'published';
  const url = result.url ?? `https://commands.com/stacks/${stackId}`;
  const componentCount = calculateComponentCount(stackPayload);

  console.log(ui.colorSuccess(`✅ Stack ${successMessage} successfully!`));
  console.log(ui.colorMeta(`  Stack ID: ${stackId}`));
  console.log(ui.colorMeta(`  URL: ${url}`));
  console.log(ui.colorMeta(`  Version: ${stack.version}`));
  console.log(ui.colorMeta(`  Components: ${componentCount} items`));

  if (isUpdate) {
    console.log(ui.colorMeta(`  📝 Name/description preserved from website`));
  } else {
    const visibility = options.public ? 'Public' : 'Private';
    console.log(ui.colorMeta(`  Visibility: ${visibility}`));
  }
}
