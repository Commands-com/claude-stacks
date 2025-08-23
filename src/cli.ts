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

interface CommandsComAsset {
  id: string;
  name: string;
  description: string;
  type: 'command' | 'agent' | 'prompt';
  content: string;
  documentation?: string;
}

interface DeveloperStack {
  name: string;
  description: string;
  version: string;
  commands?: StackCommand[];
  agents?: StackAgent[];
  mcpServers?: StackMcpServer[];
  settings?: StackSettings;
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
    // Look for stack file in current directory
    const currentDir = process.cwd();
    const dirName = path.basename(currentDir);
    const defaultStackFile = `${dirName}-stack.json`;
    stackPath = path.join(currentDir, defaultStackFile);
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
    tags: tags,
    public: options.public || false,
    metadata: {
      ...stack.metadata,
      cli_version: '1.0.0',
      published_at: new Date().toISOString()
    }
  };
  
  console.log(chalk.blue('📤 Uploading stack to Commands.com...'));
  
  // Upload to Commands.com API
  const response = await fetch('https://api.commands.com/v1/stacks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'claude-stacks-cli/1.0.0'
    },
    body: JSON.stringify(stackPayload)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Publishing failed: ${response.statusText}\n${error}`);
  }
  
  const result = await response.json() as any;
  
  console.log(chalk.green('✅ Stack published successfully!'));
  console.log(chalk.gray(`  Stack ID: ${result.id}`));
  console.log(chalk.gray(`  URL: https://commands.com/stacks/${result.id}`));
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
  if (options.category) params.set('category', options.category);
  if (options.search) params.set('search', options.search);
  if (options.myStacks) params.set('my_stacks', 'true');
  
  const headers: Record<string, string> = {
    'User-Agent': 'claude-stacks-cli/1.0.0'
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  console.log(chalk.blue('🔍 Fetching stacks from Commands.com...'));
  
  const response = await fetch(`https://api.commands.com/v1/stacks?${params.toString()}`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    throw new Error(`Browse failed: ${response.statusText}`);
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
    console.log(chalk.gray(`   Author: ${stack.author?.name || 'Unknown'}`));
    console.log(chalk.gray(`   Components: ${(stack.commands?.length || 0) + (stack.agents?.length || 0)} items`));
    console.log(chalk.gray(`   Tags: ${stack.tags?.join(', ') || 'None'}`));
    console.log(chalk.gray(`   URL: https://commands.com/stacks/${stack.id}`));
    console.log(chalk.blue(`   Install: claude-stacks install-remote ${stack.id}`));
    console.log();
  });
}

async function installRemoteStack(stackId: string, options: { overwrite?: boolean; globalOnly?: boolean; localOnly?: boolean } = {}): Promise<void> {
  console.log(chalk.blue(`📥 Fetching stack ${stackId} from Commands.com...`));
  
  // Fetch stack from Commands.com
  const response = await fetch(`https://api.commands.com/v1/stacks/${stackId}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'claude-stacks-cli/1.0.0'
    }
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Stack ${stackId} not found. It may be private or not exist.`);
    }
    throw new Error(`Failed to fetch stack: ${response.statusText}`);
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
  console.log(chalk.gray(`By: ${remoteStack.author?.name || 'Unknown'}`));
  console.log(chalk.gray(`Description: ${stack.description}\n`));
  
  // Use the existing restore function to install the stack
  // First, save it as a temporary file
  const tempStackPath = path.join(os.tmpdir(), `remote-stack-${stackId}.json`);
  await fs.writeJson(tempStackPath, stack, { spaces: 2 });
  
  try {
    await restoreStack(tempStackPath, options);
    
    // Track successful installation
    console.log(chalk.green(`\n✅ Successfully installed "${stack.name}" from Commands.com!`));
    console.log(chalk.gray(`   Stack ID: ${stackId}`));
    console.log(chalk.gray(`   Author: ${remoteStack.author?.name || 'Unknown'}`));
    
  } finally {
    // Clean up temp file
    if (await fs.pathExists(tempStackPath)) {
      await fs.remove(tempStackPath);
    }
  }
}

