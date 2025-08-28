# Claude Stacks

![Coverage](https://img.shields.io/badge/coverage-91%25-brightgreen)
[![npm version](https://badge.fury.io/js/claude-stacks.svg)](https://www.npmjs.com/package/claude-stacks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Share your Claude Code environment in seconds - export and restore development stacks.

## What is Claude Stacks?

Claude Stacks is a CLI tool that allows you to:

- **Export** your Claude Code environment configurations as portable stack files
- **Share** development stacks with your team or the community via Commands.com
- **Restore** environments quickly across different projects and machines
- **Browse** and install stacks from the Commands.com marketplace

Perfect for sharing MCP server configurations, project setups, and development environments with Claude Code users.

## Installation

Install globally via npm:

```bash
npm install -g claude-stacks
```

Or use npx to run without installing:

```bash
npx claude-stacks --help
```

## Quick Start

### Export Your Current Setup

```bash
# Export current project's Claude Code configuration
claude-stacks export my-stack.json

# Export with custom metadata
claude-stacks export --name "My Dev Stack" --description "Full-stack development environment"

# Include global Claude configurations
claude-stacks export --include-global my-complete-stack.json
```

### Restore from a Stack

```bash
# Restore from a local stack file
claude-stacks restore my-stack.json

# Merge with existing configuration (default)
claude-stacks restore stack.json

# Overwrite existing files
claude-stacks restore --overwrite stack.json
```

### Share via Commands.com

```bash
# Publish to the marketplace
claude-stacks publish my-stack.json

# Browse available stacks
claude-stacks browse

# Install from marketplace
claude-stacks install org-name/stack-name
```

## Commands

### Core Commands

- **`export [filename]`** - Export current environment to a stack file
- **`restore <filename>`** - Restore environment from a stack file
- **`publish <filename>`** - Publish stack to Commands.com marketplace
- **`install <stack-id>`** - Install stack from Commands.com
- **`browse`** - Browse marketplace stacks interactively

### Management Commands

- **`list`** - List local stacks
- **`delete <stack-id>`** - Delete published stack from Commands.com
- **`rename <stack-id>`** - Rename published stack
- **`clean`** - Clean up local stack metadata

### Export Options

- `--name <name>` - Custom stack name
- `--description <description>` - Stack description
- `--stack-version <version>` - Set version (default: auto-increment)
- `--include-global` - Include global `~/.claude` configurations
- `--include-claude-md` - Include `CLAUDE.md` files

### Restore Options

- `--overwrite` - Overwrite existing files (default: merge)
- `--global-only` - Only restore to global `~/.claude`

## What Gets Exported?

Claude Stacks captures your Claude Code environment including:

- **MCP Server Configurations** - All configured MCP servers and their settings
- **Project Commands** - Custom commands defined for your project
- **Agent Configurations** - Custom agents and their configurations
- **Project Settings** - Claude Code project-specific settings
- **CLAUDE.md Files** - Project instructions (when `--include-claude-md` is used)
- **Global Configurations** - User-level settings (when `--include-global` is used)

## Authentication

To publish or manage stacks on Commands.com, you'll need to authenticate:

```bash
claude-stacks publish my-stack.json
```

The CLI will automatically guide you through the OAuth authentication process on first use.

## Stack File Format

Stack files are JSON documents containing:

```json
{
  "name": "My Development Stack",
  "description": "Full-stack development environment with MCP servers",
  "version": "1.0.0",
  "author": "Your Name",
  "mcpServers": [...],
  "commands": [...],
  "agents": [...],
  "settings": {...}
}
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/commands-com/claude-stacks.git
cd claude-stacks

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Development Scripts

- `npm run dev` - Run in development mode
- `npm run build` - Build TypeScript to JavaScript
- `npm run test` - Run test suite with coverage
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier
- `npm run quality` - Run all quality checks

### Testing

The project has comprehensive test coverage (96%+):

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode during development
npm run test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run quality checks (`npm run quality`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Security

This tool handles your Claude Code configurations and requires network access to Commands.com. All data transmission is encrypted and the tool follows security best practices:

- OAuth 2.0 PKCE for secure authentication
- HTTPS-only API communication
- Local credential storage with appropriate permissions
- Input validation and sanitization

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/commands-com/claude-stacks/issues) - Bug reports and feature requests
- [Commands.com](https://commands.com) - Browse and share stacks

---

Made with ❤️ for the Claude Code community
