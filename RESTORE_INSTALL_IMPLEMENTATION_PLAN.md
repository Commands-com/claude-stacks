# Restore and Install Functionality Implementation Plan

## Executive Summary

The `restore` and `install` functionality in claude-stacks is currently non-functional. During a refactoring to create a service layer architecture (commit 31cfcf4), the actual implementation was replaced with placeholder comments. This document provides a comprehensive plan to restore full functionality based on the previous working implementation (commit d540ac6).

## Current State Analysis

### Problem Areas

1. **StackOperationService.ts** - All restore methods contain only placeholder comments:
   - `restoreGlobalCommands()` - "Implementation would go here - for now, just log"
   - `restoreLocalCommands()` - Same placeholder
   - `restoreGlobalAgents()` - Same placeholder
   - `restoreLocalAgents()` - Same placeholder
   - `restoreMcpServers()` - Same placeholder
   - `restoreSettings()` - Same placeholder
   - `restoreClaudeMdFiles()` - Same placeholder

2. **Tests** - Currently using mocked implementations that don't test actual functionality

3. **Missing Functionality**:
   - No actual file writing to ~/.claude/\* directories
   - No MCP server configuration in ~/.claude.json
   - No settings management
   - No CLAUDE.md file handling

## Previous Working Implementation Reference

### Key Commit: d540ac6

- Date: Mon Aug 25 13:12:51 2025 -0400
- Had full working restore functionality
- Properly configured MCP servers in ~/.claude.json
- Handled all file operations correctly

## Detailed Implementation Plan

### Phase 1: Core File System Operations

#### 1.1 Update StackOperationService Constructor

```typescript
constructor(
  private readonly ui: UIService,
  private readonly dependencies: DependencyService,
  private readonly fileService: FileService  // Add this dependency
)
```

#### 1.2 Implement restoreGlobalCommands()

```typescript
private async restoreGlobalCommands(commands: StackCommand[]): Promise<void> {
  const globalCommandsDir = path.join(os.homedir(), '.claude', 'commands');

  // Ensure directory exists
  await this.fileService.ensureDir(globalCommandsDir);

  for (const command of commands) {
    const fileName = `${command.name.replace(/ \((local|global)\)/g, '')}.md`;
    const filePath = path.join(globalCommandsDir, fileName);

    // Check if file exists and handle based on options
    if (!this.options.overwrite && await this.fileService.exists(filePath)) {
      this.ui.warning(`Skipped existing global command: ${command.name}`);
      continue;
    }

    // Write command file
    await this.fileService.writeTextFile(filePath, command.content);
    this.ui.success(`✓ Added global command: ${command.name}`);
  }
}
```

#### 1.3 Implement restoreLocalCommands()

```typescript
private async restoreLocalCommands(commands: StackCommand[]): Promise<void> {
  const localCommandsDir = path.join(process.cwd(), '.claude', 'commands');

  await this.fileService.ensureDir(localCommandsDir);

  for (const command of commands) {
    const fileName = `${command.name.replace(/ \((local|global)\)/g, '')}.md`;
    const filePath = path.join(localCommandsDir, fileName);

    if (!this.options.overwrite && await this.fileService.exists(filePath)) {
      this.ui.warning(`Skipped existing local command: ${command.name}`);
      continue;
    }

    await this.fileService.writeTextFile(filePath, command.content);
    this.ui.success(`✓ Added local command: ${command.name}`);
  }
}
```

#### 1.4 Implement restoreGlobalAgents()

```typescript
private async restoreGlobalAgents(agents: StackAgent[]): Promise<void> {
  const globalAgentsDir = path.join(os.homedir(), '.claude', 'agents');

  await this.fileService.ensureDir(globalAgentsDir);

  for (const agent of agents) {
    const fileName = `${agent.name.replace(/ \((local|global)\)/g, '')}.md`;
    const filePath = path.join(globalAgentsDir, fileName);

    if (!this.options.overwrite && await this.fileService.exists(filePath)) {
      this.ui.warning(`Skipped existing global agent: ${agent.name}`);
      continue;
    }

    await this.fileService.writeTextFile(filePath, agent.content);
    this.ui.success(`✓ Added global agent: ${agent.name}`);
  }
}
```

#### 1.5 Implement restoreLocalAgents()

```typescript
private async restoreLocalAgents(agents: StackAgent[]): Promise<void> {
  const localAgentsDir = path.join(process.cwd(), '.claude', 'agents');

  await this.fileService.ensureDir(localAgentsDir);

  for (const agent of agents) {
    const fileName = `${agent.name.replace(/ \((local|global)\)/g, '')}.md`;
    const filePath = path.join(localAgentsDir, fileName);

    if (!this.options.overwrite && await this.fileService.exists(filePath)) {
      this.ui.warning(`Skipped existing local agent: ${agent.name}`);
      continue;
    }

    await this.fileService.writeTextFile(filePath, agent.content);
    this.ui.success(`✓ Added local agent: ${agent.name}`);
  }
}
```

