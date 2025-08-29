/**
 * Enterprise-grade TypeScript utility types for better type safety and developer experience
 */

/* eslint-disable no-unused-vars */

// =============================================================================
// BRANDED TYPES FOR DOMAIN-SPECIFIC VALIDATION
// =============================================================================

/**
 * Brand utility for creating nominal types
 */
declare const __brand: unique symbol;
/**
 * Brand utility for creating nominal types
 *
 * Creates a branded type that prevents accidental usage of raw values
 * where validated/branded values are expected. The brand is a compile-time
 * only marker that provides type safety without runtime overhead.
 *
 * @template T The base type to brand (e.g., string, number)
 * @template TBrand The brand identifier as a string literal
 *
 * @example
 * ```typescript
 * type UserId = Brand<string, 'UserId'>;
 * type Email = Brand<string, 'Email'>;
 *
 * // This prevents accidentally using a UserId where Email is expected
 * function sendEmail(to: Email, from: UserId) { ... } // Type error!
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type Brand<T, TBrand extends string> = T & {
  /** Brand marker property for compile-time type differentiation */
  readonly [__brand]: TBrand;
};

/**
 * Branded string types for better type safety
 */
export type StackName = Brand<string, 'StackName'>;
/** Branded type for semantic version strings (e.g., "1.2.0", "2.0.0-beta.1") */
export type StackVersion = Brand<string, 'StackVersion'>;
/** Branded type for validated organization names in stack identifiers */
export type OrganizationName = Brand<string, 'OrganizationName'>;
/** Branded type for validated stack identifiers in format "org/name" */
export type StackId = Brand<string, 'StackId'>; // format: org/name
/** Branded type for validated file and directory paths */
export type FilePath = Brand<string, 'FilePath'>;
/** Branded type for validated command names in stack configurations */
export type CommandName = Brand<string, 'CommandName'>;
/** Branded type for validated agent names in stack configurations */
export type AgentName = Brand<string, 'AgentName'>;
/** Branded type for validated MCP server names in configurations */
export type McpServerName = Brand<string, 'McpServerName'>;

/**
 * Branded numeric types
 */
export type PositiveInteger = Brand<number, 'PositiveInteger'>;
/** Branded type for Unix timestamp values (milliseconds since epoch) */
export type Timestamp = Brand<number, 'Timestamp'>;
/** Branded type for network port numbers (1-65535) */
export type Port = Brand<number, 'Port'>;

// =============================================================================
// ADVANCED UTILITY TYPES
// =============================================================================

/**
 * Make specific properties required in a type
 */
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties optional in a type
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Deep readonly utility
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? DeepReadonly<U>[]
    : T[P] extends Record<string, unknown>
      ? DeepReadonly<T[P]>
      : T[P];
};

/**
 * Deep partial utility
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends Record<string, unknown>
      ? DeepPartial<T[P]>
      : T[P];
};

/**
 * Non-empty array type
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Extract function parameters as tuple
 */
/**
 * Extract function parameters as tuple
 *
 * Utility type that extracts the parameter types from a function type
 * and returns them as a tuple type for type-safe function composition.
 *
 * @template T The function type to extract parameters from
 *
 * @example
 * ```typescript
 * type MyFunc = (a: string, b: number) => void;
 * type MyParams = Parameters<MyFunc>; // [string, number]
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type Parameters<T extends (...args: never[]) => unknown> = T extends (
  ...args: infer P
) => unknown
  ? P
  : never;

/**
 * Extract async function return type
 */
/**
 * Extract async function return type
 *
 * Utility type that extracts the resolved type from a Promise-returning
 * function, enabling type-safe handling of async function results.
 *
 * @template T The async function type to extract return type from
 *
 * @example
 * ```typescript
 * type AsyncFunc = () => Promise<User>;
 * type UserType = AsyncReturnType<AsyncFunc>; // User
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> = T extends (
  ...args: unknown[]
) => Promise<infer R>
  ? R
  : never;

/**
 * Union to intersection utility
 */
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/**
 * Strict object type (no excess properties)
 */
