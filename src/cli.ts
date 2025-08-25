#!/usr/bin/env node

import { program } from 'commander';
import { colors } from './utils/colors.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// Import types
import { 
  DeveloperStack, 
  ExportOptions, 
  RestoreOptions, 
  PublishOptions, 
  BrowseOptions, 
  InstallOptions, 
  CleanOptions 
} from './types/index.js';

// Import utilities
import { readSingleChar } from './utils/input.js';
import { authenticate } from './utils/auth.js';
import { getApiConfig } from './utils/api.js';

// Import action functions
import { exportAction } from './actions/export.js';
import { restoreAction } from './actions/restore.js';
import { publishAction } from './actions/publish.js';
import { browseAction } from './actions/browse.js';
import { installAction } from './actions/install.js';
import { listAction } from './actions/list.js';
import { deleteAction } from './actions/delete.js';
import { cleanAction } from './actions/clean.js';
import { renameAction } from './actions/rename.js';

// Import UI components  
import { showStackDetailsAndActions, showLocalStackDetailsAndActions } from './ui/menus.js';
import { showStackInfo } from './ui/display.js';


// Set up CLI structure
program
  .name('claude-stacks')
  .description('Share your Claude Code environment in seconds - export and restore development stacks')
  .version(packageJson.version);

// Export command
program
  .command('export')
  .argument('[filename]', 'Output filename for the stack')
  .option('--name <name>', 'Custom name for the stack')
  .option('--description <description>', 'Custom description for the stack')
  .option('--stack-version <version>', 'Set stack version (default: auto-increment from last published)')
  .option('--include-global', 'Include global ~/.claude configurations (default: local only)')
  .option('--include-claude-md', 'Include CLAUDE.md files in the export')
  .description('Export your Claude Code environment to a shareable stack file')
  .action((filename, options) => exportAction(filename, options));

// Restore command  
program
  .command('restore')
  .argument('<filename>', 'Stack file to restore from')
  .option('--overwrite', 'Overwrite existing files (default: add/merge)')
  .option('--global-only', 'Only restore to global ~/.claude (skip local project files)')
  .option('--local-only', 'Only restore to local project .claude (skip global files)')
  .description('Restore a development stack to your current project')
  .action((filename, options) => restoreAction(filename, options));

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
  .action((options) => browseAction(options));

// Install command
program
  .command('install')
  .argument('<stack-id>', 'Stack ID from Commands.com marketplace')
  .option('--overwrite', 'Overwrite existing files (default: add/merge)')
  .option('--global-only', 'Only install to global ~/.claude (skip local project files)')
  .option('--local-only', 'Only install to local project .claude (skip global files)')
  .description('Install a remote stack from the marketplace')
  .action((stackId, options) => installAction(stackId, options));

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
  .action((stackId) => deleteAction(stackId));

// Rename command
program
  .command('rename')
  .argument('<new-title>', 'New title for the published stack')
  .description('Rename a published stack')
  .action((newTitle) => renameAction(newTitle));

// Clean command
program
  .command('clean')
  .option('--dry-run', 'Show what would be removed without making changes')
  .description('Remove project entries for directories that no longer exist')
  .action((options) => cleanAction(options));

// Parse and execute
program.parse();