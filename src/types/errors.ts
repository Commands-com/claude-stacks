/**
 * Comprehensive error types for better error handling throughout the Claude Stacks CLI
 *
 * @remarks
 * This module provides a hierarchical error system with specific error types for different
 * failure scenarios. All errors extend the base StackError class which provides consistent
 * error handling, cause chaining, and error code categorization for proper error recovery
 * and user feedback.
 *
 * The error hierarchy follows these principles:
 * - Specific error types for different failure categories
 * - Consistent error codes for programmatic error handling
 * - Cause chaining to preserve original error context
 * - Security-conscious error message sanitization
 * - Type guards for safe error type checking
 *
 * @since 1.0.0
 * @public
 */

/**
 * Base class for all Claude Stacks CLI errors
 *
 * @remarks
 * Provides common error handling infrastructure including error codes,
 * cause chaining, and consistent error naming. All CLI-specific errors
 * should extend this base class to ensure uniform error handling behavior.
 *
 * @example
 * ```typescript
 * class CustomError extends StackError {
 *   readonly code = 'CUSTOM_ERROR';
 *
 *   constructor(message: string, cause?: Error) {
 *     super(message, cause);
 *   }
 * }
 *
 * try {
 *   throw new Error('Original error');
 * } catch (error) {
 *   throw new CustomError('Operation failed', error as Error);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class StackError extends Error {
  /**
   * Unique error code for programmatic error identification
   *
   * @remarks
   * Each error type must provide a unique code that can be used for
   * error categorization, logging, and programmatic error handling.
   * Codes follow the pattern: CATEGORY_ERROR (e.g., 'VALIDATION_ERROR').
   *
   * @since 1.0.0
   * @public
   */
  abstract readonly code: string;

  /**
   * Original error that caused this error, if any
   *
   * @remarks
   * Preserves the original error context for debugging and error analysis.
   * Used to maintain the complete error chain when wrapping lower-level errors
   * with more specific CLI error types. Access via error.cause for compatibility
   * with standard Error cause property.
   *
   * @example
   * ```typescript
   * const originalError = new Error('File not found');
   * const stackError = new FileSystemError('read', '/path/to/file', originalError);
   * console.log(stackError._cause); // Original Error object
   * ```
   *
   * @since 1.0.0
   * @public
   */
  public readonly _cause?: Error;

  constructor(message: string, _cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this._cause = _cause;
  }
}

/**
 * Error thrown when input validation fails
 *
 * @remarks
 * Used for invalid user input, malformed configuration data, or parameter
 * validation failures. Automatically sanitizes sensitive values in error
 * messages to prevent accidental disclosure of credentials or tokens.
 *
 * @example
 * ```typescript
 * // Safe error message generation
 * throw new ValidationError('apiToken', 'invalid_token_123', 'valid JWT token');
 * // Results in: "Invalid apiToken: expected valid JWT token, got [REDACTED]"
 *
 * // Non-sensitive field validation
 * throw new ValidationError('stackName', '', 'non-empty string');
 * // Results in: "Invalid stackName: expected non-empty string, got \"\""
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ValidationError extends StackError {
  /**
   * Error code for validation failures
   *
   * @remarks
   * Used to identify validation errors programmatically for specific
   * error handling and user feedback customization.
   *
   * @since 1.0.0
   * @public
   */
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

/**
 * Error thrown when file system operations fail
 *
 * @remarks
 * Covers file I/O errors, permission issues, path resolution failures,
 * and other file system related problems. Automatically sanitizes file
 * paths in error messages to prevent disclosure of sensitive directory
 * structures or user information.
 *
 * @example
 * ```typescript
 * try {
 *   await fs.readFile('/Users/john/.config/secret.json');
 * } catch (error) {
 *   throw new FileSystemError('read', '/Users/john/.config/secret.json', error as Error);
 *   // Results in sanitized path: "Failed to read file at [USER_DIR]/.config/secret.json"
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class FileSystemError extends StackError {
  /**
   * Error code for file system operation failures
   *
   * @remarks
   * Used to identify file system errors programmatically for retry logic,
   * fallback behavior, or specific user guidance based on the operation type.
   *
   * @since 1.0.0
   * @public
   */
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

/**
 * Error thrown when a requested stack cannot be found
 *
 * @remarks
 * Used when attempting to access, install, or manipulate a stack that
 * doesn't exist locally or remotely. Common scenarios include typos in
 * stack names, missing stacks, or network issues preventing stack discovery.
 *
 * @example
 * ```typescript
 * // When trying to install a non-existent stack
 * throw new StackNotFoundError('nonexistent/missing-stack');
 * // Results in: "Stack 'nonexistent/missing-stack' not found"
 *
 * // Handle the error appropriately
 * try {
 *   await stackService.getStack(stackName);
 * } catch (error) {
 *   if (isStackNotFoundError(error)) {
 *     console.error(`Stack ${stackName} doesn't exist. Check the name and try again.`);
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class StackNotFoundError extends StackError {
  /**
   * Error code for stack not found errors
   *
   * @remarks
   * Used to identify missing stack errors programmatically for suggesting
   * alternatives, showing available stacks, or providing installation guidance.
   *
   * @since 1.0.0
   * @public
   */
  readonly code = 'STACK_NOT_FOUND';

  constructor(stackName: string) {
    super(`Stack '${stackName}' not found`);
  }
}