export type Exact<T, U extends T = T> = U & Record<Exclude<keyof U, keyof T>, never>;

// =============================================================================
// VALIDATION AND RESULT TYPES
// =============================================================================

/**
 * Result type for operations that can succeed or fail
 */
/**
 * Generic result type for operations that can succeed or fail
 *
 * Provides a discriminated union type for operations that may succeed
 * with data or fail with an error. Similar to Rust's Result type,
 * this enables type-safe error handling without exceptions.
 *
 * @template TData The type of data returned on success
 * @template TError The type of error returned on failure (defaults to Error)
 *
 * @example
 * ```typescript
 * function processFile(): Result<FileContent, string> {
 *   try {
 *     const content = readFileSync('file.txt');
 *     return { success: true, data: content };
 *   } catch (error) {
 *     return { success: false, error: 'File not found' };
 *   }
 * }
 *
 * const result = processFile();
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
export type Result<TData, TError = Error> =
  | {
      /** Indicates successful operation */
      readonly success: true;
      /** Data payload returned on successful operation */
      readonly data: TData;
    }
  | {
      /** Indicates failed operation */
      readonly success: false;
      /** Error information returned on failed operation */
      readonly error: TError;
    };

/**
 * Maybe type for optional values
 */
export type Maybe<T> = T | null | undefined;

/**
 * Non-nullable utility
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Validation result with detailed error information
 */
/**
 * Validation result with detailed error information
 *
 * Represents the outcome of validation operations with structured
 * error reporting. Unlike simple Result types, this provides detailed
 * field-level error information for complex validation scenarios.
 *
 * @template T The type of data being validated
 *
 * @example
 * ```typescript
 * function validateUser(data: unknown): ValidationResult<User> {
 *   const errors: ValidationError[] = [];
 *
 *   if (!data.name) {
 *     errors.push({
 *       field: 'name',
 *       message: 'Name is required',
 *       code: 'REQUIRED'
 *     });
 *   }
 *
 *   if (errors.length > 0) {
 *     return { success: false, errors };
 *   }
 *
 *   return { success: true, data: data as User };
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ValidationResult<T> {
  /** Whether the validation passed successfully */
  readonly success: boolean;
  /** The validated data (only present when success is true) */
  readonly data?: T;
  /** Array of validation errors (only present when success is false) */
  readonly errors?: ValidationError[];
}

/**
 * Detailed validation error information
 *
 * Provides structured error information for validation failures,
 * including field context, error messages, and optional error codes
 * for programmatic error handling.
 *
 * @example
 * ```typescript
 * const error: ValidationError = {
 *   field: 'email',
 *   message: 'Invalid email format',
 *   code: 'INVALID_FORMAT',
 *   value: 'not-an-email'
 * };
 *
 * // Use for structured error reporting
 * if (error.code === 'INVALID_FORMAT') {
 *   showFormatHelp(error.field);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ValidationError {
  /** The field name that failed validation */
  readonly field: string;
  /** Human-readable error message describing the validation failure */
  readonly message: string;
  /** Optional error code for programmatic error handling */
  readonly code?: string;
  /** Optional value that caused the validation failure */
  readonly value?: unknown;
}

// =============================================================================
// FUNCTIONAL PROGRAMMING UTILITIES
// =============================================================================

/**
 * Function composition types
 */
export type Func<T extends readonly unknown[], R> = (...args: T) => R;
/** Function type that returns a Promise with typed arguments and return value */
export type AsyncFunc<T extends readonly unknown[], R> = (...args: T) => Promise<R>;

/**
 * Predicate function type
 */
export type Predicate<T> = (value: T) => boolean;
/** Predicate function that returns a Promise<boolean> for async validation */
export type AsyncPredicate<T> = (value: T) => Promise<boolean>;

