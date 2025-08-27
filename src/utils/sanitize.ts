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
  // Handle both types of separators
  const unixSeparated = filePath.split('/').pop() ?? filePath;
  const windowsSeparated = unixSeparated.split('\\').pop() ?? unixSeparated;
  return windowsSeparated;
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
 * Sanitize a single path value by replacing it with a generic placeholder
 */
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
