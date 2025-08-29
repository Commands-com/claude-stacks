/**
 * Core type definitions for Claude Stacks system
 *
 * This module defines the fundamental data structures used throughout the Claude Stacks
 * ecosystem, including stack definitions, component interfaces, configuration options,
 * and API integration types. These types represent the core data model for managing
 * and distributing Claude Code extensions.
 *
 * @since 1.0.0
 * @public
 */

import type { ApiStackMetadata } from './api.js';

// Re-export core types
export type * from './cli.js';
export type * from './stack.js';
export type * from './api.js';
export * from './errors.js';

// Export enhanced utilities (selective to avoid conflicts)
export type {
  Brand,
  StackName,
  StackVersion,
  OrganizationName,
  StackId,
  FilePath,
  CommandName,
  AgentName,
  McpServerName,
  PositiveInteger,
  Port,
  NonEmptyArray,
  DeepReadonly,
  Result,
  BrandedTypeValidator,
} from './utilities.js';
export * from './runtime-validators.js';

/**
 * Local developer stack definition representing a complete Claude Code extension
 *
 * Core data structure that defines a stack during development and local management.
 * Contains all components (commands, agents, MCP servers, hooks) and metadata needed
 * to create a functional Claude Code extension. Used by the CLI for stack creation,
 * export, installation, and management operations.
 *
 * @example
 * ```typescript
 * const devStack: DeveloperStack = {
 *   name: 'web-development-tools',
 *   description: 'Essential tools for web development workflow',
 *   version: '1.2.0',
 *   commands: [
 *     {
 *       name: 'create-component',
 *       filePath: './commands/create-component.md',
 *       content: '# Create React Component\\nGenerates a new React component...',
 *       description: 'Generate new React components with TypeScript'
 *     }
 *   ],
 *   agents: [
 *     {
 *       name: 'code-reviewer',
 *       filePath: './agents/code-reviewer.md',
 *       content: 'You are an expert code reviewer...',
 *       description: 'AI agent specialized in code review and best practices'
 *     }
 *   ],
 *   mcpServers: [
 *     {
 *       name: 'github-integration',
 *       type: 'stdio',
 *       command: 'npx',
 *       args: ['@anthropic/mcp-server-github']
 *     }
 *   ],
 *   settings: {
 *     defaultFramework: 'react',
 *     useTypeScript: true
 *   },
 *   metadata: {
 *     created_at: '2024-01-15T10:30:00Z',
 *     local_version: '1.2.0'
 *   }
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface DeveloperStack {
  /**
   * Unique identifier name for the stack
   *
   * @remarks
   * Must be unique within the developer's local environment and follow naming
   * conventions for CLI compatibility. Used for stack identification, file paths,
   * and installation references. Should be kebab-case for consistency.
   */
  name: string;

  /**
   * Human-readable description explaining the stack's purpose and functionality
   *
   * @remarks
   * Comprehensive description that helps users understand what the stack does,
   * its intended use cases, and any important setup or usage information.
   * Displayed in CLI listings and Commands.com when published.
   */
  description: string;

  /**
   * Semantic version of the stack
   *
   * @remarks
   * Optional version string following semantic versioning (e.g., '1.2.0').
   * Used for update detection, compatibility checking, and publication tracking.
   * Defaults to '1.0.0' when first created if not specified.
   */
  version?: string;

  /**
   * Array of slash commands included in this stack
   *
   * @remarks
   * Slash commands that will be available in Claude Code after installation.
   * Each command defines its trigger, file content, and optional description.
   * Commands are loaded from markdown files and processed for Claude integration.
   */
  commands?: StackCommand[];

  /**
   * Array of specialized AI agents included in this stack
   *
   * @remarks
   * AI agents for specific tasks like code review, documentation generation,
   * or domain-specific analysis. Agents are defined in markdown files with
   * specialized prompts and instructions for Claude Code.
   */
  agents?: StackAgent[];

  /**
   * Array of MCP (Model Context Protocol) servers for external tool integration
   *
   * @remarks
   * External services and tools that extend Claude's capabilities through the
   * MCP protocol. Automatically configured in Claude Desktop after installation.
   * Can be stdio, http, or sse type servers with their respective configurations.
   */
  mcpServers?: StackMcpServer[];

  /**
   * Array of lifecycle hooks for automation and event handling
   *
   * @remarks
   * Scripts that execute at specific points during stack operations like
   * installation, tool usage, or session events. Used for setup, cleanup,
   * notifications, and workflow automation. Includes security scanning results.
   */
  hooks?: StackHook[];

  /**
   * Stack-specific configuration settings and feature toggles
   *
   * @remarks
   * Custom settings that control stack behavior, environment-specific
   * configuration, or feature flags. Flexible key-value structure allows
   * stacks to define their own configuration schema.
   */
  settings?: StackSettings;

  /**
   * Claude.md configuration files for global and local project instructions
   *
   * @remarks
   * Contains global Claude instructions that apply to all projects and local
   * project-specific instructions. These files configure Claude's behavior,
   * coding standards, and project-specific context for better assistance.
   */
  claudeMd?: {
    /**
     * Global Claude.md configuration affecting all projects
     *
     * @remarks
     * System-wide instructions placed in ~/.claude/CLAUDE.md that apply
     * to all Claude Code sessions regardless of project.
     */
    global?: {
      /** File path where the global CLAUDE.md will be installed */
      path: string;
      /** Content of the global CLAUDE.md file */
      content: string;
    };
    /**
     * Local project-specific Claude.md configuration
     *
     * @remarks
     * Project-specific instructions placed in project root as CLAUDE.md
     * that provide context and guidelines for the current project.
     */
    local?: {
      /** File path where the local CLAUDE.md will be installed */
      path: string;
      /** Content of the local CLAUDE.md file */
      content: string;
    };
  };

  /**
   * Stack lifecycle and versioning metadata
   *
   * @remarks
   * Tracks the stack's history including creation, updates, publication status,
   * and installation details. Used for version management, update detection,
   * and traceability of stack origins and modifications.
   */
  metadata?: {
    /** ISO 8601 timestamp when the stack was first created locally */
    created_at?: string;
    /** ISO 8601 timestamp when the stack was last modified locally */
    updated_at?: string;
    /** Original project path or location where the stack was exported from */
    exported_from?: string;
    /** Unique identifier for the published version on Commands.com */
    published_stack_id?: string;
    /** Version string of the last published version to Commands.com */
    published_version?: string;
    /** Current version of the local stack, may differ from published version */
    local_version?: string;
    /** Source URL or identifier where the stack was originally installed from */
    installed_from?: string;
    /** ISO 8601 timestamp when the stack was locally installed */
    installed_at?: string;
  };

  /**
   * File system path to the stack's configuration file
   *
   * @remarks
   * Local file path where the stack's .claude-stack file is stored.
   * Used by the CLI for stack management operations like updates, exports,
   * and metadata tracking. Only present for locally managed stacks.
   */
  filePath?: string;
}

