# Claude Stacks - Project Overview

## Purpose

Claude Stacks is a TypeScript CLI tool that allows developers to share their Claude Code environment in seconds by exporting and restoring development stacks. It enables users to export their Claude configurations, commands, agents, and MCP servers as portable "stacks" that can be published to and installed from the Commands.com marketplace.

## Key Features

- Export/restore Claude Code development environments
- Publish stacks to Commands.com marketplace
- Browse and install stacks from the marketplace
- Manage local and remote stacks
- OAuth authentication with Commands.com
- Support for both global (~/.claude) and local project configurations

## Tech Stack

- **Language**: TypeScript (ES2020 target, ESM modules)
- **Runtime**: Node.js
- **CLI Framework**: Commander.js
- **UI Libraries**:
  - chalk (colored output)
  - ora (spinners)
  - inquirer (interactive prompts)
- **File System**: fs-extra
- **HTTP Client**: node-fetch
- **Build Tool**: TypeScript Compiler (tsc)
- **Dev Runner**: tsx

## Architecture Overview

- CLI entry point at `src/cli.ts`
- Modular action-based architecture with separate modules for each command
- Type-safe interfaces in `src/types/index.ts`
- Utility modules for cross-cutting concerns (auth, API, colors, etc.)
- UI components separated into `src/ui/` directory
