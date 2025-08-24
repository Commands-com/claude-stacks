#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import open from 'open';
import * as http from 'http';


interface DeveloperStack {
  name: string;
  description: string;
  version: string;
  commands?: StackCommand[];
  agents?: StackAgent[];
  mcpServers?: StackMcpServer[];
  settings?: StackSettings;
  claudeMd?: {
    global?: {
      content: string;
      path: string;
    };
    local?: {
      content: string;
      path: string;
    };
  };
  metadata?: {
    created_at: string;
    updated_at: string;
    exported_from: string;
  };
  filePath?: string; // Used for local stacks listing
}

interface StackCommand {
  name: string;
  description?: string;
  filePath: string;
  content: string;
}

interface StackAgent {
  name: string;
  description?: string;
  filePath: string;
  content: string;
}


interface StackMcpServer {
  name: string;
  type: string;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

interface StackSettings {
  model?: string;
  statusLine?: {
    type: string;
    command?: string;
    padding?: number;
  };
  [key: string]: any;
}

interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

// Find available port for OAuth callback
function findAvailablePort(): Promise<number> {
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

// API Configuration
function getApiConfig() {
  const isDev = process.env.CLAUDE_STACKS_DEV === 'true' || process.env.NODE_ENV === 'development';
  return {
    baseUrl: isDev ? 'http://localhost:3000' : 'https://backend.commands.com',
    authUrl: 'https://api.commands.com/oauth/authorize',
    tokenUrl: 'https://api.commands.com/oauth/token'
  };
}

const OAUTH_CONFIG: OAuthConfig = {
  authUrl: 'https://api.commands.com/oauth/authorize',
  tokenUrl: 'https://api.commands.com/oauth/token', 
  clientId: 'claude-stacks-cli',
  redirectUri: 'http://localhost:PORT/callback', // PORT will be replaced dynamically
  scopes: ['write_assets', 'read_assets']
};

// Generate PKCE challenge
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

// Store/retrieve tokens
async function getStoredToken(): Promise<AuthToken | null> {
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

async function storeToken(token: AuthToken): Promise<void> {
  const tokenPath = path.join(os.homedir(), '.claude-stacks-auth.json');
  await fs.writeJson(tokenPath, token, { spaces: 2 });
}

async function clearStoredToken(): Promise<void> {
  const tokenPath = path.join(os.homedir(), '.claude-stacks-auth.json');
  if (await fs.pathExists(tokenPath)) {
    await fs.remove(tokenPath);
  }
}

// OAuth authentication flow
async function authenticate(): Promise<string> {
  console.log(chalk.blue('🔐 Authenticating with Commands.com...'));
  
  // Check for existing valid token
  const storedToken = await getStoredToken();
  if (storedToken) {
    // Check if token is still valid (simple expiry check)
    const expiryTime = new Date(Date.now() - (storedToken.expires_in * 1000));
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

async function refreshToken(refreshToken: string): Promise<AuthToken> {
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

// Stack publishing functions
async function publishStack(stackFilePath?: string, options: { public?: boolean; description?: string; tags?: string } = {}): Promise<void> {
  // Find stack file
  let stackPath: string;
  if (stackFilePath) {
    stackPath = path.resolve(stackFilePath);
  } else {
    // Look for stack file in ~/.claude/stacks/ directory
    const currentDir = process.cwd();
    const dirName = path.basename(currentDir);
    const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
    const defaultStackFile = `${dirName}-stack.json`;
    stackPath = path.join(stacksDir, defaultStackFile);
  }
  
  if (!await fs.pathExists(stackPath)) {
    throw new Error(`Stack file not found: ${stackPath}. Run 'claude-stacks export' first.`);
  }
  
  // Load and validate stack
  const stack: DeveloperStack = await fs.readJson(stackPath);
  
  // Override description if provided
  if (options.description) {
    stack.description = options.description;
  }
  
  // Parse tags
  const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];
  
  // Authenticate
  const accessToken = await authenticate();
  
  // Prepare stack for upload
  const stackPayload = {
    name: stack.name,
    description: stack.description,
    version: stack.version,
    commands: stack.commands || [],
    agents: stack.agents || [],
    mcpServers: stack.mcpServers || [],
    settings: stack.settings || {},
    ...(stack.claudeMd && { claudeMd: stack.claudeMd }),
    tags: tags,
    public: options.public || false,
    metadata: {
      ...stack.metadata,
      cli_version: '1.0.0',
      published_at: new Date().toISOString()
    }
  };
  
  const apiConfig = getApiConfig();
  console.log(chalk.blue('📤 Uploading stack to Commands.com...'));
  if (apiConfig.baseUrl.includes('localhost')) {
    console.log(chalk.gray(`   Using local backend: ${apiConfig.baseUrl}`));
  }
  
  // Upload to Commands.com API
  const response = await fetch(`${apiConfig.baseUrl}/v1/stacks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'claude-stacks-cli/1.0.0'
    },
    body: JSON.stringify(stackPayload)
  });
  
  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody ? `\n${errorBody}` : '';
    } catch {}
    throw new Error(`Publishing failed: ${response.status} ${response.statusText}${errorDetails}`);
  }
  
  const result = await response.json() as any;
  
  console.log(chalk.green('✅ Stack published successfully!'));
  console.log(chalk.gray(`  Stack ID: ${result.stackId}`));
  console.log(chalk.gray(`  URL: ${result.url || `https://commands.com/stacks/${result.stackId}`}`));
  console.log(chalk.gray(`  Components: ${stackPayload.commands.length + stackPayload.agents.length} items`));
  console.log(chalk.gray(`  Visibility: ${options.public ? 'Public' : 'Private'}`));
}

async function browseStacks(options: { category?: string; search?: string; myStacks?: boolean } = {}): Promise<void> {
  let accessToken: string | null = null;
  
  // Only authenticate if viewing private stacks
  if (options.myStacks) {
    accessToken = await authenticate();
  }
  
  // Build query parameters
  const params = new URLSearchParams();
  if (options.search) params.set('search', options.search);
  if (options.myStacks) params.set('myStacks', 'true');
  // Note: category not supported in current API, removing for now
  
  const headers: Record<string, string> = {
    'User-Agent': 'claude-stacks-cli/1.0.0'
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const apiConfig = getApiConfig();
  console.log(chalk.blue('🔍 Fetching stacks from Commands.com...'));
  if (apiConfig.baseUrl.includes('localhost')) {
    console.log(chalk.gray(`   Using local backend: ${apiConfig.baseUrl}`));
  }
  const response = await fetch(`${apiConfig.baseUrl}/v1/stacks?${params.toString()}`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody ? `\n${errorBody}` : '';
    } catch {}
    throw new Error(`Browse failed: ${response.status} ${response.statusText}${errorDetails}`);
  }
  
  const result = await response.json() as any;
  const stacks = result.stacks || [];
  
  if (stacks.length === 0) {
    console.log(chalk.yellow('No stacks found matching your criteria.'));
    return;
  }
  
  console.log(chalk.green(`\n📋 Found ${stacks.length} stack(s):\n`));
  
  stacks.forEach((stack: any, index: number) => {
    console.log(chalk.cyan.bold(`${index + 1}. ${stack.name}`));
    console.log(chalk.gray(`   Description: ${stack.description}`));
    console.log(chalk.gray(`   Author: ${stack.author || 'Unknown'}`));
    console.log(chalk.gray(`   Components: ${(stack.commandCount || 0) + (stack.agentCount || 0) + (stack.mcpServerCount || 0)} items`));
    console.log(chalk.gray(`   Views: ${stack.viewCount || 0}, Installs: ${stack.installCount || 0}`));
    console.log(chalk.gray(`   Created: ${stack.createdAt ? new Date(stack.createdAt).toLocaleDateString() : 'Unknown'}`));
    console.log(chalk.gray(`   URL: https://commands.com/stacks/${stack.stackId}`));
    console.log(chalk.blue(`   Install: claude-stacks install-remote ${stack.stackId}`));
    console.log();
  });
}

async function deleteStack(stackId: string): Promise<void> {
  const apiConfig = getApiConfig();
  console.log(chalk.blue(`🗑️ Deleting stack ${stackId}...`));
  if (apiConfig.baseUrl.includes('localhost')) {
    console.log(chalk.gray(`   Using local backend: ${apiConfig.baseUrl}`));
  }
  
  // Authenticate
  const accessToken = await authenticate();
  
  const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${stackId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'claude-stacks-cli/1.0.0'
    }
  });
  
  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody ? `\n${errorBody}` : '';
    } catch {}
    throw new Error(`Failed to delete stack: ${response.status} ${response.statusText}${errorDetails}`);
  }
  