// Re-export stack registry types
export type { StackRegistryEntry, StackRegistry } from '../services/StackRegistryService.js';

/**
 * Slash command definition for Claude Code integration
 *
 * Defines a slash command that will be available in Claude Code after stack installation.
 * Commands are typically defined in markdown files with instructions, examples, and
 * implementation details that Claude uses to execute the command functionality.
 *
 * @example
 * ```typescript
 * const command: StackCommand = {
 *   name: 'generate-api-docs',
 *   filePath: './commands/generate-api-docs.md',
 *   content: `# Generate API Documentation
 *
 * Analyze the codebase and generate comprehensive API documentation...
 *
 * ## Usage
 * Use this command to create documentation for REST APIs...`,
 *   description: 'Automatically generate API documentation from code analysis'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StackCommand {
  /**
   * Unique identifier for the slash command
   *
   * @remarks
   * Command name used for triggering in Claude Code (e.g., '/generate-docs').
   * Must be unique within the stack and follow naming conventions for CLI compatibility.
   * Should be kebab-case without the leading slash.
   */
  name: string;

  /**
   * Relative file path to the command's markdown definition file
   *
   * @remarks
   * Path to the markdown file containing the command's instructions and implementation.
   * Relative to the stack's root directory. Typically in a 'commands' subdirectory.
   */
  filePath: string;

  /**
   * Markdown content defining the command's behavior and instructions
   *
   * @remarks
   * Complete markdown content that Claude uses to understand and execute the command.
   * Includes usage instructions, examples, parameters, and implementation guidance.
   * Loaded from the file specified in filePath.
   */
  content: string;

  /**
   * Optional human-readable description of the command's purpose
   *
   * @remarks
   * Brief description displayed in CLI listings and help text. Should clearly
   * explain what the command does and when to use it. Falls back to extracting
   * description from the markdown content if not provided.
   */
  description?: string;
}

/**
 * Specialized AI agent definition for domain-specific tasks
 *
 * Defines an AI agent with specialized knowledge and instructions for specific tasks
 * like code review, documentation, testing, or domain expertise. Agents provide
 * focused AI assistance within Claude Code for particular workflows or use cases.
 *
 * @example
 * ```typescript
 * const agent: StackAgent = {
 *   name: 'security-reviewer',
 *   filePath: './agents/security-reviewer.md',
 *   content: `# Security Code Reviewer
 *
 * You are an expert security code reviewer specialized in identifying...
 *
 * ## Your Responsibilities
 * - Analyze code for security vulnerabilities
 * - Check for common attack vectors...`,
 *   description: 'AI agent specialized in security code review and vulnerability detection'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StackAgent {
  /**
   * Unique identifier for the AI agent
   *
   * @remarks
   * Agent name used for identification and selection in Claude Code.
   * Must be unique within the stack and descriptive of the agent's purpose.
   * Should be kebab-case for consistency with other components.
   */
  name: string;

  /**
   * Relative file path to the agent's markdown definition file
   *
   * @remarks
   * Path to the markdown file containing the agent's specialized instructions and context.
   * Relative to the stack's root directory. Typically in an 'agents' subdirectory.
   */
  filePath: string;

  /**
   * Markdown content defining the agent's specialized instructions and behavior
   *
   * @remarks
   * Complete markdown content that configures the agent's personality, expertise,
   * and behavioral instructions. Includes domain knowledge, response patterns,
   * and task-specific guidance for Claude to embody this specialized agent.
   */
  content: string;

  /**
   * Optional human-readable description of the agent's expertise and purpose
   *
   * @remarks
   * Brief description explaining the agent's specialization and when to use it.
   * Displayed in CLI listings and agent selection interfaces. Should clearly
   * communicate the agent's domain expertise and capabilities.
   */
  description?: string;
}

