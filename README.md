# Claude Stacks

**Share your Claude Code environment in seconds - export and restore development stacks**

## Quick Start

```bash
# Export current environment
claude-stacks export

# Restore from a stack file  
claude-stacks restore my-stack.json

# Publish to marketplace (requires auth)
claude-stacks publish my-stack.json

# Browse marketplace
claude-stacks browse
```

## What it does

Claude Stacks captures your complete Claude Code development environment including:

- **Commands** (`~/.claude/commands/` and `./.claude/commands/`)
- **Agents** (`~/.claude/agents/` and `./.claude/agents/`)  
- **Prompts** (`~/.claude/prompts/` and `./.claude/prompts/`)
- **MCP Servers** (project-scoped from `~/.claude.json`)
- **Settings** (global + local configurations)

## Commands

### `claude-stacks export [filename]`
Export your current Claude Code environment to a portable JSON stack.

```bash
# Auto-generates filename from current directory
claude-stacks export

# Custom filename
claude-stacks export my-react-stack.json
```

### `claude-stacks restore <filename> [options]`
Restore a stack to your current directory.

```bash
# Add to existing configuration  
claude-stacks restore stack.json

# Overwrite existing configuration
claude-stacks restore stack.json --mode overwrite
```

### `claude-stacks publish [filename]`  
Publish your stack to the Commands.com marketplace.

```bash
# Publish with OAuth authentication
claude-stacks publish my-stack.json
```

### `claude-stacks browse`
Open the Commands.com stacks marketplace in your browser.

### `claude-stacks install-remote <stack-id>`
Install a remote stack from the marketplace.

```bash
claude-stacks install-remote user123/react-dev-stack
```

## Use Cases

- **Team Onboarding**: New developers get the full environment instantly
- **Project Templates**: Create reusable stacks for common setups  
- **Environment Backup**: Version control your Claude Code configurations
- **Cross-Machine Sync**: Keep environments consistent across devices
- **Community Sharing**: Share useful command/agent combinations  

## Installation

```bash
npm install -g claude-stacks
```

## Development

```bash
npm install
npm run build
npm run dev  # Test locally
```

## Technical Details

- **Zero-login required** for basic export/restore operations
- **OAuth 2.0 with PKCE** for secure marketplace publishing  
- **Project-scoped filtering** for MCP servers
- **Automatic deduplication** of commands, agents, and prompts
- **Dynamic port allocation** for OAuth callbacks