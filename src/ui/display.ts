import fs from 'fs-extra';
import * as path from 'path';
import { STACKS_PATH } from '../constants/paths.js';
import chalk from 'chalk';
import { PathSecurity } from '../utils/pathSecurity.js';
import { isTestEnvironment, isTestPath } from '../utils/testHelpers.js';

import type {
  DeveloperStack,
  StackAgent,
  StackCommand,
  StackMcpServer,
  StackSettings,
} from '../types/index.js';
import { colors } from '../utils/colors.js';

interface CategorizedComponents {
  commands: StackCommand[];
  agents: StackAgent[];
}

interface ClaudeMdComponent {
  path: string;
  content: string;
}

// Show detailed stack information
export async function showStackInfo(
  stackFile?: string,
  showCurrent: boolean = false
): Promise<void> {
  if (showCurrent) {
    displayCurrentDirectoryInfo();
    return;
  }

  const stack = await loadStackFromFile(stackFile);
  displayStackHeader(stack);
  displayStackComponents(stack);
}

function displayCurrentDirectoryInfo(): void {
  console.log(chalk.cyan('🎯 Current Directory Environment'));
  console.log(colors.meta(`Path: ${process.cwd()}\n`));
  console.log(colors.info('Current directory analysis not yet implemented in refactored version'));
}

async function loadStackFromFile(stackFile?: string): Promise<DeveloperStack> {
  const resolvedPath = resolveStackFilePath(stackFile);

  if (!(await fs.pathExists(resolvedPath))) {
    throw new Error(`Stack file not found: ${resolvedPath}`);
  }

  return (await fs.readJson(resolvedPath)) as DeveloperStack;
}

function resolveStackFilePath(stackFile?: string): string {
  if (!stackFile) {
    return resolveDefaultStackPath();
  }

  if (isTestEnvironment() && isTestPath(stackFile)) {
    return resolveTestPath(stackFile);
  }

  return resolveUserPath(stackFile);
}

function resolveDefaultStackPath(): string {
  const currentDir = process.cwd();
  const dirName = path.basename(currentDir);
  const defaultPath = `${dirName}-stack.json`;

  // In test environment, allow test paths with minimal validation
  if (isTestEnvironment()) {
    return path.join(STACKS_PATH, defaultPath);
  }

  // Use PathSecurity to ensure the default path is safe
  return PathSecurity.sanitizePath(defaultPath, STACKS_PATH);
}

function resolveTestPath(stackFile: string): string {
  // For non-absolute paths without directory separators, join with STACKS_PATH
  if (!path.isAbsolute(stackFile) && !stackFile.includes('/') && !stackFile.includes('\\')) {
    return path.join(STACKS_PATH, stackFile);
  }
  return path.resolve(stackFile);
}

function resolveUserPath(stackFile: string): string {
  // For non-absolute paths without directory separators, join with STACKS_PATH
  if (!path.isAbsolute(stackFile) && !stackFile.includes('/') && !stackFile.includes('\\')) {
    return PathSecurity.sanitizePath(stackFile, STACKS_PATH);
  }

  if (path.isAbsolute(stackFile)) {
    return resolveAbsolutePath(stackFile);
  }

  return resolveRelativePath(stackFile);
}

function resolveAbsolutePath(stackFile: string): string {
  const allowedDirs = [STACKS_PATH, process.cwd()];

  if (!PathSecurity.isPathAllowed(stackFile, allowedDirs)) {
    throw new Error(
      `Access denied: stack file path outside allowed directories. Allowed: ${allowedDirs.join(', ')}`
    );
  }

  PathSecurity.validateFilePath(stackFile, path.dirname(stackFile));
  return path.resolve(stackFile);
}

function resolveRelativePath(stackFile: string): string {
  const resolved = path.resolve(process.cwd(), stackFile);
  const allowedDirs = [STACKS_PATH, process.cwd()];

  if (!PathSecurity.isPathAllowed(resolved, allowedDirs)) {
    throw new Error(
      `Access denied: stack file path outside allowed directories. Allowed: ${allowedDirs.join(', ')}`
    );
  }

  PathSecurity.validateFilePath(resolved, process.cwd());
  return resolved;
}

