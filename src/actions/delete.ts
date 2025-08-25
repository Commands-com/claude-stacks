import fetch from 'node-fetch';
import { colors } from '../utils/colors';
import { authenticate } from '../utils/auth';
import { getApiConfig, isLocalDev } from '../utils/api';
import { findStackByStackId, removePublishedStackMetadata } from '../utils/metadata';

export async function deleteAction(stackId: string): Promise<void> {
  const apiConfig = getApiConfig();
  console.log(colors.warning(`🗑️ Deleting stack ${stackId}...`));
  if (isLocalDev()) {
    console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
  }
  
  try {
    // Authenticate
    const accessToken = await authenticate();
    
    // Validate org/name format
    if (!stackId.includes('/')) {
      throw new Error(`Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: ${stackId}`);
    }
    
    const [org, name] = stackId.split('/');
    if (!org || !name) {
      throw new Error(`Invalid stack ID format. Expected org/name format (e.g., "commands-com/my-stack"), got: ${stackId}`);
    }
    
    const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${org}/${name}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'claude-stacks-cli/1.0.0'
      }
    });
    
    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody ? `\n${errorBody}` : '';
      } catch {}
      throw new Error(`Failed to delete stack: ${response.status} ${response.statusText}${errorDetails}`);
    }
    
    const result = await response.json() as any;
    
    // Clean up local metadata for this stack
    const finalStackId = `${org}/${name}`;
    const stackMetadata = await findStackByStackId(finalStackId);
    if (stackMetadata) {
      await removePublishedStackMetadata(stackMetadata.path);
      console.log(colors.meta(`   Cleared local metadata for ${stackMetadata.path}`));
    }
    
    console.log(colors.success(`✅ Stack deleted successfully!`));
    console.log(colors.meta(`   Stack ID: ${finalStackId}`));
    
  } catch (error) {
    console.error(colors.error('Delete failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}