/**
 * Type-safe Object.keys alternative
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Extract values of specific type from object
 */
export type ValuesOfType<T, U> = T[KeysOfType<T, U>];

// =============================================================================
// CONFIGURATION AND SCHEMA TYPES
// =============================================================================

/**
 * Configuration schema with validation
 */
export type ConfigSchema<T> = {
  readonly [K in keyof T]: ConfigField<T[K]>;
};

/**
 * Configuration field definition with type validation and transformation
 *
 * Defines the structure and validation rules for individual configuration
 * fields, supporting type checking, default values, and custom validation.
 *
 * @template T The expected type of the configuration field value
 *
 * @example
 * ```typescript
 * const portField: ConfigField<number> = {
 *   type: 'number',
 *   required: true,
 *   default: 3000,
 *   validate: (value) => value > 0 && value < 65536,
 *   description: 'Server port number'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ConfigField<T> {
  /** The expected JSON type of this field */
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Whether this field must be present in the configuration */
  readonly required?: boolean;
  /** Default value to use if field is not provided */
  readonly default?: T;
  /** Custom validation function for the field value */
  readonly validate?: Predicate<T>;
  /** Transform function to convert raw input to the expected type */
  readonly transform?: (value: unknown) => T;
  /** Human-readable description of the field's purpose */
  readonly description?: string;
}

/**
 * Branded type constructors with validation
 */
/**
 * Validator utility for branded types with runtime type checking
 *
 * Provides runtime validation, creation, and unwrapping functions for branded
 * types, enabling safe conversion between raw and branded values.
 *
 * @template T The base type being branded
 * @template TBrand The brand identifier string
 *
 * @example
 * ```typescript
 * const emailValidator = createBrandedTypeValidator<string, 'Email'>(
 *   (value): value is string => typeof value === 'string' && value.includes('@')
 * );
 *
 * const email = emailValidator.create('user@example.com');
 * const rawValue = emailValidator.unwrap(email);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface BrandedTypeValidator<T, TBrand extends string> {
  /** Type guard function to validate if a value matches the branded type */
  readonly validate: (value: unknown) => value is Brand<T, TBrand>;
  /** Creates a branded value from a validated base type */
  readonly create: (value: T) => Brand<T, TBrand>;
  /** Extracts the base value from a branded type */
  readonly unwrap: (value: Brand<T, TBrand>) => T;
}

// =============================================================================
// COMMAND AND CLI UTILITIES
// =============================================================================

/**
 * Command handler with typed arguments
 */
/**
 * Command handler definition with typed arguments and validation
 *
 * Defines the structure for CLI command handlers with type-safe argument
 * handling and optional validation. Used by the command router to execute
 * commands with proper type checking.
 *
 * @template TArgs Type definition for command arguments
 *
 * @example
 * ```typescript
 * const installHandler: CommandHandler<{stack: string, force?: boolean}> = {
 *   name: 'install',
 *   description: 'Install a stack from Commands.com',
 *   handler: async (args) => {
 *     await installStack(args.stack, args.force);
 *   },
 *   validate: (args): args is {stack: string, force?: boolean} =>
 *     typeof args.stack === 'string'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CommandHandler<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  /** The command name as it appears in CLI usage */
  readonly name: string;
  /** Human-readable description of what this command does */
  readonly description: string;
  /** The main function that executes the command logic */
  readonly handler: (args: TArgs) => Promise<void> | void;
  /** Optional type guard to validate command arguments at runtime */
  readonly validate?: (args: unknown) => args is TArgs;
}

/**
 * Command line option definition
 */