/**
 * MCP (Model Context Protocol) server configuration for external tool integration
 *
 * Defines an MCP server that extends Claude's capabilities through external tools,
 * APIs, or services. MCP servers provide resources, tools, and prompts that Claude
 * can access during conversations, enabling integration with databases, APIs,
 * file systems, and other external systems.
 *
 * @example
 * ```typescript
 * // Stdio MCP server
 * const stdioServer: StackMcpServer = {
 *   name: 'filesystem-tools',
 *   type: 'stdio',
 *   command: 'npx',
 *   args: ['-y', '@anthropic/mcp-server-filesystem', '/project/path'],
 *   env: { NODE_ENV: 'production' }
 * };
 *
 * // HTTP MCP server
 * const httpServer: StackMcpServer = {
 *   name: 'api-integration',
 *   type: 'http',
 *   url: 'http://localhost:3000/mcp'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StackMcpServer {
  /**
   * Unique identifier for the MCP server
   *
   * @remarks
   * Server name used for identification in Claude Desktop configuration.
   * Must be unique across all installed stacks to avoid conflicts.
   * Should be descriptive of the server's purpose and functionality.
   */
  name: string;

  /**
   * MCP server communication protocol type
   *
   * @remarks
   * Defines how Claude communicates with the MCP server:
   * - 'stdio': Standard input/output communication with a subprocess
   * - 'http': HTTP-based communication with a REST API
   * - 'sse': Server-Sent Events for real-time streaming communication
   */
  type: 'stdio' | 'http' | 'sse';

  /**
   * Executable command to start the MCP server (stdio type only)
   *
   * @remarks
   * The base command used to launch the MCP server process.
   * Required for stdio type servers. Common examples include 'node', 'python',
   * 'npx', or direct executable paths. Used with args to form the complete command.
   */
  command?: string;

  /**
   * Command line arguments for the MCP server process (stdio type only)
   *
   * @remarks
   * Array of arguments passed to the command when launching the MCP server.
   * Used with command to form the complete subprocess execution.
   * Can include flags, file paths, configuration options, etc.
   */
  args?: string[];

  /**
   * HTTP endpoint URL for the MCP server (http/sse types only)
   *
   * @remarks
   * Complete URL where the MCP server is accessible for HTTP or SSE communication.
   * Required for http and sse type servers. Should include protocol, host, port,
   * and path (e.g., 'http://localhost:3000/mcp' or 'https://api.example.com/mcp').
   */
  url?: string;

  /**
   * Environment variables for the MCP server process
   *
   * @remarks
   * Key-value pairs of environment variables passed to the MCP server process.
   * Used for configuration, authentication tokens, API keys, or other
   * runtime settings that the server needs to operate properly.
   */
  env?: Record<string, string>;
}

/**
 * Flexible configuration settings for stack behavior and customization
 *
 * Allows stacks to define their own configuration schema for feature toggles,
 * environment-specific settings, user preferences, or behavioral controls.
 * Settings are accessible to commands, agents, and hooks for customizing
 * their behavior based on user preferences or environment requirements.
 *
 * @example
 * ```typescript
 * const settings: StackSettings = {
 *   defaultLanguage: 'typescript',
 *   enableAutoFormat: true,
 *   maxFileSize: 1048576, // 1MB
 *   apiEndpoint: 'https://api.example.com',
 *   features: {
 *     experimentalMode: false,
 *     debugLogging: true
 *   },
 *   userPreferences: {
 *     theme: 'dark',
 *     notifications: true
 *   }
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface StackSettings {
  /**
   * Flexible key-value configuration allowing any settings structure
   *
   * @remarks
   * Stacks can define their own configuration schema by adding any properties.
   * Values can be primitives, objects, arrays, or any JSON-serializable data.
   * Used by stack components to customize behavior and features.
   */
  [key: string]: unknown;
}

/**
 * Lifecycle hook definition for automation and event handling
 *
 * Defines scripts that execute at specific points during stack operations,
 * Claude Code sessions, or tool interactions. Hooks enable automation, setup/cleanup
 * tasks, notifications, and custom workflow integration. Includes security scanning
 * to identify potentially dangerous operations.
 *
 * @example
 * ```typescript
 * const hook: StackHook = {
 *   name: 'setup-development-environment',
 *   type: 'SessionStart',
 *   filePath: './hooks/setup-dev.js',
 *   content: 'console.log("Setting up development environment...");\\n// Hook implementation',
 *   description: 'Initialize development tools and environment variables',
 *   riskLevel: 'safe',
 *   scanResults: {
 *     hasFileSystemAccess: false,
 *     hasNetworkAccess: false,
 *     hasProcessExecution: false,
 *     hasDangerousImports: false,
 *     hasCredentialAccess: false,
 *     suspiciousPatterns: [],
 *     riskScore: 10
 *   }
 * };
 * ```
 *
 * @since 1.1.0
 * @public
 */
export interface StackHook {
  /**
   * Unique identifier for the hook
   *
   * @remarks
   * Hook name used for identification, logging, and management.
   * Must be unique within the stack and descriptive of the hook's purpose.
   * Should be kebab-case for consistency with other components.
   */
  name: string;

  /**
   * Lifecycle event type that triggers the hook execution
   *
   * @remarks
   * Defines when the hook will be executed during Claude Code operations:
   * - 'PreToolUse': Before Claude executes any tool or function call
   * - 'PostToolUse': After Claude completes a tool or function call
   * - 'Notification': For custom notifications and alerts
   * - 'UserPromptSubmit': When user submits a prompt or message
   * - 'Stop': When a conversation or session is stopped
   * - 'SubagentStop': When a subagent completes its task
   * - 'SessionEnd': At the end of a Claude Code session
   * - 'PreCompact': Before conversation history is compacted
   * - 'SessionStart': At the beginning of a new Claude Code session
   */
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

  /**
   * Relative file path to the hook's executable script or code
   *
   * @remarks
   * Path to the file containing the hook's implementation code.
   * Relative to the stack's root directory. Can be JavaScript, TypeScript,
   * Python, shell script, or other executable formats.
   */
  filePath: string;

