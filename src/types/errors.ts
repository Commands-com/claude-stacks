/**
 * Comprehensive error types for better error handling
 */

export abstract class StackError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly _cause?: Error // eslint-disable-line no-unused-vars
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends StackError {
  readonly code = 'VALIDATION_ERROR';

  constructor(field: string, value: unknown, expected: string) {
    super(
      `Invalid ${field}: expected ${expected}, got ${typeof value === 'object' ? JSON.stringify(value) : value}`
    );
  }
}

export class FileSystemError extends StackError {
  readonly code = 'FILESYSTEM_ERROR';

  constructor(operation: string, path: string, cause?: Error) {
    super(`Failed to ${operation} file at ${path}`, cause);
  }
}

export class StackNotFoundError extends StackError {
  readonly code = 'STACK_NOT_FOUND';

  constructor(stackName: string) {
    super(`Stack '${stackName}' not found`);
  }
}

export class StackAlreadyExistsError extends StackError {
  readonly code = 'STACK_ALREADY_EXISTS';

  constructor(stackName: string) {
    super(`Stack '${stackName}' already exists`);
  }
}

export class PublishError extends StackError {
  readonly code = 'PUBLISH_ERROR';

  constructor(stackName: string, reason: string, cause?: Error) {
    super(`Failed to publish stack '${stackName}': ${reason}`, cause);
  }
}

export class InstallError extends StackError {
  readonly code = 'INSTALL_ERROR';

  constructor(stackIdentifier: string, reason: string, cause?: Error) {
    super(`Failed to install stack '${stackIdentifier}': ${reason}`, cause);
  }
}

export class AuthenticationError extends StackError {
  readonly code = 'AUTH_ERROR';

  constructor(message: string = 'Authentication failed') {
    super(message);
  }
}

export class NetworkError extends StackError {
  readonly code = 'NETWORK_ERROR';

  constructor(operation: string, cause?: Error) {
    super(`Network error during ${operation}`, cause);
  }
}

export class ConfigurationError extends StackError {
  readonly code = 'CONFIG_ERROR';

  constructor(message: string, cause?: Error) {
    super(`Configuration error: ${message}`, cause);
  }
}

/**
 * Type guard to check if an error is a StackError
 */
export function isStackError(error: unknown): error is StackError {
  return error instanceof StackError;
}

/**
 * Type guard for specific error types
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof FileSystemError;
}

export function isStackNotFoundError(error: unknown): error is StackNotFoundError {
  return error instanceof StackNotFoundError;
}

export function isStackAlreadyExistsError(error: unknown): error is StackAlreadyExistsError {
  return error instanceof StackAlreadyExistsError;
}
