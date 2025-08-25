import fetch from 'node-fetch';
import { colors } from '../utils/colors.js';
import { authenticate } from '../utils/auth.js';
import { getApiConfig, isLocalDev } from '../utils/api.js';
import { findStackByStackId, removePublishedStackMetadata } from '../utils/metadata.js';

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

async function performStackDeletion(org: string, name: string, accessToken: string): Promise<void> {
  const apiConfig = getApiConfig();
  const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${org}/${name}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
    throw new Error(
      `Failed to delete stack: ${response.status} ${response.statusText}${errorDetails}`
    );
  }
}

async function cleanupLocalMetadata(org: string, name: string): Promise<void> {
  const finalStackId = `${org}/${name}`;
  const stackMetadata = await findStackByStackId(finalStackId);
  if (stackMetadata) {
    await removePublishedStackMetadata(stackMetadata.path);
    console.log(colors.meta(`   Cleared local metadata for ${stackMetadata.path}`));
  }
}

export async function deleteAction(stackId: string): Promise<void> {
  const apiConfig = getApiConfig();
  console.log(colors.warning(`🗑️ Deleting stack ${stackId}...`));
  if (isLocalDev()) {
    console.log(colors.meta(`   Using local backend: ${apiConfig.baseUrl}`));
  }

  try {
    const accessToken = await authenticate();
    const { org, name } = validateStackId(stackId);

    await performStackDeletion(org, name, accessToken);
    await cleanupLocalMetadata(org, name);

    const finalStackId = `${org}/${name}`;
    console.log(colors.success(`✅ Stack deleted successfully!`));
    console.log(colors.meta(`   Stack ID: ${finalStackId}`));
  } catch (error) {
    console.error(
      colors.error('Delete failed:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