  /**
   * Source code content of the hook's implementation
   *
   * @remarks
   * Complete source code that defines the hook's behavior and execution logic.
   * Loaded from the file specified in filePath. Subject to security scanning
   * to identify potentially dangerous operations before execution.
   */
  content: string;

  /**
   * Optional human-readable description of the hook's purpose and functionality
   *
   * @remarks
   * Brief description explaining what the hook does and when it executes.
   * Displayed in CLI listings and security prompts. Should clearly communicate
   * the hook's intent and any potential system interactions.
   */
  description?: string;

  /**
   * Optional pattern matcher for filtering tool usage hooks
   *
   * @remarks
   * Regular expression or exact string match used to filter which tools
   * trigger PreToolUse and PostToolUse hooks. If not specified, the hook
   * triggers for all tool usage. Allows hooks to target specific tools or
   * tool patterns for focused automation.
   */
  matcher?: string;

  /**
   * Security risk level assessment for the hook
   *
   * @remarks
   * Risk classification based on security scanning and static analysis:
   * - 'safe': No security concerns detected, safe to execute
   * - 'warning': Potential security concerns, user should review
   * - 'dangerous': High security risk, requires explicit user approval
   * Used to inform users about potential security implications before execution.
   */
  riskLevel?: 'safe' | 'warning' | 'dangerous';

  /**
   * Detailed security scan results for the hook's code
   *
   * @remarks
   * Comprehensive security analysis results from static code scanning.
   * Identifies specific security concerns like file system access, network
   * requests, process execution, and suspicious patterns. Used to calculate
   * risk level and inform security decisions.
   */
  scanResults?: HookScanResult;
}

/**
 * Security scan results for hook code analysis
 *
 * Comprehensive security analysis results from static code scanning of hook
 * implementations. Identifies specific security concerns and calculates risk
 * scores to help users make informed decisions about hook execution safety.
 *
 * @example
 * ```typescript
 * const scanResults: HookScanResult = {
 *   hasFileSystemAccess: true,
 *   hasNetworkAccess: false,
 *   hasProcessExecution: false,
 *   hasDangerousImports: false,
 *   hasCredentialAccess: false,
 *   suspiciousPatterns: ['fs.writeFileSync'],
 *   riskScore: 25
 * };
 * ```
 *
 * @since 1.1.0
 * @public
 */
export interface HookScanResult {
  /**
   * Whether the hook accesses the file system
   *
   * @remarks
   * Indicates if the hook code contains file system operations like reading,
   * writing, creating, or deleting files and directories. Detected through
   * static analysis of fs module usage, file manipulation APIs, and related patterns.
   */
  hasFileSystemAccess: boolean;

  /**
   * Whether the hook makes network requests or connections
   *
   * @remarks
   * Indicates if the hook code contains network operations like HTTP requests,
   * socket connections, or external API calls. Detected through analysis of
   * networking modules, fetch calls, and connection establishment patterns.
   */
  hasNetworkAccess: boolean;

  /**
   * Whether the hook executes external processes or commands
   *
   * @remarks
   * Indicates if the hook code spawns child processes, executes shell commands,
   * or runs external programs. Detected through analysis of process execution
   * APIs like exec, spawn, and system command patterns.
   */
  hasProcessExecution: boolean;

  /**
   * Whether the hook imports potentially dangerous modules or libraries
   *
   * @remarks
   * Indicates if the hook code imports modules that could be used for malicious
   * purposes, such as system administration, cryptography, or low-level system
   * access. Based on a predefined list of potentially dangerous imports.
   */
  hasDangerousImports: boolean;

  /**
   * Whether the hook accesses credentials, tokens, or sensitive data
   *
   * @remarks
   * Indicates if the hook code attempts to read environment variables, access
   * credential stores, or manipulate authentication tokens. Detected through
   * analysis of credential access patterns and sensitive data handling.
   */
  hasCredentialAccess: boolean;

  /**
   * Array of suspicious code patterns or function calls detected
   *
   * @remarks
   * List of specific code patterns, function names, or API calls that were
   * flagged during security scanning as potentially risky. Used for detailed
   * security reporting and user awareness of specific concerns.
   */
  suspiciousPatterns: string[];

  /**
   * Calculated risk score from 0-100 based on security analysis
   *
   * @remarks
   * Numerical risk assessment where 0 represents no security concerns and
   * 100 represents maximum security risk. Calculated based on the combination
   * of security flags, suspicious patterns, and weighted risk factors.
   * Used to determine the overall safety classification.
   */
  riskScore: number;
}

/**
 * OAuth 2.0 configuration for Commands.com authentication
 *
 * Configuration parameters for OAuth 2.0 authentication flow with Commands.com.
 * Used by the authentication system to handle user login, token exchange,
 * and authorization for publishing and managing stacks on the platform.
 *
 * @example
 * ```typescript
 * const oauthConfig: OAuthConfig = {
 *   clientId: 'claude-stacks-cli',
 *   authUrl: 'https://backend.commands.com/oauth/authorize',
 *   tokenUrl: 'https://backend.commands.com/oauth/token',
 *   redirectPort: 8080
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface OAuthConfig {
  /**
   * OAuth client identifier for the Claude Stacks CLI
   *
   * @remarks
   * Unique identifier assigned to the CLI application by Commands.com for OAuth
   * authentication. Used to identify the application during the authorization flow
   * and token requests. Must match the registered client ID on Commands.com.
   */
  clientId: string;

  /**
   * OAuth authorization endpoint URL
   *
   * @remarks
   * Complete URL for the OAuth authorization endpoint on Commands.com where
   * users are redirected to grant permissions. Used to construct the authorization
   * URL with client ID, scopes, and redirect parameters.
   */
  authUrl: string;

  /**
   * OAuth token exchange endpoint URL
   *
   * @remarks
   * Complete URL for exchanging authorization codes for access tokens.
   * Used in the second step of the OAuth flow to obtain JWT tokens for
   * authenticated API requests to Commands.com.
   */
  tokenUrl: string;

  /**
   * Local HTTP server port for OAuth redirect handling
   *
   * @remarks
   * Port number for the temporary local HTTP server that handles the OAuth
   * redirect callback. Defaults to a system-assigned port if not specified.
   * Must match the registered redirect URI pattern on Commands.com.
   */
  redirectPort?: number;
}

