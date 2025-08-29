/**
 * Practical TypeScript enhancements for CLI argument validation
 * These types integrate seamlessly with the existing codebase
 */

import type { BaseCommandArgs, InstallStackArgs, PublishStackArgs } from './cli.js';

// =============================================================================
// TEMPLATE LITERAL TYPES FOR VALIDATION
// =============================================================================

/**
 * Template literal type for stack identifier validation (org/name format)
 */
export type StackIdFormat = `${string}/${string}`;

/**
 * Template literal type for semantic version validation
 */
export type SemanticVersion =
  | `${number}.${number}.${number}`
  | `${number}.${number}.${number}-${string}`;

/**
 * Union type for common CLI output formats
 */
export type OutputFormat = 'table' | 'json' | 'yaml' | 'csv';

/**
 * Union type for archive formats
 */
export type ArchiveFormat = 'zip' | 'tar' | 'tar.gz';

// =============================================================================
// ENHANCED ARGUMENT INTERFACES
// =============================================================================

/**
 * Enhanced install arguments with template literal validation
 */
export interface EnhancedInstallArgs extends BaseCommandArgs {
  /**
   * Stack identifier that must follow org/name format
   */
  stackIdentifier: StackIdFormat;

  /**
   * Optional semantic version
   */
  version?: SemanticVersion;

  /**
   * Optional target path
   */
  targetPath?: string;
}

/**
 * Enhanced publish arguments with version validation
 */
export interface EnhancedPublishArgs extends BaseCommandArgs {
  /**
   * Stack name to publish
   */
  stackName: string;

  /**
   * Optional semantic version for publication
   */
  version?: SemanticVersion;

  /**
   * Optional publication message
   */
  message?: string;
}

// =============================================================================
// TYPE GUARDS FOR RUNTIME VALIDATION
// =============================================================================

/**
 * Type guard to check if a string is a valid stack identifier
 */
export function isStackIdFormat(value: string): value is StackIdFormat {
  return /^[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+$/.test(value);
}

/**
 * Type guard to check if a string is a valid semantic version
 */
export function isSemanticVersion(value: string): value is SemanticVersion {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9-_.]+)?$/.test(value);
}

/**
 * Type guard to check if a value is a valid output format
 */
export function isOutputFormat(value: string): value is OutputFormat {
  return ['table', 'json', 'yaml', 'csv'].includes(value);
}

/**
 * Type guard to check if a value is a valid archive format
 */
export function isArchiveFormat(value: string): value is ArchiveFormat {
  return ['zip', 'tar', 'tar.gz'].includes(value);
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Simple validation result type
 */
export interface ValidationResult<T> {
  readonly valid: boolean;
  readonly value?: T;
  readonly error?: string;
}

/**
 * Validate and convert install arguments
 */
export function validateInstallArgs(args: InstallStackArgs): ValidationResult<EnhancedInstallArgs> {
  // Parse version from stackIdentifier if it contains @version
  const [stackId, version] = args.stackIdentifier.includes('@')
    ? args.stackIdentifier.split('@')
    : [args.stackIdentifier, undefined];

  if (!isStackIdFormat(stackId)) {
    return {
      valid: false,
      error: `Invalid stack identifier format. Expected "org/name", got "${stackId}"`,
    };
  }

  if (version && !isSemanticVersion(version)) {
    return {
      valid: false,
      error: `Invalid version format. Expected semantic version like "1.2.3", got "${version}"`,
    };
  }

  return {
    valid: true,
    value: {
      stackIdentifier: stackId as StackIdFormat,
      version: version as SemanticVersion | undefined,
      targetPath: args.targetPath,
      force: args.force,
      verbose: args.verbose,
    },
  };
}

/**
 * Validate and convert publish arguments
 */
export function validatePublishArgs(args: PublishStackArgs): ValidationResult<EnhancedPublishArgs> {
  if (args.version && !isSemanticVersion(args.version)) {
    return {
      valid: false,
      error: `Invalid version format. Expected semantic version like "1.2.3", got "${args.version}"`,
    };
  }

  return {
    valid: true,
    value: {
      stackName: args.stackName,
      version: args.version as SemanticVersion | undefined,
      message: args.message,
      force: args.force,
      verbose: args.verbose,
    },
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract the organization name from a stack identifier
 */
export type ExtractOrg<T extends StackIdFormat> = T extends `${infer Org}/${string}` ? Org : never;

/**
 * Extract the stack name from a stack identifier
 */
export type ExtractName<T extends StackIdFormat> = T extends `${string}/${infer Name}`
  ? Name
  : never;

/**
 * Helper type to make properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Helper type to make properties required
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

/**
 * Example of using the enhanced types in practice
 */
export function exampleUsage() {
  // Type-safe stack identifier
  const stackId: StackIdFormat = 'awesome-org/web-components';

  // Type-safe version
  const version: SemanticVersion = '1.2.3-beta.1';

  // Enhanced arguments with validation
  const installArgs: EnhancedInstallArgs = {
    stackIdentifier: stackId,
    version,
    targetPath: './my-project',
    force: false,
    verbose: true,
  };

  // Type inference works perfectly
  // Type inference works perfectly - commented out to avoid lint errors
  // type OrgName = ExtractOrg<typeof stackId>; // 'awesome-org'
  // type StackName = ExtractName<typeof stackId>; // 'web-components'

  return { installArgs, stackId, version };
}
