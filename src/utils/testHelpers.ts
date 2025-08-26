/**
 * Utility functions for test environment detection and test-specific behavior
 */

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
 * Gets environment-specific configuration
 * @returns configuration object with test overrides if in test environment
 */
export function getEnvironmentConfig() {
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
