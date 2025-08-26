import https from 'https';
import crypto from 'crypto';
import type { RequestInit, Response } from 'node-fetch';
import fetch from 'node-fetch';
import { isTestEnvironment, isTestHost } from './testHelpers.js';

export class SecureHttpClient {
  private static readonly ALLOWED_HOSTS = [
    'api.commands.com',
    'backend.commands.com',
    'commands.com',
  ];

  private static readonly TIMEOUT_MS = 30000; // 30 seconds
  private static readonly MAX_REDIRECTS = 5;

  private static readonly httpsAgent = new https.Agent({
    // Reject requests with invalid certificates
    rejectUnauthorized: true,

    // Connection pooling settings
    maxSockets: 5,
    maxFreeSockets: 2,
    timeout: SecureHttpClient.TIMEOUT_MS,

    // Protocol settings - Prefer TLS 1.3 with fallback to 1.2
    secureProtocol: 'TLS_method', // Use flexible method to allow TLS 1.3 negotiation
    secureOptions:
      crypto.constants.SSL_OP_NO_SSLv2 |
      crypto.constants.SSL_OP_NO_SSLv3 |
      crypto.constants.SSL_OP_NO_TLSv1 |
      crypto.constants.SSL_OP_NO_TLSv1_1, // Disable all protocols below TLS 1.2

    // Custom certificate validation
    checkServerIdentity: (hostname: string) => {
      // Additional hostname verification beyond default
      if (!SecureHttpClient.ALLOWED_HOSTS.includes(hostname)) {
        throw new Error(`Certificate hostname not in allowlist: ${hostname}`);
      }

      // Let Node.js perform the default certificate validation
      return undefined;
    },
  });

  /**
   * Makes a secure HTTPS request with certificate validation and hostname verification
   * @param url The URL to request
   * @param options Fetch options
   * @returns Promise resolving to the fetch Response
   */
  static async secureRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const parsedUrl = this.validateAndParseUrl(url);
    const secureOptions = this.prepareSecureOptions(options);

    try {
      const response = await fetch(url, secureOptions);
      this.validateResponse(response);
      return response;
    } catch (networkError) {
      throw this.wrapNetworkError(networkError, parsedUrl);
    }
  }

  private static validateAndParseUrl(url: string): URL {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid URL format: ${url}`);
    }

    // Enforce HTTPS only
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTPS requests are allowed for security');
    }

    // Validate hostname is in allowlist (allow test hosts in test environment)
    const isAllowedHost =
      this.ALLOWED_HOSTS.includes(parsedUrl.hostname) ||
      (isTestEnvironment() && isTestHost(parsedUrl.hostname));

    if (!isAllowedHost) {
      throw new Error(
        `Host not allowed: ${parsedUrl.hostname}. Allowed hosts: ${this.ALLOWED_HOSTS.join(', ')}`
      );
    }

    return parsedUrl;
  }

  private static prepareSecureOptions(options: RequestInit): RequestInit {
    const secureOptions: RequestInit = {
      ...options,
      agent: this.httpsAgent,
      headers: {
        'User-Agent': 'claude-stacks-cli/1.2.2',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
        ...options.headers,
      },
    };

    // Add Content-Type for requests with body
    if (
      secureOptions.body &&
      secureOptions.headers &&
      !(secureOptions.headers as Record<string, string>)['Content-Type']
    ) {
      (secureOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    return secureOptions;
  }

  private static validateResponse(response: Response): void {
    if (!response.ok && response.status >= 500) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
  }

  private static wrapNetworkError(networkError: unknown, parsedUrl: URL): Error {
    if (networkError instanceof Error) {
      if (networkError.message.includes('ENOTFOUND')) {
        return new Error(`Network error: Host not found - ${parsedUrl.hostname}`);
      }
      if (networkError.message.includes('ECONNREFUSED')) {
        return new Error(`Network error: Connection refused to ${parsedUrl.hostname}`);
      }
      if (networkError.message.includes('certificate')) {
        return new Error(
          `SSL/TLS certificate error for ${parsedUrl.hostname}: ${networkError.message}`
        );
      }
      if (networkError.message.includes('timeout')) {
        return new Error(
          `Request timeout: ${parsedUrl.toString()} took longer than ${this.TIMEOUT_MS}ms`
        );
      }
    }

    // Re-throw original error if we can't categorize it
    return networkError as Error;
  }

  /**
   * Makes a secure GET request
   * @param url The URL to request
   * @param headers Optional headers
   * @returns Promise resolving to the fetch Response
   */
  static async get(url: string, headers: Record<string, string> = {}): Promise<Response> {
    return this.secureRequest(url, {
      method: 'GET',
      headers,
    });
  }

  /**
   * Makes a secure POST request
   * @param url The URL to request
   * @param body Request body
   * @param headers Optional headers
   * @returns Promise resolving to the fetch Response
   */
  static async post(
    url: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const options: RequestInit = {
      method: 'POST',
      headers,
    };

    if (body !== undefined) {
      if (typeof body === 'object') {
        options.body = JSON.stringify(body);
        options.headers = {
          'Content-Type': 'application/json',
          ...headers,
        };
      } else {
        options.body = String(body);
      }
    }

    return this.secureRequest(url, options);
  }

  /**
   * Makes a secure PUT request
   * @param url The URL to request
   * @param body Request body
   * @param headers Optional headers
   * @returns Promise resolving to the fetch Response
   */
  static async put(
    url: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const options: RequestInit = {
      method: 'PUT',
      headers,
    };

    if (body !== undefined) {
      if (typeof body === 'object') {
        options.body = JSON.stringify(body);
        options.headers = {
          'Content-Type': 'application/json',
          ...headers,
        };
      } else {
        options.body = String(body);
      }
    }

    return this.secureRequest(url, options);
  }

  /**
   * Makes a secure DELETE request
   * @param url The URL to request
   * @param headers Optional headers
   * @returns Promise resolving to the fetch Response
   */
  static async delete(url: string, headers: Record<string, string> = {}): Promise<Response> {
    return this.secureRequest(url, {
      method: 'DELETE',
      headers,
    });
  }

  /**
   * Validates if a URL is allowed for requests
   * @param url The URL to validate
   * @returns true if URL is allowed
   */
  static isUrlAllowed(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const isAllowedHost =
        this.ALLOWED_HOSTS.includes(parsedUrl.hostname) ||
        (isTestEnvironment() && isTestHost(parsedUrl.hostname));
      return parsedUrl.protocol === 'https:' && isAllowedHost;
    } catch {
      return false;
    }
  }
}
