# Claude Stacks - Complete API Reference

## Table of Contents

1. [Overview](#overview)
2. [Type System](#type-system)
3. [Service APIs](#service-apis)
4. [Action APIs](#action-apis)
5. [Utility APIs](#utility-apis)
6. [CLI Command APIs](#cli-command-apis)
7. [Error Handling](#error-handling)
8. [Integration Examples](#integration-examples)
9. [Extension APIs](#extension-apis)

---

## Overview

The Claude Stacks API provides comprehensive interfaces for managing Claude Code development environments. All APIs are built with TypeScript for compile-time type safety and include runtime validation.

### API Design Principles

- **Type Safety**: All APIs use TypeScript with strict type checking
- **Error Handling**: Consistent Result<T, E> pattern for error management
- **Async/Await**: Modern async patterns throughout
- **Dependency Injection**: Services accept dependencies for testability
- **Immutability**: Data structures are immutable where possible

### Common Patterns

```typescript
// Result pattern for error handling
type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

// Service constructor pattern
class Service {
  constructor(
    private readonly dependency1: Dependency1,
    private readonly dependency2: Dependency2
  ) {}
}

// Async operation pattern
async operation(): Promise<Result<Data, ServiceError>> {
  try {
    const result = await this.performOperation();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: this.handleError(error) };
  }
}
```

---

## Type System

### Core Stack Types

#### DeveloperStack

```typescript
interface DeveloperStack {
  /** Stack identifier (alphanumeric, hyphens, underscores) */
  name: string;

  /** Human-readable description */
  description: string;

  /** Semantic version (default: "1.0.0") */
  version?: string;

  /** Array of Claude Code commands */
  commands?: StackCommand[];

  /** Array of Claude Code agents */
  agents?: StackAgent[];

  /** Array of MCP server configurations */
  mcpServers?: StackMcpServer[];

  /** Array of executable hooks */
  hooks?: StackHook[];

  /** Claude Code settings object */
  settings?: StackSettings;

  /** CLAUDE.md file contents */
  claudeMd?: {
    global?: { path: string; content: string };
    local?: { path: string; content: string };
  };

  /** Stack metadata for tracking and versioning */
  metadata?: StackMetadata;

  /** File path (for local stacks) */
  filePath?: string;
}
```

#### StackCommand

```typescript
interface StackCommand {
  /** Command name (must be unique within stack) */
  name: string;

  /** Relative file path within Claude configuration */
  filePath: string;

  /** Command source code content */
  content: string;

  /** Optional description for documentation */
  description?: string;
}

// Example usage
const command: StackCommand = {
  name: 'analyze-code',
  filePath: 'commands/analyze-code.ts',
  content: '// TypeScript command implementation...',
  description: 'Analyzes code quality and suggests improvements',
};
```

#### StackAgent

```typescript
interface StackAgent {
  /** Agent name (must be unique within stack) */
  name: string;

  /** Relative file path within Claude configuration */
  filePath: string;

  /** Agent configuration and prompt content */
  content: string;

  /** Optional description for documentation */
  description?: string;
}

// Example usage
const agent: StackAgent = {
  name: 'code-reviewer',
  filePath: 'agents/code-reviewer.md',
  content: 'You are a senior code reviewer...',
  description: 'Provides detailed code review feedback',
};
```

#### StackMcpServer

```typescript
interface StackMcpServer {
  /** Server identifier (unique within stack) */
  name: string;

  /** Communication protocol type */
  type: 'stdio' | 'http' | 'sse';

  /** Command to execute (for stdio servers) */
  command?: string;

  /** Command line arguments */
  args?: string[];

  /** HTTP/SSE endpoint URL */
  url?: string;

  /** Environment variables */
  env?: Record<string, string>;
}

// Example stdio server
const mcpServer: StackMcpServer = {
  name: 'filesystem',
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/files'],
  env: { NODE_ENV: 'production' },
};

// Example HTTP server
const httpServer: StackMcpServer = {
  name: 'api-server',
  type: 'http',
  url: 'http://localhost:3000/mcp',
  env: { API_KEY: 'secret-key' },
};
```

#### StackHook

```typescript
interface StackHook {
  /** Hook identifier */
  name: string;

  /** Hook execution trigger type */
  type:
    | 'PreToolUse'
    | 'PostToolUse'
    | 'Notification'
    | 'UserPromptSubmit'
    | 'Stop'
    | 'SubagentStop'
    | 'SessionEnd'
    | 'PreCompact'
    | 'SessionStart';

  /** Relative file path within Claude configuration */
  filePath: string;

  /** Hook JavaScript/TypeScript code */
  content: string;

  /** Optional description */
  description?: string;

  /** Tool pattern matcher (for tool-related hooks) */
  matcher?: string;

  /** Security risk assessment */
  riskLevel?: 'safe' | 'warning' | 'dangerous';

  /** Detailed security scan results */
  scanResults?: HookScanResult;
}

interface HookScanResult {
  /** File system access detected */
  hasFileSystemAccess: boolean;

  /** Network access detected */
  hasNetworkAccess: boolean;

  /** Process execution detected */
  hasProcessExecution: boolean;

  /** Dangerous imports detected */
  hasDangerousImports: boolean;

  /** Credential/environment access detected */
  hasCredentialAccess: boolean;

  /** Specific suspicious patterns found */
  suspiciousPatterns: string[];

  /** Overall risk score (0-100) */
  riskScore: number;
}
```

### API Types

#### RemoteStack

```typescript
interface RemoteStack {
  /** Organization username */
  org: string;

  /** Stack name (URL-safe slug) */
  name: string;

  /** Display title (may differ from name) */
  title?: string;

  /** Stack description */
  description: string;

  /** Semantic version */
  version?: string;

  /** Organization display name */
  author?: string;

  /** Public visibility flag */
  public?: boolean;

  /** Stack components */
  commands?: StackCommand[];
  agents?: StackAgent[];
  mcpServers?: StackMcpServer[];
  settings?: StackSettings;
  hooks?: StackHook[];

  /** API metadata */
  metadata?: ApiStackMetadata;

  /** Timestamps */
  createdAt?: string;
  updatedAt?: string;

  /** Usage statistics */
  viewCount?: number;
  installCount?: number;

  /** Component counts */
  commandCount?: number;
  agentCount?: number;
  mcpServerCount?: number;
  hookCount?: number;
}
```

### Utility Types

#### Branded Types

```typescript
// Brand pattern for type safety
type Brand<T, B> = T & { readonly __brand: B };

// Specific branded types
type StackName = Brand<string, 'StackName'>;
type StackVersion = Brand<string, 'StackVersion'>;
type OrganizationName = Brand<string, 'OrganizationName'>;
type StackId = Brand<string, 'StackId'>;
type FilePath = Brand<string, 'FilePath'>;
type CommandName = Brand<string, 'CommandName'>;
type AgentName = Brand<string, 'AgentName'>;
type McpServerName = Brand<string, 'McpServerName'>;

// Validation functions
function isValidStackName(name: string): name is StackName {
  return /^[a-zA-Z0-9-_]+$/.test(name) && name.length <= 100;
}

function isValidVersion(version: string): version is StackVersion {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/.test(version);
}
```

#### Result Types

```typescript
// Success result
type Success<T> = {
  success: true;
  data: T;
};

// Error result
type Failure<E> = {
  success: false;
  error: E;
};

// Combined result type
type Result<T, E = Error> = Success<T> | Failure<E>;

// Helper functions
function success<T>(data: T): Success<T> {
  return { success: true, data };
}

function failure<E>(error: E): Failure<E> {
  return { success: false, error };
}
```

---

## Service APIs

### ConfigService

Manages Claude Code configuration files with merge capabilities.

#### Constructor

```typescript
class ConfigService {
  constructor(private readonly fileService: FileService) {}
}
```

#### Methods

##### readGlobalConfig()

```typescript
async readGlobalConfig(): Promise<Result<ClaudeConfig, ConfigError>>
```

Reads the global Claude configuration from `~/.claude/claude_desktop_config.json`.

**Returns:**

- `Success<ClaudeConfig>` - Configuration object with MCP servers, settings
- `Failure<ConfigError>` - File not found, invalid JSON, or permission error

**Example:**

```typescript
const configService = new ConfigService(fileService);
const result = await configService.readGlobalConfig();

if (result.success) {
  console.log('Global MCP servers:', result.data.mcpServers);
} else {
  console.error('Failed to read config:', result.error.message);
}
```

##### readLocalConfig()

```typescript
async readLocalConfig(): Promise<Result<ClaudeConfig, ConfigError>>
```

Reads local project configuration from `./.claude/claude_desktop_config.json`.

**Returns:**

- `Success<ClaudeConfig>` - Local configuration object
- `Failure<ConfigError>` - File not found, invalid JSON, or permission error

##### writeGlobalConfig()

```typescript
async writeGlobalConfig(config: ClaudeConfig): Promise<Result<void, ConfigError>>
```

Writes configuration to global Claude configuration file.

**Parameters:**

- `config: ClaudeConfig` - Complete configuration object to write

**Returns:**

- `Success<void>` - Configuration written successfully
- `Failure<ConfigError>` - Write permission error or disk space

##### writeLocalConfig()

```typescript
async writeLocalConfig(config: ClaudeConfig): Promise<Result<void, ConfigError>>
```

Writes configuration to local project configuration file.

##### mergeConfigs()

```typescript
mergeConfigs(base: ClaudeConfig, overlay: ClaudeConfig): ClaudeConfig
```

Deeply merges two Claude configurations with overlay taking precedence.

**Merge Strategy:**

- MCP servers: Merge by name, overlay replaces base
- Settings: Deep merge object properties
- Arrays: Concatenate with deduplication
- Primitives: Overlay value replaces base value

**Example:**

```typescript
const baseConfig = { mcpServers: { server1: {...} } };
const stackConfig = { mcpServers: { server2: {...} } };
const merged = configService.mergeConfigs(baseConfig, stackConfig);
// Result: { mcpServers: { server1: {...}, server2: {...} } }
```

##### backupConfig()

```typescript
async backupConfig(configPath: string): Promise<Result<string, ConfigError>>
```

Creates a timestamped backup of configuration file.

**Parameters:**

- `configPath: string` - Path to configuration file to backup

**Returns:**

- `Success<string>` - Path to created backup file
- `Failure<ConfigError>` - Backup creation failed

### FileService

Provides secure file system operations with path validation.

#### Constructor

```typescript
class FileService {
  constructor() {}
}
```

#### Methods

##### readFile()

```typescript
async readFile(filePath: string): Promise<Result<string, FileError>>
```

Safely reads file content with path security validation.

**Security Features:**

- Path traversal attack prevention
- Symlink resolution and validation
- Permission checking before access

**Parameters:**

- `filePath: string` - Absolute path to file

**Returns:**

- `Success<string>` - File content as UTF-8 string
- `Failure<FileError>` - File not found, permission denied, or security violation

**Example:**

```typescript
const fileService = new FileService();
const result = await fileService.readFile('/home/user/.claude/commands/test.ts');

if (result.success) {
  console.log('File content:', result.data);
} else {
  console.error('Read failed:', result.error.code);
}
```

##### writeFile()

```typescript
async writeFile(filePath: string, content: string): Promise<Result<void, FileError>>
```

Safely writes content to file with directory creation.

**Features:**

- Automatic parent directory creation
- Atomic writes via temporary files
- File permission preservation
- Path security validation

##### exists()

```typescript
async exists(filePath: string): Promise<boolean>
```

Checks if file or directory exists.

##### ensureDir()

```typescript
async ensureDir(dirPath: string): Promise<Result<void, FileError>>
```

Creates directory and all parent directories if they don't exist.

##### deleteFile()

```typescript
async deleteFile(filePath: string): Promise<Result<void, FileError>>
```

Safely deletes file with path validation.

##### copyFile()

```typescript
async copyFile(source: string, destination: string): Promise<Result<void, FileError>>
```

Copies file from source to destination with security checks.

##### listDirectory()

```typescript
async listDirectory(dirPath: string): Promise<Result<string[], FileError>>
```

Lists directory contents with optional filtering.

**Example:**

```typescript
const result = await fileService.listDirectory('/home/user/.claude/stacks');
if (result.success) {
  const stacks = result.data.filter(name => name.endsWith('.json'));
  console.log('Available stacks:', stacks);
}
```

### StackService

Core stack management operations including CRUD and validation.

#### Constructor

```typescript
class StackService {
  constructor(
    private readonly fileService: FileService,
    private readonly configService: ConfigService
  ) {}
}
```

#### Methods

##### createStack()

```typescript
async createStack(args: CreateStackArgs): Promise<Result<DeveloperStack, StackError>>
```

Creates a new local stack with validation.

**Parameters:**

```typescript
interface CreateStackArgs {
  name: string; // Stack identifier
  description?: string; // Optional description
  version?: string; // Semantic version (default: "1.0.0")
  commands?: StackCommand[];
  agents?: StackAgent[];
  mcpServers?: StackMcpServer[];
  hooks?: StackHook[];
  settings?: StackSettings;
}
```

**Validation Rules:**

- Stack name must be unique in local registry
- Name must match pattern: `/^[a-zA-Z0-9-_]+$/`
- Version must be valid semantic version
- All file paths must be relative and secure

**Returns:**

- `Success<DeveloperStack>` - Created stack object with metadata
- `Failure<StackError>` - Validation failed, stack exists, or filesystem error

**Example:**

```typescript
const stackService = new StackService(fileService, configService);
const result = await stackService.createStack({
  name: 'my-dev-stack',
  description: 'Development environment for React apps',
  version: '1.0.0',
  commands: [
    {
      name: 'create-component',
      filePath: 'commands/create-component.ts',
      content: '// Component creation logic...',
    },
  ],
});

if (result.success) {
  console.log('Stack created:', result.data.name);
  console.log('Location:', result.data.filePath);
}
```

##### loadStack()

```typescript
async loadStack(stackName: string): Promise<Result<DeveloperStack, StackError>>
```

Loads stack from local filesystem by name.

**Parameters:**

- `stackName: string` - Stack identifier

**Returns:**

- `Success<DeveloperStack>` - Loaded stack with full metadata
- `Failure<StackError>` - Stack not found or corrupted

##### listStacks()

```typescript
async listStacks(): Promise<Result<DeveloperStack[], StackError>>
```

Lists all local stacks in `~/.claude/stacks/` directory.

**Returns:**

- `Success<DeveloperStack[]>` - Array of all local stacks with metadata
- `Failure<StackError>` - Filesystem access error

**Example:**

```typescript
const result = await stackService.listStacks();
if (result.success) {
  result.data.forEach(stack => {
    console.log(`${stack.name} (v${stack.version}): ${stack.description}`);
  });
}
```

##### updateStack()

```typescript
async updateStack(stackName: string, updates: Partial<DeveloperStack>): Promise<Result<DeveloperStack, StackError>>
```

Updates existing stack with partial changes.

**Parameters:**

- `stackName: string` - Stack to update
- `updates: Partial<DeveloperStack>` - Properties to update

**Merge Strategy:**

- Commands/agents/MCP servers: Replace entire arrays
- Settings: Deep merge with existing settings
- Metadata: Update timestamps, preserve creation info

##### deleteStack()

```typescript
async deleteStack(args: DeleteStackArgs): Promise<Result<void, StackError>>
```

Deletes stack from local filesystem.

**Parameters:**

```typescript
interface DeleteStackArgs {
  stackName: string; // Stack to delete
  force?: boolean; // Skip confirmation in non-interactive mode
}
```

##### stackExists()

```typescript
async stackExists(stackName: string): Promise<boolean>
```

Checks if stack exists in local registry.

##### validateStack()

```typescript
validateStack(stack: unknown): Result<DeveloperStack, ValidationError>
```

Validates stack object against schema.

**Validation Rules:**

- Required fields: name, description
- Name format: alphanumeric, hyphens, underscores only
- Version format: semantic versioning (if provided)
- Commands: unique names, valid file paths, non-empty content
- Agents: unique names, valid file paths, non-empty content
- MCP Servers: valid configuration for each type
- Hooks: valid type, secure code analysis

**Example:**

```typescript
const validation = stackService.validateStack(stackData);
if (!validation.success) {
  console.error('Validation errors:');
  validation.error.details.forEach(error => {
    console.error(`- ${error.path}: ${error.message}`);
  });
}
```

### AuthService

OAuth 2.0 with PKCE authentication for Commands.com marketplace.

#### Constructor

```typescript
class AuthService {
  constructor(
    private readonly apiConfig: ApiConfig,
    private readonly fileService: FileService
  ) {}
}
```

#### Methods

##### ensureAuthenticated()

```typescript
async ensureAuthenticated(): Promise<Result<AuthToken, AuthError>>
```

Ensures user is authenticated, initiating OAuth flow if needed.

**Flow:**

1. Check for existing valid token
2. Attempt token refresh if expired
3. Initiate full OAuth flow if no valid token
4. Return authenticated token

**Returns:**

- `Success<AuthToken>` - Valid authentication token
- `Failure<AuthError>` - Authentication failed or user cancelled

**Example:**

```typescript
const authService = new AuthService(apiConfig, fileService);
const result = await authService.ensureAuthenticated();

if (result.success) {
  console.log('Authenticated successfully');
  // Use result.data.access_token for API calls
} else {
  console.error('Authentication failed:', result.error.message);
}
```

##### startOAuthFlow()

```typescript
async startOAuthFlow(): Promise<Result<AuthToken, AuthError>>
```

Initiates OAuth 2.0 with PKCE flow.

**PKCE Flow Steps:**

1. Generate code verifier and challenge
2. Open browser to authorization URL
3. Start local HTTP server for callback
4. Exchange authorization code for token
5. Store token securely

**Security Features:**

- PKCE (Proof Key for Code Exchange) for public client security
- State parameter for CSRF protection
- Secure random code verifier generation
- Token storage with restricted file permissions

##### refreshToken()

```typescript
async refreshToken(token: AuthToken): Promise<Result<AuthToken, AuthError>>
```

Refreshes expired access token using refresh token.

**Parameters:**

- `token: AuthToken` - Token with refresh_token

**Returns:**

- `Success<AuthToken>` - New valid token
- `Failure<AuthError>` - Refresh failed, full reauth required

##### isTokenValid()

```typescript
isTokenValid(token: AuthToken): boolean
```

Checks if token is valid and not expired.

**Validation:**

- Token exists and has access_token
- Token not expired (with 5-minute buffer)
- Token format is valid JWT (basic validation)

##### logout()

```typescript
async logout(): Promise<Result<void, AuthError>>
```

Logs out user by removing stored credentials.

**Actions:**

- Delete token file from filesystem
- Clear any in-memory token cache
- Revoke token with authorization server (if supported)

##### getStoredToken()

```typescript
async getStoredToken(): Promise<Result<AuthToken | null, AuthError>>
```

Retrieves stored authentication token.

**Security:**

- File permissions check (600)
- JSON parsing with error handling
- Token format validation

### ApiService

HTTP client for Commands.com marketplace API with authentication.

#### Constructor

```typescript
class ApiService {
  constructor(
    private readonly config: ApiConfig,
    private readonly authService: AuthService
  ) {}
}
```

#### Configuration

```typescript
interface ApiConfig {
  baseUrl: string; // API base URL
  authUrl: string; // OAuth authorization endpoint
  tokenUrl: string; // OAuth token endpoint
  clientId: string; // OAuth client identifier
}

// Development configuration
const devConfig: ApiConfig = {
  baseUrl: 'http://localhost:3000',
  authUrl: 'http://localhost:3000/oauth/authorize',
  tokenUrl: 'http://localhost:3000/oauth/token',
  clientId: 'claude-stacks-dev',
};

// Production configuration
const prodConfig: ApiConfig = {
  baseUrl: 'https://backend.commands.com',
  authUrl: 'https://backend.commands.com/oauth/authorize',
  tokenUrl: 'https://backend.commands.com/oauth/token',
  clientId: 'claude-stacks-prod',
};
```

#### Methods

##### fetchStacks()

```typescript
async fetchStacks(options?: FetchStacksOptions): Promise<Result<RemoteStack[], ApiError>>
```

Retrieves published stacks from marketplace.

**Parameters:**

```typescript
interface FetchStacksOptions {
  search?: string; // Search term for filtering
  category?: string; // Category filter
  author?: string; // Author filter
  public?: boolean; // Public visibility filter
  limit?: number; // Results per page (max 100)
  offset?: number; // Pagination offset
  sortBy?: 'name' | 'created' | 'updated' | 'installs' | 'views';
  sortOrder?: 'asc' | 'desc';
}
```

**Returns:**

- `Success<RemoteStack[]>` - Array of matching stacks
- `Failure<ApiError>` - Network error, authentication failure, or API error

**Example:**

```typescript
const apiService = new ApiService(config, authService);
const result = await apiService.fetchStacks({
  search: 'react',
  category: 'frontend',
  public: true,
  limit: 20,
  sortBy: 'installs',
  sortOrder: 'desc',
});

if (result.success) {
  result.data.forEach(stack => {
    console.log(`${stack.org}/${stack.name}: ${stack.installCount} installs`);
  });
}
```

##### fetchStack()

```typescript
async fetchStack(stackId: string): Promise<Result<RemoteStack, ApiError>>
```

Fetches a specific stack by organization/name identifier.

**Parameters:**

- `stackId: string` - Stack identifier in format "org/name" or "org/name@version"

**Returns:**

- `Success<RemoteStack>` - Complete stack data with all components
- `Failure<ApiError>` - Stack not found, access denied, or network error

**Example:**

```typescript
const result = await apiService.fetchStack('commands-com/react-development');
if (result.success) {
  const stack = result.data;
  console.log(`${stack.title} by ${stack.author}`);
  console.log(`Commands: ${stack.commands?.length || 0}`);
  console.log(`Agents: ${stack.agents?.length || 0}`);
  console.log(`MCP Servers: ${stack.mcpServers?.length || 0}`);
}
```

##### publishStack()

```typescript
async publishStack(stack: DeveloperStack, options?: PublishOptions): Promise<Result<RemoteStack, ApiError>>
```

Publishes local stack to marketplace.

**Parameters:**

- `stack: DeveloperStack` - Local stack to publish
- `options: PublishOptions` - Publishing configuration

```typescript
interface PublishOptions {
  public?: boolean; // Make publicly discoverable
  skipSanitization?: boolean; // Skip content sanitization (admin only)
  category?: string; // Stack category
  tags?: string[]; // Descriptive tags
}
```

**Publishing Process:**

1. Validate stack schema and content
2. Sanitize sensitive data (API keys, passwords)
3. Upload stack data to marketplace
4. Generate unique stack ID
5. Update local stack with published metadata

**Returns:**

- `Success<RemoteStack>` - Published stack with marketplace metadata
- `Failure<ApiError>` - Validation failed, quota exceeded, or network error

##### updateStack()

```typescript
async updateStack(stackId: string, updates: Partial<RemoteStack>): Promise<Result<RemoteStack, ApiError>>
```

Updates published stack metadata and content.

**Updatable Fields:**

- title, description, version
- public visibility
- commands, agents, mcpServers, hooks
- settings and metadata

**Version Handling:**

- Version must be higher than current published version
- Semantic versioning validation
- Automatic version increment if not specified

##### deleteStack()

```typescript
async deleteStack(stackId: string): Promise<Result<void, ApiError>>
```

Deletes published stack from marketplace.

**Authorization:**

- Only stack owner can delete
- Admin users can delete any stack
- Soft delete with recovery period

**Impact:**

- Stack becomes unavailable for installation
- Existing installations remain functional
- Statistics and metadata preserved

##### getMyStacks()

```typescript
async getMyStacks(): Promise<Result<RemoteStack[], ApiError>>
```

Retrieves all stacks published by authenticated user.

**Returns stacks with:**

- Full metadata including private fields
- Usage statistics (views, installs)
- Revenue information (if applicable)

---

## Action APIs

Actions implement the business logic for each CLI command.

### BaseAction

Abstract base class providing common functionality for all actions.

```typescript
abstract class BaseAction {
  protected readonly services: ActionServices;

  constructor() {
    this.services = this.initializeServices();
  }

  protected initializeServices(): ActionServices {
    const fileService = new FileService();
    const configService = new ConfigService(fileService);
    const authService = new AuthService(getApiConfig(), fileService);
    const apiService = new ApiService(getApiConfig(), authService);
    const stackService = new StackService(fileService, configService);
    const uiService = new UIService();
    const metadataService = new MetadataService();
    const hookScannerService = new HookScannerService();

    return {
      fileService,
      configService,
      authService,
      apiService,
      stackService,
      uiService,
      metadataService,
      hookScannerService,
    };
  }
}

interface ActionServices {
  fileService: FileService;
  configService: ConfigService;
  authService: AuthService;
  apiService: ApiService;
  stackService: StackService;
  uiService: UIService;
  metadataService: MetadataService;
  hookScannerService: HookScannerService;
}
```

### ExportAction

Exports current Claude environment to a shareable stack file.

#### execute()

```typescript
async execute(filename?: string, options?: ExportOptions): Promise<void>
```

**Parameters:**

```typescript
interface ExportOptions {
  includeGlobal?: boolean; // Include global ~/.claude configurations
  includeClaudeMd?: boolean; // Include CLAUDE.md files
  name?: string; // Custom stack name
  description?: string; // Custom description
  stackVersion?: string; // Set specific version
  hooks?: boolean; // Include hooks (default: true)
}
```

**Export Process:**

1. Scan Claude configurations (local and optionally global)
2. Collect commands, agents, MCP servers from file system
3. Scan and analyze hooks for security risks
4. Generate stack metadata with timestamps
5. Create stack file in `~/.claude/stacks/` directory
6. Display export summary and component counts

**Example Usage:**

```typescript
const exportAction = new ExportAction();

// Basic export
await exportAction.execute();

// Export with global config and custom metadata
await exportAction.execute('my-stack.json', {
  includeGlobal: true,
  includeClaudeMd: true,
  name: 'My Development Stack',
  description: 'Full-stack development environment',
  stackVersion: '2.1.0',
});
```

**Output Example:**

```
📤 Exporting Claude Code environment...

✅ Stack "my-development-stack" exported successfully!
   📁 Location: ~/.claude/stacks/my-development-stack.json

📊 Stack Contents:
   🔧 Commands: 5
   🤖 Agents: 3
   🔌 MCP Servers: 2
   🪝 Hooks: 1 (1 safe)
   ⚙️  Settings: 4 keys
```

### RestoreAction

Restores a stack to the current project environment.

#### execute()

```typescript
async execute(filename: string, options?: RestoreOptions): Promise<void>
```

**Parameters:**

```typescript
interface RestoreOptions {
  overwrite?: boolean; // Overwrite existing files
  globalOnly?: boolean; // Restore only to global config
  localOnly?: boolean; // Restore only to local config
  trackInstallation?: {
    // Track installation metadata
    stackId: string;
    source?: 'local-file' | 'restore';
  };
}
```

**Restore Process:**

1. Load and validate stack file
2. Analyze hooks for security risks (if present)
3. Show security report and get user confirmation
4. Merge configurations according to strategy
5. Write commands, agents, and other files
6. Update installation tracking metadata
7. Display restoration summary

**Configuration Merge Strategy:**

- **Default (merge)**: Combine with existing configs, new entries added
- **Overwrite**: Replace existing configs entirely
- **Global only**: Apply only to `~/.claude/` configuration
- **Local only**: Apply only to `./.claude/` configuration

### InstallAction

Installs a stack from the Commands.com marketplace.

#### execute()

```typescript
async execute(stackId: string, options?: InstallOptions): Promise<void>
```

**Parameters:**

- `stackId: string` - Stack identifier (e.g., "commands-com/react-dev" or "org/name@1.2.0")

```typescript
interface InstallOptions {
  overwrite?: boolean; // Overwrite existing configurations
  globalOnly?: boolean; // Install to global config only
  localOnly?: boolean; // Install to local config only
}
```

**Installation Process:**

1. Authenticate with Commands.com if needed
2. Fetch stack data from marketplace API
3. Validate stack integrity and format
4. Perform security analysis of hooks
5. Display security report and installation preview
6. Get user confirmation for installation
7. Apply stack to Claude configurations
8. Track installation in local metadata
9. Display installation summary

**Security Features:**

- Hook scanning for malicious code patterns
- User confirmation for stacks with security risks
- Quarantine mode for dangerous hooks
- Installation tracking for audit purposes

**Example Output:**

```
📥 Installing stack commands-com/react-development from marketplace...

🔐 Authenticating with Commands.com...
✅ Authentication successful

📊 Stack Analysis:
   📝 Title: React Development Environment
   👤 Author: Commands.com Team
   📅 Version: 2.1.0
   👀 Views: 1,247  💾 Installs: 89

🔍 Security Analysis:
   🪝 Hooks: 2 total
   ✅ pre-commit-lint: Safe
   ⚠️  build-optimizer: Warning - Network access detected

📋 Installation Preview:
   🔧 Commands: 8 total
   🤖 Agents: 2 total
   🔌 MCP Servers: 3 total

Continue with installation? (y/N) y

✅ Stack installed successfully!
   📍 Installed to: ./.claude/
   🏷️  Tracked as: commands-com/react-development@2.1.0
```

### PublishAction

Publishes a local stack to the Commands.com marketplace.

#### execute()

```typescript
async execute(filename?: string, options?: PublishOptions): Promise<void>
```

**Parameters:**

```typescript
interface PublishOptions {
  public?: boolean; // Make publicly discoverable
  skipSanitization?: boolean; // Skip content sanitization (admin only)
}
```

**Publishing Process:**

1. Locate stack file (provided path or select from local stacks)
2. Load and validate stack content
3. Perform security analysis and sanitization
4. Authenticate with Commands.com
5. Check for existing published version
6. Handle version conflict resolution
7. Upload stack to marketplace
8. Update local metadata with published information
9. Display publishing confirmation

**Version Management:**

- Automatic version increment if not specified
- Conflict resolution for existing versions
- Version validation (semantic versioning)
- Rollback capability on publish failure

### BrowseAction

Interactive browsing of the Commands.com marketplace.

#### execute()

```typescript
async execute(options?: BrowseOptions): Promise<void>
```

**Parameters:**

```typescript
interface BrowseOptions {
  category?: string; // Filter by category
  search?: string; // Search term
  myStacks?: boolean; // Show only user's published stacks
}
```

**Browse Interface:**

- Paginated stack listing with filtering
- Interactive stack selection and preview
- Detailed stack information display
- One-click installation from browser
- Search and category filtering
- Sorting by popularity, date, installs

**Example Interface:**

```
🌐 Commands.com Stack Marketplace

🔍 Search: [                    ] 📂 Category: [All Categories ▼]

📊 Showing 1-10 of 247 stacks:

 1. 🔧 react-development          commands-com      ⭐ 89 installs
    Full-featured React development environment with TypeScript, ESLint, and Prettier

 2. 🤖 ai-assistant-toolkit       ai-experts        ⭐ 156 installs
    Collection of AI agents for code review, documentation, and debugging

 3. 🐍 python-data-science        data-team         ⭐ 203 installs
    Complete Python environment for data analysis and machine learning

[Enter] View details  [I] Install  [N] Next page  [S] Search  [Q] Quit
```

---

## Utility APIs

### Colors Utility

Provides consistent terminal color scheme throughout the application.

```typescript
interface Colors {
  // Semantic colors
  info(text: string): string; // Blue for informational messages
  success(text: string): string; // Green for success messages
  warning(text: string): string; // Yellow for warnings
  error(text: string): string; // Red for errors

  // Content colors
  stackName(text: string): string; // Cyan for stack names
  description(text: string): string; // White for descriptions
  meta(text: string): string; // Gray for metadata
  number(text: string): string; // Magenta for numbers

  // Special formatting
  dim(text: string): string; // Dimmed text
  bold(text: string): string; // Bold text
  underline(text: string): string; // Underlined text
}

// Usage examples
console.log(colors.info('📥 Fetching stack from marketplace...'));
console.log(colors.success('✅ Stack installed successfully!'));
console.log(colors.warning('⚠️ Security risk detected in hooks'));
console.log(colors.error('❌ Authentication failed'));

console.log(
  `${colors.stackName('react-dev')} - ${colors.description('React development environment')}`
);
console.log(colors.meta('   Location: ~/.claude/stacks/'));
```

### Path Security Utility

Prevents path traversal attacks and ensures safe file system access.

#### validatePath()

```typescript
function validatePath(inputPath: string): Result<string, SecurityError>;
```

Validates and normalizes file paths to prevent directory traversal attacks.

**Security Checks:**

- Prevents `../` and `..\\` patterns
- Blocks URL-encoded traversal attempts (`%2e%2e%2f`)
- Resolves symlinks and validates final path
- Ensures path is within allowed directories
- Checks for null bytes and other injection attempts

**Example:**

```typescript
const result = validatePath('../../../etc/passwd');
if (!result.success) {
  console.error('Security violation:', result.error.message);
  // Error: Path traversal attempt detected
}

const safeResult = validatePath('./commands/my-command.ts');
if (safeResult.success) {
  console.log('Safe path:', safeResult.data);
  // Safe path: /home/user/project/.claude/commands/my-command.ts
}
```

#### isPathSafe()

```typescript
function isPathSafe(path: string, allowedBasePaths: string[]): boolean;
```

Checks if path is within allowed base directories.

**Parameters:**

- `path: string` - Path to validate
- `allowedBasePaths: string[]` - Array of allowed base directories

### Input Validation Utilities

#### validateStackName()

```typescript
function validateStackName(name: string): Result<StackName, ValidationError>;
```

Validates stack name format and converts to branded type.

**Rules:**

- Length: 1-100 characters
- Pattern: `/^[a-zA-Z0-9-_]+$/`
- Reserved names blocked (e.g., 'system', 'admin')

#### validateVersion()

```typescript
function validateVersion(version: string): Result<StackVersion, ValidationError>;
```

Validates semantic version format.

**Supported Formats:**

- `1.0.0` - Standard semantic version
- `1.0.0-alpha` - Pre-release version
- `1.0.0-beta.1` - Pre-release with build number

#### sanitizeInput()

```typescript
function sanitizeInput(input: string, options?: SanitizeOptions): string;
```

Sanitizes user input to prevent injection attacks.

**Options:**

```typescript
interface SanitizeOptions {
  maxLength?: number; // Maximum string length
  allowHtml?: boolean; // Allow HTML tags (default: false)
  stripNewlines?: boolean; // Remove newline characters
  toLowerCase?: boolean; // Convert to lowercase
}
```

### Metadata Utilities

#### generateStackMetadata()

```typescript
function generateStackMetadata(stack: DeveloperStack): StackMetadata;
```

Generates comprehensive metadata for stack tracking.

**Generated Fields:**

- `created_at`: ISO timestamp of creation
- `updated_at`: ISO timestamp of last modification
- `exported_from`: System information (OS, Node version)
- `checksum`: Content hash for integrity verification
- `component_counts`: Statistics on commands, agents, etc.

#### updateMetadata()

```typescript
function updateMetadata(existing: StackMetadata, changes: Partial<StackMetadata>): StackMetadata;
```

Updates metadata while preserving creation information.

#### compareVersions()

```typescript
function compareVersions(version1: string, version2: string): number;
```

Semantic version comparison (-1, 0, 1).

---

## CLI Command APIs

### Command Registration Pattern

All CLI commands follow a consistent registration pattern in `src/cli.ts`:

```typescript
program
  .command('command-name')
  .argument('<required-arg>', 'Argument description')
  .argument('[optional-arg]', 'Optional argument description')
  .option('--flag', 'Boolean flag description')
  .option('--option <value>', 'Option with value description')
  .option('--choice <choice>', 'Option with choices', 'default-value')
  .description('Command description for help text')
  .action((requiredArg, optionalArg, options) => {
    return actionFunction(requiredArg, optionalArg, options);
  });
```

### Export Command

```bash
claude-stacks export [filename] [options]
```

**Arguments:**

- `filename` (optional) - Output filename for the stack

**Options:**

- `--name <name>` - Custom name for the stack
- `--description <description>` - Custom description for the stack
- `--stack-version <version>` - Set stack version (default: auto-increment)
- `--include-global` - Include global ~/.claude configurations
- `--include-claude-md` - Include CLAUDE.md files in export
- `--no-hooks` - Exclude hooks from export

### Restore Command

```bash
claude-stacks restore <filename> [options]
```

**Arguments:**

- `filename` (required) - Stack file to restore from

**Options:**

- `--overwrite` - Overwrite existing files (default: merge)
- `--global-only` - Only restore to global ~/.claude (skip local)
- `--local-only` - Only restore to local .claude (skip global)

### Install Command

```bash
claude-stacks install <stack-id> [options]
```

**Arguments:**

- `stack-id` (required) - Stack ID from marketplace (org/name or org/name@version)

**Options:**

- `--overwrite` - Overwrite existing files (default: merge)
- `--global-only` - Only install to global ~/.claude
- `--local-only` - Only install to local .claude

### Publish Command

```bash
claude-stacks publish [filename] [options]
```

**Arguments:**

- `filename` (optional) - Stack file to publish (searches ~/.claude/stacks/ by default)

**Options:**

- `--public` - Make the stack publicly discoverable (default: private)

### Hook Commands

#### View Hook

```bash
claude-stacks view-hook <stack-file> <hook-name>
```

Displays hook content and security analysis.

#### Scan Hooks

```bash
claude-stacks scan-hooks [stack-file] [options]
```

**Options:**

- `--show-safe` - Include safe hooks in output
- `--details` - Show detailed scan results

#### List Hooks

```bash
claude-stacks list-hooks [stack-file] [options]
```

**Options:**

- `--type <type>` - Filter by hook type
- `--risk-level <level>` - Filter by risk level

---

## Error Handling

### Error Type Hierarchy

```typescript
// Base error interface
interface BaseError {
  message: string;
  code: string;
  details?: unknown;
}

// Specific error types
class StackError extends Error implements BaseError {
  constructor(
    message: string,
    public readonly code: StackErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'StackError';
  }
}

type StackErrorCode =
  | 'STACK_NOT_FOUND'
  | 'STACK_ALREADY_EXISTS'
  | 'VALIDATION_ERROR'
  | 'FILESYSTEM_ERROR'
  | 'SECURITY_ERROR';

class ApiError extends Error implements BaseError {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiErrorCode = 'NETWORK_ERROR' | 'AUTH_ERROR' | 'NOT_FOUND' | 'RATE_LIMITED' | 'SERVER_ERROR';
```

### Error Handling Patterns

#### Result Pattern

```typescript
// Success result
type Success<T> = { success: true; data: T };

// Error result
type Failure<E> = { success: false; error: E };

// Combined result
type Result<T, E = Error> = Success<T> | Failure<E>;

// Usage pattern
async function someOperation(): Promise<Result<Data, MyError>> {
  try {
    const data = await performOperation();
    return { success: true, data };
  } catch (error) {
    if (error instanceof MyError) {
      return { success: false, error };
    }
    return { success: false, error: new MyError('Unexpected error', error) };
  }
}

// Consuming code
const result = await someOperation();
if (result.success) {
  console.log('Data:', result.data);
} else {
  console.error('Error:', result.error.message);
}
```

#### Error Recovery Strategies

```typescript
// Retry with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage
const result = await withRetry(() => apiService.fetchStack(stackId), 3, 2000);
```

#### User-Friendly Error Messages

```typescript
function formatError(error: Error): string {
  if (error instanceof StackError) {
    switch (error.code) {
      case 'STACK_NOT_FOUND':
        return `Stack not found. Use "claude-stacks list" to see available stacks.`;
      case 'VALIDATION_ERROR':
        return `Invalid stack format. Please check your stack file and try again.`;
      case 'FILESYSTEM_ERROR':
        return `File system error. Please check permissions and try again.`;
      default:
        return error.message;
    }
  }

  if (error instanceof ApiError) {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return `Network error. Please check your internet connection.`;
      case 'AUTH_ERROR':
        return `Authentication failed. Please run the command again to re-authenticate.`;
      case 'RATE_LIMITED':
        return `Rate limit exceeded. Please wait a moment and try again.`;
      default:
        return error.message;
    }
  }

  return `An unexpected error occurred: ${error.message}`;
}
```

---

## Integration Examples

### Creating a Custom Stack

```typescript
import { StackService, FileService, ConfigService } from 'claude-stacks';

// Initialize services
const fileService = new FileService();
const configService = new ConfigService(fileService);
const stackService = new StackService(fileService, configService);

// Create a new stack
const result = await stackService.createStack({
  name: 'my-custom-stack',
  description: 'Custom development environment',
  version: '1.0.0',
  commands: [
    {
      name: 'build-project',
      filePath: 'commands/build-project.ts',
      content: `
      export default async function buildProject() {
        console.log('Building project...');
        // Build logic here
      }
    `,
    },
  ],
  agents: [
    {
      name: 'code-reviewer',
      filePath: 'agents/code-reviewer.md',
      content: `
      You are a senior software engineer focused on code quality.
      Review code for best practices, security issues, and performance.
    `,
    },
  ],
  mcpServers: [
    {
      name: 'filesystem',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './src'],
    },
  ],
});

if (result.success) {
  console.log('Stack created:', result.data.filePath);
} else {
  console.error('Failed to create stack:', result.error.message);
}
```

### Publishing Workflow

```typescript
import { PublishAction, AuthService } from 'claude-stacks';

// Initialize publish action
const publishAction = new PublishAction();

// Publish with options
await publishAction.execute('my-stack.json', {
  public: true, // Make publicly discoverable
});

// The publish process will:
// 1. Authenticate with Commands.com
// 2. Validate and sanitize stack content
// 3. Upload to marketplace
// 4. Update local metadata
```

### Installing and Customizing

```typescript
import { InstallAction, ConfigService } from 'claude-stacks';

// Install a stack from marketplace
const installAction = new InstallAction();
await installAction.execute('commands-com/react-dev', {
  localOnly: true, // Install only to local project
  overwrite: false, // Merge with existing config
});

// Customize the installed configuration
const configService = new ConfigService(fileService);
const configResult = await configService.readLocalConfig();

if (configResult.success) {
  const config = configResult.data;

  // Add custom MCP server
  config.mcpServers = config.mcpServers || {};
  config.mcpServers['my-custom-server'] = {
    type: 'stdio',
    command: 'node',
    args: ['./my-custom-mcp-server.js'],
  };

  // Save updated config
  await configService.writeLocalConfig(config);
}
```

### Security Analysis

```typescript
import { HookScannerService } from 'claude-stacks';

const hookScanner = new HookScannerService();

// Analyze hook security
const scanResult = hookScanner.scanHook({
  name: 'pre-commit-hook',
  type: 'PreToolUse',
  content: `
    import fs from 'fs';
    import { exec } from 'child_process';
    
    export default function preCommitHook() {
      // Run linting
      exec('npm run lint');
      
      // Read package.json for version
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      console.log('Version:', pkg.version);
    }
  `,
});

console.log('Risk Level:', scanResult.riskLevel);
console.log('Risk Score:', scanResult.scanResults?.riskScore);
console.log('Security Issues:');
scanResult.scanResults?.suspiciousPatterns.forEach(pattern => {
  console.log(`- ${pattern}`);
});

// Output:
// Risk Level: warning
// Risk Score: 45
// Security Issues:
// - File system access detected: fs.readFileSync
// - Process execution detected: exec
```

---

## Extension APIs

### Creating Custom Services

```typescript
// Define service interface
interface CustomService {
  processCustomData(data: unknown): Promise<Result<ProcessedData, CustomError>>;
}

// Implement service
class CustomServiceImpl implements CustomService {
  constructor(
    private readonly fileService: FileService,
    private readonly configService: ConfigService
  ) {}

  async processCustomData(data: unknown): Promise<Result<ProcessedData, CustomError>> {
    try {
      // Validate input
      if (!this.isValidData(data)) {
        return failure(new CustomError('Invalid data format', 'VALIDATION_ERROR'));
      }

      // Process data
      const processed = await this.performProcessing(data);

      return success(processed);
    } catch (error) {
      return failure(this.handleError(error));
    }
  }

  private isValidData(data: unknown): data is ValidData {
    // Validation logic
    return typeof data === 'object' && data !== null;
  }

  private async performProcessing(data: ValidData): Promise<ProcessedData> {
    // Processing logic
    return { processed: true, data };
  }

  private handleError(error: unknown): CustomError {
    if (error instanceof Error) {
      return new CustomError(error.message, 'PROCESSING_ERROR');
    }
    return new CustomError('Unknown error', 'UNKNOWN_ERROR');
  }
}

// Register service in BaseAction
class ExtendedBaseAction extends BaseAction {
  protected initializeServices(): ActionServices & { customService: CustomService } {
    const baseServices = super.initializeServices();
    return {
      ...baseServices,
      customService: new CustomServiceImpl(baseServices.fileService, baseServices.configService),
    };
  }
}
```

### Creating Custom Actions

```typescript
// Define custom action
class CustomAction extends BaseAction {
  async execute(input: CustomInput): Promise<void> {
    try {
      console.log(colors.info('🔄 Starting custom operation...'));

      // Use services
      const result = await this.services.customService.processCustomData(input);

      if (!result.success) {
        console.error(colors.error(`❌ Operation failed: ${result.error.message}`));
        return;
      }

      console.log(colors.success('✅ Custom operation completed successfully!'));
      console.log(colors.meta(`   Result: ${JSON.stringify(result.data)}`));
    } catch (error) {
      console.error(colors.error('❌ Unexpected error:'));
      console.error(colors.meta(`   ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}

// Register in CLI
program
  .command('custom')
  .argument('<input>', 'Custom input parameter')
  .option('--option <value>', 'Custom option')
  .description('Custom command description')
  .action((input, options) => {
    const customAction = new CustomAction();
    return customAction.execute({ input, ...options });
  });
```

### Adding Custom Hook Types

```typescript
// Extend hook type definitions
type ExtendedHookType = HookType | 'CustomHookType' | 'AnotherCustomType';

// Extend hook interface
interface ExtendedStackHook extends StackHook {
  type: ExtendedHookType;
  customProperty?: string;
}

// Create custom hook scanner
class ExtendedHookScannerService extends HookScannerService {
  scanHook(hook: ExtendedStackHook): HookScanResult {
    // Call base scanner
    const baseResult = super.scanHook(hook);

    // Add custom scanning logic
    if (hook.type === 'CustomHookType') {
      return this.scanCustomHook(hook, baseResult);
    }

    return baseResult;
  }

  private scanCustomHook(hook: ExtendedStackHook, baseResult: HookScanResult): HookScanResult {
    // Custom security analysis
    const customPatterns = this.detectCustomPatterns(hook.content);

    return {
      ...baseResult,
      suspiciousPatterns: [...baseResult.suspiciousPatterns, ...customPatterns],
      riskScore: this.calculateCustomRiskScore(baseResult, customPatterns),
    };
  }

  private detectCustomPatterns(content: string): string[] {
    const patterns: string[] = [];

    // Add custom pattern detection
    if (content.includes('customDangerousPattern')) {
      patterns.push('Custom dangerous pattern detected');
    }

    return patterns;
  }

  private calculateCustomRiskScore(baseResult: HookScanResult, customPatterns: string[]): number {
    // Custom risk calculation
    let score = baseResult.riskScore;
    score += customPatterns.length * 10;
    return Math.min(score, 100);
  }
}
```

---

## Advanced Integration Patterns

### Service Composition Pattern

```typescript
// Compose multiple services for complex operations
class CompositeStackOperation {
  constructor(
    private readonly stackService: StackService,
    private readonly configService: ConfigService,
    private readonly hookScanner: HookScannerService,
    private readonly metadataService: MetadataService
  ) {}

  async createSecureStack(
    params: CreateSecureStackParams
  ): Promise<Result<DeveloperStack, StackError>> {
    // Validate input
    const validation = this.validateInput(params);
    if (!validation.success) return validation;

    // Create base stack
    const stackResult = await this.stackService.createStack(params);
    if (!stackResult.success) return stackResult;

    // Scan hooks for security issues
    const securityResult = await this.scanStackSecurity(stackResult.data);
    if (!securityResult.success) {
      // Cleanup failed stack
      await this.stackService.deleteStack({ stackName: params.name, force: true });
      return failure(securityResult.error);
    }

    // Generate enhanced metadata
    const metadata = this.metadataService.generateSecureMetadata(stackResult.data);

    return success({
      ...stackResult.data,
      metadata,
    });
  }
}
```

### Event-Driven Architecture

```typescript
// Event system for stack operations
interface StackEventEmitter {
  on<T>(event: StackEvent, listener: (data: T) => void): void;
  emit<T>(event: StackEvent, data: T): void;
}

type StackEvent =
  | 'stack:created'
  | 'stack:updated'
  | 'stack:deleted'
  | 'stack:published'
  | 'stack:installed';

class EventAwareStackService extends StackService {
  constructor(
    fileService: FileService,
    configService: ConfigService,
    private readonly eventEmitter: StackEventEmitter
  ) {
    super(fileService, configService);
  }

  async createStack(args: CreateStackArgs): Promise<Result<DeveloperStack, StackError>> {
    const result = await super.createStack(args);

    if (result.success) {
      this.eventEmitter.emit('stack:created', {
        stack: result.data,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }
}

// Event listeners
stackService.on('stack:created', data => {
  console.log(`Stack ${data.stack.name} created at ${data.timestamp}`);
});
```

### Plugin System Architecture

```typescript
// Plugin interface
interface StackPlugin {
  name: string;
  version: string;
  beforeStackCreate?(args: CreateStackArgs): Promise<CreateStackArgs>;
  afterStackCreate?(stack: DeveloperStack): Promise<DeveloperStack>;
  beforeStackPublish?(stack: DeveloperStack): Promise<DeveloperStack>;
  afterStackPublish?(stack: RemoteStack): Promise<void>;
}

// Plugin manager
class PluginManager {
  private plugins: Map<string, StackPlugin> = new Map();

  register(plugin: StackPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  async executeHook<T>(hookName: keyof StackPlugin, data: T): Promise<T> {
    let result = data;

    for (const plugin of this.plugins.values()) {
      const hook = plugin[hookName];
      if (typeof hook === 'function') {
        result = await hook(result);
      }
    }

    return result;
  }
}

// Usage with services
class PluginAwareStackService extends StackService {
  constructor(
    fileService: FileService,
    configService: ConfigService,
    private readonly pluginManager: PluginManager
  ) {
    super(fileService, configService);
  }

  async createStack(args: CreateStackArgs): Promise<Result<DeveloperStack, StackError>> {
    // Apply before-create plugins
    const modifiedArgs = await this.pluginManager.executeHook('beforeStackCreate', args);

    // Create stack
    const result = await super.createStack(modifiedArgs);

    if (result.success) {
      // Apply after-create plugins
      const modifiedStack = await this.pluginManager.executeHook('afterStackCreate', result.data);
      return success(modifiedStack);
    }

    return result;
  }
}
```

### Performance Monitoring Integration

```typescript
// Performance monitoring wrapper
class MonitoredService<T> {
  constructor(
    private readonly service: T,
    private readonly metrics: MetricsCollector
  ) {}

  wrap(): T {
    return new Proxy(this.service, {
      get: (target, prop) => {
        const originalMethod = target[prop];

        if (typeof originalMethod === 'function') {
          return async (...args: any[]) => {
            const startTime = Date.now();
            const operation = `${target.constructor.name}.${String(prop)}`;

            try {
              const result = await originalMethod.apply(target, args);
              const duration = Date.now() - startTime;

              this.metrics.recordSuccess(operation, duration);
              return result;
            } catch (error) {
              const duration = Date.now() - startTime;
              this.metrics.recordError(operation, duration, error);
              throw error;
            }
          };
        }

        return originalMethod;
      },
    });
  }
}

// Usage
const stackService = new MonitoredService(
  new StackService(fileService, configService),
  metricsCollector
).wrap();
```

---

## Testing Patterns

### Service Testing with Mocks

```typescript
// Service testing pattern
describe('StackService', () => {
  let stackService: StackService;
  let mockFileService: jest.Mocked<FileService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockFileService = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      exists: jest.fn(),
      ensureDir: jest.fn(),
      deleteFile: jest.fn(),
    } as any;

    mockConfigService = {
      validateStackName: jest.fn(),
      mergeConfigs: jest.fn(),
    } as any;

    stackService = new StackService(mockFileService, mockConfigService);
  });

  describe('createStack', () => {
    it('should create stack successfully', async () => {
      // Arrange
      mockConfigService.validateStackName.mockReturnValue();
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.ensureDir.mockResolvedValue({ success: true, data: undefined });
      mockFileService.writeFile.mockResolvedValue({ success: true, data: undefined });

      // Act
      const result = await stackService.createStack({
        name: 'test-stack',
        description: 'Test stack',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockConfigService.validateStackName).toHaveBeenCalledWith('test-stack');
      expect(mockFileService.ensureDir).toHaveBeenCalled();
      expect(mockFileService.writeFile).toHaveBeenCalled();
    });
  });
});
```

### Integration Testing Pattern

```typescript
// Integration test setup
describe('Stack Integration Tests', () => {
  let tempDir: string;
  let fileService: FileService;
  let configService: ConfigService;
  let stackService: StackService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-stacks-test-'));
    process.chdir(tempDir);

    fileService = new FileService();
    configService = new ConfigService(fileService);
    stackService = new StackService(fileService, configService);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle complete stack lifecycle', async () => {
    // Create stack
    const createResult = await stackService.createStack({
      name: 'integration-test',
      description: 'Integration test stack',
      commands: [
        {
          name: 'test-command',
          filePath: 'commands/test.ts',
          content: 'export default function test() { console.log("test"); }',
        },
      ],
    });

    expect(createResult.success).toBe(true);

    // Load stack
    const loadResult = await stackService.loadStack('integration-test');
    expect(loadResult.success).toBe(true);
    expect(loadResult.data?.name).toBe('integration-test');

    // Update stack
    const updateResult = await stackService.updateStack('integration-test', {
      description: 'Updated integration test stack',
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.data?.description).toBe('Updated integration test stack');

    // Delete stack
    const deleteResult = await stackService.deleteStack({
      stackName: 'integration-test',
      force: true,
    });

    expect(deleteResult.success).toBe(true);
  });
});
```

This comprehensive API reference provides detailed documentation for all public and internal APIs in the Claude Stacks system. Each API includes type definitions, parameters, return values, examples, and integration patterns to enable developers to effectively use and extend the system.
