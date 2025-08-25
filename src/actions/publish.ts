import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';

import { DeveloperStack, PublishOptions } from '../types/index.js';
import { colors } from '../utils/colors.js';
import { authenticate } from '../utils/auth.js';
import { getApiConfig, isLocalDev } from '../utils/api.js';
import { savePublishedStackMetadata, getPublishedStackMetadata, getAllPublishedStacks } from '../utils/metadata.js';
import { readSingleChar } from '../utils/input.js';

export async function publishAction(stackFilePath?: string, options: PublishOptions = {}): Promise<void> {
  try {
    // Find stack file
    let stackPath: string;
    if (stackFilePath) {
      stackPath = path.resolve(stackFilePath);
    } else {
      // Look for stack file in ~/.claude/stacks/ directory
      const currentDir = process.cwd();
      const dirName = path.basename(currentDir);
      const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
      const defaultStackFile = `${dirName}-stack.json`;
      stackPath = path.join(stacksDir, defaultStackFile);
    }
    
    if (!await fs.pathExists(stackPath)) {
      throw new Error(`Stack file not found: ${stackPath}. Run 'claude-stacks export' first.`);
    }
    
    // Load and validate stack
    const stack: DeveloperStack = await fs.readJson(stackPath);
    
    // Check for name changes in published stacks
    if (stack.metadata?.published_stack_id) {
      const globalMeta = await getAllPublishedStacks();
      const currentDir = stack.metadata?.exported_from || process.cwd();
      const lastPublished = globalMeta[currentDir];
      
      if (lastPublished && lastPublished.stack_name !== stack.name) {
        throw new Error(`Stack name changed from "${lastPublished.stack_name}" to "${stack.name}".\nUse 'claude-stacks rename "${stack.name}"' to rename the published stack first.`);
      }
    }
    
    // Check if this stack has been published before
    const isUpdate = stack.metadata?.published_stack_id;
    if (isUpdate) {
      console.log(colors.info(`📦 Updating existing stack "${stack.name}" (${stack.metadata?.published_version} → ${stack.version})`));
      
      const action = await readSingleChar(colors.stackName('Actions: (u)pdate existing, (n)ew stack, (c)ancel: '));
      
      switch (action.toLowerCase()) {
        case 'c':
        case '':
          console.log(colors.meta('Publish cancelled.'));
          return;
        case 'n':
          console.log(colors.info('Creating new stack instead of updating...'));
          // Remove published metadata so it creates a new stack
          delete stack.metadata?.published_stack_id;
          delete stack.metadata?.published_version;
          break;
        case 'u':
          console.log(colors.info('Updating existing stack...'));
          console.log(colors.meta('💡 Name/description from website will be preserved, only content will be updated'));
          break;
        default:
          console.log(colors.error('Invalid action. Cancelling publish.'));
          return;
      }
    }
    
    // Authenticate
    const accessToken = await authenticate();
    
    // Prepare stack for upload
    const stackPayload = isUpdate ? {
      // For updates: Only send content that should be updated (preserve website name/description)
      version: stack.version,
      commands: stack.commands || [],
      agents: stack.agents || [],
      mcpServers: stack.mcpServers || [],
      settings: stack.settings || {},
      ...(stack.claudeMd && { claudeMd: stack.claudeMd }),
      metadata: {
        ...stack.metadata,
        cli_version: '1.0.0',
        published_at: new Date().toISOString()
      }
    } : {
      // For new stacks: Send everything including name/description
      name: stack.name,
      description: stack.description,
      version: stack.version,
      commands: stack.commands || [],
      agents: stack.agents || [],
      mcpServers: stack.mcpServers || [],
      settings: stack.settings || {},
      ...(stack.claudeMd && { claudeMd: stack.claudeMd }),
      public: options.public || false,
      metadata: {
        ...stack.metadata,
        cli_version: '1.0.0',
        published_at: new Date().toISOString()
      }
    };
    
    const apiConfig = getApiConfig();
    console.log(colors.info(`📤 ${isUpdate ? 'Updating' : 'Uploading'} stack to Commands.com...`));
    if (isLocalDev()) {
      console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
    }
    
    // Use PUT for updates, POST for new stacks
    // For updates, published_stack_id should be in org/name format
    const url = isUpdate 
      ? `${apiConfig.baseUrl}/v1/stacks/${stack.metadata?.published_stack_id}`  // published_stack_id now contains org/name
      : `${apiConfig.baseUrl}/v1/stacks`;
    
    const response = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'claude-stacks-cli/1.0.0'
      },
      body: JSON.stringify(stackPayload)
    });
    
    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody ? `\n${errorBody}` : '';
      } catch {}
      throw new Error(`Upload failed: ${response.status} ${response.statusText}${errorDetails}`);
    }
    
    const result = await response.json() as any;
    
    // Save metadata for future updates
    let stackId: string;
    if (result.org && result.name) {
      stackId = `${result.org}/${result.name}`;
    } else if (result.url) {
      // Extract org/name from URL: https://commands.com/stacks/org/name/
      const urlMatch = result.url.match(/\/stacks\/([^/]+)\/([^/]+)\/?$/);
      if (urlMatch) {
        stackId = `${urlMatch[1]}/${urlMatch[2]}`;
      } else {
        throw new Error('Unable to determine stack ID from API response');
      }
    } else {
      throw new Error('API response missing required org/name information');
    }
    const currentDir = stack.metadata?.exported_from || process.cwd();
    
    await savePublishedStackMetadata(currentDir, {
      stack_id: stackId,
      stack_name: stack.name,
      last_published_version: stack.version || '1.0.0',
      last_published_at: new Date().toISOString()
    });
    
    // Also update the stack file with published metadata
    if (!stack.metadata) {
      stack.metadata = {
        created_at: new Date().toISOString(),
        exported_from: currentDir
      };
    }
    stack.metadata.published_stack_id = stackId;
    stack.metadata.published_version = stack.version || '1.0.0';
    
    // Save updated stack file
    const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
    const stackFileName = `${path.basename(currentDir)}-stack.json`;
    const updatedStackFilePath = path.join(stacksDir, stackFileName);
    await fs.writeJson(updatedStackFilePath, stack, { spaces: 2 });
    
    console.log(colors.success(`✅ Stack ${isUpdate ? 'content updated' : 'published'} successfully!`));
    console.log(colors.meta(`  Stack ID: ${stackId}`));
    console.log(colors.meta(`  URL: ${result.url || `https://commands.com/stacks/${stackId}`}`));
    console.log(colors.meta(`  Version: ${stack.version}`));
    console.log(colors.meta(`  Components: ${stackPayload.commands.length + stackPayload.agents.length} items`));
    if (isUpdate) {
      console.log(colors.meta(`  📝 Name/description preserved from website`));
    } else {
      console.log(colors.meta(`  Visibility: ${options.public ? 'Public' : 'Private'}`));
    }
    
  } catch (error) {
    console.error(colors.error('Publish failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}