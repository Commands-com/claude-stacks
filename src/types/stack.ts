/**
 * Core stack types and interfaces
 */

/**
 * Core metadata interface for stack information
 *
 * Represents the essential metadata for a stack including identification,
 * versioning, authorship, and file structure. Used by the stack registry
 * and installation system to track and manage stacks.
 *
 * @example
 * ```typescript
 * const metadata: StackMetadata = {
 *   name: 'my-dev-stack',
 *   version: '1.2.0',
 *   author: 'developer@example.com',
 *   createdAt: '2024-01-15T10:30:00Z',
 *   updatedAt: '2024-03-20T14:45:00Z',
 *   dependencies: ['typescript', 'eslint'],
 *   tags: ['development', 'typescript'],
 *   files: [
 *     { path: 'package.json', type: 'file', size: 1024 },
 *     { path: 'src', type: 'directory' }
 *   ]
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StackMetadata {
  /** Unique identifier name for the stack */
  name: string;
  /** Optional description of the stack's purpose and functionality */
  description?: string;
  /** Semantic version string following semver conventions */
  version: string;
  /** Optional author email or identifier */
  author?: string;
  /** ISO 8601 timestamp when the stack was first created */
  createdAt: string;
  /** ISO 8601 timestamp when the stack was last modified */
  updatedAt: string;
  /** Array of dependency package names required by this stack */
  dependencies: string[];
  /** Optional array of tags for categorizing and searching stacks */
  tags?: string[];
  /** Array of files and directories included in this stack */
  files: StackFile[];
}

/**
 * File or directory entry within a stack
 *
 * Represents individual files and directories that make up a stack,
 * including metadata for installation and verification purposes.
 * Used during stack packaging, installation, and integrity checking.
 *
 * @example
 * ```typescript
 * // File entry
 * const fileEntry: StackFile = {
 *   path: 'src/utils/helper.ts',
 *   type: 'file',
 *   size: 2048,
 *   lastModified: '2024-03-20T10:15:00Z'
 * };
 *
 * // Directory entry
 * const dirEntry: StackFile = {
 *   path: 'src/components',
 *   type: 'directory'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StackFile {
  /** Relative path to the file or directory from the stack root */
  path: string;
  /** Type indicating whether this entry is a file or directory */
  type: 'file' | 'directory';
  /** Optional file size in bytes (only applicable for files) */
  size?: number;
  /** Optional ISO 8601 timestamp of last modification */
  lastModified?: string;
}

/**
 * Configuration interface for development stacks
 *
 * @remarks
 * Defines the structure for stack configuration files used by the
 * Claude Stacks CLI. Contains metadata, dependencies, and settings
 * for reproducible development environments.
 *
 * @example
 * ```typescript
 * const config: StackConfig = {
 *   name: 'typescript-tools',
 *   version: '1.0.0',
 *   description: 'TypeScript development tools',
 *   author: 'developer@example.com',
 *   dependencies: ['@types/node', 'typescript'],
 *   scripts: { build: 'tsc', test: 'jest' },
 *   settings: { strict: true }
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
/**
 * Configuration interface for development stacks
 *
 * @remarks
 * Defines the structure for stack configuration files used by the
 * Claude Stacks CLI. Contains metadata, dependencies, and settings
 * for reproducible development environments.
 *
 * @example
 * ```typescript
 * const config: StackConfig = {
 *   name: 'typescript-tools',
 *   version: '1.0.0',
 *   description: 'TypeScript development tools',
 *   author: 'developer@example.com',
 *   dependencies: ['@types/node', 'typescript'],
 *   scripts: { build: 'tsc', test: 'jest' },
 *   settings: { strict: true }
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StackConfig {
  /** Unique identifier name for the stack */
  name: string;
  /** Semantic version string following semver conventions */
  version: string;
  /** Optional description of the stack's purpose and functionality */
  description?: string;
  /** Optional author email or identifier */
  author?: string;
  /** Array of dependency package names required by this stack */
  dependencies: string[];
  /** Optional build scripts and commands for the stack */
  scripts?: Record<string, string>;
  /** Optional configuration settings specific to this stack */
  settings?: Record<string, unknown>;
}

/**
 * Result of a stack publishing operation
 *
 * Contains the outcome and metadata from publishing a stack to the
 * remote registry. Used to provide feedback to users and track
 * published stack versions.
 *
 * @example
 * ```typescript
 * const result: PublishResult = {
 *   success: true,
 *   stackName: 'my-stack',
 *   version: '1.0.0',
 *   publishedAt: '2024-03-20T15:30:00Z',
 *   url: 'https://commands.com/stacks/user/my-stack'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PublishResult {
  /** Whether the publishing operation completed successfully */
  success: boolean;
  /** Name of the stack that was published */
  stackName: string;
  /** Version string of the published stack */
  version: string;
  /** ISO 8601 timestamp when the stack was published */
  publishedAt: string;
  /** Optional URL where the published stack can be accessed */
  url?: string;
}

