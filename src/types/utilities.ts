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
export type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

/**
 * Branded string types for better type safety
 */
export type StackName = Brand<string, 'StackName'>;
export type StackVersion = Brand<string, 'StackVersion'>;
export type OrganizationName = Brand<string, 'OrganizationName'>;
export type StackId = Brand<string, 'StackId'>; // format: org/name
export type FilePath = Brand<string, 'FilePath'>;
export type CommandName = Brand<string, 'CommandName'>;
export type AgentName = Brand<string, 'AgentName'>;
export type McpServerName = Brand<string, 'McpServerName'>;

/**
 * Branded numeric types
 */
export type PositiveInteger = Brand<number, 'PositiveInteger'>;
export type Timestamp = Brand<number, 'Timestamp'>;
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
export type Parameters<T extends (...args: never[]) => unknown> = T extends (
  ...args: infer P
) => unknown
  ? P
  : never;

/**
 * Extract async function return type
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
export type Result<TData, TError = Error> =
  | { readonly success: true; readonly data: TData }
  | { readonly success: false; readonly error: TError };

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
export interface ValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors?: ValidationError[];
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
  readonly value?: unknown;
}

// =============================================================================
// FUNCTIONAL PROGRAMMING UTILITIES
// =============================================================================

/**
 * Function composition types
 */
export type Func<T extends readonly unknown[], R> = (...args: T) => R;
export type AsyncFunc<T extends readonly unknown[], R> = (...args: T) => Promise<R>;

/**
 * Predicate function type
 */
export type Predicate<T> = (value: T) => boolean;
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

export interface ConfigField<T> {
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly required?: boolean;
  readonly default?: T;
  readonly validate?: Predicate<T>;
  readonly transform?: (value: unknown) => T;
  readonly description?: string;
}

/**
 * Branded type constructors with validation
 */
export interface BrandedTypeValidator<T, TBrand extends string> {
  readonly validate: (value: unknown) => value is Brand<T, TBrand>;
  readonly create: (value: T) => Brand<T, TBrand>;
  readonly unwrap: (value: Brand<T, TBrand>) => T;
}

// =============================================================================
// COMMAND AND CLI UTILITIES
// =============================================================================

/**
 * Command handler with typed arguments
 */
export interface CommandHandler<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  readonly name: string;
  readonly description: string;
  readonly handler: (args: TArgs) => Promise<void> | void;
  readonly validate?: (args: unknown) => args is TArgs;
}

/**
 * Command line option definition
 */
export interface CliOption<T = unknown> {
  readonly flag: string;
  readonly description: string;
  readonly type: 'string' | 'number' | 'boolean';
  readonly required?: boolean;
  readonly default?: T;
  readonly choices?: readonly T[];
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

export type EventHandler<T extends readonly unknown[]> = (...args: T) => void;
export type AsyncEventHandler<T extends readonly unknown[]> = (...args: T) => Promise<void>;

// =============================================================================
// BUILDER PATTERN UTILITIES
// =============================================================================

/**
 * Builder pattern base interface
 */
export interface Builder<T> {
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
