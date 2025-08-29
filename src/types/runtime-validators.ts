/**
 * Runtime validators for branded types with comprehensive error messages
 * Provides type-safe creation and validation of domain-specific types
 */

import type {
  AgentName,
  Brand,
  BrandedTypeValidator,
  CommandName,
  FilePath,
  McpServerName,
  OrganizationName,
  Port,
  PositiveInteger,
  StackId,
  StackName,
  StackVersion,
} from './utilities.js';

// ============================================================================
// STACK-SPECIFIC VALIDATORS
// ============================================================================

/**
 * Validates and creates a StackName
 * Rules: Start with letter, contain only letters, numbers, underscores, hyphens
 */
export const StackNameValidator: BrandedTypeValidator<string, 'StackName'> = {
  validate: (value: unknown): value is StackName => {
    if (typeof value !== 'string') return false;
    if (value.trim().length === 0) return false;
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) return false;
    return true;
  },

  create: (value: string): StackName => {
    if (!StackNameValidator.validate(value)) {
      throw new Error(
        `Invalid StackName: "${value}". Must start with a letter and contain only letters, numbers, underscores, and hyphens.`
      );
    }
    return value as StackName;
  },

  unwrap: (value: StackName): string => value as string,
};

/**
 * Validates and creates a StackVersion following semantic versioning
 */
export const StackVersionValidator: BrandedTypeValidator<string, 'StackVersion'> = {
  validate: (value: unknown): value is StackVersion => {
    if (typeof value !== 'string') return false;
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(value);
  },

  create: (value: string): StackVersion => {
    if (!StackVersionValidator.validate(value)) {
      throw new Error(
        `Invalid StackVersion: "${value}". Must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta, 1.0.0+build).`
      );
    }
    return value as StackVersion;
  },

  unwrap: (value: StackVersion): string => value as string,
};

/**
 * Validates and creates an OrganizationName
 */
export const OrganizationNameValidator: BrandedTypeValidator<string, 'OrganizationName'> = {
  validate: (value: unknown): value is OrganizationName => {
    if (typeof value !== 'string') return false;
    if (value.trim().length === 0) return false;
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) return false;
    return value.length <= 50; // Reasonable limit
  },

  create: (value: string): OrganizationName => {
    if (!OrganizationNameValidator.validate(value)) {
      throw new Error(
        `Invalid OrganizationName: "${value}". Must start with a letter, contain only letters, numbers, underscores, hyphens, and be <= 50 characters.`
      );
    }
    return value as OrganizationName;
  },

  unwrap: (value: OrganizationName): string => value as string,
};

/**
 * Validates and creates a StackId in the format "org/name"
 */
export const StackIdValidator: BrandedTypeValidator<string, 'StackId'> = {
  validate: (value: unknown): value is StackId => {
    if (typeof value !== 'string') return false;

    const parts = value.split('/');
    if (parts.length !== 2) return false;

    const [org, name] = parts;
    return OrganizationNameValidator.validate(org) && StackNameValidator.validate(name);
  },

  create: (value: string): StackId => {
    if (!StackIdValidator.validate(value)) {
      throw new Error(
        `Invalid StackId: "${value}". Must be in format "org/name" where both org and name are valid identifiers.`
      );
    }
    return value as StackId;
  },

  unwrap: (value: StackId): string => value as string,
};

/**
 * Creates a StackId from separate org and name components
 */
export const createStackId = (org: OrganizationName, name: StackName): StackId => {
  return StackIdValidator.create(`${org}/${name}`);
};

// ============================================================================
// COMMAND AND AGENT VALIDATORS
// ============================================================================

/**
 * Validates and creates a CommandName
 */
export const CommandNameValidator: BrandedTypeValidator<string, 'CommandName'> = {
  validate: (value: unknown): value is CommandName => {
    if (typeof value !== 'string') return false;
    if (value.trim().length === 0) return false;
    if (!/^[a-z][a-z0-9-]*$/.test(value)) return false;
    return value.length <= 100;
  },

  create: (value: string): CommandName => {
    if (!CommandNameValidator.validate(value)) {
      throw new Error(
        `Invalid CommandName: "${value}". Must start with lowercase letter, contain only lowercase letters, numbers, hyphens, and be <= 100 characters.`
      );
    }
    return value as CommandName;
  },

  unwrap: (value: CommandName): string => value as string,
};

/**
 * Validates and creates an AgentName
 */
