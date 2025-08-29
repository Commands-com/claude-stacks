import { getApiConfig, isLocalDev } from '../utils/api.js';
import { SecureHttpClient } from '../utils/secureHttp.js';
import { validateObjectResponse, validateRemoteStack } from '../utils/validators.js';
import type { RemoteStack } from '../types/index.js';

/**
 * Configuration interface for API operations
 *
 * Defines the configuration options for HTTP requests to the Claude Stacks API,
 * including timeout settings and retry behavior for enhanced reliability.
 *
 * @since 1.2.3
 * @public
 */
export interface ApiConfig {
  /**
   * Base URL for all API requests
   *
   * @remarks
   * Typically points to the Commands.com backend API. In local development mode,
   * this may point to localhost:3000 when CLAUDE_STACKS_DEV=true is set.
   *
   * @example "https://backend.commands.com" or "http://localhost:3000"
   */
  baseUrl: string;

  /**
   * Timeout for HTTP requests in milliseconds
   *
   * @remarks
   * Optional timeout value for HTTP requests. If not specified, uses the
   * default timeout from the HTTP client implementation.
   *
   * @default undefined (uses client default)
   */
  timeout?: number;

  /**
   * Number of retry attempts for failed requests
   *
   * @remarks
   * Optional retry count for failed HTTP requests. Useful for handling
   * temporary network issues or server unavailability.
   *
   * @default undefined (no retries)
   */
  retries?: number;
}

/**
 * Service for API operations and configuration
 *
 * @remarks
 * Encapsulates API utilities to reduce coupling in action layer.
 * Provides a clean interface for API configuration and HTTP operations
 * with proper error handling.
 *
 * @since 1.2.3
 * @public
 */
export class ApiService {
  private config: ApiConfig;

  /**
   * Creates a new ApiService instance
   *
   * @remarks
   * Automatically loads the API configuration using getApiConfig() utility,
   * which handles environment-specific settings and local development mode.
   */
  constructor() {
    this.config = getApiConfig();
  }

  /**
   * Get the current API configuration
   *
   * @returns A copy of the current API configuration
   * @since 1.2.3
   * @public
   */
  getConfig(): ApiConfig {
    return { ...this.config };
  }

  /**
   * Check if running in local development mode
   *
   * @returns True if CLAUDE_STACKS_DEV environment variable is set, false otherwise
   * @since 1.2.3
   * @public
   */
  isLocalDev(): boolean {
    return isLocalDev();
  }

