import {
  type PublishedStackMetadata,
  findStackByStackId,
  getAllPublishedStacks,
  getPublishedStackMetadata,
  removePublishedStackMetadata,
  savePublishedStackMetadata,
} from '../utils/metadata.js';
import { generateSuggestedVersion, isValidVersion } from '../utils/version.js';

/**
 * Service for stack metadata operations
 *
 * @remarks
 * Encapsulates metadata utilities to reduce coupling in action layer.
 * Provides a clean interface for managing published stack metadata
 * including creation, retrieval, updates, and deletion.
 *
 * @since 1.2.3
 * @public
 */
export class MetadataService {
  /**
   * Get all published stack metadata from the local metadata store
   *
   * Retrieves the complete collection of metadata for all stacks that have
   * been published from this machine. The returned record maps project paths
   * to their corresponding published metadata.
   *
   * @returns Promise that resolves to a record mapping project paths to published stack metadata
   * @throws {Error} If metadata file cannot be read or is corrupted
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * const allStacks = await metadataService.getAllPublishedStacks();
   * for (const [projectPath, metadata] of Object.entries(allStacks)) {
   *   console.log(`${metadata.stack_name} at ${projectPath}`);
   * }
   * ```
   * @since 1.2.3
   * @public
   */
  async getAllPublishedStacks(): Promise<Record<string, PublishedStackMetadata>> {
    return await getAllPublishedStacks();
  }

  /**
   * Get metadata for a specific published stack by project path
   *
   * Retrieves the published metadata for a stack located at the specified
   * project directory path. Returns null if no metadata exists for the
   * given path, indicating the stack has not been published.
   *
   * @param projectPath - The absolute file system path to the stack's project directory
   * @returns Promise that resolves to the stack metadata or null if not found
   * @throws {Error} If metadata file cannot be read or is corrupted
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * const metadata = await metadataService.getPublishedStackMetadata('/path/to/project');
   * if (metadata) {
   *   console.log(`Stack ID: ${metadata.stack_id}`);
   *   console.log(`Last published: ${metadata.last_published_version}`);
   * }
   * ```
   * @since 1.2.3
   * @public
   */
  async getPublishedStackMetadata(projectPath: string): Promise<PublishedStackMetadata | null> {
    return await getPublishedStackMetadata(projectPath);
  }

  /**
   * Save metadata for a published stack to the local metadata store
   *
   * Persists the provided metadata for a stack at the specified project path.
   * This creates or updates the metadata entry and writes it to the global
   * metadata file for future reference.
   *
   * @param projectPath - The absolute file system path to the stack's project directory
   * @param metadata - The complete published stack metadata to save
   * @returns Promise that resolves when metadata is successfully saved
   * @throws {Error} If metadata file cannot be written or directory is not accessible
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * const metadata = {
   *   stack_id: 'myorg/mystack',
   *   stack_name: 'My Stack',
   *   last_published_version: '1.0.0',
   *   last_published_at: new Date().toISOString()
   * };
   * await metadataService.savePublishedStackMetadata('/path/to/project', metadata);
   * ```
   * @since 1.2.3
   * @public
   */
  async savePublishedStackMetadata(
    projectPath: string,
    metadata: PublishedStackMetadata
  ): Promise<void> {
    return await savePublishedStackMetadata(projectPath, metadata);
  }

  /**
   * Find a stack by its stack ID across all published stack metadata
   *
   * Searches through all locally stored published stack metadata to find
   * a stack with the specified stack ID. This is useful for stack management
   * operations that need to locate a stack's project directory and metadata
   * based on its unique identifier.
   *
   * @param stackId - The unique stack identifier to search for (format: org/name)
   * @returns Promise that resolves to an object containing the project path and metadata,
   *   or null if no stack with the given ID is found
   * @returns {Object} result - The search result object
   * @returns {string} result.projectPath - The absolute file system path to the stack's project directory
   * @returns {PublishedStackMetadata} result.metadata - The complete published metadata for the stack including:
   *   - stack_id: The unique identifier (org/name format)
   *   - stack_name: The display name of the stack
   *   - last_published_version: The most recent published version
   *   - last_published_at: ISO timestamp of last publication
   *   - last_export_hash: Optional hash of the last export operation
   * @throws {Error} If metadata file cannot be read or is corrupted
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * const result = await metadataService.findStackByStackId('myorg/mystack');
   * if (result) {
   *   console.log(`Found stack at: ${result.projectPath}`);
   *   console.log(`Last published version: ${result.metadata.last_published_version}`);
   * } else {
   *   console.log('Stack not found');
   * }
   * ```
   * @since 1.2.3
   * @public
   */
  async findStackByStackId(stackId: string): Promise<{
    projectPath: string;
    metadata: PublishedStackMetadata;
  } | null> {
    const result = await findStackByStackId(stackId);
    if (!result) return null;

    return {
      projectPath: result.path,
      metadata: result.metadata,
    };
  }

  /**
   * Remove metadata for a published stack from the local metadata store
   *
   * Deletes the metadata entry for the stack at the specified project path.
   * This effectively marks the stack as unpublished locally, though the
   * stack may still exist on the remote server.
   *
   * @param projectPath - The absolute file system path to the stack's project directory
   * @returns Promise that resolves when metadata is successfully removed
   * @throws {Error} If metadata file cannot be written or accessed
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * await metadataService.removePublishedStackMetadata('/path/to/project');
   * console.log('Stack metadata removed from local store');
   * ```
   * @since 1.2.3
   * @public
   */
  async removePublishedStackMetadata(projectPath: string): Promise<void> {
    return await removePublishedStackMetadata(projectPath);
  }

