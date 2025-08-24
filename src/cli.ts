#!/usr/bin/env node

import { program } from 'commander';
import { colors } from './utils/colors';

// Import types
import { 
  DeveloperStack, 
  ExportOptions, 
  RestoreOptions, 
  PublishOptions, 
  BrowseOptions, 
  InstallOptions, 
  CleanOptions 
} from './types';

// Import utilities
import { readSingleChar } from './utils/input';
import { authenticate } from './utils/auth';
import { getApiConfig } from './utils/api';

// Import action functions
import { exportAction } from './actions/export';
import { restoreAction } from './actions/restore';
import { publishAction } from './actions/publish';
import { browseAction } from './actions/browse';
import { installAction } from './actions/install';
import { listAction } from './actions/list';
import { deleteAction } from './actions/delete';
import { cleanAction } from './actions/clean';

// Import UI components  
import { showStackDetailsAndActions, showLocalStackDetailsAndActions } from './ui/menus';
import { showStackInfo } from './ui/display';


// Set up CLI structure
program
  .name('claude-stacks')
  .description('Share your Claude Code environment in seconds - export and restore development stacks')
  .version('1.0.7');

// Export command
program
  .command('export')
  .argument('[filename]', 'Output filename for the stack')
  .option('--name <name>', 'Custom name for the stack')
  .option('--description <description>', 'Custom description for the stack')
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

// Clean command
program
  .command('clean')
  .option('--dry-run', 'Show what would be removed without making changes')
  .description('Remove project entries for directories that no longer exist')
  .action((options) => cleanAction(options));

// Parse and execute
program.parse();