async function exportCurrentStack(options: { name?: string; description?: string }): Promise<DeveloperStack> {
  const claudeDir = path.join(os.homedir(), '.claude');
  const currentDir = process.cwd();
  
  // Auto-generate stack name and description from current directory
  const dirName = path.basename(currentDir);
  const stackName = options.name || `${dirName} Development Stack`;
  const stackDescription = options.description || `Development stack for ${dirName} project`;
  
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

  // Scan global ~/.claude directory
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

  // Read global settings
  const globalSettingsFile = path.join(claudeDir, 'settings.json');
  if (await fs.pathExists(globalSettingsFile)) {
    try {
      const globalSettings = await fs.readJson(globalSettingsFile);
      stack.settings = { ...globalSettings, ...stack.settings };
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not parse global settings.json'));
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

async function restoreStack(stackFilePath: string, options: { overwrite?: boolean; globalOnly?: boolean; localOnly?: boolean }): Promise<void> {
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

  // Note about MCP servers (manual installation required)
  if (stack.mcpServers && stack.mcpServers.length > 0) {
    console.log(chalk.blue.bold('MCP Servers Configuration:'));
    console.log(chalk.yellow('Note: MCP servers require manual installation using `claude mcp add`'));
    console.log(chalk.gray('Run these commands to configure MCP servers for this project:\n'));
    
    for (const mcpServer of stack.mcpServers) {
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

  // Create a restore summary
  console.log(chalk.blue.bold('Restore Summary:'));
  console.log(chalk.gray(`✓ Commands: ${stack.commands?.length || 0} items`));
  console.log(chalk.gray(`✓ Agents: ${stack.agents?.length || 0} items`));
  console.log(chalk.gray(`✓ MCP Servers: ${stack.mcpServers?.length || 0} configurations`));
  console.log(chalk.gray(`✓ Settings: ${stack.settings ? 'Restored' : 'None'}`));
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


  // Note about MCP servers (they would need manual installation)
  if (stack.mcpServers && stack.mcpServers.length > 0) {
    console.log(chalk.blue.bold('MCP Servers Found:'));
    console.log(chalk.yellow('Note: MCP servers require manual installation using `claude mcp add`'));
    for (const mcpServer of stack.mcpServers) {
      console.log(chalk.gray(`  - ${mcpServer.name}: ${mcpServer.type}`));
      if (mcpServer.url) {
        console.log(chalk.gray(`    URL: ${mcpServer.url}`));
      }
      if (mcpServer.command) {
        console.log(chalk.gray(`    Command: ${mcpServer.command} ${mcpServer.args?.join(' ') || ''}`));
      }
    }
    console.log();
  }
}

async function getCliToken(): Promise<{ token: string; apiBase: string }> {
  // Token can be provided via environment variable (from /setup-project command)
  const token = process.env.COMMANDS_CLI_TOKEN;
  const apiBase = process.env.COMMANDS_API_BASE || 'https://api.commands.com';
  
  if (!token) {
    throw new Error('No authentication token provided. This command should be called from the /setup-project Claude command with COMMANDS_CLI_TOKEN environment variable.');
  }
  
  return { token, apiBase };
}

async function fetchAssetViaMCP(type: string, id: string): Promise<CommandsComAsset> {
  try {
    // Get token from MCP server
    const { token, apiBase } = await getCliToken();
    
    // Parse the ID to extract org and name (format: org/name)
    const [organizationUsername, name] = id.split('/');
    if (!organizationUsername || !name) {
      throw new Error('Invalid asset ID format. Expected: org/name');
    }
    
    // Use the unified /api/assets endpoint
    const endpoint = `${apiBase}/api/assets/${type}/${organizationUsername}/${name}`;
    
    // Fetch asset using gateway JWT token
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API returned ${response.status}: ${response.statusText}\n${errorBody}`);
    }
    
    const asset = await response.json() as any;
    
    // Transform to CLI format
    return {
      id: `${organizationUsername}/${name}`,
      name: asset.name || name,
      description: asset.description || '',
      type: type as 'command' | 'agent' | 'prompt',
      content: asset.content || '',
      documentation: asset.instructions || asset.documentation
    };
  } catch (error) {
    throw new Error(`Failed to fetch ${type}: ${id} - ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function installCommand(id: string) {
  const spinner = ora(`Installing command: ${id}`).start();
  
  try {
    // Fetch command from Commands.com via MCP server
    const asset = await fetchAssetViaMCP('command', id);
    
    // Create ~/.claude/commands directory
    const claudeDir = path.join(os.homedir(), '.claude');
    const commandsDir = path.join(claudeDir, 'commands');
    await fs.ensureDir(commandsDir);
    
    // Create command file
    const filename = `${asset.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filepath = path.join(commandsDir, filename);
    
    await fs.writeFile(filepath, asset.content);
    
    spinner.succeed(`Command installed: ${chalk.cyan(asset.name)}`);
    console.log(chalk.gray(`  File: ${filepath}`));
    console.log(chalk.gray(`  Usage: /${asset.name.toLowerCase().replace(/\s+/g, '-')}`));
    
  } catch (error) {
    spinner.fail(`Failed to install command: ${id}`);
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function installAgent(id: string) {
  const spinner = ora(`Installing agent: ${id}`).start();
  
  try {
    // Fetch agent from Commands.com via MCP server
    const asset = await fetchAssetViaMCP('agent', id);
    
    // Create ~/.claude/agents directory  
    const claudeDir = path.join(os.homedir(), '.claude');
    const agentsDir = path.join(claudeDir, 'agents');
    await fs.ensureDir(agentsDir);
    
    // Create agent file
    const filename = `${asset.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filepath = path.join(agentsDir, filename);
    
    await fs.writeFile(filepath, asset.content);
    
    spinner.succeed(`Agent installed: ${chalk.cyan(asset.name)}`);
    console.log(chalk.gray(`  File: ${filepath}`));
    console.log(chalk.gray(`  Usage: @${asset.name.toLowerCase().replace(/\s+/g, '-')}`));
    
  } catch (error) {
    spinner.fail(`Failed to install agent: ${id}`);
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
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
  .description('Export current development environment as a stack')
  .action(async (options) => {
    console.log(chalk.blue.bold('📤 Exporting Current Development Stack\n'));
    
    try {
      const stack = await exportCurrentStack(options);
      const stackContent = JSON.stringify(stack, null, 2);
      
      // Save to ~/.claude/stacks/ directory
      const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
      await fs.ensureDir(stacksDir);
      
      const fileName = `${path.basename(process.cwd())}-stack.json`;
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
  .description('Restore a development stack to the current project')
  .action(async (stackFile: string, options: { overwrite?: boolean; globalOnly?: boolean; localOnly?: boolean }) => {
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
  .description('Install a development stack from Commands.com marketplace')
  .action(async (stackId: string, options: { overwrite?: boolean; globalOnly?: boolean; localOnly?: boolean }) => {
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

// Legacy Commands.com compatibility
const legacyCommand = program
  .command('legacy')
  .description('Legacy Commands.com installation tools');

legacyCommand
  .command('install')
  .argument('<type>', 'Type: command, agent, or prompt')
  .argument('<id>', 'Namespaced ID (e.g., user/tool-name)')
  .description('Install a Commands.com asset')
  .action(async (type: string, id: string) => {
    console.log(chalk.blue.bold('📦 Commands.com Installer\n'));
    
    switch (type) {
      case 'command':
        await installCommand(id);
        break;
      case 'agent':
        await installAgent(id);
        break;
      default:
        console.error(chalk.red('Error:'), `Unknown type: ${type}`);
        console.log(chalk.gray('Valid types: command, agent'));
        process.exit(1);
    }
  });


program.parse();