function displayStackHeader(stack: DeveloperStack): void {
  console.log(chalk.cyan.bold(`📦 ${stack.name}`));

  if (stack.version) {
    console.log(`Version: ${colors.meta(stack.version)}`);
  }
  if (stack.metadata?.exported_from) {
    console.log(`Exported from: ${stack.metadata.exported_from}`);
  }
  if (stack.metadata?.created_at) {
    const date = new Date(stack.metadata.created_at);
    console.log(`Created: ${date.toLocaleDateString()}`);
  }
  if (stack.metadata?.published_stack_id) {
    console.log(`Published ID: ${colors.id(stack.metadata.published_stack_id)}`);
    if (stack.metadata.published_version) {
      console.log(`Published Version: ${colors.meta(stack.metadata.published_version)}`);
    }
  }
  console.log();

  console.log(`Description: ${colors.description(stack.description)}`);
  console.log();
}

function displayStackComponents(stack: DeveloperStack): void {
  const { global, local } = categorizeComponents(stack);

  displayGlobalComponents(global, stack.claudeMd?.global);
  displayLocalComponents(local, stack.claudeMd?.local);
  displayMcpServers(stack.mcpServers ?? []);
  displaySettings(stack.settings);
}

function categorizeComponents(stack: DeveloperStack) {
  const global = {
    commands: (stack.commands ?? []).filter(c => c.filePath?.startsWith('~')),
    agents: (stack.agents ?? []).filter(a => a.filePath?.startsWith('~')),
  };

  const local = {
    commands: (stack.commands ?? []).filter(c => c.filePath?.startsWith('.')),
    agents: (stack.agents ?? []).filter(a => a.filePath?.startsWith('.')),
  };

  return { global, local };
}

function displayGlobalComponents(
  global: CategorizedComponents,
  globalClaudeMd?: ClaudeMdComponent
): void {
  if (global.commands.length === 0 && global.agents.length === 0 && !globalClaudeMd) {
    return;
  }

  console.log(chalk.cyan.bold('GLOBAL (~/.claude/):'));

  displayComponentList('Commands', global.commands);
  displayComponentList('Agents', global.agents);

  if (globalClaudeMd) {
    console.log(chalk.blue(`  CLAUDE.md:`));
    console.log(chalk.green(`    ✓ ${globalClaudeMd.path}`), `- Global project instructions`);
    console.log();
  }
}

function displayLocalComponents(
  local: CategorizedComponents,
  localClaudeMd?: ClaudeMdComponent
): void {
  const hasComponents = local.commands.length > 0 || local.agents.length > 0 || localClaudeMd;

  if (!hasComponents) {
    return;
  }

  console.log(chalk.cyan.bold('LOCAL (./.claude/):'));

  displayComponentList('Commands', local.commands);
  displayComponentList('Agents', local.agents);

  if (localClaudeMd) {
    console.log(chalk.blue(`  CLAUDE.md:`));
    console.log(chalk.green(`    ✓ ${localClaudeMd.path}`), `- Local project instructions`);
    console.log();
  }
}

function displayComponentList(type: string, components: (StackCommand | StackAgent)[]): void {
  if (components.length === 0) {
    return;
  }

  console.log(chalk.blue(`  ${type} (${components.length}):`));
  components.forEach(component => {
    const description = component.description ?? 'No description available';
    const truncatedDescription = truncateDescription(description);
    console.log(chalk.green(`    ✓ ${component.name}`), `- ${truncatedDescription}`);
  });
  console.log();
}

function truncateDescription(description: string): string {
  return description.length > 80 ? `${description.substring(0, 77)}...` : description;
}

