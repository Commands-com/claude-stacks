import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as http from 'http';
import open from 'open';
import fetch from 'node-fetch';
import chalk from 'chalk';

import { AuthToken, OAuthConfig } from '../types/index.js';

const OAUTH_CONFIG: OAuthConfig & { scopes: string[] } = {
  authUrl: 'https://api.commands.com/oauth/authorize',
  tokenUrl: 'https://api.commands.com/oauth/token',
  clientId: 'claude-stacks-cli',
  scopes: ['write_assets', 'read_assets']
};

// Find available port for OAuth callback
export function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, () => {
      const port = (server.address() as any)?.port;
      server.close(() => {
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

// Generate PKCE challenge
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

// Store/retrieve tokens
export async function getStoredToken(): Promise<AuthToken | null> {
  const tokenPath = path.join(os.homedir(), '.claude-stacks-auth.json');
  if (await fs.pathExists(tokenPath)) {
    try {
      return await fs.readJson(tokenPath);
    } catch (error) {
      return null;
    }
  }
  return null;
}

export async function storeToken(token: AuthToken): Promise<void> {
  const tokenPath = path.join(os.homedir(), '.claude-stacks-auth.json');
  await fs.writeJson(tokenPath, token, { spaces: 2 });
}

export async function clearStoredToken(): Promise<void> {
  const tokenPath = path.join(os.homedir(), '.claude-stacks-auth.json');
  if (await fs.pathExists(tokenPath)) {
    await fs.remove(tokenPath);
  }
}

export async function refreshToken(refreshToken: string): Promise<AuthToken> {
  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: OAUTH_CONFIG.clientId
    })
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  return await response.json() as AuthToken;
}

// OAuth authentication flow
export async function authenticate(): Promise<string> {
  console.log(chalk.blue('🔐 Authenticating with Commands.com...'));
  
  // Check for existing valid token
  const storedToken = await getStoredToken();
  if (storedToken) {
    // Check if token is still valid (simple expiry check)
    const expiryTime = new Date(Date.now() - ((storedToken as any).expires_in * 1000));
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
      } catch (error) {
        console.log(chalk.yellow('🔄 Token refresh failed, re-authenticating...'));
        await clearStoredToken();
      }
    }
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
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  const authUrl = `${OAUTH_CONFIG.authUrl}?${authParams.toString()}`;
  
  // Start local server to receive callback
  const authCode = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${callbackPort}`);
      
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h1>Authentication Failed</h1><p>Error: ${error}</p></body></html>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        
        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication Failed</h1><p>Invalid state parameter</p></body></html>');
          server.close();
          reject(new Error('Invalid OAuth state'));
          return;
        }
        
        if (code) {
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
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication Failed</h1><p>No authorization code received</p></body></html>');
          server.close();
          reject(new Error('No authorization code received'));
        }
      }
    });
    
    server.listen(callbackPort, () => {
      console.log(chalk.blue('🌐 Opening browser for authentication...'));
      open(authUrl).catch(() => {
        console.log(chalk.yellow('Could not open browser automatically.'));
        console.log(chalk.gray('Please open this URL manually:'));
        console.log(chalk.cyan(authUrl));
      });
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout'));
    }, 5 * 60 * 1000);
  });
  
  // Exchange code for token
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
      code_verifier: codeVerifier
    })
  });
  
  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
  }
  
  const token: AuthToken = await tokenResponse.json() as AuthToken;
  await storeToken(token);
  
  console.log(chalk.green('✅ Authentication successful!'));
  return token.access_token;
}