  const result = await response.json() as any;
  console.log(chalk.green(`✅ Stack deleted successfully!`));
  console.log(chalk.gray(`   Stack ID: ${result.stackId || stackId}`));
}

async function installRemoteStack(stackId: string, options: { overwrite?: boolean; globalOnly?: boolean; localOnly?: boolean; skipClaudeMd?: boolean } = {}): Promise<void> {
  const apiConfig = getApiConfig();
  console.log(chalk.blue(`📥 Fetching stack ${stackId} from Commands.com...`));
  if (apiConfig.baseUrl.includes('localhost')) {
    console.log(chalk.gray(`   Using local backend: ${apiConfig.baseUrl}`));
  }
  
  // Fetch stack from Commands.com
  const response = await fetch(`${apiConfig.baseUrl}/v1/stacks/${stackId}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'claude-stacks-cli/1.0.0'
    }
  });
  
  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody ? `\n${errorBody}` : '';
    } catch {}
    
    if (response.status === 404) {
      throw new Error(`Stack ${stackId} not found. It may be private or not exist.${errorDetails}`);
    }
    throw new Error(`Failed to fetch stack: ${response.status} ${response.statusText}${errorDetails}`);
  }
  
  const remoteStack = await response.json() as any;
  
  // Convert remote stack format to local DeveloperStack format
  const stack: DeveloperStack = {
    name: remoteStack.name,
    description: remoteStack.description,
    version: remoteStack.version || '1.0.0',
    commands: remoteStack.commands || [],
    agents: remoteStack.agents || [],
    mcpServers: remoteStack.mcpServers || [],
    settings: remoteStack.settings || {},
    metadata: {
      ...remoteStack.metadata,
      installed_from: `commands.com/${stackId}`,
      installed_at: new Date().toISOString()
    }
  };
  
  console.log(chalk.cyan(`Installing: ${stack.name}`));
  console.log(chalk.gray(`By: ${remoteStack.author || 'Unknown'}`));
  console.log(chalk.gray(`Description: ${stack.description}\n`));
  
  // Use the existing restore function to install the stack
  // First, save it as a temporary file
  const tempStackPath = path.join(os.tmpdir(), `remote-stack-${stackId}.json`);
  await fs.writeJson(tempStackPath, stack, { spaces: 2 });
  
  try {
    await restoreStack(tempStackPath, options);
    
    // Track successful installation
    try {
      const apiConfig = getApiConfig();
      await fetch(`${apiConfig.baseUrl}/v1/stacks/${stackId}/install`, {
        method: 'POST',
        headers: {
          'User-Agent': 'claude-stacks-cli/1.0.0'
        }
      });
    } catch (trackingError) {
      // Silently fail tracking - don't block installation
      console.log(chalk.gray('   (Install tracking unavailable)'));
    }
    
    console.log(chalk.green(`\n✅ Successfully installed "${stack.name}" from Commands.com!`));
    console.log(chalk.gray(`   Stack ID: ${stackId}`));
    console.log(chalk.gray(`   Author: ${remoteStack.author || 'Unknown'}`));
    
  } finally {
    // Clean up temp file
    if (await fs.pathExists(tempStackPath)) {
      await fs.remove(tempStackPath);
    }
  }
}

async function exportCurrentStack(options: { name?: string; description?: string; includeGlobal?: boolean; includeClaudeMd?: boolean }): Promise<DeveloperStack> {
  const claudeDir = path.join(os.homedir(), '.claude');
  const currentDir = process.cwd();
  
  // Auto-generate stack name and description from current directory
  const dirName = path.basename(currentDir);
  const stackName = options.name || `${dirName}${options.includeGlobal ? ' Full' : ''} Development Stack`;
  const stackDescription = options.description || `${options.includeGlobal ? 'Full d' : 'Local d'}evelopment stack for ${dirName} project`;
  
  // Try to read package.json or other project files for better description
  let autoDescription = stackDescription;
  const packageJsonPath = path.join(currentDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      if (packageJson.description) {
        autoDescription = options.description || `${packageJson.description} - Development stack`;
      }
    } catch (error) {
      // Ignore package.json parsing errors
    }
  }
  
  const stack: DeveloperStack = {
    name: stackName,
    description: autoDescription,
    version: '1.0.0',
    commands: [],
    agents: [],
    mcpServers: [],
    settings: {},
    metadata: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      exported_from: currentDir
    }
  };

  // Use Maps to ensure uniqueness
  const commandsMap = new Map<string, StackCommand>();
  const agentsMap = new Map<string, StackAgent>();

  // Scan global ~/.claude directory (only if includeGlobal is specified)
  if (options.includeGlobal) {
    const globalCommandsDir = path.join(claudeDir, 'commands');
    if (await fs.pathExists(globalCommandsDir)) {
      const commands = await fs.readdir(globalCommandsDir);
      for (const commandFile of commands.filter(f => f.endsWith('.md'))) {
        const filePath = path.join(globalCommandsDir, commandFile);
        const content = await fs.readFile(filePath, 'utf-8');
        const name = commandFile.replace('.md', '');
        
        commandsMap.set(name, {
          name,
          filePath: `~/.claude/commands/${commandFile}`,
          content,
          description: extractDescriptionFromContent(content)
        });
      }
    }

    // Scan global ~/.claude/agents directory
    const globalAgentsDir = path.join(claudeDir, 'agents');
    if (await fs.pathExists(globalAgentsDir)) {
      const agents = await fs.readdir(globalAgentsDir);
      for (const agentFile of agents.filter(f => f.endsWith('.md'))) {
        const filePath = path.join(globalAgentsDir, agentFile);
        const content = await fs.readFile(filePath, 'utf-8');
        const name = agentFile.replace('.md', '');
        
        agentsMap.set(name, {
          name,
          filePath: `~/.claude/agents/${agentFile}`,
          content,
          description: extractDescriptionFromContent(content)
        });
      }
    }
  }


  // Scan project-local .claude directory if it exists
  const localClaudeDir = path.join(currentDir, '.claude');
  if (await fs.pathExists(localClaudeDir)) {
    // Check for local commands
    const localCommandsDir = path.join(localClaudeDir, 'commands');
    if (await fs.pathExists(localCommandsDir)) {
      const commands = await fs.readdir(localCommandsDir);
      for (const commandFile of commands.filter(f => f.endsWith('.md'))) {
        const filePath = path.join(localCommandsDir, commandFile);
        const content = await fs.readFile(filePath, 'utf-8');
        const name = commandFile.replace('.md', '');
        const localKey = `${name}-local`;
        
        commandsMap.set(localKey, {
          name: `${name} (local)`,
          filePath: `./.claude/commands/${commandFile}`,
          content,
          description: extractDescriptionFromContent(content)
        });
      }
    }

    // Check for local agents
    const localAgentsDir = path.join(localClaudeDir, 'agents');
    if (await fs.pathExists(localAgentsDir)) {
      const agents = await fs.readdir(localAgentsDir);
      for (const agentFile of agents.filter(f => f.endsWith('.md'))) {
        const filePath = path.join(localAgentsDir, agentFile);
        const content = await fs.readFile(filePath, 'utf-8');
        const name = agentFile.replace('.md', '');
        const localKey = `${name}-local`;
        
        agentsMap.set(localKey, {
          name: `${name} (local)`,
          filePath: `./.claude/agents/${agentFile}`,
          content,
          description: extractDescriptionFromContent(content)
        });
      }
    }

    // Check for local settings
    const localSettingsFile = path.join(localClaudeDir, 'settings.local.json');
    if (await fs.pathExists(localSettingsFile)) {
      try {
        const localSettings = await fs.readJson(localSettingsFile);
        stack.settings = { ...stack.settings, ...localSettings };
      } catch (error) {
        console.warn(chalk.yellow('Warning: Could not parse local settings.json'));
      }
    }
  }

  // Read global settings (only if includeGlobal is specified)
  if (options.includeGlobal) {
    const globalSettingsFile = path.join(claudeDir, 'settings.json');
    if (await fs.pathExists(globalSettingsFile)) {
      try {
        const globalSettings = await fs.readJson(globalSettingsFile);
        stack.settings = { ...globalSettings, ...stack.settings };
      } catch (error) {
        console.warn(chalk.yellow('Warning: Could not parse global settings.json'));
      }
    }
  }

  // Extract MCP servers from ~/.claude.json for the current project
  const claudeJsonFile = path.join(os.homedir(), '.claude.json');
  if (await fs.pathExists(claudeJsonFile)) {
    try {
      const claudeJsonContent = await fs.readFile(claudeJsonFile, 'utf-8');
      const mcpServers = extractMcpServersFromClaudeJson(claudeJsonContent, currentDir);
      stack.mcpServers = mcpServers;
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not parse ~/.claude.json for MCP servers'));
    }
  }

  // Read CLAUDE.md files if requested
  if (options.includeClaudeMd) {
    const claudeMd: NonNullable<DeveloperStack['claudeMd']> = {};
    
    // Read global CLAUDE.md
    const globalClaudeMd = path.join(claudeDir, 'CLAUDE.md');
    if (await fs.pathExists(globalClaudeMd)) {
      try {
        const content = await fs.readFile(globalClaudeMd, 'utf-8');
        claudeMd.global = {
          content,
          path: '~/.claude/CLAUDE.md'
        };
      } catch (error) {
        console.warn(chalk.yellow('Warning: Could not read ~/.claude/CLAUDE.md'));
      }
    }
    
    // Read local CLAUDE.md
    const localClaudeMd = path.join(currentDir, '.claude', 'CLAUDE.md');
    if (await fs.pathExists(localClaudeMd)) {
      try {
        const content = await fs.readFile(localClaudeMd, 'utf-8');
        claudeMd.local = {
          content,
          path: './.claude/CLAUDE.md'
        };
      } catch (error) {
        console.warn(chalk.yellow('Warning: Could not read ./.claude/CLAUDE.md'));
      }
    }
    
    // Only add claudeMd if we found at least one file
    if (claudeMd.global || claudeMd.local) {
      stack.claudeMd = claudeMd;
    }
  }

  // Convert Maps to arrays to ensure uniqueness
  stack.commands = Array.from(commandsMap.values());
  stack.agents = Array.from(agentsMap.values());

  return stack;
}

function extractDescriptionFromContent(content: string): string {
  // Try to extract description from markdown frontmatter or first paragraph
  const frontmatterMatch = content.match(/^---\s*\ndescription:\s*(.+)\n/m);
  if (frontmatterMatch) {
    return frontmatterMatch[1].trim().replace(/['"]/g, '');
  }
  
  // Try to get first line after # heading
  const lines = content.split('\n');
  let inContent = false;
  for (const line of lines) {
    if (line.startsWith('#') && !inContent) {
      inContent = true;
      continue;
    }
    if (inContent && line.trim() && !line.startsWith('#')) {
      return line.trim();
    }
  }
  
  return 'No description available';
}

function extractMcpServersFromClaudeJson(jsonContent: string, currentProjectPath: string): StackMcpServer[] {
  const mcpServersMap = new Map<string, StackMcpServer>();
  
  try {
    // The .claude.json file is actually one big JSON object containing project configurations
    const claudeConfig = JSON.parse(jsonContent);
    
    // Look for MCP servers configured for the current project
    if (claudeConfig.projects && typeof claudeConfig.projects === 'object') {
      const projectConfig = claudeConfig.projects[currentProjectPath];
      
      if (projectConfig && typeof projectConfig === 'object') {
        const config = projectConfig as any;
        if (config.mcpServers && typeof config.mcpServers === 'object') {
          const serverEntries = Object.entries(config.mcpServers);
          if (serverEntries.length > 0) {
            for (const [name, serverConfig] of serverEntries) {
              const mcpConfig = serverConfig as any;
              // Only add non-empty server configurations
              if (mcpConfig && (mcpConfig.url || mcpConfig.command)) {
                mcpServersMap.set(name, {
                  name,
                  type: mcpConfig.type || 'unknown',
                  url: mcpConfig.url,
                  command: mcpConfig.command,
                  args: mcpConfig.args,
                  env: mcpConfig.env
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn(chalk.yellow('Warning: Could not parse MCP servers from ~/.claude.json'));
  }
  
  return Array.from(mcpServersMap.values());
}

async function listLocalStacks(): Promise<DeveloperStack[]> {
  const stacks: DeveloperStack[] = [];
  const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
  
  // Check if stacks directory exists
  if (!await fs.pathExists(stacksDir)) {
    return stacks;
  }
  
  // Look for stack files in ~/.claude/stacks/
  const files = await fs.readdir(stacksDir);
  const stackFiles = files.filter(f => f.endsWith('.json'));
  
  for (const stackFile of stackFiles) {
    try {
      const stackPath = path.join(stacksDir, stackFile);
      const stackData = await fs.readJson(stackPath);
      stackData.filePath = stackPath;
      stacks.push(stackData);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not parse stack file ${stackFile}`));
    }
  }

  return stacks;
}

