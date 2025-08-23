# Claude Stacks

**Share your Claude Code environment in seconds - export and restore development stacks**

## Overview

Claude Stacks is a CLI tool that enables developers to capture, share, and restore their complete Claude Code development environments. It introspects both global (`~/.claude`) and project-local (`.claude`) configurations to create portable "stacks" that can be shared across teams and projects.

## Key Features

- **Zero-login stack management**: Export and restore stacks without authentication
- **Comprehensive introspection**: Captures commands, agents, MCP servers, and settings
- **OAuth integration**: Publish stacks to Commands.com marketplace using secure authentication
- **Project-scoped**: Automatically filters configurations relevant to the current project
- **Deduplication**: Ensures unique entries for commands and agents

## CLI Commands

### `claude-stacks export [filename]`
Exports the current Claude Code environment to a JSON stack file.
- Auto-generates filename from current directory if not specified
- Captures global and local configurations
- Filters MCP servers to current project only
- Deduplicates commands/agents using Maps

### `claude-stacks restore <filename> [options]`
Restores a stack from JSON file to the current directory.
- `--mode <add|overwrite>`: Choose restoration strategy (default: add)
- Creates `.claude` directory structure if it doesn't exist
- Preserves existing configurations when using `add` mode

### `claude-stacks publish [filename]`
Publishes a stack to the Commands.com marketplace.
- Uses OAuth 2.0 with PKCE for secure authentication
- Opens browser for authentication flow
- Dynamic port allocation to avoid conflicts
- **Note**: Backend API endpoints not yet implemented

### `claude-stacks browse`
Opens the Commands.com stacks marketplace in browser.

### `claude-stacks install-remote <stack-id>`
Installs a remote stack from the marketplace.
- **Note**: Backend API endpoints not yet implemented

## Technical Architecture

### Stack Structure
```json
{
  "name": "Project Name Development Stack",
  "description": "Auto-generated description",
  "version": "1.0.0",
  "commands": [
    {
      "name": "command-name",
      "filePath": "~/.claude/commands/command-name.md",
      "content": "Full command content",
      "description": "Extracted description"
    }
  ],
  "agents": [...],
  "mcpServers": [...],
  "settings": {...},
  "metadata": {
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp", 
    "exported_from": "/absolute/path"
  }
}
```

### OAuth Implementation
- **Flow**: Authorization Code with PKCE (RFC 7636)
- **Provider**: Firebase Auth via Commands.com API gateway
- **Redirect**: Dynamic localhost port allocation
- **Security**: S256 code challenge method
- **Scopes**: Standard OAuth scopes for Commands.com

### Configuration Sources
1. **Global Commands**: `~/.claude/commands/*.md`
2. **Local Commands**: `./.claude/commands/*.md`
3. **Global Agents**: `~/.claude/agents/*.md`
4. **Local Agents**: `./.claude/agents/*.md`
5. **MCP Servers**: `~/.claude.json` (filtered by project path)
6. **Settings**: Global `~/.claude/settings.json` + Local `./.claude/settings.local.json`

## Key Technical Solutions

### MCP Server Filtering
```typescript
const mcpProjects = claudeConfig.projects || {};
const currentProjectPath = process.cwd();
const projectConfig = mcpProjects[currentProjectPath];
const mcpServers = projectConfig?.mcpServers || [];
```

### Deduplication Strategy
```typescript
const commandsMap = new Map<string, StackCommand>();
const agentsMap = new Map<string, StackAgent>();

// Convert to arrays after deduplication
const commands = Array.from(commandsMap.values());
```

### Dynamic Port Allocation
```typescript
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, () => {
      const port = (server.address() as any)?.port;
      server.close(() => resolve(port));
    });
  });
}
```

## Dependencies

- **commander**: CLI framework
- **chalk**: Terminal styling
- **ora**: Loading spinners
- **inquirer**: Interactive prompts
- **fs-extra**: Enhanced file operations
- **node-fetch**: HTTP client
- **open**: Cross-platform browser launching

## Development

```bash
# Build
npm run build

# Development mode
npm run dev

# Test locally
node dist/cli.js stack export
```

## Known Issues & Future Work

### Backend Integration
- API endpoints `/v1/stacks` not yet implemented on Commands.com
- Need to register `claude-stacks-cli` as valid OAuth client ID
- Publish and install-remote commands ready but need backend support

### Character Encoding
- Resolved emoji display issues in terminal output
- Using ✅ instead of 🎉 for better compatibility

### Error Handling
- OAuth flow includes proper error handling for port conflicts
- File validation for stack JSON structure
- Graceful fallbacks for missing configurations

## OAuth Client Configuration

The tool is configured to authenticate with the Commands.com API gateway:
- **Auth URL**: `https://api.commands.com/auth/login`
- **Token URL**: `https://api.commands.com/auth/token`
- **Client ID**: `claude-stacks-cli`
- **Redirect**: `http://localhost:{dynamic-port}/callback`

## Package Information

- **Name**: `claude-stacks`
- **Version**: `1.0.0`
- **License**: MIT
- **Author**: Commands.com
- **Binary**: `claude-stacks`

## Use Cases

1. **Team Onboarding**: New developers can instantly restore the team's development environment
2. **Project Templates**: Create reusable stacks for common project types
3. **Environment Backup**: Version control your Claude Code configurations
4. **Cross-Machine Sync**: Maintain consistent environments across devices
5. **Community Sharing**: Publish useful command/agent combinations to marketplace