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
   * Get all published stack metadata
   *
   * @returns Promise that resolves to published stacks metadata
   */
  async getAllPublishedStacks(): Promise<Record<string, PublishedStackMetadata>> {
    return await getAllPublishedStacks();
  }

  /**
   * Get metadata for a specific published stack
   *
   * @param projectPath - The project path to get metadata for
   * @returns Promise that resolves to the stack metadata or null if not found
   */
  async getPublishedStackMetadata(projectPath: string): Promise<PublishedStackMetadata | null> {
    return await getPublishedStackMetadata(projectPath);
  }

  /**
   * Save metadata for a published stack
   *
   * @param projectPath - The project path
   * @param metadata - The metadata to save
   * @returns Promise that resolves when metadata is saved
   */
  async savePublishedStackMetadata(
    projectPath: string,
    metadata: PublishedStackMetadata
  ): Promise<void> {
    return await savePublishedStackMetadata(projectPath, metadata);
  }

  /**
   * Find a stack by its stack ID
   *
   * @param stackId - The stack ID to search for
   * @returns Promise that resolves to the found metadata or null
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
   * Remove metadata for a published stack
   *
   * @param projectPath - The project path to remove metadata for
   * @returns Promise that resolves when metadata is removed
   */
  async removePublishedStackMetadata(projectPath: string): Promise<void> {
    return await removePublishedStackMetadata(projectPath);
  }

  /**
   * Check if a version string is valid semver format
   */
  isValidVersion(version: string): boolean {
    return isValidVersion(version);
  }

  /**
   * Generate a suggested version for a stack
   */
  generateSuggestedVersion(lastVersion: string): string {
    return generateSuggestedVersion(lastVersion);
  }

  /**
   * Check if a project has published stack metadata
   *
   * @param projectPath - The project path to check
   * @returns Promise that resolves to true if metadata exists
   */
  async hasPublishedMetadata(projectPath: string): Promise<boolean> {
    const metadata = await this.getPublishedStackMetadata(projectPath);
    return metadata !== null;
  }

  /**
   * Update existing published stack metadata
   *
   * @param projectPath - The project path
   * @param updates - Partial metadata updates to apply
   * @returns Promise that resolves when metadata is updated
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
   * @param projectPath - The project path
   * @returns Promise that resolves to the stack ID or null
   */
  async getStackIdForProject(projectPath: string): Promise<string | null> {
    const metadata = await this.getPublishedStackMetadata(projectPath);
    return metadata?.stack_id ?? null;
  }

  /**
   * Check if a stack ID is already published from any project
   *
   * @param stackId - The stack ID to check
   * @returns Promise that resolves to true if stack ID exists
   */
  async isStackIdPublished(stackId: string): Promise<boolean> {
    const found = await this.findStackByStackId(stackId);
    return found !== null;
  }
}
