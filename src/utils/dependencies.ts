import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { colors } from './colors.js';
import type { StackMcpServer } from '../types/index.js';

/**
 * Represents a missing system dependency that prevents functionality from working
 *
 * Contains information about a command or tool that is required but not found
 * on the system, including installation instructions and affected components.
 *
 * @since 1.0.0
 * @public
 */
export interface MissingDependency {
  /** The command or executable name that is missing */
  command: string;
  /** Optional human-readable description of what this dependency provides */
  description?: string;
  /** Classification of dependency type (MCP server, status line, or system command) */
  type: 'mcp' | 'statusline' | 'system';
  /** List of components, servers, or features that require this dependency */
  requiredBy: string[];
  /** Platform-specific installation instructions for this dependency */
  installInstructions: string;
  /** Optional additional notes about installation or usage */
  notes?: string;
}

/**
 * Package manager specific installation instructions
 *
 * Maps package managers to their installation commands with a default fallback.
 *
 * @since 1.0.0
 * @public
 */
export interface PackageManagerInstructions {
  /** Default installation command when no specific package manager is available */
  default: string;
  /** Additional package manager specific commands (npm, brew, apt, etc.) */
  [packageManager: string]: string;
}

/**
 * Installation instructions for a dependency
 *
 * Contains default installation commands and optional platform-specific alternatives.
 *
 * @since 1.0.0
 * @public
 */
export interface InstallationInstructions {
  /** Default installation instructions if no platform-specific option available */
  default: string;
  /** Optional additional notes about installation */
  notes?: string;
  /** Platform-specific installation instructions (darwin, linux, win32, etc.) */
  [platform: string]: string | PackageManagerInstructions | undefined;
}

/**
 * Defines how to check for and install a specific dependency
 *
 * Contains platform-specific installation instructions and alternative
 * paths to check for command availability. Used by the dependency
 * checking system to provide accurate installation guidance.
 *
 * @since 1.0.0
 * @public
 */
export interface DependencyMapping {
  /** Human-readable description of what this dependency provides */
  description: string;
  /** Classification of this dependency type */
  type: 'system' | 'statusline';
  /** Optional alternative paths to check for command existence */
  checkPaths?: string[];
  /** Installation instructions organized by platform and package manager */
  installInstructions: InstallationInstructions;
}

/**
 * Container for all dependency mapping configurations
 *
 * Loaded from dependency-mappings.json file, contains mappings for all
 * known commands and their installation instructions across platforms.
 *
 * @since 1.0.0
 * @public
 */
export interface DependencyMappings {
  /** Map of command names to their dependency configurations */
  commands: Record<string, DependencyMapping>;
}

let dependencyMappings: DependencyMappings | null = null;

function loadDependencyMappings(): DependencyMappings {
  if (!dependencyMappings) {
    try {
      // Try multiple paths to find the dependency mappings file
      const possiblePaths = [
        // During development
        join(process.cwd(), 'src', 'config', 'dependency-mappings.json'),
        // In built distribution
        join(process.cwd(), 'dist', 'config', 'dependency-mappings.json'),
        // In tests or when installed globally
        join(__dirname, '..', 'config', 'dependency-mappings.json'),
      ];

      let mappingsData: string | null = null;
      for (const mappingsPath of possiblePaths) {
        try {
          mappingsData = readFileSync(mappingsPath, 'utf-8');
          break;
        } catch {
          // Try next path
        }
      }

      if (!mappingsData) {
        throw new Error('Dependency mappings file not found');
      }

      dependencyMappings = JSON.parse(mappingsData) as DependencyMappings;
    } catch {
      console.warn('Failed to load dependency mappings, using fallback');
      dependencyMappings = { commands: {} };
    }
  }
  return dependencyMappings;
}

/**
 * Checks if a command exists and is available in the system PATH
 *
 * Uses the 'which' command to determine if the specified command is installed
 * and executable. Works across Unix-like systems (macOS, Linux).
 *
 * @param command - The command name to check for existence
 * @returns Promise resolving to true if command exists, false otherwise
 * @example
 * ```typescript
 * const hasGit = await checkCommandExists('git');
 * if (hasGit) {
 *   console.log('Git is available');
 * } else {
 *   console.log('Git is not installed');
 * }
 * ```
 * @since 1.0.0
 * @public
 */
export async function checkCommandExists(command: string): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn('which', [command], { stdio: 'ignore' });
    child.on('close', code => {
      resolve(code === 0);
    });
    child.on('error', () => {
      resolve(false);
    });
  });
}

