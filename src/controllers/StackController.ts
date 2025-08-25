import type { CreateStackArgs, DeleteStackArgs, DeveloperStack } from '../types/index.js';
import { isStackError } from '../types/index.js';
import { StackService } from '../services/StackService.js';
import { FileService } from '../services/FileService.js';
import { ConfigService } from '../services/ConfigService.js';
import { colors } from '../utils/colors.js';

/**
 * Controller layer that handles CLI operations and coordinates between services
 * Maintains backward compatibility while providing better error handling
 */
export class StackController {
  private readonly stackService: StackService;

  constructor() {
    const fileService = new FileService();
    const configService = new ConfigService();
    this.stackService = new StackService(fileService, configService);
  }

  /**
   * Handle stack creation with proper error handling
   */
  async handleCreate(args: CreateStackArgs): Promise<void> {
    try {
      const result = await this.stackService.createStack(args);

      if (!result.success) {
        this.handleError(result.error);
        return;
      }

      console.log(colors.success(`✅ Stack "${args.name}" created successfully!`));
      console.log(colors.meta(`   Location: ~/.claude/stacks/${args.name}/`));
    } catch (error) {
      this.handleUnexpectedError(error);
    }
  }

  /**
   * Handle stack listing
   */
  async handleList(): Promise<void> {
    try {
      const result = await this.stackService.listStacks();

      if (!result.success) {
        this.handleError(result.error);
        return;
      }

      if (result.data.length === 0) {
        console.log(colors.info('📋 Local Development Stacks\n'));
        console.log(colors.warning('No stacks found in ~/.claude/stacks/'));
        console.log(colors.meta('Export your first stack with:'));
        console.log(colors.meta('  claude-stacks export'));
        return;
      }

      console.log(colors.info('📋 Local Development Stacks\n'));
      console.log(colors.meta(`Found ${result.data.length} local stack(s):\n`));

      result.data.forEach((stack, index) => {
        const components =
          (stack.commands?.length ?? 0) +
          (stack.agents?.length ?? 0) +
          (stack.mcpServers?.length ?? 0);
        const version = stack.version ?? '1.0.0';
        const stats = `v${version}, ${components} items`;
        console.log(
          `${colors.number(`${index + 1}.`)} ${colors.stackName(stack.name)} - ${colors.info(stats)}`
        );
      });
    } catch (error) {
      this.handleUnexpectedError(error);
    }
  }

  /**
   * Handle stack deletion
   */
  async handleDelete(args: DeleteStackArgs): Promise<void> {
    try {
      const result = await this.stackService.deleteStack(args);

      if (!result.success) {
        this.handleError(result.error);
        return;
      }

      console.log(colors.success(`✅ Stack "${args.stackName}" deleted successfully!`));
    } catch (error) {
      this.handleUnexpectedError(error);
    }
  }

  /**
   * Check if a stack exists
   */
  async stackExists(stackName: string): Promise<boolean> {
    return await this.stackService.stackExists(stackName);
  }

  /**
   * Load a stack by name
   */
  async loadStack(stackName: string): Promise<DeveloperStack | null> {
    const result = await this.stackService.loadStack(stackName);
    return result.success ? result.data : null;
  }

  /**
   * Handle StackError instances with appropriate user messaging
   */
  private handleError(error: Error): void {
    if (isStackError(error)) {
      console.error(colors.error(`❌ ${error.message}`));

      // Provide additional context for specific error types
      switch (error.code) {
        case 'STACK_NOT_FOUND':
          console.error(colors.meta('   Use "claude-stacks list" to see available stacks.'));
          break;
        case 'STACK_ALREADY_EXISTS':
          console.error(colors.meta('   Use "claude-stacks list" to see existing stacks.'));
          break;
        case 'VALIDATION_ERROR':
          console.error(colors.meta('   Please check your input and try again.'));
          break;
        case 'FILESYSTEM_ERROR':
          console.error(colors.meta('   Please check file permissions and try again.'));
          break;
      }

      // Exit with error code for CLI
      process.exit(1);
    } else {
      this.handleUnexpectedError(error);
    }
  }

  /**
   * Handle unexpected errors
   */
  private handleUnexpectedError(error: unknown): void {
    console.error(colors.error('❌ An unexpected error occurred:'));

    if (error instanceof Error) {
      console.error(colors.meta(`   ${error.message}`));

      // In development, show stack trace
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
        console.error(`\n${error.stack}`);
      }
    } else {
      console.error(colors.meta(`   ${String(error)}`));
    }

    process.exit(1);
  }
}
