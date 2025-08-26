import fs from 'fs-extra';
import * as path from 'path';
import { AUTH_TOKEN_PATH } from '../constants/paths.js';
import * as crypto from 'crypto';
import * as os from 'os';
import * as http from 'http';
import { setTimeout } from 'timers';
import open from 'open';
import fetch from 'node-fetch';
import chalk from 'chalk';
import { validateAuthToken } from './validators.js';

import type { AuthToken, OAuthConfig } from '../types/index.js';

const OAUTH_CONFIG: OAuthConfig & { scopes: string[] } = {
  authUrl: 'https://api.commands.com/oauth/authorize',
  tokenUrl: 'https://api.commands.com/oauth/token',
  clientId: 'claude-stacks-cli',
  scopes: ['write_assets', 'read_assets'],
};

// Find available port for OAuth callback
export function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : undefined;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error('Could not determine port'));
        }
      });
    });
    server.on('error', reject);
  });
}

// Generate PKCE challenge with enhanced security
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // RFC 7636 recommends 43-128 characters, use maximum for security
  const codeVerifier = crypto.randomBytes(96).toString('base64url'); // ~128 chars
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

// Token encryption utilities
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000; // OWASP recommendation for 2023

function getKeyMaterial(): string {
  // Use a combination of machine-specific data for key derivation
  const machineId = os.hostname() + os.platform() + os.arch();
  return process.env.CLAUDE_STACKS_KEY ?? `claude-stacks-default-key-${machineId}`;
}

