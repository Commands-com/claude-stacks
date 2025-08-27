import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SecureHttpClient } from '../../../src/utils/secureHttp.js';

// Mock node-fetch
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock testHelpers
jest.mock('../../../src/utils/testHelpers.js', () => ({
  isTestEnvironment: jest.fn(),
  isTestHost: jest.fn(),
}));

import fetch from 'node-fetch';
import { isTestEnvironment, isTestHost } from '../../../src/utils/testHelpers.js';

const mockedFetch = jest.mocked(fetch);
const mockedIsTestEnvironment = jest.mocked(isTestEnvironment);
const mockedIsTestHost = jest.mocked(isTestHost);

describe('SecureHttpClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to non-test environment
    mockedIsTestEnvironment.mockReturnValue(false);
    mockedIsTestHost.mockReturnValue(false);
  });

  const mockResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: jest.fn(),
    text: jest.fn(),
  };

  describe('secureRequest', () => {
    it('should make a successful HTTPS request to allowed host', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.secureRequest('https://api.commands.com/test');

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/test', {
        agent: expect.any(Object),
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
        },
      });
    });

    it('should reject invalid URL formats', async () => {
      await expect(SecureHttpClient.secureRequest('not-a-url')).rejects.toThrow(
        'Invalid URL format: not-a-url'
      );
    });

    it('should reject non-HTTPS URLs', async () => {
      await expect(SecureHttpClient.secureRequest('http://api.commands.com/test')).rejects.toThrow(
        'Only HTTPS requests are allowed for security'
      );
    });

    it('should reject non-allowed hosts', async () => {
      await expect(SecureHttpClient.secureRequest('https://malicious.com/test')).rejects.toThrow(
        'Host not allowed: malicious.com. Allowed hosts: api.commands.com, backend.commands.com, commands.com'
      );
    });

    it('should allow all allowed hosts', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);
      const allowedHosts = ['api.commands.com', 'backend.commands.com', 'commands.com'];

      for (const host of allowedHosts) {
        await SecureHttpClient.secureRequest(`https://${host}/test`);
      }

      expect(mockedFetch).toHaveBeenCalledTimes(allowedHosts.length);
    });

    it('should merge custom headers with default headers', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.secureRequest('https://api.commands.com/test', {
        headers: {
          Authorization: 'Bearer token',
          'Custom-Header': 'value',
        },
      });

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/test', {
        agent: expect.any(Object),
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          Authorization: 'Bearer token',
          'Custom-Header': 'value',
        },
      });
    });

    it('should add Content-Type header for requests with body but no Content-Type', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.secureRequest('https://api.commands.com/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: {},
      });

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        agent: expect.any(Object),
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should not override existing Content-Type header', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.secureRequest('https://api.commands.com/test', {
        method: 'POST',
        body: 'text data',
        headers: {
          'Content-Type': 'text/plain',
        },
      });

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/test', {
        method: 'POST',
        body: 'text data',
        agent: expect.any(Object),
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Content-Type': 'text/plain',
        },
      });
    });

    it('should handle server errors (5xx)', async () => {
      const serverErrorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
      mockedFetch.mockResolvedValue(serverErrorResponse as any);

      await expect(SecureHttpClient.secureRequest('https://api.commands.com/test')).rejects.toThrow(
        'Server error: 500 Internal Server Error'
      );
    });

    it('should allow client errors (4xx) to pass through', async () => {
      const clientErrorResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };
      mockedFetch.mockResolvedValue(clientErrorResponse as any);

      const response = await SecureHttpClient.secureRequest('https://api.commands.com/test');
      expect(response).toBe(clientErrorResponse);
    });

    it('should handle ENOTFOUND network errors', async () => {
      const networkError = new Error('getaddrinfo ENOTFOUND api.commands.com');
      mockedFetch.mockRejectedValue(networkError);

      await expect(SecureHttpClient.secureRequest('https://api.commands.com/test')).rejects.toThrow(
        'Network error: Host not found - api.commands.com'
      );
    });

    it('should handle ECONNREFUSED network errors', async () => {
      const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:443');
      mockedFetch.mockRejectedValue(connectionError);

      await expect(SecureHttpClient.secureRequest('https://api.commands.com/test')).rejects.toThrow(
        'Network error: Connection refused to api.commands.com'
      );
    });

    it('should handle certificate errors', async () => {
      const certError = new Error('certificate verification failed');
      mockedFetch.mockRejectedValue(certError);

      await expect(SecureHttpClient.secureRequest('https://api.commands.com/test')).rejects.toThrow(
        'SSL/TLS certificate error for api.commands.com: certificate verification failed'
      );
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      mockedFetch.mockRejectedValue(timeoutError);

      await expect(SecureHttpClient.secureRequest('https://api.commands.com/test')).rejects.toThrow(
        'Request timeout: https://api.commands.com/test took longer than 30000ms'
      );
    });

    it('should re-throw unrecognized errors', async () => {
      const unknownError = new Error('Unknown network error');
      mockedFetch.mockRejectedValue(unknownError);

      await expect(SecureHttpClient.secureRequest('https://api.commands.com/test')).rejects.toThrow(
        'Unknown network error'
      );
    });

    describe('test environment behavior', () => {
      beforeEach(() => {
        mockedIsTestEnvironment.mockReturnValue(true);
      });

      it('should allow test hosts in test environment', async () => {
        mockedIsTestHost.mockReturnValue(true);
        mockedFetch.mockResolvedValue(mockResponse as any);

        await SecureHttpClient.secureRequest('https://test-host.local/test');

        expect(mockedFetch).toHaveBeenCalledWith(
          'https://test-host.local/test',
          expect.any(Object)
        );
      });

      it('should still reject non-test hosts in test environment', async () => {
        mockedIsTestHost.mockReturnValue(false);

        await expect(SecureHttpClient.secureRequest('https://malicious.com/test')).rejects.toThrow(
          'Host not allowed: malicious.com'
        );
      });
    });
  });

  describe('get', () => {
    it('should make a GET request with default headers', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.get('https://api.commands.com/data');

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data', {
        method: 'GET',
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
        },
        agent: expect.any(Object),
      });
    });

    it('should make a GET request with custom headers', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.get('https://api.commands.com/data', {
        Authorization: 'Bearer token',
      });

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data', {
        method: 'GET',
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          Authorization: 'Bearer token',
        },
        agent: expect.any(Object),
      });
    });
  });

  describe('post', () => {
    it('should make a POST request without body', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.post('https://api.commands.com/data');

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data', {
        method: 'POST',
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
        },
        agent: expect.any(Object),
      });
    });

    it('should make a POST request with JSON body', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);
      const body = { key: 'value', number: 42 };

      await SecureHttpClient.post('https://api.commands.com/data', body);

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
        },
        agent: expect.any(Object),
      });
    });

    it('should make a POST request with string body', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);
      const body = 'text data';

      await SecureHttpClient.post('https://api.commands.com/data', body);

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data', {
        method: 'POST',
        body: 'text data',
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
        },
        agent: expect.any(Object),
      });
    });

    it('should make a POST request with custom headers', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);
      const body = { test: 'data' };

      await SecureHttpClient.post('https://api.commands.com/data', body, {
        Authorization: 'Bearer token',
        'X-Custom': 'header',
      });

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
          'X-Custom': 'header',
        },
        agent: expect.any(Object),
      });
    });
  });

  describe('put', () => {
    it('should make a PUT request without body', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.put('https://api.commands.com/data/123');

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data/123', {
        method: 'PUT',
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
        },
        agent: expect.any(Object),
      });
    });

    it('should make a PUT request with JSON body', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);
      const body = { updated: true };

      await SecureHttpClient.put('https://api.commands.com/data/123', body);

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data/123', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
        },
        agent: expect.any(Object),
      });
    });

    it('should make a PUT request with string body', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);
      const body = 'updated text';

      await SecureHttpClient.put('https://api.commands.com/data/123', body);

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data/123', {
        method: 'PUT',
        body: 'updated text',
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
        },
        agent: expect.any(Object),
      });
    });
  });

  describe('delete', () => {
    it('should make a DELETE request', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.delete('https://api.commands.com/data/123');

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data/123', {
        method: 'DELETE',
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
        },
        agent: expect.any(Object),
      });
    });

    it('should make a DELETE request with custom headers', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.delete('https://api.commands.com/data/123', {
        Authorization: 'Bearer token',
      });

      expect(mockedFetch).toHaveBeenCalledWith('https://api.commands.com/data/123', {
        method: 'DELETE',
        headers: {
          'User-Agent': 'claude-stacks-cli/1.3.7',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          Authorization: 'Bearer token',
        },
        agent: expect.any(Object),
      });
    });
  });

  describe('isUrlAllowed', () => {
    it('should return true for allowed HTTPS URLs', () => {
      const allowedUrls = [
        'https://api.commands.com/test',
        'https://backend.commands.com/data',
        'https://commands.com/info',
      ];

      allowedUrls.forEach(url => {
        expect(SecureHttpClient.isUrlAllowed(url)).toBe(true);
      });
    });

    it('should return false for non-HTTPS URLs', () => {
      expect(SecureHttpClient.isUrlAllowed('http://api.commands.com/test')).toBe(false);
      expect(SecureHttpClient.isUrlAllowed('ftp://api.commands.com/test')).toBe(false);
    });

    it('should return false for non-allowed hosts', () => {
      const disallowedUrls = [
        'https://malicious.com/test',
        'https://evil.site.com/data',
        'https://api.example.com/info',
      ];

      disallowedUrls.forEach(url => {
        expect(SecureHttpClient.isUrlAllowed(url)).toBe(false);
      });
    });

    it('should return false for invalid URLs', () => {
      const invalidUrls = ['not-a-url', 'invalid://url', '', null, undefined];

      invalidUrls.forEach(url => {
        expect(SecureHttpClient.isUrlAllowed(url as any)).toBe(false);
      });
    });

    describe('test environment behavior', () => {
      beforeEach(() => {
        mockedIsTestEnvironment.mockReturnValue(true);
      });

      it('should return true for test hosts in test environment', () => {
        mockedIsTestHost.mockReturnValue(true);
        expect(SecureHttpClient.isUrlAllowed('https://test-host.local/test')).toBe(true);
      });

      it('should return false for non-test hosts in test environment', () => {
        mockedIsTestHost.mockReturnValue(false);
        expect(SecureHttpClient.isUrlAllowed('https://malicious.com/test')).toBe(false);
      });
    });
  });

  describe('edge cases and security', () => {
    it('should handle URLs with query parameters', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.get('https://api.commands.com/data?param=value&other=123');

      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.commands.com/data?param=value&other=123',
        expect.any(Object)
      );
    });

    it('should handle URLs with fragments', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.get('https://api.commands.com/data#section');

      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.commands.com/data#section',
        expect.any(Object)
      );
    });

    it('should handle non-standard ports (still HTTPS)', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.get('https://api.commands.com:8443/data');

      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.commands.com:8443/data',
        expect.any(Object)
      );
    });

    it('should handle body that is falsy but not undefined', async () => {
      mockedFetch.mockResolvedValue(mockResponse as any);

      await SecureHttpClient.post('https://api.commands.com/data', 0);
      await SecureHttpClient.post('https://api.commands.com/data', '');
      await SecureHttpClient.post('https://api.commands.com/data', false);

      expect(mockedFetch).toHaveBeenCalledTimes(3);
      expect(mockedFetch).toHaveBeenNthCalledWith(1, 'https://api.commands.com/data', {
        method: 'POST',
        body: '0',
        headers: expect.any(Object),
        agent: expect.any(Object),
      });
      expect(mockedFetch).toHaveBeenNthCalledWith(2, 'https://api.commands.com/data', {
        method: 'POST',
        body: '',
        headers: expect.any(Object),
        agent: expect.any(Object),
      });
      expect(mockedFetch).toHaveBeenNthCalledWith(3, 'https://api.commands.com/data', {
        method: 'POST',
        body: 'false',
        headers: expect.any(Object),
        agent: expect.any(Object),
      });
    });
  });
});
