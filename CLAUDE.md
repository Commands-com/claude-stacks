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
- Looks for stack file in `~/.claude/stacks/` by default

### `claude-stacks browse`
Browse and discover published stacks from the marketplace.
- Supports search filtering with `--search` parameter
- Use `--my-stacks` to view only your published stacks

### `claude-stacks install-remote <stack-id>`
Installs a remote stack from the marketplace.
- Downloads stack and restores to current project
- Tracks installation analytics
- Supports same options as `restore` command

### `claude-stacks delete <stack-id>`
Deletes a published stack from the marketplace.
- Requires authentication and ownership
- Permanent deletion - cannot be undone

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

### Building the CLI
```bash
# Build TypeScript to JavaScript
npm run build

# Development mode (auto-rebuild)
npm run dev
```

### Local Backend Testing

The CLI supports testing against a local backend server running on port 3000. Set the environment variable to enable development mode:

```bash
# Enable local development mode
export CLAUDE_STACKS_DEV=true

# Or prefix individual commands
CLAUDE_STACKS_DEV=true node dist/cli.js browse
```

#### Local Development Workflow

1. **Start local backend** (assumes backend server running on `localhost:3000`)

2. **Export a stack for testing**:
   ```bash
   node dist/cli.js export --name "Test Stack" --description "Local testing"
   ```

3. **Publish to local backend**:
   ```bash
   CLAUDE_STACKS_DEV=true node dist/cli.js publish --public
   ```

4. **Browse stacks on local backend**:
   ```bash
   CLAUDE_STACKS_DEV=true node dist/cli.js browse
   ```

5. **Install stack from local backend**:
   ```bash
   CLAUDE_STACKS_DEV=true node dist/cli.js install-remote <stack-id>
   ```

6. **Delete test stacks**:
   ```bash
   CLAUDE_STACKS_DEV=true node dist/cli.js delete <stack-id>
   ```

#### Backend Configuration

- **Local Development**: `http://localhost:3000`
- **Production**: `https://backend.commands.com`
- **Authentication**: Always uses `https://api.commands.com/oauth/*` (both modes)

The CLI automatically detects the environment and shows which backend it's connecting to in development mode.

## Known Issues & Future Work

### Backend Integration Status
- ✅ **Local Development**: Fully working with local backend on port 3000
- ✅ **API Endpoints**: All CRUD operations implemented (`/v1/stacks/*`)
- ✅ **Authentication**: OAuth 2.0 + PKCE flow working with Commands.com API gateway
- ✅ **Install Tracking**: Analytics tracking for stack installations
- 🚧 **Production Deployment**: Production backend not yet deployed to `backend.commands.com`

### Character Encoding
- Resolved emoji display issues in terminal output
- Using ✅ instead of 🎉 for better compatibility

### Error Handling
- OAuth flow includes proper error handling for port conflicts
- File validation for stack JSON structure
- Graceful fallbacks for missing configurations

## OAuth Client Configuration

The tool is configured to authenticate with the Commands.com API gateway:
- **Auth URL**: `https://api.commands.com/oauth/authorize`
- **Token URL**: `https://api.commands.com/oauth/token`
- **Client ID**: `claude-stacks-cli`
- **Redirect**: `http://localhost:{dynamic-port}/callback`
- **Flow**: Authorization Code with PKCE (S256)

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