/**
 * Authentication token data for Commands.com API access
 *
 * JWT token structure returned after successful OAuth authentication with
 * Commands.com. Contains access tokens, refresh tokens, and metadata needed
 * for making authenticated API requests and maintaining session state.
 *
 * @example
 * ```typescript
 * const authToken: AuthToken = {
 *   access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   expires_at: 1704067200000, // Unix timestamp
 *   token_type: 'Bearer'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface AuthToken {
  /**
   * JWT access token for authenticated API requests
   *
   * @remarks
   * Short-lived token used in Authorization header for Commands.com API requests.
   * Format: 'Bearer {access_token}'. Contains encoded user identity and permissions.
   * Must be included in all authenticated API calls.
   */
  access_token: string;

  /**
   * JWT refresh token for obtaining new access tokens
   *
   * @remarks
   * Optional long-lived token used to refresh expired access tokens without
   * requiring user re-authentication. Enables seamless session continuation
   * and reduces authentication interruptions during CLI usage.
   */
  refresh_token?: string;

  /**
   * Unix timestamp when the access token expires
   *
   * @remarks
   * Milliseconds since epoch when the access token becomes invalid.
   * Used for automatic token refresh before expiration to maintain
   * authenticated session state without user intervention.
   */
  expires_at?: number;

  /**
   * Type of authentication token (typically 'Bearer')
   *
   * @remarks
   * Indicates the authentication scheme to use in the Authorization header.
   * Usually 'Bearer' for JWT tokens, defining how the token should be
   * presented in HTTP requests to Commands.com API.
   */
  token_type?: string;
}

/**
 * API configuration for Commands.com backend integration
 *
 * Complete configuration for connecting to and authenticating with the Commands.com
 * backend API. Includes endpoint URLs, OAuth settings, and client identification
 * for all CLI operations that interact with the remote platform.
 *
 * @example
 * ```typescript
 * const apiConfig: ApiConfig = {
 *   baseUrl: 'https://backend.commands.com',
 *   authUrl: 'https://backend.commands.com/oauth/authorize',
 *   tokenUrl: 'https://backend.commands.com/oauth/token',
 *   clientId: 'claude-stacks-cli'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ApiConfig {
  /**
   * Base URL for Commands.com backend API
   *
   * @remarks
   * Root URL for all API endpoints. All API requests are made relative to this base.
   * Typically 'https://backend.commands.com' for production or 'http://localhost:3000'
   * for local development when CLAUDE_STACKS_DEV environment variable is set.
   */
  baseUrl: string;

  /**
   * OAuth authorization endpoint URL for user authentication
   *
   * @remarks
   * Complete URL for the OAuth authorization endpoint where users authenticate.
   * Constructed by combining baseUrl with the authorization path. Used to redirect
   * users for login and permission grants during authentication flows.
   */
  authUrl: string;

  /**
   * OAuth token exchange endpoint URL for obtaining access tokens
   *
   * @remarks
   * Complete URL for exchanging authorization codes for JWT access tokens.
   * Constructed by combining baseUrl with the token exchange path. Used in
   * the OAuth flow to obtain authenticated session credentials.
   */
  tokenUrl: string;

  /**
   * OAuth client identifier for the Claude Stacks CLI application
   *
   * @remarks
   * Unique client identifier registered with Commands.com for OAuth authentication.
   * Identifies the CLI application during OAuth flows and API requests.
   * Must match the registered client configuration on Commands.com.
   */
  clientId: string;
}

/**
 * Configuration options for stack export operations
 *
 * Controls various aspects of stack export including what components to include,
 * metadata settings, and export behavior. Used by the export command to customize
 * the output stack file based on user preferences and requirements.
 *
 * @example
 * ```typescript
 * const exportOptions: ExportOptions = {
 *   includeGlobal: true,
 *   includeClaudeMd: true,
 *   name: 'web-dev-toolkit',
 *   description: 'Essential web development tools and utilities',
 *   stackVersion: '2.1.0',
 *   hooks: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ExportOptions {
  /**
   * Whether to include global configuration in the exported stack
   *
   * @remarks
   * Controls inclusion of global system-wide configurations like global
   * CLAUDE.md files, global MCP servers, and system-level settings.
   * When true, exports configurations that affect all projects.
   */
  includeGlobal?: boolean;

  /**
   * Whether to include CLAUDE.md files in the exported stack
   *
   * @remarks
   * Controls inclusion of both global and local CLAUDE.md configuration files.
   * These files contain project instructions and coding standards that guide
   * Claude's behavior. Essential for maintaining consistent AI assistance.
   */
  includeClaudeMd?: boolean;

  /**
   * Custom name for the exported stack
   *
   * @remarks
   * Overrides the default stack name derived from the project or directory.
   * Used as the identifier for the exported stack file and for installation
   * references. Should follow naming conventions for CLI compatibility.
   */
  name?: string;

  /**
   * Custom description for the exported stack
   *
   * @remarks
   * Overrides or provides a description for the exported stack. Used in
   * CLI listings, Commands.com if published, and helps users understand
   * the stack's purpose and functionality.
   */
  description?: string;

  /**
   * Custom version for the exported stack
   *
   * @remarks
   * Overrides the default version or sets a specific version for the export.
   * Should follow semantic versioning (e.g., '1.2.0'). Used for version
   * tracking, update detection, and compatibility management.
   */
  stackVersion?: string;

  /**
   * Whether to include lifecycle hooks in the exported stack
   *
   * @remarks
   * Controls inclusion of hook scripts that automate setup, cleanup, and
   * event handling. Hooks require security review, so this option allows
   * excluding them for simpler stack distribution when automation isn't needed.
   */
  hooks?: boolean;

  /**
   * Whether to include components from installed stacks in the export
   *
   * @remarks
   * By default (false), the export only includes locally-created components
   * and excludes any commands, agents, hooks, or MCP servers that were
   * installed from other stacks. This prevents unintended redistribution
   * of other people's stacks and ensures clean base layer exports.
   * Set to true to include all components regardless of origin.
   *
   * @default false
   */
  includeInstalled?: boolean;
}

