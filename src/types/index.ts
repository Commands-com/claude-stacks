// Type definitions for Claude Stacks

import type { ApiStackMetadata } from './api.js';

// Re-export core types
export type * from './cli.js';
export type * from './stack.js';
export type * from './api.js';
export * from './errors.js';

// Export enhanced utilities (selective to avoid conflicts)
export type {
  Brand,
  StackName,
  StackVersion,
  OrganizationName,
  StackId,
  FilePath,
  CommandName,
  AgentName,
  McpServerName,
  PositiveInteger,
  Port,
  NonEmptyArray,
  DeepReadonly,
  Result,
  BrandedTypeValidator,
} from './utilities.js';
export * from './runtime-validators.js';

export interface DeveloperStack {
  name: string;
  description: string;
  version?: string;
  commands?: StackCommand[];
  agents?: StackAgent[];
  mcpServers?: StackMcpServer[];
  settings?: StackSettings;
  claudeMd?: {
    global?: {
      path: string;
      content: string;
    };
    local?: {
      path: string;
      content: string;
    };
  };
  metadata?: {
    created_at?: string;
    updated_at?: string;
    exported_from?: string;
    published_stack_id?: string; // Track if stack was published
    published_version?: string; // Last published version
    local_version?: string; // Current local version
    installed_from?: string; // Track where stack was installed from
    installed_at?: string; // Track when stack was installed
  };
  filePath?: string; // Added for local stacks
}

export interface StackCommand {
  name: string;
  filePath: string;
  content: string;
  description?: string;
}

export interface StackAgent {
  name: string;
  filePath: string;
  content: string;
  description?: string;
}

export interface StackMcpServer {
  name: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface StackSettings {
  [key: string]: unknown;
}

export interface OAuthConfig {
  clientId: string;
  authUrl: string;
  tokenUrl: string;
  redirectPort?: number;
}

export interface AuthToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
}

// API Configuration
export interface ApiConfig {
  baseUrl: string;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
}

// Action options interfaces
export interface ExportOptions {
  includeGlobal?: boolean;
  includeClaudeMd?: boolean;
  name?: string;
  description?: string;
  stackVersion?: string;
}

export interface RestoreOptions {
  overwrite?: boolean;
  globalOnly?: boolean;
  localOnly?: boolean;
}

export interface PublishOptions {
  public?: boolean;
}

export interface BrowseOptions {
  category?: string;
  search?: string;
  myStacks?: boolean;
}

export interface InstallOptions {
  overwrite?: boolean;
  globalOnly?: boolean;
  localOnly?: boolean;
}

export interface CleanOptions {
  dryRun?: boolean;
}

// Remote stack format from API (uses org/name format)
export interface RemoteStack {
  org: string; // Organization username
  name: string; // Stack name (slugified)
  title?: string; // Display title (may differ from name)
  description: string;
  version?: string;
  author?: string; // Display name for org
  public?: boolean;
  commands?: StackCommand[];
  agents?: StackAgent[];
  mcpServers?: StackMcpServer[];
  settings?: StackSettings;
  metadata?: ApiStackMetadata;
  createdAt?: string;
  updatedAt?: string;
  viewCount?: number;
  installCount?: number;
  commandCount?: number;
  agentCount?: number;
  mcpServerCount?: number;
}
