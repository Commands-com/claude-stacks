import { spawn } from 'child_process';
import { colors } from './colors.js';
import type { StackMcpServer } from '../types/index.js';

export interface MissingDependency {
  command: string;
  mcpServers: string[];
  installInstructions: string;
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

export async function checkMcpDependencies(
  mcpServers: StackMcpServer[]
): Promise<MissingDependency[]> {
  const missingDeps: MissingDependency[] = [];

  // Group servers by command to avoid duplicate checks
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

  // Check all commands in parallel
  const commandChecks = Array.from(commandToServers.entries()).map(
    async ([command, serverNames]) => ({
      command,
      serverNames,
      exists: await checkCommandExists(command),
    })
  );

  const results = await Promise.all(commandChecks);

  for (const { command, serverNames, exists } of results) {
    if (!exists) {
      missingDeps.push({
        command,
        mcpServers: serverNames,
        installInstructions: getInstallInstructions(command),
      });
    }
  }

  return missingDeps;
}

function getInstallInstructions(command: string): string {
  switch (command) {
    case 'uvx':
      return 'Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh';
    case 'npx':
      return 'Install Node.js: https://nodejs.org/ (npx comes with Node.js)';
    case 'docker':
      return 'Install Docker: https://docs.docker.com/get-docker/';
    case 'python':
    case 'python3':
      return 'Install Python: https://www.python.org/downloads/';
    case 'node':
      return 'Install Node.js: https://nodejs.org/';
    default:
      return `Install ${command} (check the MCP server documentation for instructions)`;
  }
}

export function displayMissingDependencies(missingDeps: MissingDependency[]): void {
  if (missingDeps.length === 0) {
    return;
  }

  console.log(colors.warning('\n⚠️  Missing Dependencies Detected'));
  console.log(colors.meta('The following MCP servers may not work due to missing dependencies:\n'));

  for (const dep of missingDeps) {
    console.log(colors.error(`❌ Command not found: ${dep.command}`));
    console.log(colors.meta(`   Required by: ${dep.mcpServers.join(', ')}`));
    console.log(colors.info(`   To fix: ${dep.installInstructions}`));
    console.log();
  }

  console.log(
    colors.meta(
      'These MCP servers will be installed but may fail to start until dependencies are available.'
    )
  );
  console.log(
    colors.meta(
      "You can still use other parts of the stack that don't require these dependencies.\n"
    )
  );
}
