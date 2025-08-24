import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

import { DeveloperStack, StackCommand, StackAgent, StackMcpServer, ExportOptions } from '../types';
import { colors } from '../utils/colors';

function extractDescriptionFromContent(content: string): string {
  // Extract first meaningful line as description
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('<!--')) {
      return trimmed.substring(0, 100); // Limit description length
    }
  }
  return 'No description available';
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
        
        commandsMap.set(name, {
          name,
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
        
        agentsMap.set(name, {
          name,
          filePath: `./.claude/agents/${agentFile}`,
          content,
          description: extractDescriptionFromContent(content)
        });
      }
    }
  }

  // Get MCP server configuration for current project
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  if (await fs.pathExists(claudeJsonPath)) {
    try {
      const claudeConfig = await fs.readJson(claudeJsonPath);
      const mcpProjects = claudeConfig.projects || {};
      const currentProjectPath = process.cwd();
      const projectConfig = mcpProjects[currentProjectPath];
      
      if (projectConfig && projectConfig.mcpServers) {
        const mcpServers: StackMcpServer[] = [];
        Object.entries(projectConfig.mcpServers).forEach(([name, config]: [string, any]) => {
          mcpServers.push({
            name,
            type: config.type || 'stdio',
            command: config.command,
            args: config.args,
            url: config.url,
            env: config.env
          });
        });
        stack.mcpServers = mcpServers;
      }
    } catch (error) {
      // Ignore .claude.json parsing errors
    }
  }

  // Convert maps to arrays
  stack.commands = Array.from(commandsMap.values());
  stack.agents = Array.from(agentsMap.values());

  return stack;
}

export async function exportAction(filename?: string, options: ExportOptions = {}): Promise<void> {
  try {
    // Export current environment to stack
    const stack = await exportCurrentStack({ 
      name: options.name,
      description: options.description,
      includeGlobal: options.includeGlobal !== false,
      includeClaudeMd: true 
    });

    // Determine output filename
    let outputFilename = filename;
    if (!outputFilename) {
      const dirName = path.basename(process.cwd());
      outputFilename = `${dirName}-stack.json`;
    }

    // Ensure .json extension
    if (!outputFilename.endsWith('.json')) {
      outputFilename += '.json';
    }

    // Create ~/.claude/stacks directory if it doesn't exist
    const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
    await fs.ensureDir(stacksDir);

    // Write to ~/.claude/stacks/
    const outputPath = path.join(stacksDir, outputFilename);
    await fs.writeJson(outputPath, stack, { spaces: 2 });

    const totalComponents = (stack.commands?.length || 0) + (stack.agents?.length || 0) + (stack.mcpServers?.length || 0);
    
    console.log(colors.success('✅ Stack exported successfully!'));
    console.log(colors.meta(`  File: ~/.claude/stacks/${outputFilename}`));
    console.log(colors.meta(`  Components: ${totalComponents} items`));
    console.log(colors.meta(`  MCP Servers: ${stack.mcpServers?.length || 0} items`));

  } catch (error) {
    console.error(colors.error('Export failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}