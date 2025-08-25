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
  const isDev = process.env.CLAUDE_STACKS_DEV === 'true';

  return {
    baseUrl: isDev ? 'http://localhost:3000' : 'https://backend.commands.com',
    authUrl: 'https://api.commands.com/oauth/authorize',
    tokenUrl: 'https://api.commands.com/oauth/token',
    clientId: 'claude-stacks-cli',
  };
}

// OAuth configuration
export const oauthConfig = {
  clientId: 'claude-stacks-cli',
  authUrl: 'https://api.commands.com/oauth/authorize',
  tokenUrl: 'https://api.commands.com/oauth/token',
};

// Utility to check if using local development backend
export function isLocalDev(): boolean {
  return process.env.CLAUDE_STACKS_DEV === 'true';
}
