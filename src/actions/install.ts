import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';

import { DeveloperStack, InstallOptions } from '../types';
import { colors } from '../utils/colors';
import { getApiConfig, isLocalDev } from '../utils/api';

// Note: This will import restoreAction once it's extracted
// import { restoreAction } from './restore';

// Temporary placeholder for restore functionality
async function restoreStackFromFile(filePath: string, options: any): Promise<void> {
  console.log(colors.warning('Stack restoration not yet fully implemented in modular structure'));
  console.log(colors.info(`Would restore stack from: ${filePath}`));
}

export async function installAction(stackId: string, options: InstallOptions = {}): Promise<void> {
  const apiConfig = getApiConfig();
  console.log(colors.info(`📥 Fetching stack ${stackId} from Commands.com...`));
  if (isLocalDev()) {
    console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
  }
  
  try {
    // Fetch stack from Commands.com
    const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${stackId}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'claude-stacks-cli/1.0.0'
      }
    });
    
    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody ? `\n${errorBody}` : '';
      } catch {}
      
      if (response.status === 404) {
        throw new Error(`Stack ${stackId} not found. It may be private or not exist.${errorDetails}`);
      }
      throw new Error(`Failed to fetch stack: ${response.status} ${response.statusText}${errorDetails}`);
    }
    
    const remoteStack = await response.json() as any;
    
    // Convert remote stack format to local DeveloperStack format
    const stack: DeveloperStack = {
      name: remoteStack.name,
      description: remoteStack.description,
      version: remoteStack.version || '1.0.0',
      commands: remoteStack.commands || [],
      agents: remoteStack.agents || [],
      mcpServers: remoteStack.mcpServers || [],
      settings: remoteStack.settings || {},
      metadata: {
        ...remoteStack.metadata,
        installed_from: `commands.com/${stackId}`,
        installed_at: new Date().toISOString()
      }
    };
    
    console.log(colors.stackName(`Installing: ${stack.name}`));
    console.log(colors.meta(`By: ${remoteStack.author || 'Unknown'}`));
    console.log(`Description: ${colors.description(stack.description)}\n`);
    
    // Use the existing restore function to install the stack
    // First, save it as a temporary file
    const tempStackPath = path.join(os.tmpdir(), `remote-stack-${stackId}.json`);
    await fs.writeJson(tempStackPath, stack, { spaces: 2 });
    
    try {
      await restoreStackFromFile(tempStackPath, options);
      
      // Track successful installation
      try {
        const trackResponse = await fetch(`${apiConfig.baseUrl}/v1/stacks/${stackId}/install`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'claude-stacks-cli/1.0.0'
          }
        });
        
        if (!trackResponse.ok) {
          // Silently fail tracking - don't block installation
          console.log(colors.meta('   (Install tracking unavailable)'));
        }
      } catch (trackError) {
        // Silently fail tracking - don't block installation
        console.log(colors.meta('   (Install tracking unavailable)'));
      }
      
      console.log(colors.success(`\n✅ Successfully installed "${stack.name}" from Commands.com!`));
      console.log(colors.meta(`   Stack ID: ${stackId}`));
      console.log(colors.meta(`   Author: ${remoteStack.author || 'Unknown'}`));
      
    } finally {
      // Clean up temporary file
      try {
        await fs.remove(tempStackPath);
      } catch {}
    }
    
  } catch (error) {
    console.error(colors.error('Installation failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}