  /**
   * Get the base URL for API requests
   *
   * @returns The configured base URL for the API
   * @since 1.2.3
   * @public
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Fetch a stack from the API with authentication
   *
   * @param stackId - The stack identifier in org/name format (e.g., "anthropic/my-stack")
   * @param accessToken - Bearer token for API authentication
   * @returns Promise that resolves to the remote stack data with validation
   * @throws {Error} When the API request fails or returns invalid data
   * @example
   * ```typescript
   * const apiService = new ApiService();
   * const stack = await apiService.fetchStack('anthropic/my-stack', 'token123');
   * console.log(stack.title, stack.description);
   * ```
   * @since 1.2.3
   * @public
   */
  async fetchStack(stackId: string, accessToken: string): Promise<RemoteStack> {
    const url = `${this.config.baseUrl}/v1/stacks/${stackId}`;

    const response = await SecureHttpClient.get(url, {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'claude-stacks-cli/1.0.0',
      Accept: 'application/json',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to fetch stack: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    return validateRemoteStack(await response.json());
  }

  /**
   * Fetch a public stack without authentication
   *
   * @remarks
   * Attempts to fetch a stack without authentication headers. This works for
   * public stacks but will fail for private stacks. The method does not
   * automatically fall back to authenticated requests - that should be
   * handled by the caller if needed.
   *
   * @param stackId - The stack identifier in org/name format (e.g., "anthropic/public-stack")
   * @returns Promise that resolves to the remote stack data with validation
   * @throws {Error} When the API request fails, stack is private, or returns invalid data
   * @example
   * ```typescript
   * const apiService = new ApiService();
   * try {
   *   const stack = await apiService.fetchPublicStack('anthropic/public-stack');
   *   console.log('Public stack:', stack.title);
   * } catch (error) {
   *   console.log('Stack is private or unavailable');
   * }
   * ```
   * @since 1.2.3
   * @public
   */
  async fetchPublicStack(stackId: string): Promise<RemoteStack> {
    const url = `${this.config.baseUrl}/v1/stacks/${stackId}`;

    const response = await SecureHttpClient.get(url, {
      'User-Agent': 'claude-stacks-cli/1.0.0',
      Accept: 'application/json',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to fetch stack: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    return validateRemoteStack(await response.json());
  }

  /**
   * Publish a stack to the API
   *
   * @remarks
   * Creates a new stack or updates an existing one based on whether stackId
   * is provided. For updates, uses PUT method; for new stacks, uses POST method.
   * The payload is validated server-side and the response is validated client-side.
   *
   * @param payload - The stack data to publish, including metadata and configuration
   * @param accessToken - Bearer token for API authentication
   * @param stackId - Optional stack ID for updates; omit for new stack creation
   * @returns Promise that resolves to the publish response with server-generated metadata
   * @throws {Error} When upload/update fails due to authentication, validation, or server errors
   * @example
   * ```typescript
   * const apiService = new ApiService();
   *
   * // Create new stack
   * const newStack = await apiService.publishStack({
   *   name: 'my-stack',
   *   description: 'My awesome stack',
   *   mcpServers: [...]
   * }, 'token123');
   *
   * // Update existing stack
   * const updatedStack = await apiService.publishStack({
   *   description: 'Updated description'
   * }, 'token123', 'anthropic/my-stack');
   * ```
   * @since 1.2.3
   * @public
   */
  async publishStack(
    payload: Record<string, unknown>,
    accessToken: string,
    stackId?: string
  ): Promise<Record<string, unknown>> {
    const isUpdate = Boolean(stackId);
    const url = isUpdate
      ? `${this.config.baseUrl}/v1/stacks/${stackId}`
      : `${this.config.baseUrl}/v1/stacks`;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'claude-stacks-cli/1.0.0',
    };

    const response = isUpdate
      ? await SecureHttpClient.put(url, payload, headers)
      : await SecureHttpClient.post(url, payload, headers);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `${isUpdate ? 'Update' : 'Upload'} failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    return validateObjectResponse(await response.json());
  }

  /**
   * Delete a stack via the API
   *
   * @remarks
   * Permanently removes a stack from the Commands.com platform. This action
   * cannot be undone. The user must have ownership or appropriate permissions
   * for the stack to delete it.
   *
   * @param stackId - The stack identifier to delete in org/name format
   * @param accessToken - Bearer token for API authentication
   * @returns Promise that resolves when deletion is complete
   * @throws {Error} When deletion fails due to authentication, permissions, or server errors
   * @example
   * ```typescript
   * const apiService = new ApiService();
   * await apiService.deleteStack('anthropic/my-old-stack', 'token123');
   * console.log('Stack deleted successfully');
   * ```
   * @since 1.2.3
   * @public
   */
  async deleteStack(stackId: string, accessToken: string): Promise<void> {
    const url = `${this.config.baseUrl}/v1/stacks/${stackId}`;

    const response = await SecureHttpClient.delete(url, {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'claude-stacks-cli/1.0.0',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Delete failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
  }

  /**
   * Update the API configuration
   *
   * @remarks
   * Merges the provided configuration with the current configuration.
   * This is primarily intended for testing scenarios where you need to
   * override specific configuration values like baseUrl or timeout.
   * In production, configuration is typically loaded from environment variables.
   *
   * @param config - Partial configuration object to merge with current config
   * @example
   * ```typescript
   * const apiService = new ApiService();
   *
   * // Override base URL for testing
   * apiService.updateConfig({
   *   baseUrl: 'http://localhost:3001',
   *   timeout: 5000
   * });
   * ```
   * @since 1.2.3
   * @internal
   */
  updateConfig(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Rename a stack via the API
   *
   * @remarks
   * Updates the display title of an existing stack without changing its
   * identifier (org/name). The title is used for display purposes in the
   * Commands.com interface and CLI output.
   *
   * @param stackId - The stack identifier to rename in org/name format
   * @param newTitle - The new display title for the stack
   * @param accessToken - Bearer token for API authentication
   * @returns Promise that resolves to the rename response with updated metadata
   * @throws {Error} When rename fails due to authentication, permissions, or server errors
   * @example
   * ```typescript
   * const apiService = new ApiService();
   * const result = await apiService.renameStack(
   *   'anthropic/my-stack',
   *   'My Awesome Stack v2.0',
   *   'token123'
   * );
   * console.log('Stack renamed:', result);
   * ```
   * @since 1.2.3
   * @public
   */
  async renameStack(
    stackId: string,
    newTitle: string,
    accessToken: string
  ): Promise<Record<string, unknown>> {
    const url = `${this.config.baseUrl}/v1/stacks/${stackId}/title`;

    const response = await SecureHttpClient.put(
      url,
      { title: newTitle },
      {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'claude-stacks-cli/1.0.0',
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Rename failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return validateObjectResponse(await response.json());
  }
}
