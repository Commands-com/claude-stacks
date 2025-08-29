// API response type definitions for Claude Stacks

import type {
  StackAgent,
  StackCommand,
  StackHook,
  StackMcpServer,
  StackSettings,
} from './index.js';

/**
 * Base API response structure for Commands.com backend
 *
 * Generic response wrapper used across all API endpoints to provide consistent
 * error handling and data delivery. The data field contains the actual payload,
 * while error and message provide feedback for unsuccessful operations.
 *
 * @template T - Type of the data payload
 *
 * @example
 * ```typescript
 * // Successful response with stack data
 * const response: ApiResponse<ApiStackResponse> = {
 *   data: { org: 'example', name: 'my-stack', description: 'A test stack' }
 * };
 *
 * // Error response
 * const errorResponse: ApiResponse = {
 *   error: 'Stack not found',
 *   message: 'The requested stack does not exist or is not public'
 * };
 * ```
 *
 * @since 1.4.2
 * @public
 */
export interface ApiResponse<T = unknown> {
  /**
   * The actual data payload from the API
   *
   * @remarks
   * Contains the requested data when the API call is successful.
   * Will be undefined when an error occurs.
   */
  data?: T;

  /**
   * Error message when the API request fails
   *
   * @remarks
   * Provides a brief error identifier or code when the request fails.
   * Used in conjunction with message for detailed error information.
   */
  error?: string;

  /**
   * Human-readable status or error message
   *
   * @remarks
   * Provides detailed information about the request status, whether
   * successful or failed. Often contains user-friendly descriptions.
   */
  message?: string;
}

/**
 * Stack metadata from Commands.com API responses
 *
 * Contains timestamps, versioning information, and installation details for stacks.
 * This metadata tracks the lifecycle of a stack from creation through installation
 * and updates, providing traceability for stack management operations.
 *
 * @example
 * ```typescript
 * const metadata: ApiStackMetadata = {
 *   created_at: '2024-01-15T10:30:00Z',
 *   updated_at: '2024-01-20T14:45:00Z',
 *   published_version: '1.2.0',
 *   local_version: '1.2.0',
 *   installed_from: 'commands.com/example/my-stack',
 *   installed_at: '2024-01-21T09:15:00Z',
 *   cli_version: '1.4.2'
 * };
 * ```
 *
 * @since 1.4.2
 * @public
 */
export interface ApiStackMetadata {
  /**
   * ISO 8601 timestamp when the stack was first created
   *
   * @remarks
   * Provided by the Commands.com backend when a stack is initially published.
   * Used for sorting and displaying stack age.
   */
  created_at?: string;

  /**
   * ISO 8601 timestamp when the stack was last updated
   *
   * @remarks
   * Updated whenever the stack configuration, commands, agents, or other
   * components are modified and republished.
   */
  updated_at?: string;

  /**
   * Source location where the stack was exported from
   *
   * @remarks
   * Tracks the original project path or location when a stack was exported
   * for publishing. Useful for identifying the development origin.
   */
  exported_from?: string;

  /**
   * Unique identifier for the published stack on Commands.com
   *
   * @remarks
   * Internal identifier used by the Commands.com backend to track
   * published stacks across versions and updates.
   */
  published_stack_id?: string;

  /**
   * Version number of the published stack
   *
   * @remarks
   * Semantic version string (e.g., '1.2.0') indicating the published
   * version of the stack on Commands.com.
   */
  published_version?: string;

  /**
   * Local version of the installed stack
   *
   * @remarks
   * Version string indicating the locally installed version, which may
   * differ from the published version if updates are available.
   */
  local_version?: string;

  /**
   * Source URL or identifier where the stack was installed from
   *
   * @remarks
   * Records the installation source for traceability, typically a
   * Commands.com URL like 'commands.com/org/stack-name'.
   */
  installed_from?: string;

  /**
   * ISO 8601 timestamp when the stack was locally installed
   *
   * @remarks
   * Records when the stack was installed on the local system for
   * tracking installation history and update checking.
   */
  installed_at?: string;

  /**
   * Version of Claude Stacks CLI used for installation
   *
   * @remarks
   * Tracks which CLI version was used to install the stack, useful
   * for compatibility checking and debugging.
   */
  cli_version?: string;

  /**
   * ISO 8601 timestamp when the stack was published to Commands.com
   *
   * @remarks
   * Records the publication timestamp, which may differ from created_at
   * if the stack was created locally before being published.
   */
  published_at?: string;

  /**
   * Additional metadata fields
   *
   * @remarks
   * Allows for extensibility of metadata without breaking existing
   * type definitions. Used for future metadata additions.
   */
  [key: string]: unknown;
}

