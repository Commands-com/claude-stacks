#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// Import action functions
import { exportAction } from './actions/export.js';
import { importAction } from './actions/import.js';
import { publishAction } from './actions/publish.js';
import { browseAction } from './actions/browse.js';
import { installAction } from './actions/install.js';
import { listAction } from './actions/list.js';
import { deleteAction } from './actions/delete.js';
import { cleanAction } from './actions/clean.js';
import { renameAction } from './actions/rename.js';
import { uninstallAction } from './actions/uninstall.js';
import { listHooksAction, scanHooksAction, viewHookAction } from './actions/hooks.js';
import { syncMcpAction } from './actions/sync-mcp.js';

// Set up CLI structure
program
  .name('claude-stacks')
  .description(
    'Share your Claude Code environment in seconds - export and import development stacks'
  )
  .version(packageJson.version);

// Export command
program
  .command('export')
  .argument('[filename]', 'Output filename for the stack')
  .option('--name <name>', 'Custom name for the stack')
  .option('--description <description>', 'Custom description for the stack')
  .option(
    '--stack-version <version>',
    'Set stack version (default: auto-increment from last published)'
  )
  .option('--include-global', 'Include global ~/.claude configurations (default: local only)')
  .option('--include-claude-md', 'Include CLAUDE.md files in the export')
  .option('--no-hooks', 'Exclude hooks from export')
  .option(
    '--include-installed',
    'Include components from installed stacks (default: base layer only)'
  )
  .description('Export your Claude Code environment to a shareable stack file')
  .action((filename, options) => exportAction(filename, options));

// Import command
program
  .command('import')
  .argument('<filename>', 'Stack file to import from')
  .option('--overwrite', 'Overwrite existing files (default: add/merge)')
  .option('--global-only', 'Only import to global ~/.claude (skip local project files)')
  .option('--local-only', 'Only import to local project .claude (skip global files)')
  .description('Import a local stack to your current project')
  .action((filename, options) => importAction(filename, options));

// Publish command
program
  .command('publish')
  .argument('[filename]', 'Stack file to publish (looks in ~/.claude/stacks/ by default)')
  .option('--public', 'Make the stack publicly discoverable (default: private)')
  .description('Publish a stack to the Commands.com marketplace')
  .action((filename, options) => publishAction(filename, options));

// Browse command
program
  .command('browse')
  .option('--category <category>', 'Filter by category')
  .option('--search <search>', 'Search term to filter stacks')
  .option('--my-stacks', 'Show only your published stacks')
  .description('Browse and discover published stacks from the marketplace')
  .action(() => browseAction());

// Install command
program
  .command('install')
  .argument('<stack-id>', 'Stack ID from Commands.com marketplace')
  .option('--overwrite', 'Overwrite existing files (default: add/merge)')
  .option('--global-only', 'Only install to global ~/.claude (skip local project files)')
  .option('--local-only', 'Only install to local project .claude (skip global files)')
  .option('--no-hooks', 'Skip hook installation')
  .option('--no-settings', 'Skip settings and permissions installation')
  .option('--no-commands', 'Skip command installation')
  .option('--no-agents', 'Skip agent installation')
  .option('--no-mcp', 'Skip MCP server installation')
  .option('--no-claude-md', 'Skip CLAUDE.md file installation')
  .description('Install a remote stack from the marketplace')
  .action((stackId, options) => {
    // Transform Commander.js --no-X options to skipX format
    const transformedOptions = {
      ...options,
      skipHooks: !options.hooks,
      skipSettings: !options.settings,
      skipCommands: !options.commands,
      skipAgents: !options.agents,
      skipMcp: !options.mcp,
      skipClaudeMd: !options.claudeMd,
    };
    return installAction(stackId, transformedOptions);
  });

// List command
program
  .command('list')
  .description('List and manage local stacks in ~/.claude/stacks/')
  .action(listAction);

// Delete command
program
  .command('delete')
  .argument('<stack-id>', 'Stack ID to delete from Commands.com marketplace')
  .description('Delete a published stack from the marketplace')
  .action(stackId => deleteAction(stackId));

// Rename command
program
  .command('rename')
  .argument('<new-title>', 'New title for the published stack')
  .description('Rename a published stack')
  .action(newTitle => renameAction(newTitle));

// Uninstall command
program
  .command('uninstall')
  .argument('[stack-id]', 'Stack ID or name to uninstall from this project')
  .option('--commands-only', 'Remove only commands')
  .option('--agents-only', 'Remove only agents')
  .option('--mcp-only', 'Remove only MCP servers')
  .option('--settings-only', 'Remove only settings')
  .option('--force', 'Skip confirmation prompt')
  .option('--global', 'Remove from global config only')
  .option('--local', 'Remove from local config only')
  .option('--dry-run', 'Show what would be removed without making changes')
  .description('Uninstall a previously installed stack from your project')
  .action((stackId, options) => uninstallAction(stackId, options));

// Clean command
program
  .command('clean')
  .option('--dry-run', 'Show what would be removed without making changes')
  .description('Remove project entries for directories that no longer exist')
  .action(options => cleanAction(options));

// View hook command
program
  .command('view-hook')
  .argument('<stack-file>', 'Path to stack file or stack ID')
  .argument('<hook-name>', 'Name of the hook to view')
  .description('Display the contents and safety analysis of a specific hook')
  .action((stackFile, hookName) => viewHookAction(stackFile, hookName));

// Scan hooks command
program
  .command('scan-hooks')
  .argument('[stack-file]', 'Path to stack file or stack ID (default: current project)')
  .option('--show-safe', 'Include safe hooks in output (default: warnings and dangers only)')
  .option('--details', 'Show detailed scan results for each hook')
  .description('Scan hooks for potential security issues')
  .action((stackFile, options) => scanHooksAction(stackFile, options));

// List hooks command
program
  .command('list-hooks')
  .argument('[stack-file]', 'Path to stack file or stack ID (default: current project)')
  .option('--type <type>', 'Filter by hook type (PreToolUse, PostToolUse, etc.)')
  .option('--risk-level <level>', 'Filter by risk level (safe, warning, dangerous)')
  .description('List all hooks in a stack or current project')
  .action((stackFile, options) => listHooksAction(stackFile, options));

// Sync MCP command
program
  .command('sync')
  .description('Sync MCP servers from current Claude project to Codex and Gemini')
  .option('--append', 'Append to existing MCP servers instead of overwriting')
  .option('--codex-only', 'Only sync to Codex config (~/.codex/config.toml)')
  .option('--gemini-only', 'Only sync to Gemini config (~/.gemini/settings.json)')
  .option('--dry-run', 'Show what would be synced without making changes')
  .option('--force', 'Skip confirmation prompts')
  .action(options => syncMcpAction(options));

// Parse and execute
program.parse();
