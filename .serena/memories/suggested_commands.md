# Suggested Commands for Claude Stacks Development

## Development Commands

- `npm run build` - Compile TypeScript to JavaScript in dist/ directory
- `npm run dev` - Run development version (uses tsx to run TypeScript directly)
- `npm run prepublishOnly` - Build before publishing (runs automatically)

## Project Commands

- `npm install` - Install dependencies
- `npm publish` - Publish to npm registry (after build)

## CLI Testing Commands (after build)

- `node dist/cli.js export` - Test export functionality
- `node dist/cli.js list` - Test local stack listing
- `node dist/cli.js browse` - Test marketplace browsing

## System Utilities (macOS/Darwin)

- `ls` - List directory contents
- `cd` - Change directory
- `pwd` - Print working directory
- `find` - Find files and directories
- `grep` - Search text patterns
- `which` - Locate command binaries
- `open` - Open files/URLs (macOS specific)

## Git Commands

- `git status` - Check repository status
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit changes
- `git push` - Push to remote repository

## TypeScript Development

- `tsc --noEmit` - Type check without compilation
- `tsc --watch` - Watch mode compilation