/**
 * Command line option definition with validation and type constraints
 *
 * Defines the structure for CLI options including validation rules,
 * type constraints, and default values. Used by the argument parser
 * to validate and transform command line inputs.
 *
 * @template T The expected type of the option value
 *
 * @example
 * ```typescript
 * const portOption: CliOption<number> = {
 *   flag: '--port',
 *   description: 'Server port number',
 *   type: 'number',
 *   default: 3000,
 *   validate: (value) => value > 0 && value < 65536
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CliOption<T = unknown> {
  /** The command line flag (e.g., '--port', '-p') */
  readonly flag: string;
  /** Human-readable description shown in help text */
  readonly description: string;
  /** The expected type for parsing and validation */
  readonly type: 'string' | 'number' | 'boolean';
  /** Whether this option must be provided */
  readonly required?: boolean;
  /** Default value when option is not provided */
  readonly default?: T;
  /** Allowed values for this option (enum-like behavior) */
  readonly choices?: readonly T[];
  /** Custom validation function for the option value */
  readonly validate?: Predicate<T>;
}

/**
 * Strongly typed command arguments
 */
export type TypedArgs<T extends Record<string, CliOption>> = {
  readonly [K in keyof T]: T[K]['required'] extends true
    ? NonNullable<T[K]['default']>
    : T[K]['default'] | undefined;
};

// =============================================================================
// CONDITIONAL AND MAPPED TYPE UTILITIES
// =============================================================================

/**
 * Conditional type for checking if type is never
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Conditional type for checking if type is unknown
 */
export type IsUnknown<T> = unknown extends T ? (T extends unknown ? true : false) : false;

/**
 * Safe type assertion with validation
 */
export type TypeAssertion<T, U extends T = T> = (value: unknown) => value is U;

/**
 * Mutable version of readonly type
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P] extends readonly (infer U)[]
    ? U[]
    : T[P] extends Record<string, unknown>
      ? Mutable<T[P]>
      : T[P];
};

/**
 * Extract promise type
 */
export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T;

/**
 * Type-safe event emitter event map
 */
export interface TypedEventMap {
  readonly [eventName: string]: readonly unknown[];
}

/** Event handler function type for synchronous event processing */
export type EventHandler<T extends readonly unknown[]> = (...args: T) => void;
/** Event handler function type for asynchronous event processing */
export type AsyncEventHandler<T extends readonly unknown[]> = (...args: T) => Promise<void>;

// =============================================================================
// BUILDER PATTERN UTILITIES
// =============================================================================

/**
 * Builder pattern base interface
 */
/**
 * Builder pattern base interface for fluent object construction
 *
 * Provides a standard interface for builder pattern implementations,
 * ensuring consistent API across different builder classes.
 *
 * @template T The type of object being built
 *
 * @example
 * ```typescript
 * class StackConfigBuilder implements Builder<StackConfig> {
 *   private config: Partial<StackConfig> = {};
 *
 *   setName(name: string): this {
 *     this.config.name = name;
 *     return this;
 *   }
 *
 *   build(): StackConfig {
 *     return validateStackConfig(this.config);
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface Builder<T> {
  /** Constructs and returns the final object instance */
  build(): T;
}

/**
 * Fluent interface for method chaining
 */
export type FluentInterface<T> = {
  readonly [K in keyof T]: T[K] extends (...args: infer A) => unknown
    ? (...args: A) => FluentInterface<T>
    : T[K];
};

// =============================================================================
// TYPE GUARDS AND RUNTIME VALIDATION
// =============================================================================

/**
 * Type guard factory for branded types
 */
export function createBrandedTypeValidator<T extends string | number, TBrand extends string>(
  basePredicate: Predicate<T>
): BrandedTypeValidator<T, TBrand> {
  return {
    validate: (value: unknown): value is Brand<T, TBrand> => basePredicate(value as T),
    create: (value: T): Brand<T, TBrand> => value as Brand<T, TBrand>,
    unwrap: (value: Brand<T, TBrand>): T => value as T,
  };
}

/**
 * Array type guard
 */
export function isNonEmptyArray<T>(arr: T[]): arr is NonEmptyArray<T> {
  return arr.length > 0;
}

/**
 * Object type guard
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safe property access with type narrowing
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isRecord(obj) && key in obj;
}