/**
 * Complete stack response from Commands.com API
 *
 * Comprehensive stack data structure returned by the Commands.com backend
 * when fetching individual stacks or browsing available stacks. Contains
 * all stack configuration, components, statistics, and metadata.
 *
 * @example
 * ```typescript
 * const stack: ApiStackResponse = {
 *   org: 'anthropic',
 *   name: 'web-scraper',
 *   title: 'Web Scraping Tools',
 *   description: 'Professional web scraping and data extraction tools',
 *   version: '2.1.0',
 *   author: 'Anthropic Team',
 *   public: true,
 *   commands: [{ name: 'scrape', description: 'Scrape a website' }],
 *   agents: [{ name: 'data-extractor', description: 'Extract structured data' }],
 *   mcpServers: [{ name: 'scraper-server', command: ['node', 'server.js'] }],
 *   viewCount: 1250,
 *   installCount: 89
 * };
 * ```
 *
 * @since 1.4.2
 * @public
 */
export interface ApiStackResponse {
  /**
   * Organization name that owns the stack
   *
   * @remarks
   * Required identifier for the stack owner on Commands.com.
   * Used in URLs like 'commands.com/org/stack-name'.
   */
  org: string;

  /**
   * Unique name of the stack within the organization
   *
   * @remarks
   * Required identifier that must be unique within the organization.
   * Used for CLI commands like 'claude-stacks install org/name'.
   */
  name: string;

  /**
   * Human-readable title for display purposes
   *
   * @remarks
   * Optional display name that can be more descriptive than the technical
   * name. Falls back to the name field when not provided.
   */
  title?: string;

  /**
   * Detailed description of the stack's purpose and functionality
   *
   * @remarks
   * Required field that explains what the stack does, its intended use
   * cases, and any important setup or usage information.
   */
  description: string;

  /**
   * Semantic version of the stack
   *
   * @remarks
   * Optional version string following semantic versioning (e.g., '1.2.0').
   * Used for update detection and compatibility checking.
   */
  version?: string;

  /**
   * Author or creator of the stack
   *
   * @remarks
   * Optional field identifying who created or maintains the stack.
   * Can be an individual name or organization.
   */
  author?: string;

  /**
   * Whether the stack is publicly visible on Commands.com
   *
   * @remarks
   * Controls visibility in public browse listings. Private stacks
   * can still be accessed directly by URL if known.
   */
  public?: boolean;

  /**
   * Array of slash commands included in the stack
   *
   * @remarks
   * Commands that will be available in Claude Code after installation.
   * Each command defines its trigger, description, and behavior.
   */
  commands?: StackCommand[];

  /**
   * Array of AI agents included in the stack
   *
   * @remarks
   * Specialized agents for specific tasks like code review, documentation,
   * or data analysis. Available after stack installation.
   */
  agents?: StackAgent[];

  /**
   * Array of MCP (Model Context Protocol) servers included in the stack
   *
   * @remarks
   * External services and tools that extend Claude's capabilities.
   * Automatically configured in Claude Desktop after installation.
   */
  mcpServers?: StackMcpServer[];

  /**
   * Array of lifecycle hooks included in the stack
   *
   * @remarks
   * Scripts that run at specific points during stack operations like
   * installation, update, or removal. Used for setup and cleanup tasks.
   */
  hooks?: StackHook[];

  /**
   * Stack-specific configuration settings
   *
   * @remarks
   * Custom settings that control stack behavior, feature toggles,
   * or environment-specific configuration values.
   */
  settings?: StackSettings;

  /**
   * Installation and versioning metadata
   *
   * @remarks
   * Tracks installation history, version information, and other
   * metadata for locally installed stacks.
   */
  metadata?: ApiStackMetadata;

  /**
   * ISO 8601 timestamp when the stack was created
   *
   * @remarks
   * Alternative timestamp field used by some API endpoints.
   * May be preferred over metadata.created_at in certain contexts.
   */
  createdAt?: string;

  /**
   * ISO 8601 timestamp when the stack was last updated
   *
   * @remarks
   * Alternative timestamp field used by some API endpoints.
   * May be preferred over metadata.updated_at in certain contexts.
   */
  updatedAt?: string;

  /**
   * Number of times the stack has been viewed on Commands.com
   *
   * @remarks
   * Public statistics showing stack popularity. Used for sorting
   * and trending calculations in browse listings.
   */
  viewCount?: number;

  /**
   * Number of times the stack has been installed
   *
   * @remarks
   * Public statistics showing adoption rate. Important metric for
   * evaluating stack usefulness and community adoption.
   */
  installCount?: number;

