import * as path from 'path';
import type { StackMcpServer } from '../types/index.js';

/**
 * Patterns that indicate a value is a local filesystem path
 */
const PATH_PATTERNS = {
  // Absolute paths
  ABSOLUTE_UNIX: /^\/[^/]/,
  ABSOLUTE_WINDOWS: /^[A-Za-z]:\\/,

  // User directory paths
  USER_DIRS: /\/(?:Users|home|Documents|Desktop|Downloads)\//i,

  // Relative paths
  RELATIVE: /^\.\.?[/\\]/,

  // File extensions indicating scripts or config files
  SCRIPT_EXTENSIONS: /\.(js|py|ts|sh|json|yaml|yml|toml|cfg|conf|ini)$/i,

  // Path-like structures
  PATH_STRUCTURE: /[/\\].*[/\\]/,
};

/**
 * Patterns that indicate a value is NOT a local path (should be preserved)
 */
const NON_PATH_PATTERNS = {
  // Command line flags
  FLAGS: /^-{1,2}\w/,

  // URLs
  URLS: /^https?:\/\//i,

  // Docker images (but not relative paths starting with ./)
  DOCKER_IMAGES: /^(?!\.)[\w.-]+\/[\w.-]+(?::[\w.-]+)?$/,

  // Common commands (single words)
  COMMANDS: /^(node|python|npm|yarn|pnpm|docker|run|start|serve|install|build|test|dev)$/i,

  // Environment variable names (when used as references)
  ENV_VARS: /^\$?\w+$/,
};

/**
 * Common command executables that should be generalized but not treated as sensitive paths
 */
const EXECUTABLE_MAPPINGS: Record<string, string> = {
  '/usr/bin/node': 'node',
  '/usr/local/bin/node': 'node',
  '/opt/homebrew/bin/node': 'node',
  'C:\\Program Files\\nodejs\\node.exe': 'node',
  '/usr/bin/python': 'python',
  '/usr/bin/python3': 'python3',
  '/usr/local/bin/python': 'python',
  '/usr/local/bin/python3': 'python3',
};

/**
 * Check if a path appears to be a common executable based on filename patterns
 */
function isCommonExecutablePattern(value: string): string | null {
  const filename = getFilename(value).toLowerCase();

  if (filename === 'node' || filename === 'node.exe') {
    return 'node';
  }
  if (filename === 'python' || filename === 'python.exe') {
    return 'python';
  }
  if (filename === 'python3' || filename === 'python3.exe') {
    return 'python3';
  }

  return null;
}

/**
 * Cross-platform basename that handles both Unix and Windows paths
 */
function getFilename(filePath: string): string {
  // Handle both types of separators by normalizing first
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() ?? filePath;
}

/**
 * Check if a value appears to be a local filesystem path that should be sanitized
 */
export function isLocalPath(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // First check if it's explicitly NOT a path
  if (Object.values(NON_PATH_PATTERNS).some(pattern => pattern.test(value))) {
    return false;
  }

  // Then check if it matches path patterns
  return Object.values(PATH_PATTERNS).some(pattern => pattern.test(value));
}

/**
 * Check if a value is a common executable that should be mapped to a generic command
 */
export function isCommonExecutable(value: string): boolean {
  // Check exact matches first
  if (value in EXECUTABLE_MAPPINGS) {
    return true;
  }

  // Check pattern matches for Windows paths and non-standard locations
  return isCommonExecutablePattern(value) !== null;
}

/**
 * Patterns that indicate a filename contains sensitive information that should be generalized
 */
const SENSITIVE_FILENAME_PATTERNS = {
  // OAuth client credentials (Google, etc.)
  OAUTH_CLIENT_ID: /client_secret.*\.apps\.googleusercontent\.com/i,
  OAUTH_CREDENTIALS: /credentials.*\d{10,}/i,
  OAUTH_GENERAL: /(oauth|client_secret)/i,

  // API keys and tokens
  API_KEYS: /_key_\w+|api_key_\w+|token_\w+/i,

  // User-specific identifiers
  USER_IDS: /\d{10,}/,

  // Long random strings (likely tokens/keys)
  RANDOM_STRINGS: /[a-zA-Z0-9]{20,}/,
};

