import { authenticate } from '../utils/auth.js';

/**
 * Service for authentication operations
 *
 * @remarks
 * Encapsulates authentication utilities to reduce coupling in action layer.
 * Provides a clean interface for authentication operations with proper
 * error handling and token management.
 *
 * @since 1.2.3
 * @public
 */
export class AuthService {
  private accessToken: string | null = null;

  /**
   * Authenticate the user and get an access token
   *
   * @returns Promise that resolves to the access token
   * @throws Error if authentication fails
   */
  async authenticate(): Promise<string> {
    try {
      this.accessToken = await authenticate();
      return this.accessToken;
    } catch (error) {
      this.accessToken = null;
      throw error;
    }
  }

  /**
   * Get the current access token if available
   *
   * @returns The current access token or null if not authenticated
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if the user is currently authenticated
   *
   * @returns True if authenticated, false otherwise
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Clear the current authentication token
   */
  clearToken(): void {
    this.accessToken = null;
  }

  /**
   * Set an access token directly (useful for testing)
   *
   * @param token - The access token to set
   * @internal
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}