  /**
   * Check if a version string is valid semver format
   *
   * Validates that the provided version string conforms to semantic versioning
   * specification (semver). Used before publishing or updating stack versions
   * to ensure version consistency.
   *
   * @param version - The version string to validate (e.g., '1.0.0', '2.1.3-beta.1')
   * @returns True if the version is valid semver format, false otherwise
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * console.log(metadataService.isValidVersion('1.0.0')); // true
   * console.log(metadataService.isValidVersion('invalid')); // false
   * ```
   * @since 1.2.3
   * @public
   */
  isValidVersion(version: string): boolean {
    return isValidVersion(version);
  }

  /**
   * Generate a suggested next version for a stack based on the last published version
   *
   * Automatically increments the patch version of the provided semver string
   * to suggest the next logical version for publication. Follows semantic
   * versioning conventions for patch-level increments.
   *
   * @param lastVersion - The last published version in semver format (e.g., '1.0.0')
   * @returns The suggested next version with patch incremented (e.g., '1.0.1')
   * @throws {Error} If the lastVersion is not a valid semver format
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * const suggested = metadataService.generateSuggestedVersion('1.0.0');
   * console.log(suggested); // '1.0.1'
   * ```
   * @since 1.2.3
   * @public
   */
  generateSuggestedVersion(lastVersion: string): string {
    return generateSuggestedVersion(lastVersion);
  }

  /**
   * Check if a project has published stack metadata
   *
   * Determines whether the stack at the specified project path has been
   * published by checking for existing metadata in the local store.
   * This is a convenience method that wraps getPublishedStackMetadata.
   *
   * @param projectPath - The absolute file system path to the stack's project directory
   * @returns Promise that resolves to true if metadata exists, false otherwise
   * @throws {Error} If metadata file cannot be read or is corrupted
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * const isPublished = await metadataService.hasPublishedMetadata('/path/to/project');
   * if (isPublished) {
   *   console.log('This stack has been published before');
   * }
   * ```
   * @since 1.2.3
   * @public
   */
  async hasPublishedMetadata(projectPath: string): Promise<boolean> {
    const metadata = await this.getPublishedStackMetadata(projectPath);
    return metadata !== null;
  }

  /**
   * Update existing published stack metadata with partial changes
   *
   * Merges the provided updates with existing metadata for the stack at
   * the specified project path. This allows selective updates without
   * requiring the complete metadata object.
   *
   * @param projectPath - The absolute file system path to the stack's project directory
   * @param updates - Partial metadata updates to merge with existing data
   * @returns Promise that resolves when metadata is successfully updated
   * @throws {Error} If no existing metadata found for the project path
   * @throws {Error} If metadata file cannot be read or written
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * await metadataService.updatePublishedStackMetadata('/path/to/project', {
   *   last_published_version: '1.1.0',
   *   last_published_at: new Date().toISOString()
   * });
   * ```
   * @since 1.2.3
   * @public
   */
  async updatePublishedStackMetadata(
    projectPath: string,
    updates: Partial<PublishedStackMetadata>
  ): Promise<void> {
    const existing = await this.getPublishedStackMetadata(projectPath);
    if (!existing) {
      throw new Error(`No published metadata found for project: ${projectPath}`);
    }

    const updated: PublishedStackMetadata = {
      ...existing,
      ...updates,
    };

    await this.savePublishedStackMetadata(projectPath, updated);
  }

  /**
   * Get the stack ID for a project if it exists
   *
   * Retrieves the unique stack identifier for the stack at the specified
   * project path. This is a convenience method for accessing just the
   * stack_id from the published metadata.
   *
   * @param projectPath - The absolute file system path to the stack's project directory
   * @returns Promise that resolves to the stack ID (org/name format) or null if not published
   * @throws {Error} If metadata file cannot be read or is corrupted
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * const stackId = await metadataService.getStackIdForProject('/path/to/project');
   * if (stackId) {
   *   console.log(`Stack ID: ${stackId}`);
   * } else {
   *   console.log('Stack has not been published');
   * }
   * ```
   * @since 1.2.3
   * @public
   */
  async getStackIdForProject(projectPath: string): Promise<string | null> {
    const metadata = await this.getPublishedStackMetadata(projectPath);
    return metadata?.stack_id ?? null;
  }

  /**
   * Check if a stack ID is already published from any project
   *
   * Determines whether the specified stack ID is already in use by any
   * published stack in the local metadata store. Useful for validating
   * stack ID uniqueness before publishing.
   *
   * @param stackId - The unique stack identifier to check (org/name format)
   * @returns Promise that resolves to true if stack ID exists, false otherwise
   * @throws {Error} If metadata file cannot be read or is corrupted
   * @example
   * ```typescript
   * const metadataService = new MetadataService();
   * const exists = await metadataService.isStackIdPublished('myorg/mystack');
   * if (exists) {
   *   console.log('Stack ID is already in use');
   * } else {
   *   console.log('Stack ID is available for use');
   * }
   * ```
   * @since 1.2.3
   * @public
   */
  async isStackIdPublished(stackId: string): Promise<boolean> {
    const found = await this.findStackByStackId(stackId);
    return found !== null;
  }
}