  /**
   * Total number of commands in the stack
   *
   * @remarks
   * Quick reference count for the commands array length.
   * Useful for displaying stack complexity at a glance.
   */
  commandCount?: number;

  /**
   * Total number of agents in the stack
   *
   * @remarks
   * Quick reference count for the agents array length.
   * Indicates the variety of AI capabilities included.
   */
  agentCount?: number;

  /**
   * Total number of MCP servers in the stack
   *
   * @remarks
   * Quick reference count for the mcpServers array length.
   * Shows the extent of external tool integrations.
   */
  mcpServerCount?: number;

  /**
   * Total number of lifecycle hooks in the stack
   *
   * @remarks
   * Quick reference count for the hooks array length.
   * Indicates setup complexity and automation level.
   */
  hookCount?: number;
}

/**
 * Search response from Commands.com browse API
 *
 * Paginated search results returned by the browse endpoint when searching
 * or listing available stacks on Commands.com. Includes pagination metadata
 * for handling large result sets efficiently.
 *
 * @example
 * ```typescript
 * const searchResults: ApiSearchResponse = {
 *   stacks: [
 *     { org: 'anthropic', name: 'web-scraper', description: 'Web scraping tools' },
 *     { org: 'example', name: 'data-tools', description: 'Data processing utilities' }
 *   ],
 *   total: 25,
 *   page: 1,
 *   per_page: 10,
 *   totalPages: 3
 * };
 * ```
 *
 * @since 1.4.2
 * @public
 */
export interface ApiSearchResponse {
  /**
   * Array of stack responses matching the search criteria
   *
   * @remarks
   * Contains the actual search results as ApiStackResponse objects.
   * May be empty if no stacks match the search criteria.
   */
  stacks: ApiStackResponse[];

  /**
   * Total number of stacks matching the search criteria
   *
   * @remarks
   * The complete count of matching stacks across all pages.
   * Used for pagination controls and result count display.
   */
  total?: number;

  /**
   * Current page number (1-based indexing)
   *
   * @remarks
   * Indicates which page of results is currently being returned.
   * Used with per_page to calculate result offsets.
   */
  page?: number;

  /**
   * Number of results per page
   *
   * @remarks
   * Maximum number of stack results included in this response.
   * Used to control result set size and pagination behavior.
   */
  per_page?: number;

  /**
   * Total number of pages available
   *
   * @remarks
   * Calculated from total count and per_page size.
   * Used for pagination controls and navigation.
   */
  totalPages?: number;
}

/**
 * User stacks response from Commands.com list API
 *
 * Response structure for listing stacks owned or authored by a specific user
 * or organization. Used by the list command to show user's published stacks
 * and their metadata.
 *
 * @example
 * ```typescript
 * const userStacks: ApiUserStacksResponse = {
 *   stacks: [
 *     {
 *       org: 'user123',
 *       name: 'my-dev-tools',
 *       description: 'Personal development utilities',
 *       public: true,
 *       installCount: 15
 *     }
 *   ],
 *   total: 3
 * };
 * ```
 *
 * @since 1.4.2
 * @public
 */
export interface ApiUserStacksResponse {
  /**
   * Array of stacks owned by the user or organization
   *
   * @remarks
   * Contains all stacks published by the specified user or organization.
   * Includes both public and private stacks if the user is authenticated.
   */
  stacks: ApiStackResponse[];

  /**
   * Total number of stacks owned by the user
   *
   * @remarks
   * Complete count of stacks, useful for display purposes and
   * understanding user's publishing activity level.
   */
  total?: number;
}

/**
 * Authentication token response from Commands.com auth API
 *
 * JWT token response structure returned after successful authentication
 * with Commands.com. Contains access tokens and metadata needed for
 * authenticated API requests.
 *
 * @example
 * ```typescript
 * const authResponse: ApiAuthResponse = {
 *   access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   expires_at: 1704067200000,
 *   token_type: 'Bearer'
 * };
 * ```
 *
 * @since 1.4.2
 * @public
 */
export interface ApiAuthResponse {
  /**
   * JWT access token for authenticated API requests
   *
   * @remarks
   * Required token used in Authorization header for API requests.
   * Format: 'Bearer {access_token}'. Has limited lifetime.
   */
  access_token: string;

  /**
   * JWT refresh token for obtaining new access tokens
   *
   * @remarks
   * Optional long-lived token used to refresh expired access tokens
   * without requiring user re-authentication.
   */
  refresh_token?: string;