export const AgentNameValidator: BrandedTypeValidator<string, 'AgentName'> = {
  validate: (value: unknown): value is AgentName => {
    if (typeof value !== 'string') return false;
    if (value.trim().length === 0) return false;
    if (!/^[a-z][a-z0-9-]*$/.test(value)) return false;
    return value.length <= 100;
  },

  create: (value: string): AgentName => {
    if (!AgentNameValidator.validate(value)) {
      throw new Error(
        `Invalid AgentName: "${value}". Must start with lowercase letter, contain only lowercase letters, numbers, hyphens, and be <= 100 characters.`
      );
    }
    return value as AgentName;
  },

  unwrap: (value: AgentName): string => value as string,
};

/**
 * Validates and creates an McpServerName
 */
export const McpServerNameValidator: BrandedTypeValidator<string, 'McpServerName'> = {
  validate: (value: unknown): value is McpServerName => {
    if (typeof value !== 'string') return false;
    if (value.trim().length === 0) return false;
    if (!/^[a-z][a-z0-9_-]*$/.test(value)) return false;
    return value.length <= 100;
  },

  create: (value: string): McpServerName => {
    if (!McpServerNameValidator.validate(value)) {
      throw new Error(
        `Invalid McpServerName: "${value}". Must start with lowercase letter, contain only lowercase letters, numbers, underscores, hyphens, and be <= 100 characters.`
      );
    }
    return value as McpServerName;
  },

  unwrap: (value: McpServerName): string => value as string,
};

// ============================================================================
// NUMERIC VALIDATORS
// ============================================================================

/**
 * Validates and creates a PositiveInteger
 */
export const PositiveIntegerValidator: BrandedTypeValidator<number, 'PositiveInteger'> = {
  validate: (value: unknown): value is PositiveInteger => {
    if (typeof value !== 'number') return false;
    return Number.isInteger(value) && value > 0;
  },

  create: (value: number): PositiveInteger => {
    if (!PositiveIntegerValidator.validate(value)) {
      throw new Error(
        `Invalid PositiveInteger: "${value}". Must be a positive integer greater than 0.`
      );
    }
    return value as PositiveInteger;
  },

  unwrap: (value: PositiveInteger): number => value as number,
};

/**
 * Validates and creates a Port number
 */
export const PortValidator: BrandedTypeValidator<number, 'Port'> = {
  validate: (value: unknown): value is Port => {
    if (typeof value !== 'number') return false;
    return Number.isInteger(value) && value >= 1 && value <= 65535;
  },

  create: (value: number): Port => {
    if (!PortValidator.validate(value)) {
      throw new Error(`Invalid Port: "${value}". Must be an integer between 1 and 65535.`);
    }
    return value as Port;
  },

  unwrap: (value: Port): number => value as number,
};

// ============================================================================
// PATH VALIDATORS
// ============================================================================

/**
 * Validates and creates a FilePath
 */
export const FilePathValidator: BrandedTypeValidator<string, 'FilePath'> = {
  validate: (value: unknown): value is FilePath => {
    if (typeof value !== 'string') return false;
    if (value.trim().length === 0) return false;

    // Basic path validation (can be enhanced based on OS)
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(value)) return false;

    // Prevent obvious dangerous paths
    const normalizedPath = value.toLowerCase();
    const dangerousPaths = [
      'con',
      'prn',
      'aux',
      'nul',
      'com1',
      'com2',
      'com3',
      'com4',
      'com5',
      'com6',
      'com7',
      'com8',
      'com9',
      'lpt1',
      'lpt2',
      'lpt3',
      'lpt4',
      'lpt5',
      'lpt6',
      'lpt7',
      'lpt8',
      'lpt9',
    ];

    for (const dangerous of dangerousPaths) {
      if (normalizedPath === dangerous || normalizedPath.startsWith(`${dangerous}.`)) {
        return false;
      }
    }

    return true;
  },

  create: (value: string): FilePath => {
    if (!FilePathValidator.validate(value)) {
      throw new Error(
        `Invalid FilePath: "${value}". Contains invalid characters or is a reserved system path.`
      );
    }
    return value as FilePath;
  },

  unwrap: (value: FilePath): string => value as string,
};

// ============================================================================
// MCP SERVER SECURITY VALIDATORS
// ============================================================================

/**
 * Interface for safe MCP server configuration
 */
