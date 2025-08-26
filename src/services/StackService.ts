import * as path from 'path';
import { getStackMetadataPath, getStackPath, getStacksPath } from '../constants/paths.js';
import type {
  CreateStackArgs,
  DeleteStackArgs,
  DeveloperStack,
  StackMetadata,
  StackResult,
} from '../types/index.js';
import { StackAlreadyExistsError, StackNotFoundError, ValidationError } from '../types/index.js';
import type { FileService } from './FileService.js';
import type { ConfigService } from './ConfigService.js';

/**
 * Core service for stack management operations
 */
export class StackService {
  constructor(
    private readonly fileService: FileService, // eslint-disable-line no-unused-vars
    private readonly configService: ConfigService // eslint-disable-line no-unused-vars
  ) {}

  /**
   * Create a new stack (will be used by createAction)
   */
  async createStack(args: CreateStackArgs): Promise<StackResult<DeveloperStack>> {
    try {
      this.configService.validateStackName(args.name);

      const stackPath = getStackPath(args.name);

      if (await this.fileService.exists(stackPath)) {
        return {
          success: false,
          error: new StackAlreadyExistsError(args.name),
        };
      }

      const stack: DeveloperStack = {
        name: args.name,
        description: args.description ?? `Development stack for ${args.name}`,
        version: '1.0.0',
        commands: [],
        agents: [],
        mcpServers: [],
        settings: {},
        metadata: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          exported_from: process.cwd(),
        },
      };

      await this.fileService.ensureDir(stackPath);
      const metadataPath = getStackMetadataPath(args.name);
      await this.fileService.writeJsonFile(metadataPath, stack);

      return {
        success: true,
        data: stack,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Load a stack by name
   */
  async loadStack(stackName: string): Promise<StackResult<DeveloperStack>> {
    try {
      const metadataPath = getStackMetadataPath(stackName);

      if (!(await this.fileService.exists(metadataPath))) {
        return {
          success: false,
          error: new StackNotFoundError(stackName),
        };
      }

      const stack = await this.fileService.readJsonFile<DeveloperStack>(metadataPath);

      return {
        success: true,
        data: stack,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Save/update a stack
   */
  async saveStack(stack: DeveloperStack): Promise<StackResult<void>> {
    try {
      this.configService.validateStackName(stack.name);

      const updatedStack = {
        ...stack,
        metadata: {
          ...stack.metadata,
          updated_at: new Date().toISOString(),
        },
      };

      const metadataPath = getStackMetadataPath(stack.name);
      await this.fileService.writeJsonFile(metadataPath, updatedStack);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Delete a stack
   */
  async deleteStack(args: DeleteStackArgs): Promise<StackResult<void>> {
    try {
      const stackPath = getStackPath(args.stackName);

      if (!(await this.fileService.exists(stackPath))) {
        return {
          success: false,
          error: new StackNotFoundError(args.stackName),
        };
      }

      if (!args.confirm && !args.force) {
        return {
          success: false,
          error: new ValidationError('confirm', false, 'user confirmation or force flag'),
        };
      }

      await this.fileService.remove(stackPath);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * List all local stacks
   */
  async listStacks(): Promise<StackResult<DeveloperStack[]>> {
    try {
      if (!(await this.fileService.exists(getStacksPath()))) {
        return { success: true, data: [] };
      }

      const stackDirs = await this.fileService.listFiles(getStacksPath());

      const stackPromises = stackDirs.map(async dirName => {
        try {
          const metadataPath = getStackMetadataPath(dirName);
          if (await this.fileService.exists(metadataPath)) {
            return await this.fileService.readJsonFile<DeveloperStack>(metadataPath);
          }
          return null;
        } catch {
          // Skip invalid stacks
          return null;
        }
      });

      const stackResults = await Promise.all(stackPromises);
      const stacks = stackResults.filter((stack): stack is DeveloperStack => stack !== null);

      // Sort by creation date (newest first)
      stacks.sort((a, b) => {
        const dateA = new Date(a.metadata?.created_at ?? 0);
        const dateB = new Date(b.metadata?.created_at ?? 0);
        return dateB.getTime() - dateA.getTime();
      });

      return { success: true, data: stacks };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Check if a stack exists
   */
  async stackExists(stackName: string): Promise<boolean> {
    const metadataPath = getStackMetadataPath(stackName);
    return await this.fileService.exists(metadataPath);
  }

  /**
   * Get stack metadata without loading full content
   */
  async getStackMetadata(stackName: string): Promise<StackResult<StackMetadata>> {
    try {
      const result = await this.loadStack(stackName);
      if (!result.success) {
        return result;
      }

      const metadata = this.buildStackMetadata(result.data);
      return { success: true, data: metadata };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  private buildStackMetadata(stack: DeveloperStack): StackMetadata {
    return {
      name: stack.name,
      description: stack.description,
      version: stack.version ?? '1.0.0',
      author: this.extractAuthorFromMetadata(stack.metadata),
      createdAt: stack.metadata?.created_at ?? new Date().toISOString(),
      updatedAt: stack.metadata?.updated_at ?? new Date().toISOString(),
      dependencies: [],
      files: [],
    };
  }

  private extractAuthorFromMetadata(metadata?: { exported_from?: string }): string | undefined {
    return metadata?.exported_from ? path.basename(metadata.exported_from) : undefined;
  }
}