/**
 * Error thrown when attempting to create a stack that already exists
 *
 * @remarks
 * Used during stack installation or creation when a stack with the same
 * name already exists locally. Helps prevent accidental overwrites and
 * guides users toward proper stack management commands.
 *
 * @example
 * ```typescript
 * // When trying to install an already installed stack
 * throw new StackAlreadyExistsError('existing/installed-stack');
 * // Results in: "Stack 'existing/installed-stack' already exists"
 *
 * // Handle the error with user guidance
 * try {
 *   await stackService.installStack(stackName);
 * } catch (error) {
 *   if (isStackAlreadyExistsError(error)) {
 *     console.log(`Stack ${stackName} is already installed. Use --force to reinstall.`);
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class StackAlreadyExistsError extends StackError {
  /**
   * Error code for duplicate stack errors
   *
   * @remarks
   * Used to identify duplicate stack errors programmatically for offering
   * force reinstall options, update suggestions, or alternative actions.
   *
   * @since 1.0.0
   * @public
   */
  readonly code = 'STACK_ALREADY_EXISTS';

  constructor(stackName: string) {
    super(`Stack '${stackName}' already exists`);
  }
}

/**
 * Error thrown when stack publishing fails
 *
 * @remarks
 * Covers failures during the stack publishing process including network
 * issues, authentication problems, validation failures, or server errors.
 * Preserves the original error cause for detailed debugging while providing
 * user-friendly error messages.
 *
 * @example
 * ```typescript
 * try {
 *   await apiService.publishStack(stackData);
 * } catch (error) {
 *   throw new PublishError('my-org/my-stack', 'Invalid stack configuration', error as Error);
 *   // Results in: "Failed to publish stack 'my-org/my-stack': Invalid stack configuration"
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PublishError extends StackError {
  /**
   * Error code for stack publishing failures
   *
   * @remarks
   * Used to identify publishing errors programmatically for retry logic,
   * authentication prompts, or specific troubleshooting guidance.
   *
   * @since 1.0.0
   * @public
   */
  readonly code = 'PUBLISH_ERROR';

  constructor(stackName: string, reason: string, cause?: Error) {
    super(`Failed to publish stack '${stackName}': ${reason}`, cause);
  }
}

/**
 * Error thrown when stack installation fails
 *
 * @remarks
 * Covers failures during the stack installation process including download
 * errors, file system issues, configuration problems, or dependency conflicts.
 * Provides detailed context about what went wrong during installation.
 *
 * @example
 * ```typescript
 * try {
 *   await stackService.downloadStack(stackIdentifier);
 * } catch (error) {
 *   throw new InstallError(
 *     'example-org/useful-stack',
 *     'Network timeout during download',
 *     error as Error
 *   );
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class InstallError extends StackError {
  /**
   * Error code for stack installation failures
   *
   * @remarks
   * Used to identify installation errors programmatically for retry attempts,
   * cleanup operations, or alternative installation methods.
   *
   * @since 1.0.0
   * @public
   */
  readonly code = 'INSTALL_ERROR';

  constructor(stackIdentifier: string, reason: string, cause?: Error) {
    super(`Failed to install stack '${stackIdentifier}': ${reason}`, cause);
  }
}

/**
 * Error thrown when authentication operations fail
 *
 * @remarks
 * Handles authentication failures, token validation errors, and credential
 * issues. Automatically sanitizes error messages to prevent accidental
 * disclosure of tokens, credentials, or other sensitive authentication data.
 *
 * @example
 * ```typescript
 * // Authentication failure with sanitized message
 * throw new AuthenticationError('Invalid Bearer token: abc123xyz');
 * // Results in: "Authentication failed: [REDACTED]"
 *
 * // Handle authentication errors appropriately
 * try {
 *   await authService.authenticate();
 * } catch (error) {
 *   if (error instanceof AuthenticationError) {
 *     console.error('Please log in again with: claude-stacks auth');
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class AuthenticationError extends StackError {
  /**
   * Error code for authentication failures
   *
   * @remarks
   * Used to identify authentication errors programmatically for triggering
   * re-authentication flows, clearing invalid tokens, or showing login prompts.
   *
   * @since 1.0.0
   * @public
   */
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