### Phase 2: MCP Server Configuration

#### 2.1 Implement restoreMcpServers()

```typescript
private async restoreMcpServers(servers: StackMcpServer[], options: RestoreOptions): Promise<void> {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  let claudeConfig: any = {};

  // Read existing config
  if (await this.fileService.exists(claudeJsonPath)) {
    try {
      claudeConfig = await this.fileService.readJsonFile(claudeJsonPath);
    } catch (error) {
      this.ui.warning('Warning: Could not read existing .claude.json, creating new one');
    }
  }

  // Ensure projects object exists
  if (!claudeConfig.projects) {
    claudeConfig.projects = {};
  }

  // Set up current project configuration
  const currentProjectPath = process.cwd();
  let projectConfig = claudeConfig.projects[currentProjectPath] || {};
  claudeConfig.projects[currentProjectPath] = projectConfig;

  // Handle overwrite option
  if (options.overwrite) {
    projectConfig.mcpServers = {};
  } else if (!projectConfig.mcpServers) {
    projectConfig.mcpServers = {};
  }

  // Add stack's MCP servers
  for (const mcpServer of servers) {
    if (!options.overwrite && projectConfig.mcpServers[mcpServer.name]) {
      this.ui.warning(`Skipped existing MCP server: ${mcpServer.name}`);
      continue;
    }

    projectConfig.mcpServers[mcpServer.name] = {
      type: mcpServer.type,
      ...(mcpServer.command && { command: mcpServer.command }),
      ...(mcpServer.args && { args: mcpServer.args }),
      ...(mcpServer.url && { url: mcpServer.url }),
      ...(mcpServer.env && { env: mcpServer.env })
    };

    this.ui.success(`✓ Added MCP server: ${mcpServer.name}`);
  }

  // Write updated config
  await this.fileService.writeJsonFile(claudeJsonPath, claudeConfig);
}
```

#### 2.2 MCP Server Configuration Structure

```json
{
  "projects": {
    "/Users/username/projects/my-project": {
      "mcpServers": {
        "filesystem": {
          "type": "stdio",
          "command": "npx",
          "args": ["@modelcontextprotocol/server-filesystem"],
          "env": {
            "SOME_VAR": "value"
          }
        },
        "github": {
          "type": "stdio",
          "command": "uvx",
          "args": ["mcp-server-github"]
        }
      }
    }
  }
}
```

### Phase 3: Settings Management

#### 3.1 Implement restoreSettings()

```typescript
private async restoreSettings(settings: StackSettings, options: RestoreOptions): Promise<void> {
  // Determine if settings should go to local or global
  const localSettingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
  const globalSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');

  // For now, prefer local settings unless globalOnly is set
  const targetPath = options.globalOnly ? globalSettingsPath : localSettingsPath;

  if (options.overwrite) {
    // Replace settings entirely
    await this.fileService.writeJsonFile(targetPath, settings);
    this.ui.success('✓ Replaced settings');
  } else {
    // Merge with existing settings
    let existingSettings = {};
    if (await this.fileService.exists(targetPath)) {
      try {
        existingSettings = await this.fileService.readJsonFile(targetPath);
      } catch (error) {
        this.ui.warning('Warning: Could not read existing settings');
      }
    }

    const mergedSettings = { ...existingSettings, ...settings };
    await this.fileService.writeJsonFile(targetPath, mergedSettings);
    this.ui.success('✓ Merged settings');
  }
}
```

### Phase 4: CLAUDE.md Files

#### 4.1 Implement restoreClaudeMdFiles()

```typescript
private async restoreClaudeMdFiles(claudeMd: StackClaudeMd, options: RestoreOptions): Promise<void> {
  if (claudeMd.global && !options.localOnly) {
    const globalClaudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');

    if (!options.overwrite && await this.fileService.exists(globalClaudeMdPath)) {
      this.ui.warning('Skipped existing global CLAUDE.md');
    } else {
      await this.fileService.writeTextFile(globalClaudeMdPath, claudeMd.global.content);
      this.ui.success('✓ Added global CLAUDE.md');
    }
  }

  if (claudeMd.local && !options.globalOnly) {
    const localClaudeMdPath = path.join(process.cwd(), '.claude', 'CLAUDE.md');

    if (!options.overwrite && await this.fileService.exists(localClaudeMdPath)) {
      this.ui.warning('Skipped existing local CLAUDE.md');
    } else {
      await this.fileService.writeTextFile(localClaudeMdPath, claudeMd.local.content);
      this.ui.success('✓ Added local CLAUDE.md');
    }
  }
}
```

### Phase 5: Update Main Restore Methods

#### 5.1 Update restoreComponents()

```typescript
private async restoreComponents(stack: DeveloperStack, options: RestoreOptions): Promise<void> {
  // Pass options to all restore methods
  await this.restoreCommandComponents(stack, options);
  await this.restoreAgentComponents(stack, options);
  await this.restoreOtherComponents(stack, options);
}
```

