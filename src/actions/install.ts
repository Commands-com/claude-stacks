import fetch from 'node-fetch';
import type { DeveloperStack, InstallOptions, RemoteStack } from '../types/index.js';
import { BaseAction } from './BaseAction.js';

/**
 * Action class for installing stacks from Commands.com
 *
 * @since 1.2.3
 * @public
 */
export class InstallAction extends BaseAction {
  /**
   * Execute the install action
   */
  async execute(stackId: string, options: InstallOptions = {}): Promise<void> {
    try {
      this.validateRequired(stackId, 'stackId');

      this.ui.info(`📥 Fetching stack ${stackId} from Commands.com...`);
      this.displayApiEnvironment();

      const { org, name } = this.validateStackId(stackId);

      // Try to fetch as public stack first
      let remoteStack: RemoteStack;

      try {
        remoteStack = await this.api.fetchPublicStack(stackId);
      } catch (error: unknown) {
        // If it's a 401/403 error, the stack might require authentication
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          const accessToken = await this.auth.authenticate();
          remoteStack = await this.api.fetchStack(stackId, accessToken);
        } else {
          throw error;
        }
      }
      const stack = this.convertToLocalStack(remoteStack);

      this.ui.log(this.ui.colorStackName(`Installing: ${stack.name}`));
      this.ui.meta(`By: ${remoteStack.author ?? 'Unknown'}`);
      this.ui.log(`Description: ${this.ui.colorDescription(stack.description)}\n`);

      // Check dependencies and display warnings
      await this.checkAndDisplayDependencies(stack);

      // Use StackOperationService for installation
      await this.stackOperations.performInstallation(stack, remoteStack, stackId, options);

      // Track installation
      await this.trackInstallation(org, name);
    } catch (error) {
      this.handleError(error, 'Installation');
    }
  }

  private validateStackId(stackId: string): { org: string; name: string } {
    const parts = stackId.split('/');
    if (parts.length !== 2) {
      throw new Error('Stack ID must be in format "org/name"');
    }

    const [org, name] = parts;
    if (!org || !name) {
      throw new Error('Stack ID must be in format "org/name" with non-empty org and name');
    }

    return { org, name };
  }

  private async checkAndDisplayDependencies(stack: DeveloperStack): Promise<void> {
    this.ui.info('🔍 Checking dependencies...');
    const allMissingDeps = [];

    // Check MCP server dependencies
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      const mcpDeps = await this.dependencies.checkMcpDependencies(stack.mcpServers);
      allMissingDeps.push(...mcpDeps);
    }

    // Check statusLine dependencies
    if (stack.settings?.statusLine) {
      const statusLineDeps = await this.dependencies.checkStatusLineDependencies(
        stack.settings.statusLine
      );
      allMissingDeps.push(...statusLineDeps);
    }

    this.dependencies.displayMissingDependencies(allMissingDeps);
  }

  private convertToLocalStack(remoteStack: RemoteStack): DeveloperStack {
    return {
      name: remoteStack.title ?? remoteStack.name,
      description: remoteStack.description,
      version: remoteStack.version ?? '1.0.0',
      commands: remoteStack.commands ?? [],
      agents: remoteStack.agents ?? [],
      mcpServers: remoteStack.mcpServers ?? [],
      settings: remoteStack.settings ?? {},
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        installed_from: 'commands.com',
        installed_at: new Date().toISOString(),
      },
    };
  }

  private async trackInstallation(org: string, name: string): Promise<void> {
    try {
      // Track installation with the remote service
      const accessToken = this.auth.getAccessToken();
      if (!accessToken) {
        return; // Can't track without token
      }

      await fetch(`${this.api.getBaseUrl()}/v1/analytics/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'claude-stacks-cli/1.0.0',
        },
        body: JSON.stringify({
          stack_id: `${org}/${name}`,
          timestamp: new Date().toISOString(),
          client_version: '1.0.0',
        }),
      }).catch(() => {
        // Ignore tracking failures - don't interrupt installation
      });
    } catch {
      // Ignore tracking errors
    }
  }
}

// Create instance for backward compatibility
const installActionInstance = new InstallAction();

/**
 * Install a stack from Commands.com
 *
 * @param stackId - Stack identifier in org/name format
 * @param options - Installation options
 *
 * @returns Promise that resolves when installation is complete
 *
 * @throws {@link Error} When stack is not found or installation fails
 *
 * @example
 * ```typescript
 * // Install a public stack
 * await installAction('anthropic/web-scraper');
 *
 * // Install with specific options
 * await installAction('org/stack-name', {
 *   localOnly: true,
 *   overwrite: false
 * });
 * ```
 *
 * @remarks
 * Fetches stack metadata and content from Commands.com API.
 * Validates MCP server dependencies before installation.
 * Tracks installation statistics with the remote service.
 *
 * @since 1.0.0
 * @public
 */
export async function installAction(stackId: string, options: InstallOptions = {}): Promise<void> {
  await installActionInstance.execute(stackId, options);
}
