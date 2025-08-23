#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

function showClaudeProjects() {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  
  console.log('🔍 Checking Claude project configurations...\n');
  
  if (!fs.existsSync(claudeJsonPath)) {
    console.log('❌ No ~/.claude.json file found');
    return;
  }
  
  try {
    const content = fs.readFileSync(claudeJsonPath, 'utf-8');
    const claudeConfig = JSON.parse(content);
    
    console.log(`📁 File: ${claudeJsonPath}`);
    console.log(`📏 Size: ${Math.round(content.length / 1024 * 100) / 100} KB\n`);
    
    if (!claudeConfig.projects || typeof claudeConfig.projects !== 'object') {
      console.log('⚠️  No "projects" section found in .claude.json');
      return;
    }
    
    const projects = Object.keys(claudeConfig.projects);
    
    if (projects.length === 0) {
      console.log('📂 No projects configured');
      return;
    }
    
    console.log(`📋 Found ${projects.length} project(s):\n`);
    
    projects.forEach((projectPath, index) => {
      const projectConfig = claudeConfig.projects[projectPath];
      const mcpCount = projectConfig.mcpServers ? Object.keys(projectConfig.mcpServers).length : 0;
      
      console.log(`${index + 1}. ${projectPath}`);
      console.log(`   📡 MCP Servers: ${mcpCount}`);
      
      if (mcpCount > 0) {
        const mcpNames = Object.keys(projectConfig.mcpServers);
        console.log(`   📝 MCP Names: ${mcpNames.join(', ')}`);
      }
      
      // Show if this is the current directory
      if (projectPath === process.cwd()) {
        console.log(`   🎯 ← Current directory`);
      }
      
      console.log();
    });
    
  } catch (error) {
    console.error('❌ Error parsing .claude.json:', error.message);
  }
}

showClaudeProjects();