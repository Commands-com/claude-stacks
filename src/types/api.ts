// API response type definitions for Claude Stacks

import type { StackAgent, StackCommand, StackMcpServer, StackSettings } from './index.js';

// Base API response structure
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

// Stack metadata from API responses
export interface ApiStackMetadata {
  created_at?: string;
  updated_at?: string;
  exported_from?: string;
  published_stack_id?: string;
  published_version?: string;
  local_version?: string;
  installed_from?: string;
  installed_at?: string;
  cli_version?: string;
  published_at?: string;
  [key: string]: unknown;
}

// Complete stack response from API
export interface ApiStackResponse {
  org: string;
  name: string;
  title?: string;
  description: string;
  version?: string;
  author?: string;
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

// Search response from browse API
export interface ApiSearchResponse {
  stacks: ApiStackResponse[];
  total?: number;
  page?: number;
  per_page?: number;
  totalPages?: number;
}

// User stacks response from list API
export interface ApiUserStacksResponse {
  stacks: ApiStackResponse[];
  total?: number;
}

// Auth token response
export interface ApiAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
}

// Publish response
export interface ApiPublishResponse {
  org: string;
  name: string;
  organizationUsername?: string;
  url?: string;
  version?: string;
  stack_id?: string;
  [key: string]: unknown;
}

// Stack statistics for API responses
export interface ApiStackStats {
  viewCount: number;
  installCount: number;
  commandCount: number;
  agentCount: number;
  mcpServerCount: number;
}

// Type guards for runtime validation
export function isApiStackResponse(obj: unknown): obj is ApiStackResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'org' in obj &&
    'name' in obj &&
    'description' in obj &&
    typeof (obj as Record<string, unknown>).org === 'string' &&
    typeof (obj as Record<string, unknown>).name === 'string' &&
    typeof (obj as Record<string, unknown>).description === 'string'
  );
}

export function isApiSearchResponse(obj: unknown): obj is ApiSearchResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'stacks' in obj &&
    Array.isArray((obj as Record<string, unknown>).stacks)
  );
}

export function isApiUserStacksResponse(obj: unknown): obj is ApiUserStacksResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'stacks' in obj &&
    Array.isArray((obj as Record<string, unknown>).stacks)
  );
}

export function isApiAuthResponse(obj: unknown): obj is ApiAuthResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'access_token' in obj &&
    typeof (obj as Record<string, unknown>).access_token === 'string'
  );
}
