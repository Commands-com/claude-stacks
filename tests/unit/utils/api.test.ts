import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getApiConfig, isLocalDev, oauthConfig } from '../../../src/utils/api.js';

describe('API Utility Functions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('isLocalDev', () => {
    it('should return true when CLAUDE_STACKS_LOCAL_DEV is set', () => {
      process.env.CLAUDE_STACKS_LOCAL_DEV = 'true';
      expect(isLocalDev()).toBe(true);
    });

    it('should return true when CLAUDE_STACKS_LOCAL_DEV is set to any truthy value', () => {
      process.env.CLAUDE_STACKS_LOCAL_DEV = '1';
      expect(isLocalDev()).toBe(true);

      process.env.CLAUDE_STACKS_LOCAL_DEV = 'yes';
      expect(isLocalDev()).toBe(true);
    });

    it('should return false when CLAUDE_STACKS_LOCAL_DEV is not set', () => {
      delete process.env.CLAUDE_STACKS_LOCAL_DEV;
      expect(isLocalDev()).toBe(false);
    });

    it('should return false when CLAUDE_STACKS_LOCAL_DEV is set to falsy values', () => {
      process.env.CLAUDE_STACKS_LOCAL_DEV = 'false';
      expect(isLocalDev()).toBe(false);

      process.env.CLAUDE_STACKS_LOCAL_DEV = '0';
      expect(isLocalDev()).toBe(false);

      process.env.CLAUDE_STACKS_LOCAL_DEV = '';
      expect(isLocalDev()).toBe(false);
    });
  });

  describe('getApiConfig', () => {
    it('should return production config by default', () => {
      delete process.env.CLAUDE_STACKS_LOCAL_DEV;
      const config = getApiConfig();

      expect(config).toBeDefined();
      expect(config.baseUrl).toBeDefined();
      expect(config.baseUrl).not.toContain('localhost');
      expect(config.baseUrl).not.toContain('127.0.0.1');
    });

    it('should return local development config when CLAUDE_STACKS_LOCAL_DEV is set', () => {
      process.env.CLAUDE_STACKS_LOCAL_DEV = 'true';
      const config = getApiConfig();

      expect(config).toBeDefined();
      expect(config.baseUrl).toBeDefined();
      expect(config.baseUrl).toMatch(/localhost|127\.0\.0\.1/);
    });

    it('should have consistent structure between environments', () => {
      // Test production config
      delete process.env.CLAUDE_STACKS_LOCAL_DEV;
      const prodConfig = getApiConfig();

      // Test development config
      process.env.CLAUDE_STACKS_LOCAL_DEV = 'true';
      const devConfig = getApiConfig();

      // Both configs should have the same structure
      expect(Object.keys(prodConfig)).toEqual(Object.keys(devConfig));
      expect(typeof prodConfig.baseUrl).toBe('string');
      expect(typeof devConfig.baseUrl).toBe('string');
    });

    it('should return valid URLs', () => {
      // Test production URL
      delete process.env.CLAUDE_STACKS_LOCAL_DEV;
      const prodConfig = getApiConfig();
      expect(() => new URL(prodConfig.baseUrl)).not.toThrow();

      // Test development URL
      process.env.CLAUDE_STACKS_LOCAL_DEV = 'true';
      const devConfig = getApiConfig();
      expect(() => new URL(devConfig.baseUrl)).not.toThrow();
    });

    it('should use HTTPS in production', () => {
      delete process.env.CLAUDE_STACKS_LOCAL_DEV;
      const config = getApiConfig();
      expect(config.baseUrl).toMatch(/^https:/);
    });

    it('should allow custom API URL via environment variable', () => {
      const customUrl = 'https://custom-api.example.com';
      process.env.CLAUDE_STACKS_API_URL = customUrl;

      const config = getApiConfig();
      expect(config.baseUrl).toBe(customUrl);
    });
  });

  describe('oauthConfig', () => {
    it('should have required OAuth configuration properties', () => {
      expect(oauthConfig).toBeDefined();
      expect(oauthConfig).toHaveProperty('clientId');
      expect(oauthConfig).toHaveProperty('redirectUri');
      expect(oauthConfig).toHaveProperty('scope');
      expect(oauthConfig).toHaveProperty('responseType');
    });

    it('should have valid OAuth values', () => {
      expect(typeof oauthConfig.clientId).toBe('string');
      expect(oauthConfig.clientId.length).toBeGreaterThan(0);

      expect(typeof oauthConfig.redirectUri).toBe('string');
      expect(() => new URL(oauthConfig.redirectUri)).not.toThrow();

      expect(typeof oauthConfig.scope).toBe('string');
      expect(oauthConfig.scope.length).toBeGreaterThan(0);

      expect(typeof oauthConfig.responseType).toBe('string');
      expect(['code', 'token', 'id_token']).toContain(oauthConfig.responseType);
    });

    it('should use secure redirect URI in production', () => {
      if (!isLocalDev()) {
        expect(oauthConfig.redirectUri).toMatch(/^https:/);
      }
    });

    it('should have appropriate scope for Claude Stacks', () => {
      expect(oauthConfig.scope).toMatch(/read|write|stacks/);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle missing environment variables gracefully', () => {
      // Clear all relevant environment variables
      delete process.env.CLAUDE_STACKS_LOCAL_DEV;
      delete process.env.CLAUDE_STACKS_API_URL;
      delete process.env.NODE_ENV;

      expect(() => getApiConfig()).not.toThrow();
      expect(() => isLocalDev()).not.toThrow();
    });

    it('should validate API URLs are accessible format', () => {
      const config = getApiConfig();
      const url = new URL(config.baseUrl);

      expect(['http:', 'https:']).toContain(url.protocol);
      expect(url.hostname).toBeDefined();
      expect(url.hostname.length).toBeGreaterThan(0);
    });
  });

  describe('Environment-specific behavior', () => {
    it('should adapt to different NODE_ENV values', () => {
      const environments = ['development', 'production', 'test'];

      environments.forEach(env => {
        process.env.NODE_ENV = env;
        expect(() => getApiConfig()).not.toThrow();
      });
    });

    it('should prioritize explicit local dev flag over NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLAUDE_STACKS_LOCAL_DEV = 'true';

      expect(isLocalDev()).toBe(true);

      const config = getApiConfig();
      expect(config.baseUrl).toMatch(/localhost|127\.0\.0\.1/);
    });
  });

  describe('Integration with other utilities', () => {
    it('should provide config that works with fetch', () => {
      const config = getApiConfig();
      const testUrl = `${config.baseUrl}/test`;

      // Should be a valid URL for fetch
      expect(() => new URL(testUrl)).not.toThrow();
    });

    it('should provide OAuth config compatible with browser flow', () => {
      expect(oauthConfig.responseType).toBeDefined();
      expect(oauthConfig.clientId).toBeDefined();
      expect(oauthConfig.redirectUri).toBeDefined();

      // Should form a valid OAuth URL
      const authUrl = new URL('https://oauth.example.com/authorize');
      authUrl.searchParams.set('client_id', oauthConfig.clientId);
      authUrl.searchParams.set('redirect_uri', oauthConfig.redirectUri);
      authUrl.searchParams.set('response_type', oauthConfig.responseType);
      authUrl.searchParams.set('scope', oauthConfig.scope);

      expect(authUrl.toString()).toContain('client_id');
      expect(authUrl.toString()).toContain('redirect_uri');
    });
  });
});
