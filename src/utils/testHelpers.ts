/**
 * Utility functions for test environment detection and test-specific behavior
 */

/**
 * Configuration object for environment-specific security and validation settings
 *
 * Provides different configuration values based on whether running in test
 * or production environment to balance security with testing convenience.
 *
 * @since 1.0.0
 * @public
 */
export interface EnvironmentConfig {
  /** Whether to skip path security validation */
  skipPathValidation: boolean;
  /** Whether to allow test host connections */
  allowTestHosts: boolean;
  /** Whether to skip encryption for sensitive data */
  skipEncryption: boolean;
}

/**
 * Checks if the application is running in test environment
 * @returns true if NODE_ENV is 'test'
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Checks if a path appears to be a test path
 * @param filePath The file path to check
 * @returns true if the path appears to be for testing
 */
export function isTestPath(filePath: string): boolean {
  // Common test path patterns
  const testPatterns = [
    '/test/',
    '\\test\\',
    '/tmp/',
    '\\tmp\\',
    '/tests/',
    '\\tests\\',
    '__tests__',
    '.test.',
    '.spec.',
    '/var/folders/', // macOS temp directories used in tests
  ];

  const normalizedPath = filePath.toLowerCase();
  return testPatterns.some(pattern => normalizedPath.includes(pattern.toLowerCase()));
}

/**
 * Checks if a hostname appears to be for testing
 * @param hostname The hostname to check
 * @returns true if the hostname appears to be for testing
 */
export function isTestHost(hostname: string): boolean {
  const testHostPatterns = [
    'test.com',
    'localhost',
    '127.0.0.1',
    'api.test.com',
    'backend.test.com',
  ];

  return testHostPatterns.some(pattern => hostname.includes(pattern));
}

/**
 * Gets environment-specific configuration for security and validation settings
 *
 * Provides different configuration values based on whether running in test
 * or production environment. Test environment disables security measures
 * for easier testing while production enables all safety features.
 *
 * @returns {EnvironmentConfig} Configuration object with environment-appropriate security settings
 *
 * @example
 * ```typescript
 * const config = getEnvironmentConfig();
 *
 * if (!config.skipPathValidation) {
 *   await validatePath(userPath);
 * }
 *
 * if (config.allowTestHosts) {
 *   // Allow connections to localhost for testing
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  if (isTestEnvironment()) {
    return {
      skipPathValidation: true,
      allowTestHosts: true,
      skipEncryption: true,
    };
  }

  return {
    skipPathValidation: false,
    allowTestHosts: false,
    skipEncryption: false,
  };
}
