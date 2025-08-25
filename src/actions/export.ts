import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

import { DeveloperStack, StackCommand, StackAgent, StackMcpServer, ExportOptions } from '../types/index.js';
import { colors } from '../utils/colors.js';
import { getPublishedStackMetadata } from '../utils/metadata.js';
import { generateSuggestedVersion, isValidVersion } from '../utils/version.js';

function extractDescriptionFromContent(content: string): string {
  // Try to extract description from YAML frontmatter first
  if (content.startsWith('---')) {
    const frontmatterEnd = content.indexOf('\n---\n', 4);
    if (frontmatterEnd !== -1) {
      const frontmatterContent = content.substring(4, frontmatterEnd);
      const descriptionMatch = frontmatterContent.match(/^description:\s*(.+)$/m);
      if (descriptionMatch) {
        const description = descriptionMatch[1].trim().replace(/^['"]|['"]$/g, '');
        return description.length > 80 ? description.substring(0, 77) + '...' : description;
      }
    }
  }
  
  // Fall back to first meaningful line as description
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('<!--') && !trimmed.startsWith('---')) {
      return trimmed.length > 80 ? trimmed.substring(0, 77) + '...' : trimmed;
    }
  }
  return 'No description available';
}

async function exportCurrentStack(options: { name?: string; description?: string; includeGlobal?: boolean; includeClaudeMd?: boolean; stackVersion?: string }): Promise<DeveloperStack> {
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

  // Check for previous publication and determine version
  const publishedMeta = await getPublishedStackMetadata(currentDir);
  let stackVersion = '1.0.0';
  
  if (options.stackVersion) {
    // Manual version override
    if (!isValidVersion(options.stackVersion)) {
      throw new Error(`Invalid version format: ${options.stackVersion}. Expected format: X.Y.Z`);
    }
    stackVersion = options.stackVersion;
  } else if (publishedMeta) {
    // Auto-suggest next version based on previous publication
    stackVersion = generateSuggestedVersion(publishedMeta.last_published_version);
    console.log(colors.info(`📌 Previously published as "${publishedMeta.stack_name}" (v${publishedMeta.last_published_version})`));
    console.log(colors.meta(`   Auto-suggesting version: ${stackVersion} (use --version to override)`));
  }

  const stack: DeveloperStack = {
    name: stackName,
    description: autoDescription,
    version: stackVersion,
    commands: [],
    agents: [],
    mcpServers: [],
    settings: {},
    metadata: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      exported_from: currentDir,
      published_stack_id: publishedMeta?.stack_id,
      published_version: publishedMeta?.last_published_version,
      local_version: stackVersion
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

  // Read settings files
  if (options.includeGlobal) {
    // Read global settings
    const globalSettingsPath = path.join(claudeDir, 'settings.json');
    if (await fs.pathExists(globalSettingsPath)) {
      try {
        const globalSettings = await fs.readJson(globalSettingsPath);
        stack.settings = { ...stack.settings, ...globalSettings };
      } catch (error) {
        console.warn('Warning: Could not read global settings.json');
      }
    }
  }
  
  // Always try to read local settings if .claude directory exists
  if (await fs.pathExists(localClaudeDir)) {
    const localSettingsPath = path.join(localClaudeDir, 'settings.local.json');
    if (await fs.pathExists(localSettingsPath)) {
      try {
        const localSettings = await fs.readJson(localSettingsPath);
        stack.settings = { ...stack.settings, ...localSettings };
      } catch (error) {
        console.warn('Warning: Could not read local settings.local.json');
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
      includeGlobal: options.includeGlobal || false,
      includeClaudeMd: options.includeClaudeMd || false,
      stackVersion: options.stackVersion  // Add version option support
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
    console.log(colors.meta(`  Version: ${stack.version}`));
    console.log(colors.meta(`  Components: ${totalComponents} items`));
    console.log(colors.meta(`  MCP Servers: ${stack.mcpServers?.length || 0} items`));

  } catch (error) {
    console.error(colors.error('Export failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}