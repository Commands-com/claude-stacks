import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  isTestEnvironment,
  isTestPath,
  isTestHost,
  getEnvironmentConfig,
} from '../../../src/utils/testHelpers.js';

describe('testHelpers', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Store original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('isTestEnvironment', () => {
    it('should return true when NODE_ENV is "test"', () => {
      process.env.NODE_ENV = 'test';
      expect(isTestEnvironment()).toBe(true);
    });

    it('should return false when NODE_ENV is "production"', () => {
      process.env.NODE_ENV = 'production';
      expect(isTestEnvironment()).toBe(false);
    });

    it('should return false when NODE_ENV is "development"', () => {
      process.env.NODE_ENV = 'development';
      expect(isTestEnvironment()).toBe(false);
    });

    it('should return false when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      expect(isTestEnvironment()).toBe(false);
    });

    it('should return false when NODE_ENV is empty string', () => {
      process.env.NODE_ENV = '';
      expect(isTestEnvironment()).toBe(false);
    });

    it('should be case-sensitive for "test"', () => {
      process.env.NODE_ENV = 'TEST';
      expect(isTestEnvironment()).toBe(false);

      process.env.NODE_ENV = 'Test';
      expect(isTestEnvironment()).toBe(false);
    });
  });

  describe('isTestPath', () => {
    it('should detect common test directory patterns', () => {
      const testPaths = [
        '/project/test/file.js',
        '\\project\\test\\file.js',
        '/var/tmp/temp-file.json',
        '\\tmp\\temp-file.json',
        '/project/tests/unit/test.js',
        '\\project\\tests\\unit\\test.js',
        '/project/__tests__/component.test.js',
        '/project/src/component.test.js',
        '/project/src/component.spec.js',
        '/var/folders/random/tmp/test-file.json', // macOS temp
      ];

      testPaths.forEach(testPath => {
        expect(isTestPath(testPath)).toBe(true);
      });
    });

    it('should reject non-test paths', () => {
      const nonTestPaths = [
        '/project/src/main.js',
        '/usr/lib/module.js',
        '/home/user/documents/file.txt',
        'C:\\Program Files\\app\\main.exe',
        '/project/node_modules/package/index.js',
        '/project/dist/bundle.js',
      ];

      nonTestPaths.forEach(nonTestPath => {
        expect(isTestPath(nonTestPath)).toBe(false);
      });
    });

    it('should be case-insensitive', () => {
      const mixedCasePaths = [
        '/project/TEST/file.js',
        '/project/Tests/unit.js',
        '/TMP/temp-file.json',
        '/project/Component.TEST.js',
        '/project/Component.SPEC.js',
      ];

      mixedCasePaths.forEach(mixedCasePath => {
        expect(isTestPath(mixedCasePath)).toBe(true);
      });
    });

    it('should handle edge cases', () => {
      expect(isTestPath('')).toBe(false);
      expect(isTestPath('test')).toBe(false); // No path separators
      expect(isTestPath('testing')).toBe(false); // Similar but not exact match
      expect(isTestPath('/production/testify/file.js')).toBe(false); // Contains "test" but not as directory
    });

    it('should detect patterns within longer paths', () => {
      expect(isTestPath('/very/deep/nested/test/path/file.js')).toBe(true);
      expect(isTestPath('/var/folders/ab/cd/ef/test-temp/file.js')).toBe(true);
      expect(isTestPath('/project/src/module.test.integration.js')).toBe(true);
    });
  });

  describe('isTestHost', () => {
    it('should detect common test hostnames', () => {
      const testHosts = [
        'test.com',
        'api.test.com',
        'backend.test.com',
        'localhost',
        '127.0.0.1',
        'subdomain.test.com',
      ];

      testHosts.forEach(testHost => {
        expect(isTestHost(testHost)).toBe(true);
      });
    });

    it('should reject production hostnames', () => {
      const productionHosts = [
        'api.commands.com',
        'backend.commands.com',
        'google.com',
        'github.com',
        'stackoverflow.com',
        'production.example.com',
        'api.production.com',
      ];

      productionHosts.forEach(productionHost => {
        expect(isTestHost(productionHost)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(isTestHost('')).toBe(false);
      expect(isTestHost('testing.com')).toBe(false); // Similar but not exact match
      expect(isTestHost('attest.com')).toBe(true); // Contains "test.com" as substring
    });

    it('should be case-sensitive for exact matches', () => {
      expect(isTestHost('TEST.COM')).toBe(false);
      expect(isTestHost('LOCALHOST')).toBe(false);
      expect(isTestHost('Api.Test.Com')).toBe(false);
    });

    it('should handle subdomains correctly', () => {
      expect(isTestHost('sub.test.com')).toBe(true);
      expect(isTestHost('api.backend.test.com')).toBe(true);
      expect(isTestHost('test.com.example.org')).toBe(true); // Contains test.com
    });

    it('should handle IP addresses', () => {
      expect(isTestHost('127.0.0.1')).toBe(true);
      expect(isTestHost('192.168.1.127.0.0.1')).toBe(true); // Contains 127.0.0.1
      expect(isTestHost('192.168.1.1')).toBe(false);
    });

    it('should handle localhost variations', () => {
      expect(isTestHost('localhost')).toBe(true);
      expect(isTestHost('subdomain.localhost')).toBe(true);
      expect(isTestHost('localhost.localdomain')).toBe(true);
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return test configuration when in test environment', () => {
      process.env.NODE_ENV = 'test';

      const config = getEnvironmentConfig();

      expect(config).toEqual({
        skipPathValidation: true,
        allowTestHosts: true,
        skipEncryption: true,
      });
    });

    it('should return production configuration when not in test environment', () => {
      process.env.NODE_ENV = 'production';

      const config = getEnvironmentConfig();

      expect(config).toEqual({
        skipPathValidation: false,
        allowTestHosts: false,
        skipEncryption: false,
      });
    });

    it('should return production configuration when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;

      const config = getEnvironmentConfig();

      expect(config).toEqual({
        skipPathValidation: false,
        allowTestHosts: false,
        skipEncryption: false,
      });
    });

    it('should return production configuration for development environment', () => {
      process.env.NODE_ENV = 'development';

      const config = getEnvironmentConfig();

      expect(config).toEqual({
        skipPathValidation: false,
        allowTestHosts: false,
        skipEncryption: false,
      });
    });

    it('should be consistent with isTestEnvironment', () => {
      const testEnvironments = ['test'];
      const nonTestEnvironments = ['production', 'development', 'staging', ''];

      testEnvironments.forEach(env => {
        process.env.NODE_ENV = env;
        const config = getEnvironmentConfig();
        expect(config.skipPathValidation).toBe(isTestEnvironment());
        expect(config.allowTestHosts).toBe(isTestEnvironment());
        expect(config.skipEncryption).toBe(isTestEnvironment());
      });

      nonTestEnvironments.forEach(env => {
        process.env.NODE_ENV = env;
        const config = getEnvironmentConfig();
        expect(config.skipPathValidation).toBe(isTestEnvironment());
        expect(config.allowTestHosts).toBe(isTestEnvironment());
        expect(config.skipEncryption).toBe(isTestEnvironment());
      });
    });
  });

  describe('integration and edge cases', () => {
    it('should handle multiple rapid environment changes', () => {
      // Test rapid switching between environments
      process.env.NODE_ENV = 'test';
      expect(isTestEnvironment()).toBe(true);
      expect(getEnvironmentConfig().skipPathValidation).toBe(true);

      process.env.NODE_ENV = 'production';
      expect(isTestEnvironment()).toBe(false);
      expect(getEnvironmentConfig().skipPathValidation).toBe(false);

      process.env.NODE_ENV = 'test';
      expect(isTestEnvironment()).toBe(true);
      expect(getEnvironmentConfig().skipPathValidation).toBe(true);
    });

    it('should handle unusual but valid inputs', () => {
      // Test unusual NODE_ENV values
      const unusualValues = ['testing', 'test-env', 'test123', '123test'];

      unusualValues.forEach(value => {
        process.env.NODE_ENV = value;
        expect(isTestEnvironment()).toBe(false);
        expect(getEnvironmentConfig().skipPathValidation).toBe(false);
      });
    });

    it('should handle paths with mixed separators', () => {
      // Mixed Windows/Unix separators - patterns need to match exactly
      expect(isTestPath('/project/test/file.js')).toBe(true); // Contains '/test/' pattern
      expect(isTestPath('\\project\\test\\file.js')).toBe(true); // Contains '\test\' pattern
    });

    it('should handle hosts with ports', () => {
      expect(isTestHost('localhost:3000')).toBe(true);
      expect(isTestHost('test.com:8080')).toBe(true);
      expect(isTestHost('127.0.0.1:5432')).toBe(true);
    });

    it('should handle unicode and special characters in paths', () => {
      expect(isTestPath('/project/测试/file.js')).toBe(false);
      expect(isTestPath('/project/test/файл.js')).toBe(true);
      expect(isTestPath('/project/tëst/file.js')).toBe(false);
    });
  });
});