/**
 * Result of a stack installation operation
 *
 * Contains the outcome and details from installing a stack locally.
 * Provides information about installed files and location for
 * verification and cleanup purposes.
 *
 * @example
 * ```typescript
 * const result: InstallResult = {
 *   success: true,
 *   stackName: 'typescript-tools',
 *   installedFiles: [
 *     'package.json',
 *     'tsconfig.json',
 *     'src/index.ts'
 *   ],
 *   targetPath: '/Users/dev/my-project'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface InstallResult {
  /** Whether the installation operation completed successfully */
  success: boolean;
  /** Name of the stack that was installed */
  stackName: string;
  /** Array of file paths that were installed */
  installedFiles: string[];
  /** Absolute path where the stack was installed */
  targetPath: string;
}

/**
 * Search result entry for stack discovery
 *
 * Represents a stack found in search results with metadata
 * for display and selection. Used by the browse and search
 * functionality to present available stacks to users.
 *
 * @example
 * ```typescript
 * const searchResult: StackSearchResult = {
 *   name: 'react-starter',
 *   description: 'Complete React development environment',
 *   version: '2.1.0',
 *   author: 'react-team',
 *   downloads: 15420,
 *   rating: 4.8,
 *   tags: ['react', 'frontend', 'javascript']
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StackSearchResult {
  /** Name identifier of the stack */
  name: string;
  /** Optional description of the stack's purpose */
  description?: string;
  /** Current version of the stack */
  version: string;
  /** Optional author or organization name */
  author?: string;
  /** Optional download count for popularity indication */
  downloads?: number;
  /** Optional user rating score (typically 0-5 scale) */
  rating?: number;
  /** Optional array of tags for categorization */
  tags?: string[];
}

/**
 * Generic result type for operations that can succeed or fail
 *
 * Provides a discriminated union type for operations that may succeed
 * with data or fail with an error. The success field allows type-safe
 * handling of both success and error cases.
 *
 * @template T The type of data returned on success
 * @template E The type of error returned on failure (defaults to Error)
 *
 * @example
 * ```typescript
 * async function loadStack(): Promise<StackResult<StackMetadata, string>> {
 *   try {
 *     const data = await fetchStackData();
 *     return { success: true, data };
 *   } catch (error) {
 *     return { success: false, error: error.message };
 *   }
 * }
 *
 * const result = await loadStack();
 * if (result.success) {
 *   console.log(result.data.name); // TypeScript knows data exists
 * } else {
 *   console.error(result.error); // TypeScript knows error exists
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type StackResult<T = unknown, E = Error> =
  | {
      /** Success state indicator */
      success: true;
      /** Data payload returned on successful operation */
      data: T;
    }
  | {
      /** Failure state indicator */
      success: false;
      /** Error information returned on failed operation */
      error: E;
    };

/**
 * Branded type for validated stack names
 *
 * A string that has been validated to ensure it meets stack naming
 * requirements. The brand prevents accidentally using unvalidated
 * strings where validated stack names are expected.
 *
 * @example
 * ```typescript
 * function validateStackName(name: string): ValidatedStackName | null {
 *   if (/^[a-z][a-z0-9-]*$/.test(name)) {
 *     return name as ValidatedStackName;
 *   }
 *   return null;
 * }
 *
 * function processStack(name: ValidatedStackName) {
 *   // Function only accepts validated names
 *   console.log(`Processing stack: ${name}`);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ValidatedStackName = string & {
  /** Brand marker to prevent using unvalidated strings */
  readonly __brand: unique symbol;
};

/**
 * Configuration validation schema type
 *
 * Maps each property of a configuration object to its corresponding
 * validator. Used to build type-safe validation schemas that ensure
 * all configuration fields have appropriate validation rules.
 *
 * @template T The configuration object type to create a schema for
 *
 * @example
 * ```typescript
 * interface MyConfig {
 *   name: string;
 *   version: string;
 *   enabled: boolean;
 * }
 *
 * const schema: ConfigSchema<MyConfig> = {
 *   name: {
 *     validate: (value): value is string => typeof value === 'string',
 *     required: true
 *   },
 *   version: {
 *     validate: (value): value is string => /^\d+\.\d+\.\d+$/.test(String(value)),
 *     default: '1.0.0'
 *   },
 *   enabled: {
 *     validate: (value): value is boolean => typeof value === 'boolean',
 *     default: false
 *   }
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ConfigSchema<T> = {
  [K in keyof T]: ConfigValidator<T[K]>;
};

/**
 * Configuration field validator interface
 *
 * Defines validation rules and default values for configuration fields.
 * Used by the configuration system to validate and normalize user inputs
 * with proper type safety and error handling.
 *
 * @template T The type of value this validator handles
 *
 * @example
 * ```typescript
 * const nameValidator: ConfigValidator<string> = {
 *   validate: (value): value is string =>
 *     typeof value === 'string' && value.length > 0,
 *   default: 'untitled-stack',
 *   required: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ConfigValidator<T> {
  /** Type guard function to validate if a value is of type T */
  validate: (value: unknown) => value is T;
  /** Optional default value to use when validation fails or value is missing */
  default?: T;
  /** Optional flag indicating if this field is required */
  required?: boolean;
}