/**
 * Configuration options for stack restoration operations
 *
 * Controls the behavior of stack restoration from backup files, including
 * what components to restore, conflict resolution, and installation tracking.
 * Used by the restore command to customize the restoration process.
 *
 * @example
 * ```typescript
 * const restoreOptions: RestoreOptions = {
 *   overwrite: true,
 *   globalOnly: false,
 *   localOnly: false,
 *   trackInstallation: {
 *     stackId: 'web-toolkit-backup-2024-01-15',
 *     source: 'restore'
 *   }
 * };
 * ```
 *
 * @since 1.2.0
 * @public
 */
export interface RestoreOptions {
  /**
   * Whether to overwrite existing files and configurations during restoration
   *
   * @remarks
   * Controls conflict resolution when restoring files that already exist.
   * When true, existing files are replaced with backup versions. When false,
   * restoration skips existing files to avoid data loss.
   */
  overwrite?: boolean;

  /**
   * Whether to restore only global configurations
   *
   * @remarks
   * Limits restoration to global system-wide configurations like global
   * CLAUDE.md files and global MCP servers. Ignores project-specific
   * components when true. Useful for system-level configuration recovery.
   */
  globalOnly?: boolean;

  /**
   * Whether to restore only local project-specific configurations
   *
   * @remarks
   * Limits restoration to local project configurations like local CLAUDE.md
   * files and project-specific settings. Ignores global configurations when
   * true. Useful for project-specific restoration without affecting system settings.
   */
  localOnly?: boolean;

  /**
   * Installation tracking metadata for the restored stack
   *
   * @remarks
   * Optional metadata to record the restoration as an installation event.
   * Helps maintain stack management history and enables proper update tracking
   * for restored stacks that may later be updated or managed.
   */
  trackInstallation?: {
    /** Unique identifier for tracking the restored stack installation */
    stackId: string;
    /** Source type indicating how the stack was installed */
    source?: 'local-file' | 'restore';
  };
}

/**
 * Configuration options for stack publishing to Commands.com
 *
 * Controls the publishing process including visibility settings and content
 * sanitization. Used by the publish command to customize how stacks are
 * made available on the Commands.com platform.
 *
 * @example
 * ```typescript
 * const publishOptions: PublishOptions = {
 *   public: true,
 *   skipSanitization: false
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PublishOptions {
  /**
   * Whether to make the published stack publicly visible on Commands.com
   *
   * @remarks
   * Controls visibility in public browse listings and search results.
   * When true, the stack appears in public directories and can be discovered
   * by other users. When false or undefined, the stack is private but still
   * accessible via direct URL if known.
   */
  public?: boolean;

  /**
   * Whether to bypass content sanitization during publishing
   *
   * @remarks
   * Controls whether stack content undergoes sanitization to remove potentially
   * sensitive information like file paths, usernames, or private data.
   * Generally should be false for security, but can be true for trusted content
   * where original formatting must be preserved.
   */
  skipSanitization?: boolean;
}

/**
 * Configuration options for browsing stacks on Commands.com
 *
 * Controls search and filtering parameters when browsing available stacks
 * on the Commands.com platform. Used by the browse command to customize
 * search results and navigation.
 *
 * @example
 * ```typescript
 * const browseOptions: BrowseOptions = {
 *   category: 'development',
 *   search: 'web scraping',
 *   myStacks: false
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface BrowseOptions {
  /**
   * Category filter for browsing stacks
   *
   * @remarks
   * Filters browse results to show only stacks in the specified category.
   * Common categories include 'development', 'productivity', 'data-analysis',
   * 'automation', etc. Category taxonomy is defined by Commands.com.
   */
  category?: string;

  /**
   * Search query for finding specific stacks
   *
   * @remarks
   * Text search query to find stacks matching specific keywords, descriptions,
   * or functionality. Searches across stack names, descriptions, tags, and
   * other searchable metadata on Commands.com.
   */
  search?: string;

  /**
   * Whether to show only stacks owned by the authenticated user
   *
   * @remarks
   * Filters results to display only stacks published by the current user.
   * Requires authentication to work properly. Useful for managing and
   * reviewing personal published stacks.
   */
  myStacks?: boolean;
}