async function restoreStack(stackFilePath: string, options: { overwrite?: boolean; globalOnly?: boolean; localOnly?: boolean; skipClaudeMd?: boolean }): Promise<void> {
  let resolvedPath = stackFilePath;
  
  // If it's just a filename, look in ~/.claude/stacks/
  if (!path.isAbsolute(stackFilePath) && !stackFilePath.includes('/')) {
    const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
    resolvedPath = path.join(stacksDir, stackFilePath);
  }
  
  if (!await fs.pathExists(resolvedPath)) {
    throw new Error(`Stack file not found: ${resolvedPath}`);
  }
  
  const stack: DeveloperStack = await fs.readJson(resolvedPath);
  const claudeDir = path.join(os.homedir(), '.claude');
  const currentDir = process.cwd();
  const localClaudeDir = path.join(currentDir, '.claude');

  console.log(chalk.cyan(`Restoring stack: ${stack.name}`));
  console.log(chalk.gray(`Description: ${stack.description}`));
  console.log(chalk.gray(`Mode: ${options.overwrite ? 'Overwrite' : 'Add/Merge'}`));
  console.log();

  // Restore commands
  if (stack.commands && stack.commands.length > 0 && !options.localOnly) {
    console.log(chalk.cyan.bold('Restoring Commands:'));
    const commandsDir = path.join(claudeDir, 'commands');
    await fs.ensureDir(commandsDir);

    for (const command of stack.commands) {
      const spinner = ora(`Restoring command: ${command.name}`).start();
      try {
        const filename = `${command.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/local$/, '')}.md`;
        const filepath = path.join(commandsDir, filename);
        
        // Check if file exists and handle overwrite/add logic
        if (await fs.pathExists(filepath) && !options.overwrite) {
          spinner.warn(`Command already exists (skipped): ${chalk.cyan(command.name)}`);
          continue;
        }
        
        await fs.writeFile(filepath, command.content);
        spinner.succeed(`Command restored: ${chalk.cyan(command.name)}`);
      } catch (error) {
        spinner.fail(`Failed to restore command: ${command.name}`);
        console.error(chalk.red('  Error:'), error instanceof Error ? error.message : String(error));
      }
    }
    console.log();
  }

  // Restore agents
  if (stack.agents && stack.agents.length > 0 && !options.localOnly) {
    console.log(chalk.green.bold('Restoring Agents:'));
    const agentsDir = path.join(claudeDir, 'agents');
    await fs.ensureDir(agentsDir);

    for (const agent of stack.agents) {
      const spinner = ora(`Restoring agent: ${agent.name}`).start();
      try {
        const filename = `${agent.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/local$/, '')}.md`;
        const filepath = path.join(agentsDir, filename);
        
        if (await fs.pathExists(filepath) && !options.overwrite) {
          spinner.warn(`Agent already exists (skipped): ${chalk.green(agent.name)}`);
          continue;
        }
        
        await fs.writeFile(filepath, agent.content);
        spinner.succeed(`Agent restored: ${chalk.green(agent.name)}`);
      } catch (error) {
        spinner.fail(`Failed to restore agent: ${agent.name}`);
        console.error(chalk.red('  Error:'), error instanceof Error ? error.message : String(error));
      }
    }
    console.log();
  }


  // Restore local project settings
  if (stack.settings && !options.globalOnly) {
    console.log(chalk.blue.bold('Restoring Local Settings:'));
    const spinner = ora('Creating local settings').start();
    try {
      await fs.ensureDir(localClaudeDir);
      const localSettingsPath = path.join(localClaudeDir, 'settings.local.json');
      
      let localSettings = {};
      if (await fs.pathExists(localSettingsPath) && !options.overwrite) {
        // Merge with existing settings
        localSettings = await fs.readJson(localSettingsPath);
      }
      
      // Merge stack settings (stack takes precedence)
      const mergedSettings = { ...localSettings, ...stack.settings };
      
      await fs.writeFile(localSettingsPath, JSON.stringify(mergedSettings, null, 2));
      spinner.succeed(`Local settings ${options.overwrite ? 'overwritten' : 'merged'}: .claude/settings.local.json`);
    } catch (error) {
      spinner.fail('Failed to restore local settings');
      console.error(chalk.red('  Error:'), error instanceof Error ? error.message : String(error));
    }
    console.log();
  }

  // Handle MCP servers based on stack source (local vs remote)
  if (stack.mcpServers && stack.mcpServers.length > 0) {
    const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
    const isLocalStack = resolvedPath.startsWith(stacksDir);
    
    if (isLocalStack) {
      // Local stack (from ~/.claude/stacks/): Direct .claude.json modification
      await installMcpServersDirectly(stack.mcpServers);
    } else {
      // Remote stack: Validate dependencies and provide scripts
      await handleRemoteMcpServers(stack.mcpServers);
    }
  }

  // Restore CLAUDE.md files
  if (stack.claudeMd && !options.skipClaudeMd) {
    console.log(chalk.blue.bold('Restoring CLAUDE.md Files:'));
    
    // Restore global CLAUDE.md (with confirmation)
    if (stack.claudeMd.global && !options.localOnly) {
      const globalClaudeMdPath = path.join(claudeDir, 'CLAUDE.md');
      
      if (await fs.pathExists(globalClaudeMdPath) && !options.overwrite) {
        console.log(chalk.yellow('⚠️  Global CLAUDE.md already exists'));
        console.log(chalk.gray('  Use --overwrite to replace existing global CLAUDE.md'));
        console.log(chalk.gray('  (This affects all Claude Code projects)'));
      } else {
        const spinner = ora('Restoring global CLAUDE.md').start();
        try {
          await fs.ensureDir(claudeDir);
          await fs.writeFile(globalClaudeMdPath, stack.claudeMd.global.content);
          spinner.succeed(`Global CLAUDE.md ${options.overwrite ? 'overwritten' : 'restored'}: ~/.claude/CLAUDE.md`);
        } catch (error) {
          spinner.fail('Failed to restore global CLAUDE.md');
          console.error(chalk.red('  Error:'), error instanceof Error ? error.message : String(error));
        }
      }
    }
    
    // Restore local CLAUDE.md
    if (stack.claudeMd.local && !options.globalOnly) {
      const localClaudeMdPath = path.join(localClaudeDir, 'CLAUDE.md');
      const spinner = ora('Restoring local CLAUDE.md').start();
      try {
        await fs.ensureDir(localClaudeDir);
        
        if (await fs.pathExists(localClaudeMdPath) && !options.overwrite) {
          spinner.warn('Local CLAUDE.md already exists (skipped)');
          console.log(chalk.gray('  Use --overwrite to replace existing local CLAUDE.md'));
        } else {
          await fs.writeFile(localClaudeMdPath, stack.claudeMd.local.content);
          spinner.succeed(`Local CLAUDE.md ${options.overwrite ? 'overwritten' : 'restored'}: ./.claude/CLAUDE.md`);
        }
      } catch (error) {
        spinner.fail('Failed to restore local CLAUDE.md');
        console.error(chalk.red('  Error:'), error instanceof Error ? error.message : String(error));
      }
    }
    console.log();
  }

  // Create a restore summary
  console.log(chalk.blue.bold('Restore Summary:'));
  console.log(chalk.gray(`✓ Commands: ${stack.commands?.length || 0} items`));
  console.log(chalk.gray(`✓ Agents: ${stack.agents?.length || 0} items`));
  console.log(chalk.gray(`✓ MCP Servers: ${stack.mcpServers?.length || 0} configurations`));
  console.log(chalk.gray(`✓ Settings: ${stack.settings ? 'Restored' : 'None'}`));
  
  if (stack.claudeMd) {
    const claudeMdCount = (stack.claudeMd.global ? 1 : 0) + (stack.claudeMd.local ? 1 : 0);
    console.log(chalk.gray(`✓ CLAUDE.md: ${claudeMdCount} file${claudeMdCount > 1 ? 's' : ''}`));
  }
}

