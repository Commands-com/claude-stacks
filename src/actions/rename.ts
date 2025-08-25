import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';

import { DeveloperStack } from '../types';
import { colors } from '../utils/colors';
import { authenticate } from '../utils/auth';
import { getApiConfig, isLocalDev } from '../utils/api';
import { savePublishedStackMetadata } from '../utils/metadata';

export async function renameAction(newTitle: string): Promise<void> {
  try {
    // Find stack file in current directory
    const currentDir = process.cwd();
    const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
    const defaultStackFile = `${path.basename(currentDir)}-stack.json`;
    const stackPath = path.join(stacksDir, defaultStackFile);
    
    if (!await fs.pathExists(stackPath)) {
      throw new Error(`Stack file not found: ${stackPath}. Make sure you're in the correct directory and have exported a stack.`);
    }
    
    // Load stack
    const stack: DeveloperStack = await fs.readJson(stackPath);
    
    if (!stack.metadata?.published_stack_id) {
      throw new Error('Stack is not published. Use "claude-stacks publish" first.');
    }
    
    // Extract current org/name from published_stack_id
    const [org, oldName] = stack.metadata.published_stack_id.split('/');
    if (!org || !oldName) {
      throw new Error('Invalid published stack ID format. Expected "org/name".');
    }
    
    console.log(colors.info(`🏷️  Renaming stack "${stack.name}" → "${newTitle}"`));
    console.log(colors.meta(`   Current URL: https://commands.com/stacks/${org}/${oldName}`));
    
    if (isLocalDev()) {
      const apiConfig = getApiConfig();
      console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
    }
    
    // Authenticate
    const accessToken = await authenticate();
    
    // Call rename endpoint
    const apiConfig = getApiConfig();
    const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${org}/${oldName}/rename`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'claude-stacks-cli/1.0.0'
      },
      body: JSON.stringify({
        title: newTitle
      })
    });
    
    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody ? `\n${errorBody}` : '';
      } catch {}
      throw new Error(`Rename failed: ${response.status} ${response.statusText}${errorDetails}`);
    }
    
    const result = await response.json() as any;
    
    // Update local stack file
    stack.name = newTitle;  // Update the display name
    if (stack.metadata) {
      stack.metadata.published_stack_id = `${result.organizationUsername}/${result.name}`;
      stack.metadata.updated_at = new Date().toISOString();
    }
    
    await fs.writeJson(stackPath, stack, { spaces: 2 });
    
    // Update global metadata
    await savePublishedStackMetadata(currentDir, {
      stack_id: `${result.organizationUsername}/${result.name}`,
      stack_name: newTitle,
      last_published_version: stack.version || '1.0.0',
      last_published_at: new Date().toISOString()
    });
    
    console.log(colors.success('✅ Stack renamed successfully!'));
    console.log(colors.meta(`  New title: ${newTitle}`));
    console.log(colors.meta(`  New URL: ${result.newUrl}`));
    if (result.oldUrl !== result.newUrl) {
      console.log(colors.meta(`  Old URL: ${result.oldUrl} (will redirect)`));
    }
    
  } catch (error) {
    console.error(colors.error('Rename failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}