/**
 * Check if a filename contains sensitive information that should be generalized
 */
function containsSensitiveFilename(filename: string): boolean {
  return Object.values(SENSITIVE_FILENAME_PATTERNS).some(pattern => pattern.test(filename));
}

/**
 * Generate a generic filename based on the original filename's purpose
 */
function generateGenericFilename(originalFilename: string): string {
  const extension = path.extname(originalFilename);
  const baseName = path.basename(originalFilename, extension).toLowerCase();

  // Map common patterns to generic names
  if (baseName.includes('client_secret') || baseName.includes('oauth')) {
    return `oauth_credentials${extension}`;
  }
  if (baseName.includes('credentials')) {
    return `credentials${extension}`;
  }
  if (baseName.includes('config')) {
    return `config${extension}`;
  }
  if (baseName.includes('key') || baseName.includes('token')) {
    return `api_key${extension}`;
  }
  if (baseName.includes('cert')) {
    return `certificate${extension}`;
  }

  // Default generic name
  return `sensitive_file${extension}`;
}

export function sanitizePath(originalPath: string): string {
  if (!originalPath || typeof originalPath !== 'string') {
    return originalPath;
  }

  // Check for common executable patterns (by filename) first - handles all cases
  const commonExecutable = isCommonExecutablePattern(originalPath);
  if (commonExecutable) {
    return commonExecutable;
  }

  // Map common executables to generic commands (exact matches) as fallback
  if (originalPath in EXECUTABLE_MAPPINGS) {
    return EXECUTABLE_MAPPINGS[originalPath];
  }

  // For other paths, create a generic placeholder
  // Handle both Unix and Windows path separators
  const filename = getFilename(originalPath);
  const extension = path.extname(filename);

  // Check if filename contains sensitive information
  if (containsSensitiveFilename(filename)) {
    const genericFilename = generateGenericFilename(filename);
    return `/path/to/${genericFilename}`;
  }

  if (extension) {
    // Keep the filename structure but generalize the path
    return `/path/to/${filename}`;
  } else {
    // For directories or executables without extensions
    return `/path/to/${filename}`;
  }
}

/**
 * Sanitize an array of arguments, preserving commands/flags but sanitizing paths
 */
export function sanitizeArgs(args?: string[]): string[] | undefined {
  if (!args || !Array.isArray(args)) {
    return args;
  }

  return args.map(arg => {
    if (isLocalPath(arg)) {
      return sanitizePath(arg);
    }
    return arg;
  });
}

/**
 * Sanitize environment variables, replacing file paths with placeholders
 */
export function sanitizeEnvVars(env?: Record<string, string>): Record<string, string> | undefined {
  if (!env || typeof env !== 'object') {
    return env;
  }

  const sanitizedEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && isLocalPath(value)) {
      sanitizedEnv[key] = sanitizePath(value);
    } else {
      sanitizedEnv[key] = value;
    }
  }

  return sanitizedEnv;
}

/**
 * Sanitize a command path
 */
export function sanitizeCommand(command?: string): string | undefined {
  if (!command || typeof command !== 'string') {
    return command;
  }

  if (isLocalPath(command)) {
    return sanitizePath(command);
  }

  return command;
}

/**
 * Sanitize a complete MCP server configuration
 */
export function sanitizeMcpServer(server: StackMcpServer): StackMcpServer {
  return {
    ...server,
    command: sanitizeCommand(server.command),
    args: sanitizeArgs(server.args),
    env: sanitizeEnvVars(server.env),
  };
}

/**
 * Sanitize an array of MCP servers
 */