async function installLocalStack(stackFilePath: string): Promise<void> {
  if (!await fs.pathExists(stackFilePath)) {
    throw new Error(`Stack file not found: ${stackFilePath}`);
  }

  const stack: DeveloperStack = await fs.readJson(stackFilePath);
  const claudeDir = path.join(os.homedir(), '.claude');

  console.log(chalk.cyan(`Installing stack: ${stack.name}`));
  console.log(chalk.gray(`Description: ${stack.description}\n`));

  // Install commands
  if (stack.commands && stack.commands.length > 0) {
    console.log(chalk.cyan.bold('Installing Commands:'));
    const commandsDir = path.join(claudeDir, 'commands');
    await fs.ensureDir(commandsDir);

    for (const command of stack.commands) {
      const spinner = ora(`Installing command: ${command.name}`).start();
      try {
        const filename = `${command.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.md`;
        const filepath = path.join(commandsDir, filename);
        await fs.writeFile(filepath, command.content);
        spinner.succeed(`Command installed: ${chalk.cyan(command.name)}`);
      } catch (error) {
        spinner.fail(`Failed to install command: ${command.name}`);
        console.error(chalk.red('  Error:'), error instanceof Error ? error.message : String(error));
      }
    }
    console.log();
  }

  // Install agents
  if (stack.agents && stack.agents.length > 0) {
    console.log(chalk.green.bold('Installing Agents:'));
    const agentsDir = path.join(claudeDir, 'agents');
    await fs.ensureDir(agentsDir);

    for (const agent of stack.agents) {
      const spinner = ora(`Installing agent: ${agent.name}`).start();
      try {
        const filename = `${agent.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.md`;
        const filepath = path.join(agentsDir, filename);
        await fs.writeFile(filepath, agent.content);
        spinner.succeed(`Agent installed: ${chalk.green(agent.name)}`);
      } catch (error) {
        spinner.fail(`Failed to install agent: ${agent.name}`);
        console.error(chalk.red('  Error:'), error instanceof Error ? error.message : String(error));
      }
    }
    console.log();
  }


  // Handle MCP servers (installLocalStack is always for local stacks)
  if (stack.mcpServers && stack.mcpServers.length > 0) {
    await installMcpServersDirectly(stack.mcpServers);
  }
}