function deriveKey(keyMaterial: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(keyMaterial, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function encryptToken(token: AuthToken): string {
  // Generate unique salt for this encryption
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(getKeyMaterial(), salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(JSON.stringify(token), 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Format: version:salt:iv:authTag:encrypted
  return `v2:${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptTokenV2(encryptedData: string): AuthToken {
  const parts = encryptedData.split(':');
  if (parts.length !== 5 || parts[0] !== 'v2') {
    throw new Error('Invalid v2 encrypted token format');
  }

  const [, saltHex, ivHex, authTagHex, encryptedHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const key = deriveKey(getKeyMaterial(), salt);
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted) as AuthToken;
}

function decryptTokenLegacy(encryptedData: string): AuthToken {
  // Legacy decryption for backward compatibility
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid legacy encrypted token format');
    }

    const [, encrypted] = parts;
    const keyMaterial = getKeyMaterial();
    const key = crypto.scryptSync(keyMaterial, 'claude-stacks-salt', KEY_LENGTH);

    const decipher = crypto.createDecipher('aes-256-cbc', key);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted) as AuthToken;
  } catch (error) {
    throw new Error(
      `Failed to decrypt legacy token: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function decryptToken(encryptedData: string): AuthToken {
  try {
    // Handle v2 format (new secure format)
    if (encryptedData.startsWith('v2:')) {
      return decryptTokenV2(encryptedData);
    }

    // Handle legacy format for backward compatibility
    return decryptTokenLegacy(encryptedData);
  } catch (error) {
    throw new Error(
      `Failed to decrypt token: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validates OAuth state parameter using timing-safe comparison
 * @param receivedState The state parameter received from OAuth callback
 * @param expectedState The expected state parameter
 * @returns true if states match
 */
function validateOAuthState(receivedState: string, expectedState: string): boolean {
  if (receivedState.length !== expectedState.length) {
    return false;
  }

  // Use crypto.timingSafeEqual for constant-time comparison
  const receivedBuffer = Buffer.from(receivedState, 'hex');
  const expectedBuffer = Buffer.from(expectedState, 'hex');

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

// Store/retrieve tokens
export async function getStoredToken(): Promise<AuthToken | null> {
  const tokenPath = AUTH_TOKEN_PATH;
  if (await fs.pathExists(tokenPath)) {
    try {
      const encryptedData = await fs.readFile(tokenPath, 'utf-8');

      // Check if this is an old unencrypted token (for backward compatibility)
      if (encryptedData.trim().startsWith('{')) {
        console.warn('Found unencrypted token, re-encrypting for security...');
        const oldToken = JSON.parse(encryptedData) as AuthToken;
        await storeToken(oldToken); // Re-store with encryption
        return oldToken;
      }

      return decryptToken(encryptedData);
    } catch {
      console.warn('Failed to decrypt stored token, removing invalid token file');
      await clearStoredToken();
      return null;
    }
  }
  return null;
}

export async function storeToken(token: AuthToken): Promise<void> {
  const tokenPath = AUTH_TOKEN_PATH;
  const encryptedToken = encryptToken(token);

  // Ensure the directory exists
  await fs.ensureDir(path.dirname(tokenPath));

  // Write encrypted token with restrictive permissions
  await fs.writeFile(tokenPath, encryptedToken, { mode: 0o600 });
}

export async function clearStoredToken(): Promise<void> {
  const tokenPath = AUTH_TOKEN_PATH;
  if (await fs.pathExists(tokenPath)) {
    await fs.remove(tokenPath);
  }
}

export async function refreshToken(token: string): Promise<AuthToken> {
  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token,
      client_id: OAUTH_CONFIG.clientId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  return validateAuthToken(await response.json());
}

// eslint-disable-next-line no-unused-vars
type ResolveFunction = (value: string) => void;
// eslint-disable-next-line no-unused-vars
type RejectFunction = (error: Error) => void;

interface CallbackConfig {
  callbackPort: number;
  state: string;
  server: http.Server;
  resolve: ResolveFunction;
  reject: RejectFunction;
}

function sendErrorResponse(
  res: http.ServerResponse,
  error: string,
  server: http.Server,
  reject: RejectFunction
): void {
  res.writeHead(400, { 'Content-Type': 'text/html' });
  res.end(`<html><body><h1>Authentication Failed</h1><p>${error}</p></body></html>`);
  server.close();
  reject(new Error(error));
}

function sendSuccessResponse(
  res: http.ServerResponse,
  code: string,
  server: http.Server,
  resolve: ResolveFunction
): void {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <body style="font-family: system-ui; text-align: center; padding: 50px;">
        <h1 style="color: #28a745;">✅ Authentication Successful!</h1>
        <p>You can now close this window and return to your terminal.</p>
        <p style="color: #666; font-size: 14px;">Claude Stacks CLI is now authenticated with Commands.com</p>
      </body>
    </html>
  `);
  server.close();
  resolve(code);
}

function handleOAuthCallback(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: CallbackConfig
): void {
  const { callbackPort, state, server, resolve, reject } = config;
  const url = new URL(req.url!, `http://localhost:${callbackPort}`);

  if (url.pathname !== '/callback') {
    return;
  }

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    sendErrorResponse(res, `Error: ${error}`, server, reject);
    return;
  }

  if (!validateOAuthState(returnedState ?? '', state)) {
    sendErrorResponse(res, 'Invalid state parameter', server, reject);
    return;
  }

  if (code) {
    sendSuccessResponse(res, code, server, resolve);
  } else {
    sendErrorResponse(res, 'No authorization code received', server, reject);
  }
}

function startOAuthServer(callbackPort: number, state: string, authUrl: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleOAuthCallback(req, res, { callbackPort, state, server, resolve, reject });
    });

    server.listen(callbackPort, () => {
      console.log(chalk.blue('🌐 Opening browser for authentication...'));
      open(authUrl).catch(() => {
        console.log(chalk.yellow('Could not open browser automatically.'));
        console.log(chalk.gray('Please open this URL manually:'));
        console.log(chalk.cyan(authUrl));
      });
    });

    // Skip timeouts in test environment
    if (process.env.NODE_ENV !== 'test') {
      // Warning at 2 minutes
      setTimeout(
        () => {
          console.log(chalk.yellow('⚠️  Authentication timeout in 1 minute...'));
        },
        2 * 60 * 1000
      );

      // Timeout after 3 minutes
      setTimeout(
        () => {
          server.close();
          reject(new Error('Authentication timeout'));
        },
        3 * 60 * 1000
      );
    }
  });
}

async function checkExistingToken(): Promise<string | null> {
  const storedToken = await getStoredToken();
  if (!storedToken) return null;

  // Check if token is still valid (simple expiry check)
  const expiresAt = typeof storedToken.expires_at === 'number' ? storedToken.expires_at : 0;
  const expiryTime = new Date(expiresAt * 1000);
  if (expiryTime > new Date()) {
    console.log(chalk.green('✅ Using existing authentication'));
    return storedToken.access_token;
  }

  // Try to refresh token if available
  if (storedToken.refresh_token) {
    try {
      const newToken = await refreshToken(storedToken.refresh_token);
      await storeToken(newToken);
      console.log(chalk.green('✅ Refreshed authentication'));
      return newToken.access_token;
    } catch {
      console.log(chalk.yellow('🔄 Token refresh failed, re-authenticating...'));
      await clearStoredToken();
    }
  }

  return null;
}

async function exchangeCodeForToken(
  authCode: string,
  redirectUri: string,
  codeVerifier: string
): Promise<string> {
  const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: redirectUri,
      client_id: OAUTH_CONFIG.clientId,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
  }

  const token: AuthToken = validateAuthToken(await tokenResponse.json());
  await storeToken(token);
  return token.access_token;
}

// OAuth authentication flow
/**
 * Authenticates the user with Commands.com using OAuth 2.0 PKCE flow
 *
 * @returns Promise resolving to access token for API requests
 *
 * @throws {@link Error} When authentication fails, network errors occur, or user cancels
 *
 * @example
 * ```typescript
 * const token = await authenticate();
 * // User will be redirected to browser for authentication
 * console.log('Authenticated successfully');
 * ```
 *
 * @remarks
 * Checks for existing valid tokens before initiating new OAuth flow.
 * Opens browser automatically for user authentication.
 * Stores tokens securely for future use and handles token refresh.
 *
 * @since 1.0.0
 * @public
 */
export async function authenticate(): Promise<string> {
  console.log(chalk.blue('🔐 Authenticating with Commands.com...'));

  // Check for existing valid token
  const existingToken = await checkExistingToken();
  if (existingToken) {
    return existingToken;
  }

  // Start new OAuth flow
  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  // Find available port
  const callbackPort = await findAvailablePort();
  const redirectUri = `http://localhost:${callbackPort}/callback`;

  // Build authorization URL
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    scope: OAUTH_CONFIG.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${OAUTH_CONFIG.authUrl}?${authParams.toString()}`;
  const authCode = await startOAuthServer(callbackPort, state, authUrl);

  const accessToken = await exchangeCodeForToken(authCode, redirectUri, codeVerifier);
  console.log(chalk.green('✅ Authentication successful!'));
  return accessToken;
}
