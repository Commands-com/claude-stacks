import fetch from 'node-fetch';

import { colors } from '../utils/colors';
import { authenticate } from '../utils/auth';
import { getApiConfig, isLocalDev } from '../utils/api';

export async function deleteAction(stackId: string): Promise<void> {
  const apiConfig = getApiConfig();
  console.log(colors.warning(`🗑️ Deleting stack ${stackId}...`));
  if (isLocalDev()) {
    console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
  }
  
  try {
    // Authenticate
    const accessToken = await authenticate();
    
    const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${stackId}`, {
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
    console.log(colors.success(`✅ Stack deleted successfully!`));
    console.log(colors.meta(`   Stack ID: ${result.stackId || stackId}`));
    
  } catch (error) {
    console.error(colors.error('Delete failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}