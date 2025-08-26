import { getApiConfig, isLocalDev } from '../utils/api.js';
import { SecureHttpClient } from '../utils/secureHttp.js';
import { validateObjectResponse, validateRemoteStack } from '../utils/validators.js';
import type { RemoteStack } from '../types/index.js';

/**
 * Configuration interface for API operations
 */
export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
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

  constructor() {
    this.config = getApiConfig();
  }

  /**
   * Get the current API configuration
   */
  getConfig(): ApiConfig {
    return { ...this.config };
  }

  /**
   * Check if running in local development mode
   */
  isLocalDev(): boolean {
    return isLocalDev();
  }

  /**
   * Get the base URL for API requests
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Fetch a stack from the API
   *
   * @param stackId - The stack identifier (org/name format)
   * @param accessToken - Authentication token
   * @returns Promise that resolves to the remote stack data
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
   * Publish a stack to the API
   *
   * @param payload - The stack data to publish
   * @param accessToken - Authentication token
   * @param stackId - Optional stack ID for updates
   * @returns Promise that resolves to the publish response
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
   * @param stackId - The stack identifier to delete
   * @param accessToken - Authentication token
   * @returns Promise that resolves when deletion is complete
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
   * Update the API configuration (useful for testing)
   *
   * @param config - New configuration to apply
   * @internal
   */
  updateConfig(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Rename a stack via the API
   *
   * @param stackId - The stack identifier to rename
   * @param newTitle - The new title for the stack
   * @param accessToken - Authentication token
   * @returns Promise that resolves to the rename response
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
