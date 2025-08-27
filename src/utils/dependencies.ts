import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { colors } from './colors.js';
import type { StackMcpServer } from '../types/index.js';

export interface MissingDependency {
  command: string;
  description?: string;
  type: 'mcp' | 'statusline' | 'system';
  requiredBy: string[];
  installInstructions: string;
  notes?: string;
}

export interface DependencyMapping {
  description: string;
  type: 'system' | 'statusline';
  checkPaths?: string[];
  installInstructions: {
    default: string;
    notes?: string;
  } & {
    [platform: string]: string | { [packageManager: string]: string; default: string } | undefined;
  };
}

export interface DependencyMappings {
  commands: Record<string, DependencyMapping>;
}

let dependencyMappings: DependencyMappings | null = null;

function loadDependencyMappings(): DependencyMappings {
  if (!dependencyMappings) {
    try {
      const mappingsPath = join(process.cwd(), 'src', 'config', 'dependency-mappings.json');
      const mappingsData = readFileSync(mappingsPath, 'utf-8');
      dependencyMappings = JSON.parse(mappingsData) as DependencyMappings;
    } catch {
      console.warn('Failed to load dependency mappings, using fallback');
      dependencyMappings = { commands: {} };
    }
  }
  return dependencyMappings;
}

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
