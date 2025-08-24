import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

import { DeveloperStack } from '../types';
import { colors } from '../utils/colors';

// Show detailed stack information
export async function showStackInfo(stackFile?: string, showCurrent: boolean = false): Promise<void> {
  let stack: DeveloperStack;
  
  if (showCurrent) {
    // Show current directory environment without exporting
    console.log(chalk.cyan('🎯 Current Directory Environment'));
    console.log(colors.meta(`Path: ${process.cwd()}\n`));
    
    // This would need to import the export function - placeholder for now
    console.log(colors.info('Current directory analysis not yet implemented in refactored version'));
    return;
  } else {
    // Load from stack file
    let resolvedPath = stackFile;
    
    if (!stackFile) {
      // Look for default stack file in ~/.claude/stacks/
      const currentDir = process.cwd();
      const dirName = path.basename(currentDir);
      const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
      resolvedPath = path.join(stacksDir, `${dirName}-stack.json`);
    } else if (!path.isAbsolute(stackFile) && !stackFile.includes('/')) {
      // If it's just a filename, look in ~/.claude/stacks/
      const stacksDir = path.join(os.homedir(), '.claude', 'stacks');
      resolvedPath = path.join(stacksDir, stackFile);
    } else {
      resolvedPath = path.resolve(stackFile);
    }
    
    if (!await fs.pathExists(resolvedPath)) {
      throw new Error(`Stack file not found: ${resolvedPath}`);
    }
    
    stack = await fs.readJson(resolvedPath);
    
    console.log(chalk.cyan.bold(`📦 ${stack.name}`));
    if (stack.metadata?.exported_from) {
      console.log(`Exported from: ${stack.metadata.exported_from}`);
    }
    if (stack.metadata?.created_at) {
      const date = new Date(stack.metadata.created_at);
      console.log(`Created: ${date.toLocaleDateString()}`);
    }
    console.log();
  }
  
  console.log(`Description: ${colors.description(stack.description)}`);
  console.log();
  
  // Categorize components by global vs local
  const global = {
    commands: (stack.commands || []).filter(c => c.filePath?.startsWith('~')),
    agents: (stack.agents || []).filter(a => a.filePath?.startsWith('~'))
  };
  
  const local = {
    commands: (stack.commands || []).filter(c => c.filePath?.startsWith('.')),
    agents: (stack.agents || []).filter(a => a.filePath?.startsWith('.'))
  };
  
  // Show global components
  if (global.commands.length > 0 || global.agents.length > 0 || stack.claudeMd?.global) {
    console.log(chalk.cyan.bold('GLOBAL (~/.claude/):'));
    
    if (global.commands.length > 0) {
      console.log(chalk.blue(`  Commands (${global.commands.length}):`));
      global.commands.forEach(cmd => {
        const description = cmd.description || 'No description available';
        console.log(chalk.green(`    ✓ ${cmd.name}`), `- ${description}`);
      });
      console.log();
    }
    
    if (global.agents.length > 0) {
      console.log(chalk.blue(`  Agents (${global.agents.length}):`));
      global.agents.forEach(agent => {
        const description = agent.description || 'No description available';
        console.log(chalk.green(`    ✓ ${agent.name}`), `- ${description}`);
      });
      console.log();
    }
    
    // Show global CLAUDE.md
    if (stack.claudeMd?.global) {
      console.log(chalk.blue(`  CLAUDE.md:`));
      console.log(chalk.green(`    ✓ ${stack.claudeMd.global.path}`), `- Global project instructions`);
      console.log();
    }
  }
  
  // Show local components
  if (local.commands.length > 0 || local.agents.length > 0 || (stack.mcpServers && stack.mcpServers.length > 0) || stack.claudeMd?.local) {
    console.log(chalk.cyan.bold('LOCAL (./.claude/):'));
    
    if (local.commands.length > 0) {
      console.log(chalk.blue(`  Commands (${local.commands.length}):`));
      local.commands.forEach(cmd => {
        const description = cmd.description || 'No description available';
        console.log(chalk.green(`    ✓ ${cmd.name}`), `- ${description}`);
      });
      console.log();
    }
    
    if (local.agents.length > 0) {
      console.log(chalk.blue(`  Agents (${local.agents.length}):`));
      local.agents.forEach(agent => {
        const description = agent.description || 'No description available';
        console.log(chalk.green(`    ✓ ${agent.name}`), `- ${description}`);
      });
      console.log();
    }
    
    if (stack.mcpServers && stack.mcpServers.length > 0) {
      console.log(chalk.blue(`  MCP Servers (${stack.mcpServers.length}):`));
      stack.mcpServers.forEach(mcp => {
        let serverInfo = mcp.name;
        if (mcp.type) serverInfo += ` (${mcp.type})`;
        if (mcp.command) serverInfo += ` - ${mcp.command}`;
        else if (mcp.url) serverInfo += ` - ${mcp.url}`;
        
        console.log(chalk.green(`    ✓ ${serverInfo}`));
      });
      console.log();
    }
    
    // Show local CLAUDE.md
    if (stack.claudeMd?.local) {
      console.log(chalk.blue(`  CLAUDE.md:`));
      console.log(chalk.green(`    ✓ ${stack.claudeMd.local.path}`), `- Local project instructions`);
      console.log();
    }
  }
  
  // Show settings info
  if (stack.settings && Object.keys(stack.settings).length > 0) {
    console.log(chalk.cyan.bold('SETTINGS:'));
    Object.entries(stack.settings).forEach(([key, value]) => {
      if (typeof value === 'object') {
        console.log(chalk.blue(`  ${key}:`), JSON.stringify(value, null, 2).replace(/\n/g, '\n    '));
      } else {
        console.log(chalk.blue(`  ${key}:`), String(value));
      }
    });
    console.log();
  }
  
  // Show summary
  const totalCommands = (stack.commands || []).length;
  const totalAgents = (stack.agents || []).length;
  const totalMcpServers = (stack.mcpServers || []).length;
  const totalComponents = totalCommands + totalAgents + totalMcpServers;
  
  console.log(chalk.cyan.bold('SUMMARY:'));
  console.log(`  Total components: ${totalComponents}`);
  console.log(`  Commands: ${totalCommands} (${global.commands.length} global, ${local.commands.length} local)`);
  console.log(`  Agents: ${totalAgents} (${global.agents.length} global, ${local.agents.length} local)`);
  console.log(`  MCP Servers: ${totalMcpServers}`);
  
  if (stack.settings && Object.keys(stack.settings).length > 0) {
    console.log(`  Settings: ${Object.keys(stack.settings).length} entries`);
  }
  
  if (!showCurrent && !stackFile) {
    console.log();
    console.log(chalk.blue('Install this stack with:'));
    const currentDir = process.cwd();
    const dirName = path.basename(currentDir);
    console.log(chalk.cyan(`  claude-stacks restore ${dirName}-stack.json`));
  }
}