  /**
   * Unix timestamp when the access token expires
   *
   * @remarks
   * Milliseconds since epoch when the access token becomes invalid.
   * Used for automatic token refresh before expiration.
   */
  expires_at?: number;

  /**
   * Type of token (typically 'Bearer')
   *
   * @remarks
   * Indicates the authentication scheme to use in the Authorization
   * header. Usually 'Bearer' for JWT tokens.
   */
  token_type?: string;
}

/**
 * Publish response from Commands.com publish API
 *
 * Response structure returned after successfully publishing a stack to
 * Commands.com. Contains the published stack's metadata and access
 * information for verification and sharing.
 *
 * @example
 * ```typescript
 * const publishResponse: ApiPublishResponse = {
 *   org: 'developer123',
 *   name: 'awesome-tools',
 *   organizationUsername: 'developer123',
 *   url: 'https://commands.com/developer123/awesome-tools',
 *   version: '1.0.0',
 *   stack_id: 'st_abc123xyz789'
 * };
 * ```
 *
 * @since 1.4.2
 * @public
 */
export interface ApiPublishResponse {
  /**
   * Organization name where the stack was published
   *
   * @remarks
   * The organization identifier under which the stack is published.
   * Must match the authenticated user's organization access.
   */
  org: string;

  /**
   * Name of the published stack
   *
   * @remarks
   * The unique stack identifier within the organization.
   * Used for installation and referencing the stack.
   */
  name: string;

  /**
   * Human-readable organization username
   *
   * @remarks
   * Display name for the organization, which may differ from
   * the technical org identifier. Used for UI display.
   */
  organizationUsername?: string;

  /**
   * Public URL where the stack can be viewed
   *
   * @remarks
   * Direct link to the stack's page on Commands.com where users
   * can view details, documentation, and installation instructions.
   */
  url?: string;

  /**
   * Version of the published stack
   *
   * @remarks
   * Semantic version string assigned to this publication.
   * Used for version tracking and update detection.
   */
  version?: string;

  /**
   * Unique internal identifier for the published stack
   *
   * @remarks
   * Backend database identifier for the stack record.
   * Used for internal API operations and tracking.
   */
  stack_id?: string;

  /**
   * Additional publish response fields
   *
   * @remarks
   * Allows for extensibility of publish responses without breaking
   * existing type definitions. Used for future API enhancements.
   */
  [key: string]: unknown;
}

/**
 * Stack statistics for Commands.com API responses
 *
 * Aggregated statistics and counts for a stack's components and usage.
 * Used for displaying stack popularity, complexity, and adoption metrics
 * in browse listings and stack details.
 *
 * @example
 * ```typescript
 * const stats: ApiStackStats = {
 *   viewCount: 1250,
 *   installCount: 89,
 *   commandCount: 5,
 *   agentCount: 2,
 *   mcpServerCount: 3,
 *   hookCount: 1
 * };
 * ```
 *
 * @since 1.4.2
 * @public
 */
export interface ApiStackStats {
  /**
   * Number of times the stack has been viewed
   *
   * @remarks
   * Public popularity metric showing how many users have viewed
   * the stack's details page on Commands.com. Used for trending.
   */
  viewCount: number;

  /**
   * Number of times the stack has been installed
   *
   * @remarks
   * Adoption metric showing how many users have successfully
   * installed the stack using the CLI. Indicates usefulness.
   */
  installCount: number;

  /**
   * Total number of slash commands in the stack
   *
   * @remarks
   * Count of available commands that will be installed.
   * Indicates the breadth of functionality provided.
   */
  commandCount: number;

  /**
   * Total number of AI agents in the stack
   *
   * @remarks
   * Count of specialized AI agents included in the stack.
   * Shows the variety of AI-powered capabilities available.
   */
  agentCount: number;

  /**
   * Total number of MCP servers in the stack
   *
   * @remarks
   * Count of Model Context Protocol servers for external integrations.
   * Indicates the extent of third-party tool connections.
   */
  mcpServerCount: number;

  /**
   * Total number of lifecycle hooks in the stack
   *
   * @remarks
   * Count of installation, update, and removal hooks.
   * Shows the level of automation and setup complexity.
   */
  hookCount: number;
}

