import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readJson: jest.fn(),
  writeJson: jest.fn(),
  remove: jest.fn(),
}));

// Mock node-fetch
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHash: jest.fn(),
}));

// Mock http
jest.mock('http', () => ({
  createServer: jest.fn(),
}));

// Mock open
jest.mock('open', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock chalk to avoid import issues
jest.mock('chalk', () => {
  const mockChalkFunction = (text: string) => text;
  return {
    __esModule: true,
    default: {
      blue: mockChalkFunction,
      green: mockChalkFunction,
      yellow: mockChalkFunction,
      gray: mockChalkFunction,
      cyan: mockChalkFunction,
    },
  };
});

// Import the module under test
import {
  findAvailablePort,
  generatePKCE,
  getStoredToken,
  storeToken,
  clearStoredToken,
  refreshToken,
  authenticate,
} from '../../../src/utils/auth.js';

import type { AuthToken } from '../../../src/types/index.js';

// Import mocked modules with proper typing
import fsExtra from 'fs-extra';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import * as http from 'http';
import open from 'open';

// Cast to mocked versions for better type support
const mockedFs = jest.mocked(fsExtra);
const mockedFetch = jest.mocked(fetch);
const mockedCrypto = jest.mocked(crypto);
const mockedHttp = jest.mocked(http);
const mockedOpen = jest.mocked(open);

// Test data
const mockAuthToken: AuthToken = {
  access_token: 'mock_access_token_12345',
  refresh_token: 'mock_refresh_token_67890',
  expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  token_type: 'Bearer',
};

const expiredAuthToken: AuthToken = {
  access_token: 'expired_access_token',
  refresh_token: 'mock_refresh_token_67890',
  expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  token_type: 'Bearer',
};

const refreshedToken: AuthToken = {
  access_token: 'refreshed_access_token_99999',
  refresh_token: 'new_refresh_token_88888',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'Bearer',
};

describe('Auth Utility Functions', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock console methods to prevent noise in test output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findAvailablePort', () => {
    it('should find and return an available port', async () => {
      const mockPort = 3000;
      const mockAddress = { port: mockPort };
      const mockServer = {
        listen: jest.fn((port: number, callback: () => void) => {
          callback();
        }),
        address: jest.fn(() => mockAddress),
        close: jest.fn((callback?: () => void) => {
          if (callback) callback();
        }),
        on: jest.fn(),
      };

      mockedHttp.createServer.mockReturnValue(mockServer as any);

      const port = await findAvailablePort();

      expect(port).toBe(mockPort);
      expect(mockedHttp.createServer).toHaveBeenCalledTimes(1);
      expect(mockServer.listen).toHaveBeenCalledWith(0, expect.any(Function));
      expect(mockServer.address).toHaveBeenCalledTimes(1);
      expect(mockServer.close).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should reject when no port is available', async () => {
      const mockServer = {
        listen: jest.fn((port: number, callback: () => void) => {
          callback();
        }),
        address: jest.fn(() => null), // No address available
        close: jest.fn((callback?: () => void) => {
          if (callback) callback();
        }),
        on: jest.fn(),
      };

      mockedHttp.createServer.mockReturnValue(mockServer as any);

      await expect(findAvailablePort()).rejects.toThrow('Could not determine port');
    });

    it('should reject when address is not an object', async () => {
      const mockServer = {
        listen: jest.fn((port: number, callback: () => void) => {
          callback();
        }),
        address: jest.fn(() => 'not-an-object'), // Invalid address format
        close: jest.fn((callback?: () => void) => {
          if (callback) callback();
        }),
        on: jest.fn(),
      };

      mockedHttp.createServer.mockReturnValue(mockServer as any);

      await expect(findAvailablePort()).rejects.toThrow('Could not determine port');
    });

    it('should reject when server throws an error', async () => {
      const mockError = new Error('Server creation failed');
      const mockServer = {
        listen: jest.fn(),
        address: jest.fn(),
        close: jest.fn(),
        on: jest.fn((event: string, callback: (error: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => callback(mockError), 0); // Simulate async error
          }
        }),
      };

      mockedHttp.createServer.mockReturnValue(mockServer as any);

      await expect(findAvailablePort()).rejects.toThrow('Server creation failed');
    });
  });

  describe('generatePKCE', () => {
    it('should generate valid PKCE challenge and verifier', () => {
      const mockRandomBytes = Buffer.from('test-random-bytes-32-characters', 'utf8');
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('mock-hash-base64url'),
      };

      mockedCrypto.randomBytes.mockReturnValue(mockRandomBytes);
      mockedCrypto.createHash.mockReturnValue(mockHash as any);

      const result = generatePKCE();

      expect(mockedCrypto.randomBytes).toHaveBeenCalledWith(32);
      expect(mockedCrypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockHash.update).toHaveBeenCalledWith(mockRandomBytes.toString('base64url'));
      expect(mockHash.digest).toHaveBeenCalledWith('base64url');

      expect(result).toHaveProperty('codeVerifier');
      expect(result).toHaveProperty('codeChallenge');
      expect(typeof result.codeVerifier).toBe('string');
      expect(typeof result.codeChallenge).toBe('string');
    });

    it('should generate different values on subsequent calls', () => {
      const mockRandomBytes1 = Buffer.from('random-bytes-1', 'utf8');
      const mockRandomBytes2 = Buffer.from('random-bytes-2', 'utf8');
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(),
      };

      mockedCrypto.randomBytes
        .mockReturnValueOnce(mockRandomBytes1)
        .mockReturnValueOnce(mockRandomBytes2);

      mockHash.digest
        .mockReturnValueOnce(Buffer.from('hash-1', 'utf8'))
        .mockReturnValueOnce(Buffer.from('hash-2', 'utf8'));

      mockedCrypto.createHash.mockReturnValue(mockHash as any);

      const result1 = generatePKCE();
      const result2 = generatePKCE();

      expect(result1.codeVerifier).not.toBe(result2.codeVerifier);
      expect(result1.codeChallenge).not.toBe(result2.codeChallenge);
    });

    it('should handle crypto errors gracefully', () => {
      mockedCrypto.randomBytes.mockImplementation(() => {
        throw new Error('Crypto random bytes failed');
      });

      expect(() => generatePKCE()).toThrow('Crypto random bytes failed');
    });
  });

  describe('getStoredToken', () => {
    it('should return null when token file does not exist', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      const result = await getStoredToken();

      expect(result).toBeNull();
      expect(mockedFs.pathExists).toHaveBeenCalledWith(
        expect.stringContaining('.claude-stacks-auth.json')
      );
    });

    it('should return token when file exists and contains valid data', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue(mockAuthToken);

      const result = await getStoredToken();

      expect(result).toEqual(mockAuthToken);
      expect(mockedFs.readJson).toHaveBeenCalledWith(
        expect.stringContaining('.claude-stacks-auth.json')
      );
    });

    it('should return null when file exists but contains invalid JSON', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockRejectedValue(new Error('Invalid JSON'));

      const result = await getStoredToken();

      expect(result).toBeNull();
    });

    it('should return null when readJson throws any error', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockRejectedValue(new Error('Permission denied'));

      const result = await getStoredToken();

      expect(result).toBeNull();
    });

    it('should handle pathExists error gracefully', async () => {
      mockedFs.pathExists.mockRejectedValue(new Error('Path check failed'));

      await expect(getStoredToken()).rejects.toThrow('Path check failed');
    });
  });

  describe('storeToken', () => {
    it('should store token successfully', async () => {
      mockedFs.writeJson.mockResolvedValue(undefined);

      await storeToken(mockAuthToken);

      expect(mockedFs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('.claude-stacks-auth.json'),
        mockAuthToken,
        { spaces: 2 }
      );
    });

    it('should handle writeJson errors', async () => {
      const error = new Error('Write failed');
      mockedFs.writeJson.mockRejectedValue(error);

      await expect(storeToken(mockAuthToken)).rejects.toThrow('Write failed');
    });

    it('should accept token without optional fields', async () => {
      const minimalToken: AuthToken = {
        access_token: 'minimal_token',
      };

      mockedFs.writeJson.mockResolvedValue(undefined);

      await storeToken(minimalToken);

      expect(mockedFs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('.claude-stacks-auth.json'),
        minimalToken,
        { spaces: 2 }
      );
    });
  });

  describe('clearStoredToken', () => {
    it('should remove token file when it exists', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.remove.mockResolvedValue(undefined);

      await clearStoredToken();

      expect(mockedFs.pathExists).toHaveBeenCalledWith(
        expect.stringContaining('.claude-stacks-auth.json')
      );
      expect(mockedFs.remove).toHaveBeenCalledWith(
        expect.stringContaining('.claude-stacks-auth.json')
      );
    });

    it('should not attempt removal when file does not exist', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      await clearStoredToken();

      expect(mockedFs.pathExists).toHaveBeenCalledWith(
        expect.stringContaining('.claude-stacks-auth.json')
      );
      expect(mockedFs.remove).not.toHaveBeenCalled();
    });

    it('should handle pathExists errors', async () => {
      mockedFs.pathExists.mockRejectedValue(new Error('Path check failed'));

      await expect(clearStoredToken()).rejects.toThrow('Path check failed');
    });

    it('should handle remove errors', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.remove.mockRejectedValue(new Error('Remove failed'));

      await expect(clearStoredToken()).rejects.toThrow('Remove failed');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(refreshedToken),
        statusText: 'OK',
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await refreshToken('mock_refresh_token');

      expect(result).toEqual(refreshedToken);
      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: 'mock_refresh_token',
          client_id: 'claude-stacks-cli',
        }),
      });
    });

    it('should handle HTTP errors during refresh', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Unauthorized',
        json: jest.fn(),
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      await expect(refreshToken('invalid_token')).rejects.toThrow(
        'Token refresh failed: Unauthorized'
      );
    });

    it('should handle network errors during refresh', async () => {
      mockedFetch.mockRejectedValue(new Error('Network error'));

      await expect(refreshToken('mock_refresh_token')).rejects.toThrow('Network error');
    });

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('JSON parse error')),
        statusText: 'OK',
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      await expect(refreshToken('mock_refresh_token')).rejects.toThrow('JSON parse error');
    });

    it('should handle empty refresh token', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(refreshedToken),
        statusText: 'OK',
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      await refreshToken('');

      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.commands.com/oauth/token',
        expect.objectContaining({
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: '',
            client_id: 'claude-stacks-cli',
          }),
        })
      );
    });
  });

  describe('authenticate (Integration)', () => {
    let mockServer: any;
    let originalSetTimeout: typeof global.setTimeout;

    beforeEach(() => {
      // Mock server setup
      mockServer = {
        listen: jest.fn((port: number, callback: () => void) => {
          callback();
        }),
        address: jest.fn(() => ({ port: 3000 })),
        close: jest.fn((callback?: () => void) => {
          if (callback) callback();
        }),
        on: jest.fn(),
      };

      mockedHttp.createServer.mockImplementation(requestHandler => {
        (mockServer as any).requestHandler = requestHandler;
        return mockServer as any;
      });

      // Mock crypto
      const mockRandomBytes = Buffer.from('mock-random-bytes-32-characters', 'utf8');
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(Buffer.from('mock-challenge', 'utf8')),
      };

      mockedCrypto.randomBytes.mockImplementation((size: number) => {
        if (size === 32) {
          return mockRandomBytes; // For PKCE code verifier
        }
        // For state (16 bytes) - return hex-compatible bytes that will match the expected state
        return Buffer.from('6d6f636b2d73746174652d313662797465', 'hex'); // 'mock-state-16bytes' in hex
      });

      mockedCrypto.createHash.mockReturnValue(mockHash as any);

      // Mock open
      mockedOpen.mockResolvedValue({ pid: 123 } as any);

      // Mock setTimeout to avoid actual timeouts in tests
      originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback, timeout) => {
        // Don't actually set timeout, just return a mock timer
        return { ref: jest.fn(), unref: jest.fn() } as any;
      }) as any;
    });

    afterEach(() => {
      global.setTimeout = originalSetTimeout;
    });

    it('should return existing valid token without authentication', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue(mockAuthToken);

      const result = await authenticate();

      expect(result).toBe(mockAuthToken.access_token);
      expect(mockedOpen).not.toHaveBeenCalled();
    });

    it('should refresh expired token successfully', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue(expiredAuthToken);

      const mockRefreshResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(refreshedToken),
        statusText: 'OK',
      };

      mockedFetch.mockResolvedValue(mockRefreshResponse as any);
      mockedFs.writeJson.mockResolvedValue(undefined);

      const result = await authenticate();

      expect(result).toBe(refreshedToken.access_token);
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.commands.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: expiredAuthToken.refresh_token!,
            client_id: 'claude-stacks-cli',
          }),
        })
      );
      expect(mockedFs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('.claude-stacks-auth.json'),
        refreshedToken,
        { spaces: 2 }
      );
    });

    it('should handle no stored token and start new auth flow', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      // Token exchange succeeds
      const mockTokenResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAuthToken),
        statusText: 'OK',
      };

      mockedFetch.mockResolvedValue(mockTokenResponse as any);
      mockedFs.writeJson.mockResolvedValue(undefined);

      // Start authentication and immediately trigger callback
      const authPromise = authenticate();

      // Use real setTimeout to trigger callback immediately
      originalSetTimeout(() => {
        if ((mockServer as any).requestHandler) {
          const mockReq = {
            url: '/callback?code=mock_auth_code&state=6d6f636b2d73746174652d313662797465',
          };
          const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
          };
          (mockServer as any).requestHandler(mockReq, mockRes);
        }
      }, 0);

      const result = await authPromise;

      expect(result).toBe(mockAuthToken.access_token);
      expect(mockedOpen).toHaveBeenCalledWith(
        expect.stringContaining('https://api.commands.com/oauth/authorize')
      );
    });

    it('should handle OAuth callback with error parameter', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      // Start authentication but simulate error callback
      const authPromise = authenticate();

      originalSetTimeout(() => {
        if ((mockServer as any).requestHandler) {
          const mockReq = {
            url: '/callback?error=access_denied&state=6d6f636b2d73746174652d313662797465',
          };
          const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
          };
          (mockServer as any).requestHandler(mockReq, mockRes);
        }
      }, 0);

      await expect(authPromise).rejects.toThrow('Error: access_denied');
    });

    it('should handle OAuth callback with invalid state', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      // Start authentication but simulate invalid state
      const authPromise = authenticate();

      originalSetTimeout(() => {
        if ((mockServer as any).requestHandler) {
          const mockReq = {
            url: '/callback?code=mock_auth_code&state=invalid_state',
          };
          const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
          };
          (mockServer as any).requestHandler(mockReq, mockRes);
        }
      }, 0);

      await expect(authPromise).rejects.toThrow('Invalid state parameter');
    });

    it('should handle OAuth callback with no authorization code', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      // Start authentication but simulate missing code
      const authPromise = authenticate();

      originalSetTimeout(() => {
        if ((mockServer as any).requestHandler) {
          const mockReq = {
            url: '/callback?state=6d6f636b2d73746174652d313662797465',
          };
          const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
          };
          (mockServer as any).requestHandler(mockReq, mockRes);
        }
      }, 0);

      await expect(authPromise).rejects.toThrow('No authorization code received');
    });

    it('should handle token exchange failure', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      // Token exchange fails
      const mockTokenResponse = {
        ok: false,
        statusText: 'Bad Request',
      };

      mockedFetch.mockResolvedValue(mockTokenResponse as any);

      // Start authentication and simulate OAuth callback
      const authPromise = authenticate();

      originalSetTimeout(() => {
        if ((mockServer as any).requestHandler) {
          const mockReq = {
            url: '/callback?code=mock_auth_code&state=6d6f636b2d73746174652d313662797465',
          };
          const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
          };
          (mockServer as any).requestHandler(mockReq, mockRes);
        }
      }, 0);

      await expect(authPromise).rejects.toThrow('Token exchange failed: Bad Request');
    });

    it('should handle browser open failure gracefully', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      mockedOpen.mockRejectedValue(new Error('Browser open failed'));

      // Token exchange succeeds
      const mockTokenResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAuthToken),
        statusText: 'OK',
      };

      mockedFetch.mockResolvedValue(mockTokenResponse as any);
      mockedFs.writeJson.mockResolvedValue(undefined);

      // Start authentication and simulate OAuth callback
      const authPromise = authenticate();

      originalSetTimeout(() => {
        if ((mockServer as any).requestHandler) {
          const mockReq = {
            url: '/callback?code=mock_auth_code&state=6d6f636b2d73746174652d313662797465',
          };
          const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
          };
          (mockServer as any).requestHandler(mockReq, mockRes);
        }
      }, 0);

      const result = await authPromise;

      expect(result).toBe(mockAuthToken.access_token);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Could not open browser automatically')
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent token storage operations', async () => {
      let writeCallCount = 0;
      mockedFs.writeJson.mockImplementation(async () => {
        writeCallCount++;
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async operation
        return undefined;
      });

      const token1 = { ...mockAuthToken, access_token: 'token1' };
      const token2 = { ...mockAuthToken, access_token: 'token2' };

      // Start both operations concurrently
      const promise1 = storeToken(token1);
      const promise2 = storeToken(token2);

      await Promise.all([promise1, promise2]);

      expect(writeCallCount).toBe(2);
      expect(mockedFs.writeJson).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent token retrieval operations', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue(mockAuthToken);

      const promise1 = getStoredToken();
      const promise2 = getStoredToken();
      const promise3 = getStoredToken();

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toEqual([mockAuthToken, mockAuthToken, mockAuthToken]);
      expect(mockedFs.readJson).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed token data gracefully', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue({ invalid: 'token format' });

      const result = await getStoredToken();

      // Should still return the malformed data (type system should catch this)
      expect(result).toEqual({ invalid: 'token format' });
    });

    it('should handle extremely large port numbers', async () => {
      const mockPort = 65535; // Max port number
      const mockAddress = { port: mockPort };
      const mockServer = {
        listen: jest.fn((port: number, callback: () => void) => {
          callback();
        }),
        address: jest.fn(() => mockAddress),
        close: jest.fn((callback?: () => void) => {
          if (callback) callback();
        }),
        on: jest.fn(),
      };

      mockedHttp.createServer.mockReturnValue(mockServer as any);

      const port = await findAvailablePort();
      expect(port).toBe(mockPort);
    });

    it('should handle token without expiry time', async () => {
      const tokenWithoutExpiry: AuthToken = {
        access_token: 'no_expiry_token',
        refresh_token: 'refresh_token',
      };

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue(tokenWithoutExpiry);

      // The token should be considered invalid due to missing/zero expires_at
      const result = await getStoredToken();
      expect(result).toEqual(tokenWithoutExpiry);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should clean up server resources properly on successful port finding', async () => {
      const mockServer = {
        listen: jest.fn((port: number, callback: () => void) => {
          callback();
        }),
        address: jest.fn(() => ({ port: 3000 })),
        close: jest.fn((callback?: () => void) => {
          if (callback) callback();
        }),
        on: jest.fn(),
      };

      mockedHttp.createServer.mockReturnValue(mockServer as any);

      await findAvailablePort();

      expect(mockServer.close).toHaveBeenCalledTimes(1);
      expect(mockServer.close).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
