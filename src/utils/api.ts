import type { ApiConfig } from '../types/index.js';

// API configuration based on environment
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
