import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Mock the authenticate utility
const mockAuthenticate = jest.fn();

jest.mock('../../../src/utils/auth.ts', () => ({
  authenticate: mockAuthenticate,
}));

// Import AuthService after setting up mocks
import { AuthService } from '../../../src/services/AuthService.js';

describe('AuthService', () => {
  let authService: AuthService;

  const mockToken = 'test-access-token-12345';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticate.mockReset();
    authService = new AuthService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with null access token', () => {
      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('authenticate', () => {
    it('should authenticate successfully and store token', async () => {
      mockAuthenticate.mockResolvedValue(mockToken);

      const result = await authService.authenticate();

      expect(mockAuthenticate).toHaveBeenCalled();
      expect(result).toBe(mockToken);
      expect(authService.getAccessToken()).toBe(mockToken);
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should handle authentication failure and clear token', async () => {
      const authError = new Error('Authentication failed');
      mockAuthenticate.mockRejectedValue(authError);

      await expect(authService.authenticate()).rejects.toThrow('Authentication failed');

      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should clear token on authentication failure even if previously authenticated', async () => {
      // First, set up a successful authentication
      mockAuthenticate.mockResolvedValueOnce(mockToken);
      await authService.authenticate();
      expect(authService.isAuthenticated()).toBe(true);

      // Then fail the next authentication
      const authError = new Error('Authentication failed');
      mockAuthenticate.mockRejectedValueOnce(authError);

      await expect(authService.authenticate()).rejects.toThrow('Authentication failed');

      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      mockAuthenticate.mockRejectedValue(networkError);

      await expect(authService.authenticate()).rejects.toThrow('Network timeout');

      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle oauth errors', async () => {
      const oauthError = new Error('OAuth authorization denied');
      mockAuthenticate.mockRejectedValue(oauthError);

      await expect(authService.authenticate()).rejects.toThrow('OAuth authorization denied');

      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should update token on multiple authentication calls', async () => {
      const firstToken = 'first-token';
      const secondToken = 'second-token';

      // First authentication
      mockAuthenticate.mockResolvedValueOnce(firstToken);
      await authService.authenticate();
      expect(authService.getAccessToken()).toBe(firstToken);

      // Second authentication with different token
      mockAuthenticate.mockResolvedValueOnce(secondToken);
      await authService.authenticate();
      expect(authService.getAccessToken()).toBe(secondToken);
    });
  });

  describe('getAccessToken', () => {
    it('should return null when not authenticated', () => {
      expect(authService.getAccessToken()).toBeNull();
    });

    it('should return token when authenticated', async () => {
      mockAuthenticate.mockResolvedValue(mockToken);
      await authService.authenticate();

      expect(authService.getAccessToken()).toBe(mockToken);
    });

    it('should return null after clearToken', async () => {
      mockAuthenticate.mockResolvedValue(mockToken);
      await authService.authenticate();

      authService.clearToken();

      expect(authService.getAccessToken()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when not authenticated', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return true when authenticated', async () => {
      mockAuthenticate.mockResolvedValue(mockToken);
      await authService.authenticate();

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false after clearToken', async () => {
      mockAuthenticate.mockResolvedValue(mockToken);
      await authService.authenticate();

      authService.clearToken();

      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return false after failed authentication', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Auth failed'));

      await expect(authService.authenticate()).rejects.toThrow();

      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('clearToken', () => {
    it('should clear token when authenticated', async () => {
      mockAuthenticate.mockResolvedValue(mockToken);
      await authService.authenticate();

      expect(authService.isAuthenticated()).toBe(true);

      authService.clearToken();

      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should be safe to call when not authenticated', () => {
      expect(authService.isAuthenticated()).toBe(false);

      authService.clearToken(); // Should not throw

      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should be safe to call multiple times', async () => {
      mockAuthenticate.mockResolvedValue(mockToken);
      await authService.authenticate();

      authService.clearToken();
      authService.clearToken(); // Multiple calls should be safe

      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('setAccessToken', () => {
    it('should set token directly', () => {
      authService.setAccessToken(mockToken);

      expect(authService.getAccessToken()).toBe(mockToken);
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should overwrite existing token', async () => {
      // First authenticate normally
      mockAuthenticate.mockResolvedValue('original-token');
      await authService.authenticate();
      expect(authService.getAccessToken()).toBe('original-token');

      // Then set token directly
      authService.setAccessToken(mockToken);
      expect(authService.getAccessToken()).toBe(mockToken);
    });

    it('should handle empty string token', () => {
      authService.setAccessToken('');

      expect(authService.getAccessToken()).toBe('');
      expect(authService.isAuthenticated()).toBe(true); // Empty string is still truthy for authentication
    });

    it('should set token after clearToken', () => {
      authService.setAccessToken('initial-token');
      authService.clearToken();
      authService.setAccessToken(mockToken);

      expect(authService.getAccessToken()).toBe(mockToken);
      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete authentication workflow', async () => {
      // Start unauthenticated
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getAccessToken()).toBeNull();

      // Authenticate
      mockAuthenticate.mockResolvedValue(mockToken);
      const token = await authService.authenticate();

      expect(token).toBe(mockToken);
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getAccessToken()).toBe(mockToken);

      // Clear token
      authService.clearToken();

      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getAccessToken()).toBeNull();
    });

    it('should handle authentication failure and recovery', async () => {
      // First authentication fails
      mockAuthenticate.mockRejectedValueOnce(new Error('First attempt failed'));
      await expect(authService.authenticate()).rejects.toThrow('First attempt failed');
      expect(authService.isAuthenticated()).toBe(false);

      // Second authentication succeeds
      mockAuthenticate.mockResolvedValueOnce(mockToken);
      const token = await authService.authenticate();

      expect(token).toBe(mockToken);
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should handle multiple service instances independently', async () => {
      const authService2 = new AuthService();

      // Authenticate first service
      mockAuthenticate.mockResolvedValue(mockToken);
      await authService.authenticate();

      // Second service should still be unauthenticated
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService2.isAuthenticated()).toBe(false);

      // Set token directly on second service
      authService2.setAccessToken('different-token');

      expect(authService.getAccessToken()).toBe(mockToken);
      expect(authService2.getAccessToken()).toBe('different-token');
    });

    it('should handle rapid successive authentication calls', async () => {
      let callCount = 0;
      mockAuthenticate.mockImplementation(async () => {
        callCount++;
        return `token-${callCount}`;
      });

      // Make multiple authentication calls
      const promises = [
        authService.authenticate(),
        authService.authenticate(),
        authService.authenticate(),
      ];

      const results = await Promise.all(promises);

      // All should succeed, but we can't guarantee which token ends up stored
      // due to race conditions
      expect(results).toHaveLength(3);
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getAccessToken()).toMatch(/^token-\d+$/);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle undefined error from authenticate', async () => {
      mockAuthenticate.mockRejectedValue(undefined);

      await expect(authService.authenticate()).rejects.toBe(undefined);
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle null error from authenticate', async () => {
      mockAuthenticate.mockRejectedValue(null);

      await expect(authService.authenticate()).rejects.toBe(null);
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle string error from authenticate', async () => {
      mockAuthenticate.mockRejectedValue('String error message');

      await expect(authService.authenticate()).rejects.toBe('String error message');
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle authenticate returning null token', async () => {
      mockAuthenticate.mockResolvedValue(null as any);

      const token = await authService.authenticate();

      expect(token).toBeNull();
      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false); // null is falsy
    });

    it('should handle authenticate returning undefined token', async () => {
      mockAuthenticate.mockResolvedValue(undefined as any);

      const token = await authService.authenticate();

      expect(token).toBeUndefined();
      expect(authService.getAccessToken()).toBeUndefined();
      expect(authService.isAuthenticated()).toBe(true); // undefined !== null, so this returns true
    });
  });

  describe('state consistency', () => {
    it('should maintain consistent state after successful authentication', async () => {
      mockAuthenticate.mockResolvedValue(mockToken);

      await authService.authenticate();

      expect(authService.getAccessToken()).toBe(mockToken);
      expect(authService.isAuthenticated()).toBe(true);

      // State should remain consistent across multiple calls
      expect(authService.getAccessToken()).toBe(mockToken);
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should maintain consistent state after failed authentication', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Auth failed'));

      await expect(authService.authenticate()).rejects.toThrow();

      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);

      // State should remain consistent
      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });
});