export function sanitizeMcpServers(servers?: StackMcpServer[]): StackMcpServer[] | undefined {
  if (!servers || !Array.isArray(servers)) {
    return servers;
  }

  return servers.map(sanitizeMcpServer);
}

/**
 * Check if an MCP server contains any values that would be sanitized
 */
export function containsSensitiveData(server: StackMcpServer): boolean {
  // Check command
  if (server.command && isLocalPath(server.command)) {
    return true;
  }

  // Check args
  if (server.args?.some(arg => isLocalPath(arg))) {
    return true;
  }

  // Check env values
  if (server.env) {
    for (const value of Object.values(server.env)) {
      if (typeof value === 'string' && isLocalPath(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get a summary of what would be sanitized in an MCP server
 */
export function getSanitizationSummary(server: StackMcpServer): {
  serverName: string;
  sensitiveFields: string[];
} {
  const sensitiveFields: string[] = [];

  if (server.command && isLocalPath(server.command)) {
    sensitiveFields.push('command');
  }

  if (server.args?.some(arg => isLocalPath(arg))) {
    sensitiveFields.push('args');
  }

  if (server.env) {
    const sensitiveEnvKeys = Object.entries(server.env)
      .filter(([, value]) => typeof value === 'string' && isLocalPath(value))
      .map(([key]) => key);

    if (sensitiveEnvKeys.length > 0) {
      sensitiveFields.push(`env (${sensitiveEnvKeys.join(', ')})`);
    }
  }

  return {
    serverName: server.name,
    sensitiveFields,
  };
}

/**
 * Sanitize settings object, focusing on permissions that may contain local paths
 */
export function sanitizeSettings(
  settings?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!settings || typeof settings !== 'object') {
    return settings;
  }

  const sanitizedSettings: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(settings)) {
    if (key === 'permissions' && value && typeof value === 'object') {
      sanitizedSettings[key] = sanitizePermissions(value as Record<string, unknown>);
    } else {
      sanitizedSettings[key] = value;
    }
  }

  return sanitizedSettings;
}

/**
 * Sanitize permissions object, removing or sanitizing local paths
 */
function sanitizePermissions(permissions: Record<string, unknown>): Record<string, unknown> {
  const sanitizedPermissions: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(permissions)) {
    if (key === 'allow' && Array.isArray(value)) {
      // Filter out or sanitize permission entries with local paths
      sanitizedPermissions[key] = value
        .map(permission => {
          if (typeof permission === 'string') {
            return sanitizePermissionString(permission);
          }
          return permission as string;
        })
        .filter((permission): permission is string => permission !== null);
    } else {
      sanitizedPermissions[key] = value;
    }
  }

  return sanitizedPermissions;
}

/**
 * Sanitize a single permission string, removing local paths
 */
function sanitizePermissionString(permission: string): string | null {
  // Match patterns like "Read(//Users/username/...)" or "Read(/home/user/...)"
  const localPathPermissionPattern = /^(\w+\()(\/\/[^/]+\/[^/]+\/|\/(?:Users|home)\/[^/]+\/)/i;

  if (localPathPermissionPattern.test(permission)) {
    // For local paths, we could either remove them entirely or replace with generic paths
    // For security, it's safer to remove them entirely since they're user-specific
    return null;
  }

  return permission;
}

/**
 * Check if settings contain any sensitive data that would be sanitized
 */
export function settingsContainsSensitiveData(settings?: Record<string, unknown>): boolean {
  if (!settings || typeof settings !== 'object') {
    return false;
  }

  const { permissions } = settings;
  if (!permissions || typeof permissions !== 'object') {
    return false;
  }

  const { allow } = permissions as Record<string, unknown>;
  if (!Array.isArray(allow)) {
    return false;
  }

  return allow.some(permission => {
    if (typeof permission === 'string') {
      const localPathPermissionPattern = /^(\w+\()(\/\/[^/]+\/[^/]+\/|\/(?:Users|home)\/[^/]+\/)/i;
      return localPathPermissionPattern.test(permission);
    }
    return false;
  });
}
