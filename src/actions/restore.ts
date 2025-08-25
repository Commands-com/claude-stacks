import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

import { DeveloperStack, RestoreOptions } from '../types/index.js';
import { colors } from '../utils/colors.js';

export async function restoreAction(stackFilePath: string, options: RestoreOptions = {}): Promise<void> {
  try {
    let resolvedPath = stackFilePath;
    
    // If it's just a filename, look in ~/.claude/stacks/
    if (!path.isAbsolute(stackFilePath) && !stackFilePath.includes('/')) {
      const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
      resolvedPath = path.join(stacksDir, stackFilePath);
    }
    
    if (!await fs.pathExists(resolvedPath)) {
      throw new Error(`Stack file not found: ${resolvedPath}`);
    }
    
    const stack: DeveloperStack = await fs.readJson(resolvedPath);
    
    console.log(colors.stackName(`Restoring stack: ${stack.name}`));
    console.log(`Description: ${colors.description(stack.description)}`);
    console.log(colors.meta(`Mode: ${options.overwrite ? 'Overwrite' : 'Add/Merge'}`));
    console.log();
    
    const claudeDir = path.join(os.homedir(), '.claude');
    const currentDir = process.cwd();
    const localClaudeDir = path.join(currentDir, '.claude');
    
    // Create directories if they don't exist
    await fs.ensureDir(claudeDir);
    await fs.ensureDir(localClaudeDir);
    
    // Categorize commands by global vs local
    const globalCommands = (stack.commands || []).filter(c => c.filePath?.startsWith('~'));
    const localCommands = (stack.commands || []).filter(c => c.filePath?.startsWith('.'));
    
    // Categorize agents by global vs local  
    const globalAgents = (stack.agents || []).filter(a => a.filePath?.startsWith('~'));
    const localAgents = (stack.agents || []).filter(a => a.filePath?.startsWith('.'));
    
    // Restore global commands
    if (globalCommands.length > 0) {
      const globalCommandsDir = path.join(claudeDir, 'commands');
      
      if (options.overwrite) {
        // Clear existing global commands directory
        if (await fs.pathExists(globalCommandsDir)) {
          await fs.emptyDir(globalCommandsDir);
        }
      }
      
      await fs.ensureDir(globalCommandsDir);
      
      for (const command of globalCommands) {
        const fileName = `${command.name.replace(' (local)', '').replace(' (global)', '')}.md`;
        const filePath = path.join(globalCommandsDir, fileName);
        
        if (!options.overwrite && await fs.pathExists(filePath)) {
          console.log(colors.warning(`Skipped existing global command: ${command.name}`));
          continue;
        }
        
        await fs.writeFile(filePath, command.content, 'utf-8');
        console.log(colors.success(`✓ Added global command: ${command.name}`));
      }
    }
    
    // Restore local commands
    if (localCommands.length > 0) {
      const localCommandsDir = path.join(localClaudeDir, 'commands');
      
      if (options.overwrite) {
        // Clear existing local commands directory
        if (await fs.pathExists(localCommandsDir)) {
          await fs.emptyDir(localCommandsDir);
        }
      }
      
      await fs.ensureDir(localCommandsDir);
      
      for (const command of localCommands) {
        const fileName = `${command.name.replace(' (local)', '').replace(' (global)', '')}.md`;
        const filePath = path.join(localCommandsDir, fileName);
        
        if (!options.overwrite && await fs.pathExists(filePath)) {
          console.log(colors.warning(`Skipped existing local command: ${command.name}`));
          continue;
        }
        
        await fs.writeFile(filePath, command.content, 'utf-8');
        console.log(colors.success(`✓ Added local command: ${command.name}`));
      }
    }
    
    // Restore global agents
    if (globalAgents.length > 0) {
      const globalAgentsDir = path.join(claudeDir, 'agents');
      
      if (options.overwrite) {
        // Clear existing global agents directory
        if (await fs.pathExists(globalAgentsDir)) {
          await fs.emptyDir(globalAgentsDir);
        }
      }
      
      await fs.ensureDir(globalAgentsDir);
      
      for (const agent of globalAgents) {
        const fileName = `${agent.name.replace(' (local)', '').replace(' (global)', '')}.md`;
        const filePath = path.join(globalAgentsDir, fileName);
        
        if (!options.overwrite && await fs.pathExists(filePath)) {
          console.log(colors.warning(`Skipped existing global agent: ${agent.name}`));
          continue;
        }
        
        await fs.writeFile(filePath, agent.content, 'utf-8');
        console.log(colors.success(`✓ Added global agent: ${agent.name}`));
      }
    }
    
    // Restore local agents
    if (localAgents.length > 0) {
      const localAgentsDir = path.join(localClaudeDir, 'agents');
      
      if (options.overwrite) {
        // Clear existing local agents directory
        if (await fs.pathExists(localAgentsDir)) {
          await fs.emptyDir(localAgentsDir);
        }
      }
      
      await fs.ensureDir(localAgentsDir);
      
      for (const agent of localAgents) {
        const fileName = `${agent.name.replace(' (local)', '').replace(' (global)', '')}.md`;
        const filePath = path.join(localAgentsDir, fileName);
        
        if (!options.overwrite && await fs.pathExists(filePath)) {
          console.log(colors.warning(`Skipped existing local agent: ${agent.name}`));
          continue;
        }
        
        await fs.writeFile(filePath, agent.content, 'utf-8');
        console.log(colors.success(`✓ Added local agent: ${agent.name}`));
      }
    }
    
    // Restore MCP servers
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      const claudeJsonPath = path.join(os.homedir(), '.claude.json');
      let claudeConfig: any = {};
      
      // Read existing config
      if (await fs.pathExists(claudeJsonPath)) {
        try {
          claudeConfig = await fs.readJson(claudeJsonPath);
        } catch (error) {
          console.warn(colors.warning('Warning: Could not read existing .claude.json, creating new one'));
        }
      }
      
      // Ensure projects object exists
      if (!claudeConfig.projects) {
        claudeConfig.projects = {};
      }
      
      // Set up current project configuration
      const currentProjectPath = process.cwd();
      if (!claudeConfig.projects[currentProjectPath]) {
        claudeConfig.projects[currentProjectPath] = {
          allowedTools: []
        };
      }
      
      const projectConfig = claudeConfig.projects[currentProjectPath];
      
      // Ensure allowedTools exists (for existing projects that might not have it)
      if (!projectConfig.allowedTools) {
        projectConfig.allowedTools = [];
      }
      
      if (options.overwrite) {
        // Replace MCP servers entirely
        projectConfig.mcpServers = {};
      } else if (!projectConfig.mcpServers) {
        projectConfig.mcpServers = {};
      }
      
      // Add stack's MCP servers
      for (const mcpServer of stack.mcpServers) {
        if (!options.overwrite && projectConfig.mcpServers[mcpServer.name]) {
          console.log(colors.warning(`Skipped existing MCP server: ${mcpServer.name}`));
          continue;
        }
        
        projectConfig.mcpServers[mcpServer.name] = {
          type: mcpServer.type,
          ...(mcpServer.command && { command: mcpServer.command }),
          ...(mcpServer.args && { args: mcpServer.args }),
          ...(mcpServer.url && { url: mcpServer.url }),
          ...(mcpServer.env && { env: mcpServer.env })
        };
        
        console.log(colors.success(`✓ Added MCP server: ${mcpServer.name}`));
      }
      
      // Write updated config
      await fs.writeJson(claudeJsonPath, claudeConfig, { spaces: 2 });
    }
    
    // Restore settings
    if (stack.settings && Object.keys(stack.settings).length > 0) {
      // Check if settings contain global vs local by examining the structure
      // For now, assume all settings go to local unless we can detect otherwise
      const localSettingsPath = path.join(localClaudeDir, 'settings.local.json');
      
      if (options.overwrite) {
        // Replace settings entirely
        await fs.writeJson(localSettingsPath, stack.settings, { spaces: 2 });
        console.log(colors.success('✓ Replaced local settings'));
      } else {
        // Merge with existing settings
        let existingSettings = {};
        if (await fs.pathExists(localSettingsPath)) {
          try {
            existingSettings = await fs.readJson(localSettingsPath);
          } catch (error) {
            console.warn(colors.warning('Warning: Could not read existing local settings'));
          }
        }
        
        const mergedSettings = { ...existingSettings, ...stack.settings };
        await fs.writeJson(localSettingsPath, mergedSettings, { spaces: 2 });
        console.log(colors.success('✓ Merged local settings'));
      }
    }
    
    // Restore CLAUDE.md files
    if (stack.claudeMd) {
      if (stack.claudeMd.global) {
        const globalClaudeMdPath = path.join(claudeDir, 'CLAUDE.md');
        
        if (!options.overwrite && await fs.pathExists(globalClaudeMdPath)) {
          console.log(colors.warning('Skipped existing global CLAUDE.md'));
        } else {
          await fs.writeFile(globalClaudeMdPath, stack.claudeMd.global.content, 'utf-8');
          console.log(colors.success('✓ Added global CLAUDE.md'));
        }
      }
      
      if (stack.claudeMd.local) {
        const localClaudeMdPath = path.join(localClaudeDir, 'CLAUDE.md');
        
        if (!options.overwrite && await fs.pathExists(localClaudeMdPath)) {
          console.log(colors.warning('Skipped existing local CLAUDE.md'));
        } else {
          await fs.writeFile(localClaudeMdPath, stack.claudeMd.local.content, 'utf-8');
          console.log(colors.success('✓ Added local CLAUDE.md'));
        }
      }
    }
    
    console.log();
    console.log(colors.success('✅ Stack restoration completed successfully!'));
    
    const restoredItems = [
      `Commands: ${globalCommands.length} global, ${localCommands.length} local`,
      `Agents: ${globalAgents.length} global, ${localAgents.length} local`,
      `MCP Servers: ${stack.mcpServers?.length || 0} configurations`,
      `Settings: ${stack.settings ? 'Yes' : 'None'}`,
      `CLAUDE.md: ${(stack.claudeMd?.global ? 1 : 0) + (stack.claudeMd?.local ? 1 : 0)} files`
    ];
    
    console.log(colors.info('Restored:'));
    restoredItems.forEach(item => console.log(colors.meta(`  ${item}`)));
    
  } catch (error) {
    console.error(colors.error('Restore failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}