async function checkCommandExistsInPaths(command: string, paths: string[]): Promise<boolean> {
  const pathChecks = paths.map(async path => {
    const resolvedPath = path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
    const commandToCheck = resolvedPath.includes('/') ? resolvedPath : command;
    return checkCommandExists(commandToCheck);
  });

  const results = await Promise.all(pathChecks);
  return results.some(exists => exists);
}

async function getAvailablePackageManager(): Promise<string | null> {
  const { platform } = process;

  if (platform === 'darwin' && (await checkCommandExists('brew'))) {
    return 'brew';
  }

  if (platform === 'linux') {
    if (await checkCommandExists('apt')) return 'apt';
    if (await checkCommandExists('yum')) return 'yum';
    if (await checkCommandExists('dnf')) return 'dnf';
  }

  if (platform === 'win32') {
    if (await checkCommandExists('winget')) return 'winget';
    if (await checkCommandExists('choco')) return 'choco';
  }

  return null;
}

async function getInstallInstructionsWithPackageManager(
  command: string,
  mapping?: DependencyMapping
): Promise<string> {
  if (!mapping) {
    return `Install ${command} (check documentation for instructions)`;
  }

  const { platform } = process;
  const instructions = mapping.installInstructions;
  const packageManager = await getAvailablePackageManager();

  const platformInstructions = instructions[platform];

  if (
    typeof platformInstructions === 'object' &&
    platformInstructions &&
    packageManager &&
    platformInstructions[packageManager]
  ) {
    return platformInstructions[packageManager];
  }

  if (typeof platformInstructions === 'object' && platformInstructions?.default) {
    return platformInstructions.default;
  }

  if (typeof platformInstructions === 'string') {
    return platformInstructions;
  }

  return instructions.default;
}

function buildCommandToServersMap(mcpServers: StackMcpServer[]): Map<string, string[]> {
  const commandToServers = new Map<string, string[]>();

  for (const mcpServer of mcpServers) {
    if (mcpServer.type !== 'stdio' || !mcpServer.command) {
      continue;
    }

    const { command } = mcpServer;
    const serverName = mcpServer.name || 'Unknown MCP Server';

    if (!commandToServers.has(command)) {
      commandToServers.set(command, []);
    }
    commandToServers.get(command)!.push(serverName);
  }

  return commandToServers;
}

async function createMissingDependency(
  command: string,
  serverNames: string[],
  mapping: DependencyMapping | undefined
): Promise<MissingDependency> {
  return {
    command,
    description: mapping?.description,
    type: 'mcp',
    requiredBy: serverNames,
    installInstructions: await getInstallInstructionsWithPackageManager(command, mapping),
    notes: mapping?.installInstructions.notes,
  };
}

/**
 * Checks for missing dependencies required by MCP servers in a stack
 *
 * Analyzes the provided MCP servers to identify command dependencies and
 * verifies their availability on the system. Returns detailed information
 * about any missing dependencies including installation instructions.
 *
 * @param mcpServers - Array of MCP server configurations to check dependencies for
 * @returns Promise resolving to array of missing dependencies, empty if all found
 * @throws {Error} When dependency mapping configuration cannot be loaded
 * @example
 * ```typescript
 * const servers = [{ name: 'github', command: 'gh', type: 'stdio' }];
 * const missing = await checkMcpDependencies(servers);
 * if (missing.length > 0) {
 *   console.log('Missing dependencies:', missing.map(d => d.command));
 * }
 * ```
 * @since 1.0.0
 * @public
 */
export async function checkMcpDependencies(
  mcpServers: StackMcpServer[]
): Promise<MissingDependency[]> {
  const mappings = loadDependencyMappings();
  const commandToServers = buildCommandToServersMap(mcpServers);

  const commandChecks = Array.from(commandToServers.entries()).map(
    async ([command, serverNames]) => {
      const mapping = mappings.commands[command];
      const checkPaths = mapping?.checkPaths ?? [command];

      return {
        command,
        serverNames,
        mapping,
        exists: await checkCommandExistsInPaths(command, checkPaths),
      };
    }
  );

  const results = await Promise.all(commandChecks);
  const missingDepsPromises = results
    .filter(({ exists }) => !exists)
    .map(({ command, serverNames, mapping }) =>
      createMissingDependency(command, serverNames, mapping)
    );

  return Promise.all(missingDepsPromises);
}