/**
 * Error thrown when network operations fail
 *
 * @remarks
 * Covers network connectivity issues, API timeouts, DNS resolution failures,
 * and other network-related problems. Preserves the original network error
 * for debugging while providing user-friendly operation context.
 *
 * @example
 * ```typescript
 * try {
 *   const response = await fetch('https://api.commands.com/stacks');
 * } catch (error) {
 *   throw new NetworkError('fetching stack list', error as Error);
 *   // Results in: "Network error during fetching stack list"
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class NetworkError extends StackError {
  /**
   * Error code for network operation failures
   *
   * @remarks
   * Used to identify network errors programmatically for retry logic,
   * offline mode fallbacks, or connectivity troubleshooting guidance.
   *
   * @since 1.0.0
   * @public
   */
  readonly code = 'NETWORK_ERROR';

  constructor(operation: string, cause?: Error) {
    super(`Network error during ${operation}`, cause);
  }
}

/**
 * Error thrown when configuration operations fail
 *
 * @remarks
 * Handles configuration file parsing errors, invalid settings, missing
 * required configuration, or configuration validation failures. Used for
 * both CLI configuration and stack configuration issues.
 *
 * @example
 * ```typescript
 * try {
 *   const config = JSON.parse(configFileContent);
 * } catch (error) {
 *   throw new ConfigurationError(
 *     'Invalid JSON in claude_desktop_config.json',
 *     error as Error
 *   );
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ConfigurationError extends StackError {
  /**
   * Error code for configuration failures
   *
   * @remarks
   * Used to identify configuration errors programmatically for showing
   * configuration repair suggestions, validation guidance, or default fallbacks.
   *
   * @since 1.0.0
   * @public
   */
  readonly code = 'CONFIG_ERROR';

  constructor(message: string, cause?: Error) {
    super(`Configuration error: ${message}`, cause);
  }
}

/**
 * Type guard to check if an error is a StackError
 *
 * @remarks
 * Safely determines if an unknown error is an instance of StackError or any
 * of its subclasses. Essential for proper error handling and accessing
 * StackError-specific properties like error codes and causes.
 *
 * @param error - Unknown error value to check
 * @returns True if the error is a StackError instance, false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   if (isStackError(error)) {
 *     console.error(`CLI Error [${error.code}]: ${error.message}`);
 *     if (error._cause) {
 *       console.debug('Caused by:', error._cause.message);
 *     }
 *   } else {
 *     console.error('Unexpected error:', error);
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function isStackError(error: unknown): error is StackError {
  return error instanceof StackError;
}

/**
 * Type guard to check if an error is a ValidationError
 *
 * @remarks
 * Safely identifies validation errors for specific error handling,
 * such as showing field-specific validation messages or re-prompting
 * for corrected input.
 *
 * @param error - Unknown error value to check
 * @returns True if the error is a ValidationError instance, false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   validateStackConfig(config);
 * } catch (error) {
 *   if (isValidationError(error)) {
 *     console.error('Validation failed:', error.message);
 *     // Show specific validation guidance
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is a FileSystemError
 *
 * @remarks
 * Identifies file system errors for appropriate error handling such as
 * permission checks, disk space verification, or alternative file paths.
 *
 * @param error - Unknown error value to check
 * @returns True if the error is a FileSystemError instance, false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await stackService.saveStack(stackData);
 * } catch (error) {
 *   if (isFileSystemError(error)) {
 *     console.error('File operation failed. Check permissions and disk space.');
 *     // Attempt alternative save location or cleanup
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof FileSystemError;
}

/**
 * Type guard to check if an error is a StackNotFoundError
 *
 * @remarks
 * Identifies stack not found errors for showing helpful suggestions,
 * listing available stacks, or guiding users to correct stack names.
 *
 * @param error - Unknown error value to check
 * @returns True if the error is a StackNotFoundError instance, false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   const stack = await stackService.getStack(stackName);
 * } catch (error) {
 *   if (isStackNotFoundError(error)) {
 *     console.error(`Stack '${stackName}' not found.`);
 *     console.log('Available stacks:');
 *     await showAvailableStacks();
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function isStackNotFoundError(error: unknown): error is StackNotFoundError {
  return error instanceof StackNotFoundError;
}

/**
 * Type guard to check if an error is a StackAlreadyExistsError
 *
 * @remarks
 * Identifies duplicate stack errors for offering force reinstall options,
 * showing existing stack information, or suggesting alternative actions.
 *
 * @param error - Unknown error value to check
 * @returns True if the error is a StackAlreadyExistsError instance, false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await stackService.installStack(stackName);
 * } catch (error) {
 *   if (isStackAlreadyExistsError(error)) {
 *     console.log(`Stack '${stackName}' is already installed.`);
 *     const shouldReinstall = await promptForReinstall();
 *     if (shouldReinstall) {
 *       await stackService.installStack(stackName, { force: true });
 *     }
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function isStackAlreadyExistsError(error: unknown): error is StackAlreadyExistsError {
  return error instanceof StackAlreadyExistsError;
}