function displayMcpServers(mcpServers: StackMcpServer[]): void {
  if (mcpServers.length === 0) {
    return;
  }

  console.log(chalk.blue(`  MCP Servers (${mcpServers.length}):`));
  mcpServers.forEach(mcp => {
    let serverInfo = mcp.name;
    if (mcp.type) serverInfo += ` (${mcp.type})`;
    if (mcp.command) serverInfo += ` - ${mcp.command}`;
    else if (mcp.url) serverInfo += ` - ${mcp.url}`;

    console.log(chalk.green(`    ✓ ${serverInfo}`));
  });
  console.log();
}

function displaySettings(settings?: StackSettings): void {
  if (!settings || Object.keys(settings).length === 0) {
    return;
  }

  console.log(chalk.cyan.bold('SETTINGS:'));
  Object.entries(settings).forEach(([key, value]) => {
    if (shouldSkipSetting(key)) {
      return;
    }

    displaySettingValue(key, value);
  });
  console.log();
}

function shouldSkipSetting(key: string): boolean {
  return ['$schema', 'feedbackSurveyState'].includes(key);
}

function displaySettingValue(key: string, value: unknown): void {
  if (key === 'permissions') {
    displayPermissions(key, value);
  } else if (key === 'statusLine') {
    displayStatusLine(key, value);
  } else if (key === 'hooks') {
    displayHooks(key, value);
  } else if (typeof value === 'object') {
    console.log(chalk.blue(`  ${key}:`), JSON.stringify(value, null, 2).replace(/\n/g, '\n    '));
  } else {
    console.log(chalk.blue(`  ${key}:`), String(value));
  }
}

function displayPermissionRule(
  type: string,
  rules: unknown,
  colorFn: (_text: string) => string // eslint-disable-line no-unused-vars
): void {
  if (Array.isArray(rules)) {
    console.log(colorFn(`    ${type}: ${rules.length} rules`));
  }
}

function displayPermissions(key: string, permissions: unknown): void {
  if (typeof permissions !== 'object' || permissions === null) {
    return;
  }

  const permissionsObj = permissions as Record<string, unknown>;

  console.log(chalk.blue(`  ${key}:`));
  displayPermissionRule('allow', permissionsObj.allow, chalk.green);
  displayPermissionRule('deny', permissionsObj.deny, chalk.red);
  displayPermissionRule('ask', permissionsObj.ask, chalk.yellow);

  if (permissionsObj.additionalDirectories && Array.isArray(permissionsObj.additionalDirectories)) {
    console.log(
      chalk.blue(
        `    additional directories: ${permissionsObj.additionalDirectories.length} entries`
      )
    );
  }
}

function displayStatusLine(key: string, statusLine: unknown): void {
  if (typeof statusLine !== 'object' || statusLine === null) {
    return;
  }

  const statusLineObj = statusLine as Record<string, unknown>;

  if (statusLineObj.type === 'command' && statusLineObj.command) {
    console.log(chalk.blue(`  ${key}:`), `${statusLineObj.type}: ${statusLineObj.command}`);
  } else {
    console.log(chalk.blue(`  ${key}:`), `type: ${statusLineObj.type ?? 'unknown'}`);
  }
}

function displayHooks(key: string, hooks: unknown): void {
  if (typeof hooks !== 'object' || hooks === null) {
    return;
  }

  const hooksObj = hooks as Record<string, unknown>;

  console.log(chalk.blue(`  ${key}:`));
  Object.entries(hooksObj).forEach(([hookName, hookConfig]) => {
    if (Array.isArray(hookConfig)) {
      const totalHooks = hookConfig.reduce((sum: number, matcher: unknown) => {
        const matcherObj = matcher as Record<string, unknown>;
        return sum + (Array.isArray(matcherObj.hooks) ? (matcherObj.hooks as unknown[]).length : 0);
      }, 0);
      console.log(
        chalk.green(`    ✓ ${hookName}:`),
        `${hookConfig.length} matcher(s), ${totalHooks} hook(s)`
      );
    }
  });
}
