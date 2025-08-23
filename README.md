# Claude Stacks

**Share your Claude Code environment in seconds - export and restore development stacks**

## Quick Start

```bash
# Export current environment (saves to ~/.claude/stacks/)
claude-stacks export [filename] [--name "Custom Name"]

# List available stacks
claude-stacks list

# Restore from a stack
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
- **MCP Servers** (project-scoped from `~/.claude.json`)
- **Settings** (global + local configurations)

## Commands

### `claude-stacks export [filename] [options]`
Export your current Claude Code environment to a portable JSON stack (saved to `~/.claude/stacks/`).

```bash
# Auto-generates filename from current directory
claude-stacks export

# Custom filename  
claude-stacks export my-react-stack.json

# Override stack name and description
claude-stacks export --name "My React Development Stack" --description "Complete React setup with TypeScript and testing"
```

### `claude-stacks list`
List all available stacks in `~/.claude/stacks/`.

```bash
claude-stacks list
```

### `claude-stacks restore <filename> [options]`
Restore a stack to your current directory (looks in `~/.claude/stacks/` for filename).

```bash
# Add to existing configuration  
claude-stacks restore my-react-stack.json

# Overwrite existing configuration
claude-stacks restore my-react-stack.json --overwrite
```

### `claude-stacks publish [filename] [options]`  
Publish your stack to the Commands.com marketplace (reads from `~/.claude/stacks/`).

```bash
# Publish with OAuth authentication
claude-stacks publish my-react-stack.json

# Override description and add tags
claude-stacks publish my-react-stack.json --description "Production-ready React stack" --tags "react,typescript,testing" --public
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

- **Centralized storage** in `~/.claude/stacks/` for easy management
- **Zero-login required** for basic export/restore operations
- **OAuth 2.0 with PKCE** for secure marketplace publishing  
- **Project-scoped filtering** for MCP servers
- **Automatic deduplication** of commands, agents, and prompts
- **Dynamic port allocation** for OAuth callbacks