/**
 * Configuration options for stack installation operations
 *
 * Controls the installation process including conflict resolution and scope
 * of installation. Used by the install command to customize how stacks are
 * installed and integrated into the local Claude Code environment.
 *
 * @example
 * ```typescript
 * const installOptions: InstallOptions = {
 *   overwrite: false,
 *   globalOnly: false,
 *   localOnly: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface InstallOptions {
  /**
   * Whether to overwrite existing components during installation
   *
   * @remarks
   * Controls conflict resolution when installing components that already exist.
   * When true, existing commands, agents, or configurations are replaced.
   * When false, installation skips existing components to prevent data loss.
   */
  overwrite?: boolean;

  /**
   * Whether to install only global components
   *
   * @remarks
   * Limits installation to global system-wide components like global CLAUDE.md
   * files and global MCP servers. Ignores local project-specific components
   * when true. Useful for system-level tool installation.
   */
  globalOnly?: boolean;

  /**
   * Whether to install only local project-specific components
   *
   * @remarks
   * Limits installation to local project components like local CLAUDE.md files
   * and project-specific settings. Ignores global configurations when true.
   * Useful for project-specific tool installation without affecting system settings.
   */
  localOnly?: boolean;
}

/**
 * Configuration options for stack uninstallation operations
 *
 * Controls selective removal of stack components and provides safety features
 * like dry-run mode. Used by the uninstall command to customize what gets
 * removed and how the uninstallation process executes.
 *
 * @example
 * ```typescript
 * const uninstallOptions: UninstallOptions = {
 *   commandsOnly: false,
 *   agentsOnly: false,
 *   mcpOnly: false,
 *   settingsOnly: false,
 *   force: false,
 *   global: false,
 *   local: true,
 *   dryRun: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface UninstallOptions {
  /**
   * Whether to uninstall only slash commands
   *
   * @remarks
   * Limits uninstallation to slash commands only, preserving agents,
   * MCP servers, settings, and other components. Useful when you want
   * to remove commands but keep other functionality intact.
   */
  commandsOnly?: boolean;

  /**
   * Whether to uninstall only AI agents
   *
   * @remarks
   * Limits uninstallation to AI agents only, preserving commands, MCP servers,
   * settings, and other components. Useful when you want to remove specific
   * AI assistance but keep tools and configurations.
   */
  agentsOnly?: boolean;

  /**
   * Whether to uninstall only MCP servers
   *
   * @remarks
   * Limits uninstallation to MCP servers only, preserving commands, agents,
   * settings, and other components. Useful when you want to remove external
   * tool integrations but keep other stack functionality.
   */
  mcpOnly?: boolean;

  /**
   * Whether to uninstall only stack settings
   *
   * @remarks
   * Limits uninstallation to stack-specific settings only, preserving commands,
   * agents, MCP servers, and other components. Useful for resetting configuration
   * while keeping functional components intact.
   */
  settingsOnly?: boolean;

  /**
   * Whether to force uninstallation without confirmation prompts
   *
   * @remarks
   * Bypasses interactive confirmation prompts and proceeds with uninstallation
   * immediately. Use with caution as this can result in data loss without
   * user confirmation. Useful for scripted or automated uninstallation.
   */
  force?: boolean;

  /**
   * Whether to uninstall global system-wide components
   *
   * @remarks
   * Targets global components like global CLAUDE.md files and system-wide
   * MCP servers for removal. Can be combined with other scope options.
   * Affects system-level configuration that applies to all projects.
   */
  global?: boolean;

  /**
   * Whether to uninstall local project-specific components
   *
   * @remarks
   * Targets local components like project-specific CLAUDE.md files and
   * local configurations for removal. Can be combined with other scope options.
   * Affects only the current project without changing system-wide settings.
   */
  local?: boolean;

  /**
   * Whether to perform a dry run showing what would be uninstalled
   *
   * @remarks
   * Performs all uninstallation analysis and displays what would be removed
   * without actually deleting anything. Safety feature that allows users
   * to preview uninstallation effects before committing to the operation.
   */
  dryRun?: boolean;
}

/**
 * Configuration options for cleanup operations
 *
 * Controls the cleanup process for removing temporary files, clearing caches,
 * and performing maintenance operations. Used by the clean command to customize
 * what gets cleaned and how the cleanup process executes.
 *
 * @example
 * ```typescript
 * const cleanOptions: CleanOptions = {
 *   dryRun: true
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CleanOptions {
  /**
   * Whether to perform a dry run showing what would be cleaned
   *
   * @remarks
   * Performs all cleanup analysis and displays what would be removed
   * without actually deleting anything. Safety feature that allows users
   * to preview cleanup effects before committing to the operation.
   */
  dryRun?: boolean;
}