/**
 * Interface for safe MCP server configuration
 *
 * Defines the structure for MCP server configuration objects that have
 * been validated for basic format correctness. Used internally by the
 * validation system to ensure type safety after validation.
 *
 * @example
 * ```typescript
 * const config: SafeMcpServerConfig = {
 *   command: 'node',
 *   args: ['server.js', '--port', '3000'],
 *   env: { NODE_ENV: 'production' },
 *   url: 'http://localhost:3000'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface SafeMcpServerConfig {
  /** Optional command to execute for the MCP server */
  command?: string;
  /** Optional array of arguments to pass to the command */
  args?: string[];
  /** Optional environment variables for the MCP server process */
  env?: Record<string, string>;
  /** Optional URL for connecting to the MCP server */
  url?: string;
  /** Optional type identifier for the MCP server */
  type?: string;
}

/**
 * Validates MCP server configurations for basic format correctness
 * Note: MCP servers are user-controlled and run in user's environment
 * Security is the user's responsibility as they choose what to install
 */
export const McpServerConfigValidator = {
  /**
   * Validates an MCP server configuration for basic format
   * @param config The MCP server configuration to validate
   * @returns true if configuration has valid format
   * @throws Error if configuration has invalid format
   */
  validate: (config: unknown): config is SafeMcpServerConfig => {
    if (!config || typeof config !== 'object') {
      throw new Error('MCP server configuration must be an object');
    }

    const server = config as Record<string, unknown>;

    // Basic format validation only - no security restrictions
    McpServerConfigValidator.validateCommand(server);
    McpServerConfigValidator.validateArgs(server);
    McpServerConfigValidator.validateEnv(server);
    McpServerConfigValidator.validateUrl(server);

    return true;
  },

  /**
   * Validates the command property of an MCP server configuration
   *
   * @param server - The server configuration object to validate
   * @throws {Error} When command property exists but is not a string
   * @since 1.0.0
   * @public
   */
  validateCommand: (server: Record<string, unknown>): void => {
    if (server.command !== undefined && typeof server.command !== 'string') {
      throw new Error('MCP server command must be a string');
    }
  },

  /**
   * Validates the args property of an MCP server configuration
   *
   * @param server - The server configuration object to validate
   * @throws {Error} When args property exists but is not an array
   * @since 1.0.0
   * @public
   */
  validateArgs: (server: Record<string, unknown>): void => {
    if (server.args !== undefined && !Array.isArray(server.args)) {
      throw new Error('MCP server args must be an array');
    }
  },

  /**
   * Validates the env property of an MCP server configuration
   *
   * @param server - The server configuration object to validate
   * @throws {Error} When env property exists but is not a valid object
   * @since 1.0.0
   * @public
   */
  validateEnv: (server: Record<string, unknown>): void => {
    if (server.env !== undefined && (typeof server.env !== 'object' || server.env === null)) {
      throw new Error('MCP server env must be an object');
    }
  },

  /**
   * Validates the url property of an MCP server configuration
   *
   * @param server - The server configuration object to validate
   * @throws {Error} When url property exists but is not a string
   * @since 1.0.0
   * @public
   */
  validateUrl: (server: Record<string, unknown>): void => {
    if (server.url !== undefined && typeof server.url !== 'string') {
      throw new Error('MCP server URL must be a string');
    }
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Type-safe parser that returns a Result type
 */
/**
 * Type-safe parser that returns a Result type
 *
 * Attempts to validate and create a branded type from an unknown value.
 * Returns a discriminated union indicating success or failure with
 * appropriate data or error information.
 *
 * @template T The base type to validate
 * @template TBrand The brand identifier for the type
 * @param validator - The branded type validator to use
 * @param value - The unknown value to validate and convert
 * @returns Success result with data or failure result with error message
 *
 * @example
 * ```typescript
 * const result = safeParse(StackNameValidator, 'my-stack');
 * if (result.success) {
 *   console.log(result.data); // TypeScript knows data exists
 * } else {
 *   console.error(result.error); // TypeScript knows error exists
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const safeParse = <T, TBrand extends string>(
  validator: BrandedTypeValidator<T, TBrand>,
  value: unknown
):
  | {
      /** Success state indicator */
      success: true;
      /** Validated and branded data on success */
      data: Brand<T, TBrand>;
    }
  | {
      /** Failure state indicator */
      success: false;
      /** Error message explaining validation failure */
      error: string;
    } => {
  try {
    const result = validator.create(value as T);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Creates a validation function for arrays of branded types
 */
export const createArrayValidator = <T, TBrand extends string>(
  validator: BrandedTypeValidator<T, TBrand>
) => {
  return (values: unknown[]): Brand<T, TBrand>[] => {
    return values.map((value, index) => {
      const result = safeParse(validator, value);
      if (!result.success) {
        throw new Error(`Invalid value at index ${index}: ${result.error}`);
      }
      return result.data;
    });
  };
};
