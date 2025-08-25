import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export interface PublishedStackMetadata {
  stack_id: string;
  stack_name: string;
  last_published_version: string;
  last_published_at: string;
  last_export_hash?: string;
}

export interface StacksMetadata {
  published_stacks: Record<string, PublishedStackMetadata>;
}

/**
 * Get the path to the global stacks metadata file
 */
function getMetadataPath(): string {
  return path.join(os.homedir(), '.claude', '.claude-stacks-meta.json');
}

/**
 * Load the stacks metadata file, creating it if it doesn't exist
 */
export async function loadMetadata(): Promise<StacksMetadata> {
  const metadataPath = getMetadataPath();
  
  try {
    if (await fs.pathExists(metadataPath)) {
      return await fs.readJson(metadataPath);
    }
  } catch (error) {
    // If file is corrupted, start fresh
    console.warn('Warning: Could not read metadata file, starting fresh');
  }
  
  // Return default structure
  return {
    published_stacks: {}
  };
}

/**
 * Save the stacks metadata file
 */
export async function saveMetadata(metadata: StacksMetadata): Promise<void> {
  const metadataPath = getMetadataPath();
  
  // Ensure directory exists
  await fs.ensureDir(path.dirname(metadataPath));
  
  await fs.writeJson(metadataPath, metadata, { spaces: 2 });
}

/**
 * Get published stack metadata for a specific directory
 */
export async function getPublishedStackMetadata(directoryPath: string): Promise<PublishedStackMetadata | null> {
  const metadata = await loadMetadata();
  return metadata.published_stacks[directoryPath] || null;
}

/**
 * Save or update published stack metadata for a directory
 */
export async function savePublishedStackMetadata(
  directoryPath: string, 
  stackMetadata: PublishedStackMetadata
): Promise<void> {
  const metadata = await loadMetadata();
  metadata.published_stacks[directoryPath] = stackMetadata;
  await saveMetadata(metadata);
}

/**
 * Remove published stack metadata for a directory
 */
export async function removePublishedStackMetadata(directoryPath: string): Promise<void> {
  const metadata = await loadMetadata();
  delete metadata.published_stacks[directoryPath];
  await saveMetadata(metadata);
}

/**
 * Get all published stacks metadata
 */
export async function getAllPublishedStacks(): Promise<Record<string, PublishedStackMetadata>> {
  const metadata = await loadMetadata();
  return metadata.published_stacks;
}

/**
 * Find stack metadata by stack ID
 */
export async function findStackByStackId(stackId: string): Promise<{ path: string; metadata: PublishedStackMetadata } | null> {
  const metadata = await loadMetadata();
  
  for (const [directoryPath, stackMetadata] of Object.entries(metadata.published_stacks)) {
    if (stackMetadata.stack_id === stackId) {
      return { path: directoryPath, metadata: stackMetadata };
    }
  }
  
  return null;
}

/**
 * Clean up metadata for directories that no longer exist
 */
export async function cleanupMetadata(): Promise<string[]> {
  const metadata = await loadMetadata();
  const removedPaths: string[] = [];
  
  for (const directoryPath of Object.keys(metadata.published_stacks)) {
    if (!await fs.pathExists(directoryPath)) {
      delete metadata.published_stacks[directoryPath];
      removedPaths.push(directoryPath);
    }
  }
  
  if (removedPaths.length > 0) {
    await saveMetadata(metadata);
  }
  
  return removedPaths;
}