async function cleanClaudeJson(dryRun: boolean): Promise<void> {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  
  if (!await fs.pathExists(claudeJsonPath)) {
    console.log(chalk.yellow('No ~/.claude.json file found'));
    return;
  }
  
  try {
    const content = await fs.readFile(claudeJsonPath, 'utf-8');
    const claudeConfig = JSON.parse(content);
    
    if (!claudeConfig.projects || typeof claudeConfig.projects !== 'object') {
      console.log(chalk.yellow('No "projects" section found in .claude.json'));
      return;
    }
    
    const allProjects = Object.keys(claudeConfig.projects);
    const existingProjects: string[] = [];
    const missingProjects: string[] = [];
    
    console.log(chalk.gray(`Checking ${allProjects.length} project paths...\n`));
    
    // Check which directories exist
    for (const projectPath of allProjects) {
      const spinner = ora(`Checking: ${projectPath}`).start();
      
      if (await fs.pathExists(projectPath)) {
        existingProjects.push(projectPath);
        spinner.succeed(chalk.green(`✓ ${projectPath}`));
      } else {
        missingProjects.push(projectPath);
        spinner.fail(chalk.red(`✗ ${projectPath}`));
      }
    }
    
    console.log();
    console.log(chalk.green(`Found ${existingProjects.length} existing directories`));
    console.log(chalk.red(`Found ${missingProjects.length} missing directories`));
    
    if (missingProjects.length === 0) {
      console.log(chalk.green('\n✅ All project directories exist - nothing to clean!'));
      return;
    }
    
    console.log(chalk.red.bold(`\nDirectories to remove:`));
    missingProjects.forEach((projectPath, index) => {
      const mcpCount = claudeConfig.projects[projectPath]?.mcpServers ? 
        Object.keys(claudeConfig.projects[projectPath].mcpServers).length : 0;
      console.log(chalk.red(`${index + 1}. ${projectPath} (${mcpCount} MCP servers)`));
    });
    
    if (dryRun) {
      console.log(chalk.yellow('\n🔍 DRY RUN - No changes made'));
      console.log(chalk.gray('Run without --dry-run to actually remove these entries'));
      return;
    }
    
    // Create new config without missing projects
    const cleanedConfig = {
      ...claudeConfig,
      projects: {}
    };
    
    // Keep only existing projects
    for (const projectPath of existingProjects) {
      cleanedConfig.projects[projectPath] = claudeConfig.projects[projectPath];
    }
    
    // Write back to file
    await fs.writeFile(claudeJsonPath, JSON.stringify(cleanedConfig, null, 2));
    
    // Calculate file size change
    const newContent = JSON.stringify(cleanedConfig, null, 2);
    const oldSizeKB = Math.round(content.length / 1024 * 100) / 100;
    const newSizeKB = Math.round(newContent.length / 1024 * 100) / 100;
    const savedKB = Math.round((oldSizeKB - newSizeKB) * 100) / 100;
    
    console.log(chalk.green.bold('\n✅ Cleanup complete!'));
    console.log(chalk.gray(`Removed ${missingProjects.length} project entries`));
    console.log(chalk.gray(`File size: ${oldSizeKB} KB → ${newSizeKB} KB (saved ${savedKB} KB)`));
    
  } catch (error) {
    throw new Error(`Failed to clean ~/.claude.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function showStackInfo(stackFile?: string, showCurrent: boolean = false): Promise<void> {
  let stack: DeveloperStack;
  
  if (showCurrent) {
    // Show current directory environment without exporting
    console.log(chalk.cyan('🎯 Current Directory Environment'));
    console.log(chalk.gray(`Path: ${process.cwd()}\n`));
    
    stack = await exportCurrentStack({ includeGlobal: true });
  } else {
    // Load from stack file
    let resolvedPath = stackFile;
    
    if (!stackFile) {
      // Look for default stack file in ~/.claude/stacks/
      const currentDir = process.cwd();
      const dirName = path.basename(currentDir);
      const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
      resolvedPath = path.join(stacksDir, `${dirName}-stack.json`);
    } else if (!path.isAbsolute(stackFile) && !stackFile.includes('/')) {
      // If it's just a filename, look in ~/.claude/stacks/
      const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
      resolvedPath = path.join(stacksDir, stackFile);
    } else {
      resolvedPath = path.resolve(stackFile);
    }
    
    if (!await fs.pathExists(resolvedPath)) {
      throw new Error(`Stack file not found: ${resolvedPath}`);
    }
    
    stack = await fs.readJson(resolvedPath);
    
    console.log(chalk.cyan.bold(`📦 ${stack.name}`));
    if (stack.metadata?.exported_from) {
      console.log(chalk.gray(`Exported from: ${stack.metadata.exported_from}`));
    }
    if (stack.metadata?.created_at) {
      const date = new Date(stack.metadata.created_at);
      console.log(chalk.gray(`Created: ${date.toLocaleDateString()}`));
    }
    console.log();
  }
  
  console.log(chalk.gray(`Description: ${stack.description}`));
  console.log();
  
  // Categorize components by global vs local
  const global = {
    commands: (stack.commands || []).filter(c => c.filePath?.startsWith('~')),
    agents: (stack.agents || []).filter(a => a.filePath?.startsWith('~'))
  };
  
  const local = {
    commands: (stack.commands || []).filter(c => c.filePath?.startsWith('.')),
    agents: (stack.agents || []).filter(a => a.filePath?.startsWith('.'))
  };
  
  // Show global components
  if (global.commands.length > 0 || global.agents.length > 0 || stack.claudeMd?.global) {
    console.log(chalk.cyan.bold('GLOBAL (~/.claude/):'));
    
    if (global.commands.length > 0) {
      console.log(chalk.blue(`  Commands (${global.commands.length}):`));
      global.commands.forEach(cmd => {
        const description = cmd.description || 'No description available';
        console.log(chalk.green(`    ✓ ${cmd.name}`), chalk.gray(`- ${description}`));
      });
      console.log();
    }
    
    if (global.agents.length > 0) {
      console.log(chalk.blue(`  Agents (${global.agents.length}):`));
      global.agents.forEach(agent => {
        const description = agent.description || 'No description available';
        console.log(chalk.green(`    ✓ ${agent.name}`), chalk.gray(`- ${description}`));
      });
      console.log();
    }
    
    // Show global CLAUDE.md
    if (stack.claudeMd?.global) {
      console.log(chalk.blue(`  CLAUDE.md:`));
      console.log(chalk.green(`    ✓ ${stack.claudeMd.global.path}`), chalk.gray(`- Global project instructions`));
      console.log();
    }
  }
  
  // Show local components
  if (local.commands.length > 0 || local.agents.length > 0 || (stack.mcpServers && stack.mcpServers.length > 0) || stack.claudeMd?.local) {
    console.log(chalk.cyan.bold('LOCAL (./.claude/):'));
    
    if (local.commands.length > 0) {
      console.log(chalk.blue(`  Commands (${local.commands.length}):`));
      local.commands.forEach(cmd => {
        const description = cmd.description || 'No description available';
        console.log(chalk.green(`    ✓ ${cmd.name}`), chalk.gray(`- ${description}`));
      });
      console.log();
    }
    
    if (local.agents.length > 0) {
      console.log(chalk.blue(`  Agents (${local.agents.length}):`));
      local.agents.forEach(agent => {
        const description = agent.description || 'No description available';
        console.log(chalk.green(`    ✓ ${agent.name}`), chalk.gray(`- ${description}`));
      });
      console.log();
    }
    
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      console.log(chalk.blue(`  MCP Servers (${stack.mcpServers.length}):`));
      stack.mcpServers.forEach(mcp => {
        let serverInfo = mcp.name;
        if (mcp.type) serverInfo += ` (${mcp.type})`;
        if (mcp.command) serverInfo += ` - ${mcp.command}`;
        else if (mcp.url) serverInfo += ` - ${mcp.url}`;
        
        console.log(chalk.green(`    ✓ ${serverInfo}`));
      });
      console.log();
    }
    
    // Show local CLAUDE.md
    if (stack.claudeMd?.local) {
      console.log(chalk.blue(`  CLAUDE.md:`));
      console.log(chalk.green(`    ✓ ${stack.claudeMd.local.path}`), chalk.gray(`- Local project instructions`));
      console.log();
    }
  }
  
  // Show settings info
  if (stack.settings && Object.keys(stack.settings).length > 0) {
    console.log(chalk.cyan.bold('SETTINGS:'));
    Object.entries(stack.settings).forEach(([key, value]) => {
      if (typeof value === 'object') {
        console.log(chalk.blue(`  ${key}:`), chalk.gray(JSON.stringify(value, null, 2).replace(/\n/g, '\n    ')));
      } else {
        console.log(chalk.blue(`  ${key}:`), chalk.gray(String(value)));
      }
    });
    console.log();
  }
  
  // Show summary
  const totalCommands = (stack.commands || []).length;
  const totalAgents = (stack.agents || []).length;
  const totalMcpServers = (stack.mcpServers || []).length;
  const totalComponents = totalCommands + totalAgents + totalMcpServers;
  
  console.log(chalk.cyan.bold('SUMMARY:'));
  console.log(chalk.gray(`  Total components: ${totalComponents}`));
  console.log(chalk.gray(`  Commands: ${totalCommands} (${global.commands.length} global, ${local.commands.length} local)`));
  console.log(chalk.gray(`  Agents: ${totalAgents} (${global.agents.length} global, ${local.agents.length} local)`));
  console.log(chalk.gray(`  MCP Servers: ${totalMcpServers}`));
  
  if (stack.settings && Object.keys(stack.settings).length > 0) {
    console.log(chalk.gray(`  Settings: ${Object.keys(stack.settings).length} entries`));
  }
  
  if (!showCurrent && !stackFile) {
    console.log();
    console.log(chalk.blue('Install this stack with:'));
    const currentDir = process.cwd();
    const dirName = path.basename(currentDir);
    console.log(chalk.cyan(`  claude-stacks restore ${dirName}-stack.json`));
  }
}

async function installMcpServersDirectly(mcpServers: StackMcpServer[]): Promise<void> {
  console.log(chalk.blue.bold('MCP Servers Configuration:'));
  
  try {
    const claudeJsonPath = path.join(os.homedir(), '.claude.json');
    let claudeConfig: any = {};
    
    // Read existing .claude.json
    if (await fs.pathExists(claudeJsonPath)) {
      const content = await fs.readFile(claudeJsonPath, 'utf-8');
      claudeConfig = JSON.parse(content);
    }
    
    // Initialize projects structure if needed
    if (!claudeConfig.projects) {
      claudeConfig.projects = {};
    }
    
    const currentProjectPath = process.cwd();
    if (!claudeConfig.projects[currentProjectPath]) {
      claudeConfig.projects[currentProjectPath] = {};
    }
    if (!claudeConfig.projects[currentProjectPath].mcpServers) {
      claudeConfig.projects[currentProjectPath].mcpServers = {};
    }
    
    const existingMcpServers = claudeConfig.projects[currentProjectPath].mcpServers || {};
    const newServers: StackMcpServer[] = [];
    const existingServers: string[] = [];
    const updatedServers: StackMcpServer[] = [];
    
    // Check which servers already exist and which are new/different
    for (const mcpServer of mcpServers) {
      const existingServer = existingMcpServers[mcpServer.name];
      
      if (!existingServer) {
        // Completely new server
        newServers.push(mcpServer);
      } else {
        // Check if configuration is different
        const configMatches = 
          existingServer.type === mcpServer.type &&
          existingServer.url === mcpServer.url &&
          existingServer.command === mcpServer.command &&
          JSON.stringify(existingServer.args || []) === JSON.stringify(mcpServer.args || []) &&
          JSON.stringify(existingServer.env || {}) === JSON.stringify(mcpServer.env || {});
        
        if (!configMatches) {
          // Configuration changed
          updatedServers.push(mcpServer);
        } else {
          // Already exists with same configuration
          existingServers.push(mcpServer.name);
        }
      }
    }
    
    // Show status of existing servers
    if (existingServers.length > 0) {
      console.log(chalk.green(`✅ Already configured (${existingServers.length}):`));
      existingServers.forEach(serverName => {
        const serverConfig = existingMcpServers[serverName];
        console.log(chalk.gray(`  ✓ ${serverName} (${serverConfig.type})`));
      });
    }
    
    // Configure new servers
    if (newServers.length > 0) {
      console.log(chalk.cyan(`🔧 Auto-configuring new MCP servers (${newServers.length})...`));
      
      for (const mcpServer of newServers) {
        claudeConfig.projects[currentProjectPath].mcpServers[mcpServer.name] = {
          type: mcpServer.type,
          ...(mcpServer.url && { url: mcpServer.url }),
          ...(mcpServer.command && { command: mcpServer.command }),
          ...(mcpServer.args && { args: mcpServer.args }),
          ...(mcpServer.env && { env: mcpServer.env })
        };
      }
      
      // Write back to .claude.json
      await fs.writeFile(claudeJsonPath, JSON.stringify(claudeConfig, null, 2));
      
      console.log(chalk.green(`✅ New MCP servers configured successfully!`));
      newServers.forEach(server => {
        console.log(chalk.green(`  + ${server.name} (${server.type})`));
      });
    }
    
    // Update changed servers
    if (updatedServers.length > 0) {
      console.log(chalk.yellow(`🔄 Updating changed MCP servers (${updatedServers.length})...`));
      
      for (const mcpServer of updatedServers) {
        claudeConfig.projects[currentProjectPath].mcpServers[mcpServer.name] = {
          type: mcpServer.type,
          ...(mcpServer.url && { url: mcpServer.url }),
          ...(mcpServer.command && { command: mcpServer.command }),
          ...(mcpServer.args && { args: mcpServer.args }),
          ...(mcpServer.env && { env: mcpServer.env })
        };
      }
      
      // Write back to .claude.json
      await fs.writeFile(claudeJsonPath, JSON.stringify(claudeConfig, null, 2));
      
      console.log(chalk.green(`✅ MCP servers updated successfully!`));
      updatedServers.forEach(server => {
        console.log(chalk.yellow(`  ↻ ${server.name} (${server.type})`));
      });
    }
    
    // Show summary if no changes needed
    if (newServers.length === 0 && updatedServers.length === 0 && existingServers.length > 0) {
      console.log(chalk.green('✅ All MCP servers are already configured correctly!'));
    }
    
    console.log();
    
  } catch (error) {
    console.error(chalk.red('Failed to configure MCP servers automatically:'), error instanceof Error ? error.message : String(error));
    console.log(chalk.yellow('Falling back to manual installation instructions...'));
    await showManualMcpInstructions(mcpServers);
  }
}

async function handleRemoteMcpServers(mcpServers: StackMcpServer[]): Promise<void> {
  console.log(chalk.blue.bold('MCP Servers Configuration:'));
  
  // Check for required dependencies
  const dependencies = new Set<string>();
  const missingDeps: string[] = [];
  
  for (const server of mcpServers) {
    if (server.command) {
      dependencies.add(server.command);
    }
  }
  
  // Validate dependencies
  for (const dep of dependencies) {
    try {
      execSync(`which ${dep}`, { stdio: 'ignore' });
    } catch {
      missingDeps.push(dep);
    }
  }
  
  if (missingDeps.length > 0) {
    console.log(chalk.yellow('⚠️  Missing dependencies detected:'));
    missingDeps.forEach(dep => {
      console.log(chalk.red(`  ✗ ${dep} not found`));
    });
    console.log();
    
    // Generate installation script
    await generateMcpInstallationScript(mcpServers, missingDeps);
  } else {
    console.log(chalk.green('✅ All dependencies available'));
    
    // Ask user if they want auto-installation or manual commands
    console.log(chalk.blue('Choose MCP server installation method:'));
    console.log(chalk.gray('1. Auto-configure (modifies ~/.claude.json)'));
    console.log(chalk.gray('2. Show manual commands'));
    console.log();
    
    // For now, default to manual (could add inquirer prompt later)
    await showManualMcpInstructions(mcpServers);
  }
}

async function showManualMcpInstructions(mcpServers: StackMcpServer[]): Promise<void> {
  console.log(chalk.yellow('Run these commands to configure MCP servers for this project:\n'));
  
  for (const mcpServer of mcpServers) {
    if (mcpServer.type === 'http') {
      console.log(chalk.cyan(`claude mcp add --transport http ${mcpServer.name} ${mcpServer.url}`));
    } else if (mcpServer.type === 'stdio' && mcpServer.command) {
      const args = mcpServer.args ? ` ${mcpServer.args.join(' ')}` : '';
      console.log(chalk.cyan(`claude mcp add --transport stdio ${mcpServer.name} -- ${mcpServer.command}${args}`));
    } else if (mcpServer.type === 'sse') {
      console.log(chalk.cyan(`claude mcp add --transport sse ${mcpServer.name} ${mcpServer.url}`));
    }
  }
  console.log();
}

async function generateMcpInstallationScript(mcpServers: StackMcpServer[], missingDeps: string[]): Promise<void> {
  const scriptPath = path.join(process.cwd(), 'install-mcp-setup.sh');
  
  let script = '#!/bin/bash\n\n';
  script += '# MCP Server Installation Script\n';
  script += '# Generated by claude-stacks\n\n';
  script += 'echo "🔧 Installing MCP server dependencies and configuration..."\n\n';
  
  // Add dependency installation
  script += '# Install missing dependencies\n\n';
  
  if (missingDeps.includes('npx') || missingDeps.includes('node')) {
    script += '# Install Node.js (includes npx)\n';
    script += 'if ! command -v node &> /dev/null; then\n';
    script += '  echo "Installing Node.js..."\n';
    script += '  # macOS\n';
    script += '  if [[ "$OSTYPE" == "darwin"* ]]; then\n';
    script += '    if command -v brew &> /dev/null; then\n';
    script += '      brew install node\n';
    script += '    else\n';
    script += '      echo "Please install Homebrew first: https://brew.sh/"\n';
    script += '      exit 1\n';
    script += '    fi\n';
    script += '  # Linux\n';
    script += '  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then\n';
    script += '    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -\n';
    script += '    sudo apt-get install -y nodejs\n';
    script += '  fi\n';
    script += 'fi\n\n';
  }
  
  if (missingDeps.includes('uvx')) {
    script += '# Install uv (includes uvx)\n';
    script += 'if ! command -v uvx &> /dev/null; then\n';
    script += '  echo "Installing uv..."\n';
    script += '  curl -LsSf https://astral.sh/uv/install.sh | sh\n';
    script += '  source $HOME/.cargo/env\n';
    script += 'fi\n\n';
  }
  
  if (missingDeps.includes('docker')) {
    script += '# Install Docker\n';
    script += 'if ! command -v docker &> /dev/null; then\n';
    script += '  echo "Installing Docker..."\n';
    script += '  # macOS\n';
    script += '  if [[ "$OSTYPE" == "darwin"* ]]; then\n';
    script += '    if command -v brew &> /dev/null; then\n';
    script += '      brew install --cask docker\n';
    script += '      echo "Please start Docker Desktop application"\n';
    script += '    else\n';
    script += '      echo "Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"\n';
    script += '    fi\n';
    script += '  # Linux\n';
    script += '  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then\n';
    script += '    curl -fsSL https://get.docker.com -o get-docker.sh\n';
    script += '    sudo sh get-docker.sh\n';
    script += '    sudo usermod -aG docker $USER\n';
    script += '    echo "Please log out and back in for Docker permissions"\n';
    script += '  fi\n';
    script += 'fi\n\n';
  }
  
  // Add MCP server configuration commands
  script += 'echo "Configuring MCP servers..."\n\n';
  for (const mcpServer of mcpServers) {
    if (mcpServer.type === 'http') {
      script += `claude mcp add --transport http ${mcpServer.name} ${mcpServer.url}\n`;
    } else if (mcpServer.type === 'stdio' && mcpServer.command) {
      const args = mcpServer.args ? ` ${mcpServer.args.join(' ')}` : '';
      script += `claude mcp add --transport stdio ${mcpServer.name} -- ${mcpServer.command}${args}\n`;
    } else if (mcpServer.type === 'sse') {
      script += `claude mcp add --transport sse ${mcpServer.name} ${mcpServer.url}\n`;
    }
  }
  
  // Add generic dependency installation for unknown commands
  const knownDeps = ['npx', 'node', 'uvx', 'docker'];
  const unknownDeps = missingDeps.filter(dep => !knownDeps.includes(dep));
  
  if (unknownDeps.length > 0) {
    script += '# Install other missing dependencies\n';
    for (const dep of unknownDeps) {
      script += `# Please install ${dep} manually\n`;
      script += `echo "Please install ${dep} and ensure it's in your PATH"\n`;
      script += `echo "Then re-run this script"\n`;
      script += `if ! command -v ${dep} &> /dev/null; then\n`;
      script += `  echo "❌ ${dep} is still missing - please install it manually"\n`;
      script += `  exit 1\n`;
      script += `fi\n\n`;
    }
  }
  
  script += '\necho "✅ MCP setup complete!"\n';
  
  // Write script
  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, 0o755); // Make executable
  
  console.log(chalk.green(`📝 Generated installation script: ${scriptPath}`));
  console.log(chalk.blue('To install dependencies and configure MCP servers:'));
  console.log(chalk.cyan(`  bash ${scriptPath}`));
  console.log();
  console.log(chalk.yellow('Or install dependencies manually and run these commands:'));
  await showManualMcpInstructions(mcpServers);
}

