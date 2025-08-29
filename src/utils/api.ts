import type { ApiConfig } from '../types/index.js';

// API configuration based on environment
/**
 * Gets the API configuration for Commands.com integration
 *
 * @returns API configuration object with URLs and client credentials
 *
 * @example
 * ```typescript
 * const config = getApiConfig();
 * const response = await fetch(`${config.baseUrl}/v1/stacks`);
 * ```
 *
 * @remarks
 * Switches between development and production endpoints based on
 * the CLAUDE_STACKS_DEV environment variable. Uses localhost
 * for development and production Commands.com URLs otherwise.
 *
 * @since 1.0.0
 * @public
 */
export function getApiConfig(): ApiConfig {
  // Check for custom API URL first
  if (process.env.CLAUDE_STACKS_API_URL) {
    return {
      baseUrl: process.env.CLAUDE_STACKS_API_URL,
      authUrl: 'https://api.commands.com/oauth/authorize',
      tokenUrl: 'https://api.commands.com/oauth/token',
      clientId: 'claude-stacks-cli',
    };
  }

  const isDev =
    process.env.CLAUDE_STACKS_LOCAL_DEV === 'true' || process.env.CLAUDE_STACKS_DEV === 'true';

  return {
    baseUrl: isDev ? 'http://localhost:3000' : 'https://backend.commands.com',
    authUrl: 'https://api.commands.com/oauth/authorize',
    tokenUrl: 'https://api.commands.com/oauth/token',
    clientId: 'claude-stacks-cli',
  };
}

/**
 * OAuth 2.0 configuration for Commands.com authentication
 *
 * Contains all necessary OAuth parameters including client credentials,
 * authorization endpoints, and callback URLs. Automatically adjusts
 * redirect URI based on development environment.
 *
 * @example
 * ```typescript
 * const authUrl = `${oauthConfig.authUrl}?client_id=${oauthConfig.clientId}`;
 * console.log('Redirect to:', authUrl);
 * ```
 * @since 1.0.0
 * @public
 */
export const oauthConfig = {
  /** OAuth client identifier for Claude Stacks CLI */
  clientId: 'claude-stacks-cli',
  /** Authorization endpoint URL for initiating OAuth flow */
  authUrl: 'https://api.commands.com/oauth/authorize',
  /** Token exchange endpoint URL for completing OAuth flow */
  tokenUrl: 'https://api.commands.com/oauth/token',
  /** Callback URI for OAuth redirect, switches based on environment */
  redirectUri: isLocalDev()
    ? 'http://localhost:8080/callback'
    : 'https://stacks.commands.com/callback',
  /** OAuth scope defining permissions requested */
  scope: 'read write stacks',
  /** OAuth response type for authorization code flow */
  responseType: 'code',
};

/**
 * Checks if the CLI is configured to use local development backend
 *
 * Examines environment variables to determine if requests should be sent
 * to localhost:3000 instead of production Commands.com endpoints. Supports
 * multiple environment variable formats for flexibility.
 *
 * @returns true if local development mode is enabled, false otherwise
 * @example
 * ```typescript
 * const baseUrl = isLocalDev() ? 'http://localhost:3000' : 'https://backend.commands.com';
 * console.log('Using API:', baseUrl);
 * ```
 * @since 1.0.0
 * @public
 */
export function isLocalDev(): boolean {
  const localDevVar = process.env.CLAUDE_STACKS_LOCAL_DEV;
  if (localDevVar === 'true' || localDevVar === '1' || localDevVar === 'yes') {
    return true;
  }
  return process.env.CLAUDE_STACKS_DEV === 'true';
}
