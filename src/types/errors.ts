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
    const sanitizedValue = ValidationError.sanitizeErrorValue(field, value);
    super(`Invalid ${field}: expected ${expected}, got ${sanitizedValue}`);
  }

  /**
   * Sanitizes error values to prevent information disclosure
   * @param field The field name being validated
   * @param value The value that failed validation
   * @returns A safe string representation
   */
  private static sanitizeErrorValue(field: string, value: unknown): string {
    // List of sensitive field names that should be redacted
    const sensitiveFields = ['token', 'password', 'key', 'secret', 'auth', 'credential', 'bearer'];

    // Check if field name contains sensitive keywords
    const fieldLower = field.toLowerCase();
    const isSensitiveField = sensitiveFields.some(sensitive => fieldLower.includes(sensitive));

    if (isSensitiveField) {
      return '[REDACTED]';
    }

    return ValidationError.formatValue(value);
  }

  private static formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (typeof value === 'string') {
      return ValidationError.formatString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (typeof value === 'object') {
      return ValidationError.formatObject(value);
    }

    return `[${typeof value}]`;
  }

  private static formatString(value: string): string {
    return value.length > 100 ? `"${value.substring(0, 97)}..."` : `"${value}"`;
  }

  private static formatObject(value: object): string {
    return Array.isArray(value)
      ? `Array(${value.length})`
      : `[object ${value.constructor?.name || 'Object'}]`;
  }
}

export class FileSystemError extends StackError {
  readonly code = 'FILESYSTEM_ERROR';

  constructor(operation: string, path: string, cause?: Error) {
    // Sanitize file paths to prevent information disclosure
    const sanitizedPath = FileSystemError.sanitizeFilePath(path);
    super(`Failed to ${operation} file at ${sanitizedPath}`, cause);
  }

  /**
   * Sanitizes file paths to prevent information disclosure
   * @param path The file path to sanitize
   * @returns A sanitized path that doesn't reveal sensitive information
   */
  private static sanitizeFilePath(path: string): string {
    let sanitized = path
      .replace(/\/Users\/[^/]+/g, '[USER_DIR]') // macOS user directories
      .replace(/\/home\/[^/]+/g, '[USER_DIR]') // Linux user directories
      .replace(/C:\\Users\\[^\\]+/g, '[USER_DIR]') // Windows user directories
      .replace(/\/etc\/[^/]*/g, '[SYS_DIR]') // System configuration directories
      .replace(/\/root\/[^/]*/g, '[ROOT_DIR]'); // Root directory contents

    // Truncate very long paths
    if (sanitized.length > 100) {
      const parts = sanitized.split('/');
      if (parts.length > 3) {
        sanitized = `.../${parts.slice(-2).join('/')}`;
      }
    }

    return sanitized;
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
    // Sanitize authentication error messages to prevent information disclosure
    const sanitizedMessage = AuthenticationError.sanitizeAuthMessage(message);
    super(sanitizedMessage);
  }

  /**
   * Sanitizes authentication error messages to prevent information disclosure
   * @param message The original error message
   * @returns A sanitized message that doesn't reveal sensitive information
   */
  private static sanitizeAuthMessage(message: string): string {
    // Remove any potential token or credential information from error messages
    const sensitivePatterns = [
      /Bearer\s+[A-Za-z0-9+/=]+/g, // Bearer tokens
      /token[:\s]+[A-Za-z0-9+/=]+/gi, // Token values
      /key[:\s]+[A-Za-z0-9+/=]+/gi, // API keys
      /secret[:\s]+[A-Za-z0-9+/=]+/gi, // Secrets
      /password[:\s]+\S+/gi, // Passwords
    ];

    let sanitized = message;

    // Replace sensitive patterns
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    // If message is too detailed, use a generic message
    if (
      sanitized.toLowerCase().includes('invalid_client') ||
      sanitized.toLowerCase().includes('unauthorized_client')
    ) {
      return 'Authentication failed: Invalid credentials';
    }

    return sanitized;
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
