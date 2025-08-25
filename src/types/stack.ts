/**
 * Core stack types and interfaces
 */

export interface StackMetadata {
  name: string;
  description?: string;
  version: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  dependencies: string[];
  tags?: string[];
  files: StackFile[];
}

export interface StackFile {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
}

export interface StackConfig {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies: string[];
  scripts?: Record<string, string>;
  settings?: Record<string, unknown>;
}

export interface PublishResult {
  success: boolean;
  stackName: string;
  version: string;
  publishedAt: string;
  url?: string;
}

export interface InstallResult {
  success: boolean;
  stackName: string;
  installedFiles: string[];
  targetPath: string;
}

export interface StackSearchResult {
  name: string;
  description?: string;
  version: string;
  author?: string;
  downloads?: number;
  rating?: number;
  tags?: string[];
}

/**
 * Result type for operations that can succeed or fail
 */
export type StackResult<T = unknown, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Validated stack name type
 */
export type ValidatedStackName = string & { readonly __brand: unique symbol };

/**
 * Configuration validation schema
 */
export type ConfigSchema<T> = {
  [K in keyof T]: ConfigValidator<T[K]>;
};

export interface ConfigValidator<T> {
  validate: (value: unknown) => value is T;
  default?: T;
  required?: boolean;
}