/**
 * Remote stack definition from Commands.com API
 *
 * Complete stack data structure as returned by Commands.com API endpoints.
 * Represents published stacks with full metadata, statistics, and component
 * information. Used for browsing, installation, and synchronization with
 * the remote platform.
 *
 * @example
 * ```typescript
 * const remoteStack: RemoteStack = {
 *   org: 'anthropic',
 *   name: 'web-scraper',
 *   title: 'Professional Web Scraping Tools',
 *   description: 'Comprehensive web scraping and data extraction utilities',
 *   version: '2.1.0',
 *   author: 'Anthropic Team',
 *   public: true,
 *   commands: [{
 *     name: 'scrape-page',
 *     description: 'Extract content from web pages'
 *   }],
 *   agents: [{
 *     name: 'data-extractor',
 *     description: 'AI agent for structured data extraction'
 *   }],
 *   mcpServers: [{
 *     name: 'scraper-api',
 *     type: 'http',
 *     url: 'http://localhost:3001'
 *   }],
 *   viewCount: 1250,
 *   installCount: 89,
 *   commandCount: 3,
 *   agentCount: 2
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface RemoteStack {
  /**
   * Organization name that owns the stack on Commands.com
   *
   * @remarks
   * Organization identifier used in URLs and CLI commands like
   * 'claude-stacks install org/stack-name'. Must be unique across
   * Commands.com and match the authenticated user's organization access.
   */
  org: string;

  /**
   * Unique stack name within the organization
   *
   * @remarks
   * Stack identifier that must be unique within the organization namespace.
   * Used in URLs and CLI commands for installation and reference.
   * Typically slugified (kebab-case) for URL compatibility.
   */
  name: string;

  /**
   * Human-readable display title for the stack
   *
   * @remarks
   * Optional display title that can be more descriptive than the technical
   * name. Used in UI listings and descriptions. Falls back to the name
   * field when not provided. Can contain spaces and special characters.
   */
  title?: string;

  /**
   * Comprehensive description of the stack's functionality and purpose
   *
   * @remarks
   * Required detailed description explaining what the stack does, intended
   * use cases, setup instructions, and any important usage information.
   * Displayed in browse listings, installation previews, and stack details.
   */
  description: string;

  /**
   * Semantic version of the published stack
   *
   * @remarks
   * Version string following semantic versioning (e.g., '1.2.0') for the
   * published stack. Used for update detection, compatibility checking,
   * and version management across installations.
   */
  version?: string;

  /**
   * Display name of the stack author or organization
   *
   * @remarks
   * Human-readable author name or organization display name.
   * May differ from the technical org identifier, providing a
   * more user-friendly representation for UI display and attribution.
   */
  author?: string;

  /**
   * Whether the stack is publicly visible on Commands.com
   *
   * @remarks
   * Controls visibility in public browse listings and search results.
   * Public stacks can be discovered and installed by any user.
   * Private stacks are accessible only via direct URL or to authorized users.
   */
  public?: boolean;

  /**
   * Array of slash commands included in the stack
   *
   * @remarks
   * Commands that will be available in Claude Code after installation.
   * Each command provides specific functionality and instructions for Claude.
   * Commands are the primary way users interact with stack functionality.
   */
  commands?: StackCommand[];

  /**
   * Array of specialized AI agents included in the stack
   *
   * @remarks
   * AI agents for domain-specific tasks like code review, documentation,
   * or specialized analysis. Agents provide focused AI assistance with
   * specific expertise and behavioral patterns.
   */
  agents?: StackAgent[];

  /**
   * Array of MCP servers for external tool integration
   *
   * @remarks
   * Model Context Protocol servers that extend Claude's capabilities
   * through external tools, APIs, and services. Automatically configured
   * in Claude Desktop after stack installation.
   */
  mcpServers?: StackMcpServer[];

  /**
   * Stack-specific configuration settings
   *
   * @remarks
   * Custom settings that control stack behavior, feature toggles,
   * and environment-specific configuration. Flexible structure allows
   * stacks to define their own configuration schema.
   */
  settings?: StackSettings;

  /**
   * Array of lifecycle hooks for automation and event handling
   *
   * @remarks
   * Scripts that execute at specific points during stack operations or
   * Claude Code sessions. Used for setup, cleanup, notifications, and
   * custom workflow integration with security scanning results.
   */
  hooks?: StackHook[];

  /**
   * Installation and versioning metadata from Commands.com
   *
   * @remarks
   * Comprehensive metadata tracking stack lifecycle, publication history,
   * installation details, and version management. Provided by Commands.com
   * API for tracking and synchronization purposes.
   */
  metadata?: ApiStackMetadata;

  /**
   * ISO 8601 timestamp when the stack was created on Commands.com
   *
   * @remarks
   * Alternative timestamp field used by some API endpoints for creation time.
   * May be preferred over metadata.created_at in certain API contexts.
   * Used for sorting and displaying stack age information.
   */
  createdAt?: string;

  /**
   * ISO 8601 timestamp when the stack was last updated on Commands.com
   *
   * @remarks
   * Alternative timestamp field used by some API endpoints for update time.
   * May be preferred over metadata.updated_at in certain API contexts.
   * Used for displaying freshness and update availability.
   */
  updatedAt?: string;

  /**
   * Number of times the stack has been viewed on Commands.com
   *
   * @remarks
   * Public popularity metric showing how many users have viewed the stack's
   * details page. Used for trending calculations, popularity sorting, and
   * engagement analytics in browse listings.
   */
  viewCount?: number;

  /**
   * Number of times the stack has been successfully installed
   *
   * @remarks
   * Adoption metric showing how many users have installed the stack using
   * the CLI. Important indicator of stack usefulness and community adoption.
   * Used for popularity ranking and success metrics.
   */
  installCount?: number;

  /**
   * Total number of slash commands included in the stack
   *
   * @remarks
   * Quick reference count for the commands array length. Indicates the
   * breadth of functionality provided by the stack. Useful for displaying
   * stack complexity and feature richness at a glance.
   */
  commandCount?: number;

  /**
   * Total number of AI agents included in the stack
   *
   * @remarks
   * Quick reference count for the agents array length. Shows the variety
   * of AI-powered capabilities and specialized assistance available.
   * Indicates the depth of AI integration in the stack.
   */
  agentCount?: number;

  /**
   * Total number of MCP servers included in the stack
   *
   * @remarks
   * Quick reference count for the mcpServers array length. Indicates the
   * extent of external tool integrations and system connectivity provided
   * by the stack. Shows integration complexity and capabilities.
   */
  mcpServerCount?: number;

  /**
   * Total number of lifecycle hooks included in the stack
   *
   * @remarks
   * Quick reference count for the hooks array length. Indicates the level
   * of automation, setup complexity, and event handling provided by the stack.
   * Shows how much automated behavior and workflow integration is included.
   */
  hookCount?: number;
}