// CLI setup
program
  .name('claude-stacks')
  .description('Share your Claude Code environment in seconds')
  .version('1.0.0');

// Main commands - stack management is the primary feature
program
  .command('export')
  .option('--name <name>', 'Override the default stack name (derived from directory)')
  .option('--description <description>', 'Override the default description')
  .option('--include-global', 'Include global ~/.claude/ configurations (default: local-only)')
  .option('--include-claude-md', 'Include CLAUDE.md files in the stack')
  .description('Export current development environment as a stack (local project configs by default)')
  .action(async (options) => {
    console.log(chalk.blue.bold('📤 Exporting Current Development Stack\n'));
    
    try {
      const stack = await exportCurrentStack(options);
      const stackContent = JSON.stringify(stack, null, 2);
      
      // Save to ~/.claude/stacks/ directory
      const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
      await fs.ensureDir(stacksDir);
      
      const fileName = `${path.basename(process.cwd())}${options.includeGlobal ? '-full' : ''}-stack.json`;
      const stackPath = path.join(stacksDir, fileName);
      await fs.writeFile(stackPath, stackContent);
      
      console.log(chalk.green.bold('✅ Stack exported successfully!'));
      console.log(chalk.gray(`  File: ~/.claude/stacks/${fileName}`));
      console.log(chalk.gray(`  Components: ${(stack.commands?.length || 0) + (stack.agents?.length || 0)} items`));
      console.log(chalk.gray(`  MCP Servers: ${stack.mcpServers?.length || 0} items`));
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('restore')
  .argument('<stack-file>', 'Path to stack JSON file to restore')
  .option('--overwrite', 'Overwrite existing files (default: add/merge)')
  .option('--global-only', 'Only restore to global ~/.claude (skip local project files)')
  .option('--local-only', 'Only restore to local ./.claude (skip global files)')
  .option('--skip-claude-md', 'Skip restoring CLAUDE.md files')
  .description('Restore a development stack to the current project')
  .action(async (stackFile: string, options: { overwrite?: boolean; globalOnly?: boolean; localOnly?: boolean; skipClaudeMd?: boolean }) => {
    console.log(chalk.blue.bold('🔄 Restoring Development Stack\n'));
    
    try {
      await restoreStack(stackFile, options);
      console.log(chalk.green.bold('\n✅ Stack restoration complete!'));
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('publish')
  .argument('[stack-file]', 'Path to stack JSON file (defaults to current directory stack)')
  .option('--public', 'Make the stack publicly discoverable')
  .option('--description <description>', 'Override stack description')
  .option('--tags <tags>', 'Comma-separated tags for the stack')
  .description('Publish a development stack to Commands.com marketplace')
  .action(async (stackFile: string, options: { public?: boolean; description?: string; tags?: string }) => {
    console.log(chalk.blue.bold('🚀 Publishing Development Stack\n'));
    
    try {
      await publishStack(stackFile, options);
      console.log(chalk.green.bold('\n✅ Stack published successfully!'));
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('browse')
  .option('--category <category>', 'Filter by category (frontend, backend, fullstack, etc.)')
  .option('--search <search>', 'Search stacks by name or description')
  .option('--my-stacks', 'Show only your published stacks')
  .description('Browse and discover published stacks from the community')
  .action(async (options: { category?: string; search?: string; myStacks?: boolean }) => {
    console.log(chalk.blue.bold('🔍 Browsing Development Stacks\n'));
    
    try {
      await browseStacks(options);
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('install-remote')
  .argument('<stack-id>', 'Stack ID from Commands.com marketplace')
  .option('--overwrite', 'Overwrite existing files (default: add/merge)')
  .option('--global-only', 'Only install to global ~/.claude (skip local project files)')
  .option('--local-only', 'Only install to local ./.claude (skip global files)')
  .option('--skip-claude-md', 'Skip restoring CLAUDE.md files')
  .description('Install a development stack from Commands.com marketplace')
  .action(async (stackId: string, options: { overwrite?: boolean; globalOnly?: boolean; localOnly?: boolean; skipClaudeMd?: boolean }) => {
    console.log(chalk.blue.bold('📦 Installing Stack from Commands.com\n'));
    
    try {
      await installRemoteStack(stackId, options);
      console.log(chalk.green.bold('\n✅ Stack installation complete!'));
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all stacks in ~/.claude/stacks/ available for restoration')
  .action(async () => {
    console.log(chalk.blue.bold('📋 Available Development Stacks\n'));
    
    try {
      const stacks = await listLocalStacks();
      
      if (stacks.length === 0) {
        console.log(chalk.yellow('No stacks found in ~/.claude/stacks/'));
        console.log(chalk.gray('Export your first stack with:'));
        console.log(chalk.gray('  claude-stacks export'));
        return;
      }
      
      console.log(chalk.gray(`Found ${stacks.length} stack(s) in ~/.claude/stacks/\n`));
      
      stacks.forEach((stack, index) => {
        const filename = path.basename(stack.filePath || '');
        console.log(chalk.cyan.bold(`${index + 1}. ${stack.name}`));
        console.log(chalk.gray(`   Description: ${stack.description}`));
        console.log(chalk.gray(`   File: ${filename}`));
        console.log(chalk.gray(`   Components: ${(stack.commands?.length || 0) + (stack.agents?.length || 0)} items`));
        console.log(chalk.gray(`   Created: ${new Date(stack.metadata?.created_at || Date.now()).toLocaleDateString()}`));
        console.log(chalk.blue(`   Restore: claude-stacks restore ${filename}`));
        console.log();
      });
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('info')
  .argument('[stack-file]', 'Path to stack JSON file (defaults to current directory stack)')
  .option('--current', 'Show info for current directory environment (without exporting)')
  .description('Show detailed information about a stack or current environment')
  .action(async (stackFile: string, options: { current?: boolean }) => {
    console.log(chalk.blue.bold('📋 Stack Information\n'));
    
    try {
      await showStackInfo(stackFile, options.current || false);
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('delete')
  .argument('<stack-id>', 'Stack ID to delete from Commands.com marketplace')
  .description('Delete a published stack from Commands.com marketplace')
  .action(async (stackId: string) => {
    console.log(chalk.blue.bold('🗑️ Deleting Stack from Commands.com\n'));
    
    try {
      await deleteStack(stackId);
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('clean')
  .option('--dry-run', 'Show what would be removed without making changes')
  .description('Remove project entries for directories that no longer exist')
  .action(async (options: { dryRun?: boolean }) => {
    console.log(chalk.blue.bold('🧹 Cleaning ~/.claude.json\n'));
    
    try {
      await cleanClaudeJson(options.dryRun || false);
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();