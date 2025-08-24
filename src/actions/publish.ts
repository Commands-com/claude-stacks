import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';

import { DeveloperStack, PublishOptions } from '../types';
import { colors } from '../utils/colors';
import { authenticate } from '../utils/auth';
import { getApiConfig, isLocalDev } from '../utils/api';

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
    
    // Authenticate
    const accessToken = await authenticate();
    
    // Prepare stack for upload
    const stackPayload = {
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
    console.log(colors.info('📤 Uploading stack to Commands.com...'));
    if (isLocalDev()) {
      console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
    }
    
    const response = await fetch(`${apiConfig.baseUrl}/v1/stacks`, {
      method: 'POST',
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
    
    console.log(colors.success('✅ Stack published successfully!'));
    console.log(colors.meta(`  Stack ID: ${result.stackId}`));
    console.log(colors.meta(`  URL: ${result.url || `https://commands.com/stacks/${result.stackId}`}`));
    console.log(colors.meta(`  Components: ${stackPayload.commands.length + stackPayload.agents.length} items`));
    console.log(colors.meta(`  Visibility: ${options.public ? 'Public' : 'Private'}`));
    
  } catch (error) {
    console.error(colors.error('Publish failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}