/**
 * Type guard to validate ApiStackResponse objects at runtime
 *
 * Performs runtime validation to ensure an unknown object conforms to the
 * ApiStackResponse interface structure. Checks for required fields and
 * their expected types to provide type safety for API responses.
 *
 * @param obj - Unknown object to validate as ApiStackResponse
 * @returns True if the object is a valid ApiStackResponse, false otherwise
 * @throws Never throws, returns false for invalid inputs
 *
 * @example
 * ```typescript
 * const apiResponse = await fetch('/api/stack/org/name').then(r => r.json());
 *
 * if (isApiStackResponse(apiResponse)) {
 *   // TypeScript now knows apiResponse is ApiStackResponse
 *   console.log(`Stack: ${apiResponse.org}/${apiResponse.name}`);
 * } else {
 *   throw new Error('Invalid stack response format');
 * }
 * ```
 *
 * @since 1.4.2
 * @public
 */
export function isApiStackResponse(obj: unknown): obj is ApiStackResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'org' in obj &&
    'name' in obj &&
    'description' in obj &&
    typeof (obj as Record<string, unknown>).org === 'string' &&
    typeof (obj as Record<string, unknown>).name === 'string' &&
    typeof (obj as Record<string, unknown>).description === 'string'
  );
}

/**
 * Type guard to validate ApiSearchResponse objects at runtime
 *
 * Performs runtime validation to ensure an unknown object conforms to the
 * ApiSearchResponse interface structure. Validates the presence of the
 * required stacks array for search result responses.
 *
 * @param obj - Unknown object to validate as ApiSearchResponse
 * @returns True if the object is a valid ApiSearchResponse, false otherwise
 * @throws Never throws, returns false for invalid inputs
 *
 * @example
 * ```typescript
 * const searchResults = await fetch('/api/browse?q=web').then(r => r.json());
 *
 * if (isApiSearchResponse(searchResults)) {
 *   // TypeScript now knows searchResults is ApiSearchResponse
 *   console.log(`Found ${searchResults.stacks.length} stacks`);
 *   console.log(`Total results: ${searchResults.total || 'unknown'}`);
 * } else {
 *   throw new Error('Invalid search response format');
 * }
 * ```
 *
 * @since 1.4.2
 * @public
 */
export function isApiSearchResponse(obj: unknown): obj is ApiSearchResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'stacks' in obj &&
    Array.isArray((obj as Record<string, unknown>).stacks)
  );
}

/**
 * Type guard to validate ApiUserStacksResponse objects at runtime
 *
 * Performs runtime validation to ensure an unknown object conforms to the
 * ApiUserStacksResponse interface structure. Validates the presence of the
 * required stacks array for user-owned stack listings.
 *
 * @param obj - Unknown object to validate as ApiUserStacksResponse
 * @returns True if the object is a valid ApiUserStacksResponse, false otherwise
 * @throws Never throws, returns false for invalid inputs
 *
 * @example
 * ```typescript
 * const userStacks = await fetch('/api/user/stacks').then(r => r.json());
 *
 * if (isApiUserStacksResponse(userStacks)) {
 *   // TypeScript now knows userStacks is ApiUserStacksResponse
 *   console.log(`User has ${userStacks.stacks.length} published stacks`);
 *   if (userStacks.total) {
 *     console.log(`Total: ${userStacks.total}`);
 *   }
 * } else {
 *   throw new Error('Invalid user stacks response format');
 * }
 * ```
 *
 * @since 1.4.2
 * @public
 */
export function isApiUserStacksResponse(obj: unknown): obj is ApiUserStacksResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'stacks' in obj &&
    Array.isArray((obj as Record<string, unknown>).stacks)
  );
}

/**
 * Type guard to validate ApiAuthResponse objects at runtime
 *
 * Performs runtime validation to ensure an unknown object conforms to the
 * ApiAuthResponse interface structure. Validates the presence of the required
 * access_token field for authentication responses.
 *
 * @param obj - Unknown object to validate as ApiAuthResponse
 * @returns True if the object is a valid ApiAuthResponse, false otherwise
 * @throws Never throws, returns false for invalid inputs
 *
 * @example
 * ```typescript
 * const authData = await fetch('/api/auth/token').then(r => r.json());
 *
 * if (isApiAuthResponse(authData)) {
 *   // TypeScript now knows authData is ApiAuthResponse
 *   localStorage.setItem('access_token', authData.access_token);
 *
 *   if (authData.refresh_token) {
 *     localStorage.setItem('refresh_token', authData.refresh_token);
 *   }
 *
 *   if (authData.expires_at) {
 *     console.log(`Token expires at: ${new Date(authData.expires_at)}`);
 *   }
 * } else {
 *   throw new Error('Invalid authentication response format');
 * }
 * ```
 *
 * @since 1.4.2
 * @public
 */
export function isApiAuthResponse(obj: unknown): obj is ApiAuthResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'access_token' in obj &&
    typeof (obj as Record<string, unknown>).access_token === 'string'
  );
}
