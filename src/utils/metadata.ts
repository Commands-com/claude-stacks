import fs from 'fs-extra';
import * as path from 'path';
import { METADATA_FILE_PATH } from '../constants/paths.js';

/**
 * Metadata tracking information for published stacks
 *
 * Contains essential information about stacks that have been published to
 * Commands.com, including versioning and change tracking data.
 *
 * @example
 * ```typescript
 * const stackMetadata: PublishedStackMetadata = {
 *   stack_id: 'user/my-stack',
 *   stack_name: 'my-stack',
 *   last_published_version: '1.2.0',
 *   last_published_at: '2023-12-01T10:30:00Z',
 *   last_export_hash: 'abc123def456'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PublishedStackMetadata {
  /** Unique identifier for the stack in format 'org/name' */
  stack_id: string;
  /** Display name of the stack */
  stack_name: string;
  /** Description of the stack */
  description: string;
  /** Semantic version string of the last published version */
  last_published_version: string;
  /** ISO timestamp of when the stack was last published */
  last_published_at: string;
  /** Optional hash of the last exported content for change detection */
  last_export_hash?: string;
}

/**
 * Root metadata structure containing all published stack information
 *
 * Top-level container for all stack metadata, organized by directory path
 * for efficient lookup and management of published stacks.
 *
 * @example
 * ```typescript
 * const metadata: StacksMetadata = {
 *   published_stacks: {
 *     '/path/to/stack1': {
 *       stack_id: 'user/stack1',
 *       stack_name: 'stack1',
 *       last_published_version: '1.0.0',
 *       last_published_at: '2023-12-01T10:30:00Z'
 *     },
 *     '/path/to/stack2': {
 *       stack_id: 'user/stack2',
 *       stack_name: 'stack2',
 *       last_published_version: '2.1.0',
 *       last_published_at: '2023-12-15T14:20:00Z'
 *     }
 *   }
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StacksMetadata {
  /** Map of directory paths to their published stack metadata */
  published_stacks: Record<string, PublishedStackMetadata>;
}

/**
 * Get the path to the global stacks metadata file
 */
export function getMetadataPath(): string {
  return METADATA_FILE_PATH;
}

/**
 * Load the stacks metadata file, creating it if it doesn't exist
 */
export async function loadMetadata(): Promise<StacksMetadata> {
  const metadataPath = getMetadataPath();

  try {
    if (await fs.pathExists(metadataPath)) {
      const data = (await fs.readJson(metadataPath)) as StacksMetadata;
      return data;
    }
  } catch {
    // If file is corrupted, start fresh
    console.warn('Warning: Could not read metadata file, starting fresh');
  }

  // Return default structure
  return {
    published_stacks: {},
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
export async function getPublishedStackMetadata(
  directoryPath: string
): Promise<PublishedStackMetadata | null> {
  const metadata = await loadMetadata();
  return metadata.published_stacks[directoryPath] ?? null;
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
 *
 * Searches through all published stack metadata to find a stack with the
 * specified ID and returns both its directory path and metadata.
 *
 * @param stackId - The stack ID to search for (format: 'org/name')
 * @returns Promise resolving to an object with path and metadata, or null if not found
 *
 * @example
 * ```typescript
 * const result = await findStackByStackId('user/my-stack');
 * if (result) {
 *   console.log(`Found at: ${result.path}`);
 *   console.log(`Version: ${result.metadata.last_published_version}`);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export async function findStackByStackId(stackId: string): Promise<{
  /** The file system path where the stack is located */
  path: string;
  /** The published metadata for the found stack */
  metadata: PublishedStackMetadata;
} | null> {
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

  const directoryPaths = Object.keys(metadata.published_stacks);
  const existenceChecks = await Promise.all(
    directoryPaths.map(async dirPath => ({
      dirPath,
      exists: await fs.pathExists(dirPath),
    }))
  );

  for (const { dirPath, exists } of existenceChecks) {
    if (!exists) {
      delete metadata.published_stacks[dirPath];
      removedPaths.push(dirPath);
    }
  }

  if (removedPaths.length > 0) {
    await saveMetadata(metadata);
  }

  return removedPaths;
}