#### 5.2 Update restoreOtherComponents()

```typescript
private async restoreOtherComponents(stack: DeveloperStack, options: RestoreOptions): Promise<void> {
  if (stack.mcpServers && stack.mcpServers.length > 0) {
    await this.restoreMcpServers(stack.mcpServers, options);
  }

  if (stack.settings && Object.keys(stack.settings).length > 0) {
    await this.restoreSettings(stack.settings, options);
  }

  if (stack.claudeMd) {
    await this.restoreClaudeMdFiles(stack.claudeMd, options);
  }
}
```

### Phase 6: Error Handling

#### 6.1 Add Try-Catch Blocks

- Wrap each restore method in try-catch
- Log specific errors but continue with other operations
- Collect errors and report summary at end

#### 6.2 Permission Handling

```typescript
try {
  await this.fileService.ensureDir(dir);
} catch (error) {
  if (error.code === 'EACCES') {
    this.ui.error(`Permission denied: Cannot create directory ${dir}`);
    this.ui.info('Try running with sudo or check directory permissions');
  }
  throw error;
}
```

### Phase 7: Testing Strategy

#### 7.1 Unit Tests

- Mock FileService operations
- Test each restore method independently
- Verify correct paths are used
- Test overwrite vs merge logic

#### 7.2 Integration Tests

```typescript
describe('StackOperationService Integration', () => {
  const tempDir = path.join(os.tmpdir(), 'claude-stacks-test');

  beforeEach(() => {
    fs.ensureDirSync(tempDir);
    process.chdir(tempDir);
  });

  afterEach(() => {
    fs.removeSync(tempDir);
  });

  it('should restore all stack components', async () => {
    const stack = createMockStack();
    await service.performRestore('stack.json', {});

    // Verify files exist
    expect(fs.existsSync('.claude/commands/test.md')).toBe(true);
    expect(fs.existsSync('.claude/agents/test.md')).toBe(true);
    // etc...
  });
});
```

## File Structure After Implementation

```
~/.claude/
├── commands/           # Global commands
│   ├── command1.md
│   └── command2.md
├── agents/            # Global agents
│   ├── agent1.md
│   └── agent2.md
├── settings.json      # Global settings
├── CLAUDE.md          # Global CLAUDE.md
└── stacks/           # Saved stacks
    └── my-stack.json

~/.claude.json         # MCP server configurations for all projects

/project/.claude/
├── commands/          # Local commands
│   ├── command1.md
│   └── command2.md
├── agents/           # Local agents
│   ├── agent1.md
│   └── agent2.md
├── settings.local.json  # Local settings
└── CLAUDE.md           # Local CLAUDE.md
```

## Success Criteria

1. **Installation Works**: `claude-stacks install org/stack` creates all necessary files
2. **Restoration Works**: `claude-stacks restore stack.json` properly restores saved stacks
3. **MCP Configuration**: MCP servers properly configured in ~/.claude.json
4. **File Placement**: Commands, agents, settings in correct directories
5. **Options Work**: --overwrite, --globalOnly, --localOnly function correctly
6. **Tests Pass**: All unit and integration tests pass
7. **Error Handling**: Graceful handling of permission errors, missing files
8. **User Feedback**: Clear success/warning/error messages

## Implementation Order

1. **Day 1**: Implement file operations (Phase 1)
2. **Day 2**: Implement MCP server configuration (Phase 2)
3. **Day 3**: Implement settings and CLAUDE.md (Phases 3-4)
4. **Day 4**: Add error handling and testing (Phases 5-6)
5. **Day 5**: Integration testing and documentation

## Risks and Mitigations

| Risk                                      | Mitigation                                        |
| ----------------------------------------- | ------------------------------------------------- |
| File permission errors                    | Add clear error messages and sudo suggestions     |
| Breaking changes to ~/.claude.json format | Version the config format, add migration logic    |
| Conflicts with existing files             | Implement careful merge logic, backup options     |
| Large stack files                         | Stream file operations for efficiency             |
| Windows/Linux path differences            | Use path.join consistently, test on all platforms |

## Notes from Previous Implementation

1. **File name cleaning**: Remove "(local)" and "(global)" suffixes from names
2. **Directory creation**: Always ensure parent directories exist before writing
3. **Config merging**: Deep merge for settings, shallow merge for MCP servers
4. **Temp files**: Use os.tmpdir() for temporary stack files during install
5. **Cleanup**: Always clean up temp files in finally blocks

## Next Steps

1. Create feature branch: `git checkout -b fix/restore-install-functionality`
2. Implement Phase 1 (Core File Operations)
3. Write unit tests for Phase 1
4. Continue with subsequent phases
5. Update documentation
6. Create PR with comprehensive testing evidence

## References

- Previous working commit: d540ac6
- Refactoring commit that broke it: 31cfcf4
- Current StackOperationService: src/services/StackOperationService.ts
- Install action: src/actions/install.ts
- Restore action: src/actions/restore.ts