/**
 * Checks for missing dependencies required by status line display functionality
 *
 * Verifies that commands specified in status line configuration are available
 * on the system. Status line dependencies are typically optional and only
 * affect visual display enhancements.
 *
 * @param statusLine - Optional status line configuration with command requirements
 * @returns Promise resolving to array of missing status line dependencies
 * @example
 * ```typescript
 * const statusConfig = { type: 'command', command: 'git' };
 * const missing = await checkStatusLineDependencies(statusConfig);
 * if (missing.length === 0) {
 *   console.log('Status line ready');
 * }
 * ```
 * @since 1.0.0
 * @public
 */
// eslint-disable-next-line complexity
export async function checkStatusLineDependencies(statusLine?: {
  type?: string;
  command?: string;
}): Promise<MissingDependency[]> {
  if (!statusLine?.type || statusLine.type !== 'command' || !statusLine.command) {
    return [];
  }

  const mappings = loadDependencyMappings();
  const { command } = statusLine;
  const commandName = command.includes('/') ? (command.split('/').pop() ?? command) : command;
  const mapping = mappings.commands[command] ?? mappings.commands[commandName];
  const checkPaths = mapping?.checkPaths ?? [command, commandName];

  const exists = await checkCommandExistsInPaths(commandName, checkPaths);

  if (exists) {
    return [];
  }

  return [
    {
      command: commandName,
      description: mapping?.description ?? 'Status line command',
      type: 'statusline',
      requiredBy: ['Status line display'],
      installInstructions: await getInstallInstructionsWithPackageManager(commandName, mapping),
      notes: mapping?.installInstructions.notes,
    },
  ];
}

function displayDependenciesGroup(
  deps: MissingDependency[],
  title: string,
  description: string
): void {
  if (deps.length === 0) return;

  console.log(colors.meta(title));
  console.log(colors.meta(description));

  for (const dep of deps) {
    const commandDisplay = dep.description ? `${dep.command} - ${dep.description}` : dep.command;
    console.log(colors.error(`❌ ${commandDisplay}`));

    const requiredLabel = dep.type === 'statusline' ? 'Required for' : 'Required by';
    console.log(colors.meta(`   ${requiredLabel}: ${dep.requiredBy.join(', ')}`));
    console.log(colors.info(`   📦 Installation: ${dep.installInstructions}`));

    if (dep.notes) {
      console.log(colors.meta(`   ℹ️  Note: ${dep.notes}`));
    }
    console.log();
  }
}

/**
 * Displays formatted output of missing dependencies organized by type
 *
 * Presents missing dependencies in a user-friendly format with installation
 * instructions, categorized by dependency type (MCP, status line, system).
 * Includes helpful context about impact and installation guidance.
 *
 * @param missingDeps - Array of missing dependencies to display
 * @example
 * ```typescript
 * const missing = await checkMcpDependencies(servers);
 * displayMissingDependencies(missing);
 * // Outputs formatted dependency information to console
 * ```
 * @since 1.0.0
 * @public
 */
export function displayMissingDependencies(missingDeps: MissingDependency[]): void {
  if (missingDeps.length === 0) return;

  console.log(colors.warning('\\n⚠️  Missing Dependencies Detected'));

  const statusLineDeps = missingDeps.filter(dep => dep.type === 'statusline');
  const mcpDeps = missingDeps.filter(dep => dep.type === 'mcp');
  const systemDeps = missingDeps.filter(dep => dep.type === 'system');

  displayDependenciesGroup(
    statusLineDeps,
    '\\nStatusLine Dependencies:',
    'The following status line commands are missing (optional UI enhancements):\\n'
  );

  displayDependenciesGroup(
    mcpDeps,
    statusLineDeps.length > 0 ? 'MCP Server Dependencies:' : '\\nMCP Server Dependencies:',
    'The following MCP servers may not work due to missing dependencies:\\n'
  );

  displayDependenciesGroup(
    systemDeps,
    statusLineDeps.length > 0 || mcpDeps.length > 0
      ? 'System Dependencies:'
      : '\\nSystem Dependencies:',
    'The following system commands are missing:\\n'
  );

  console.log(
    colors.meta('Missing MCP server dependencies will prevent those servers from starting.')
  );
  console.log(
    colors.meta('Missing status line dependencies only affect the visual status line display.')
  );
  console.log(
    colors.meta(
      "You can still use other parts of the stack that don't require these dependencies.\\n"
    )
  );
}
