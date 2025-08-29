import fs from 'fs-extra';
import * as path from 'path';
import { getStacksPath } from '../constants/paths.js';
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

/**
 * Displays comprehensive information about a stack or current directory
 *
 * Shows stack metadata, components, and configuration details in a formatted
 * display. Can show either a specific stack file or current directory analysis.
 *
 * @param stackFile - Optional path to stack file, uses default if not provided
 * @param showCurrent - If true, shows current directory info instead of stack details
 * @returns Promise that resolves when display is complete
 * @throws {Error} When stack file cannot be found or loaded
 * @example
 * ```typescript
 * await showStackInfo('./my-stack.json');
 * await showStackInfo(undefined, true); // Show current directory
 * ```
 * @since 1.0.0
 * @public
 */
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
    return path.join(getStacksPath(), defaultPath);
  }

  // Use PathSecurity to ensure the default path is safe
  return PathSecurity.sanitizePath(defaultPath, getStacksPath());
}

function resolveTestPath(stackFile: string): string {
  // For non-absolute paths without directory separators, join with getStacksPath()
  if (!path.isAbsolute(stackFile) && !stackFile.includes('/') && !stackFile.includes('\\')) {
    return path.join(getStacksPath(), stackFile);
  }
  return path.resolve(stackFile);
}

function resolveUserPath(stackFile: string): string {
  // For non-absolute paths without directory separators, join with getStacksPath()
  if (!path.isAbsolute(stackFile) && !stackFile.includes('/') && !stackFile.includes('\\')) {
    return PathSecurity.sanitizePath(stackFile, getStacksPath());
  }

  if (path.isAbsolute(stackFile)) {
    return resolveAbsolutePath(stackFile);
  }

  return resolveRelativePath(stackFile);
}

function resolveAbsolutePath(stackFile: string): string {
  const allowedDirs = [getStacksPath(), process.cwd()];

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
  const allowedDirs = [getStacksPath(), process.cwd()];

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

  // Display hooks if they exist
  if (stack.hooks && stack.hooks.length > 0) {
    console.log(chalk.cyan.bold('HOOKS:'));
    displayHooks('hooks', stack.hooks);
  }

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

  console.log(chalk.blue(`  ${key}:`));

  if (Array.isArray(hooks)) {
    displayHookArray(hooks);
  } else {
    displayHookSettings(hooks as Record<string, unknown>);
  }
}

/**
 * Display array of StackHook objects
 */
function displayHookArray(hooks: unknown[]): void {
  hooks.forEach((hook: unknown) => {
    if (hook && typeof hook === 'object') {
      displaySingleHook(hook);
    }
  });
}

/**
 * Display a single hook with risk information
 */
function displaySingleHook(hook: unknown): void {
  if (!hook || typeof hook !== 'object') return;

  const hookObj = hook as Record<string, unknown>;
  const riskLevel = (hookObj.riskLevel as string) ?? 'safe';
  const name = (hookObj.name as string) ?? 'unknown';
  const type = (hookObj.type as string) ?? 'unknown';
  const filePath = hookObj.filePath as string;

  const riskEmoji = getRiskEmoji(riskLevel);
  const hookInfo = `${name} (${type})`;

  if (riskLevel && riskLevel !== 'safe') {
    console.log(`    ${riskEmoji} ${chalk.yellow(hookInfo)} - ${chalk.gray(filePath)}`);
    displaySuspiciousPatterns(hookObj.scanResults);
  } else {
    console.log(`    ${riskEmoji} ${chalk.green(hookInfo)} - ${chalk.gray(filePath)}`);
  }
}

/**
 * Display suspicious patterns for a hook
 */
function displaySuspiciousPatterns(scanResults: unknown): void {
  if (!scanResults || typeof scanResults !== 'object') return;

  const results = scanResults as Record<string, unknown>;
  const patterns = results.suspiciousPatterns as string[] | undefined;

  if (patterns && Array.isArray(patterns) && patterns.length > 0) {
    patterns.slice(0, 2).forEach((pattern: string) => {
      console.log(`      • ${chalk.gray(pattern)}`);
    });
    if (patterns.length > 2) {
      console.log(`      • ${chalk.gray(`... and ${patterns.length - 2} more`)}`);
    }
  }
}

/**
 * Display settings-based hooks
 */
function displayHookSettings(hooksObj: Record<string, unknown>): void {
  Object.entries(hooksObj).forEach(([hookName, hookConfig]) => {
    if (Array.isArray(hookConfig)) {
      const totalHooks = calculateTotalHooks(hookConfig);
      console.log(
        chalk.green(`    ✓ ${hookName}:`),
        `${hookConfig.length} matcher(s), ${totalHooks} hook(s)`
      );
    }
  });
}

/**
 * Calculate total hooks in configuration
 */
function calculateTotalHooks(hookConfig: unknown[]): number {
  return hookConfig.reduce((sum: number, matcher: unknown) => {
    const matcherObj = matcher as Record<string, unknown>;
    return sum + (Array.isArray(matcherObj.hooks) ? (matcherObj.hooks as unknown[]).length : 0);
  }, 0);
}

/**
 * Displays comprehensive hook safety analysis with risk categorization
 *
 * Analyzes both file-based hooks and inline script patterns, presenting
 * a detailed security report with risk levels, suspicious patterns, and
 * safety statistics to help users make informed decisions about stack installation.
 *
 * @param hooks - Array of analyzed hook objects from stack files
 * @param inlineResults - Map of inline script analysis results with risk scores
 *
 * @example
 * ```typescript
 * const hooks = await analyzeStackHooks(stack);
 * const inlineResults = await scanInlineScripts(stack);
 * displayHookSafetySummary(hooks, inlineResults);
 * ```
 *
 * @since 1.2.0
 * @public
 */
function displayHookSafetySummary(hooks: unknown[], inlineResults?: Map<string, unknown>): void {
  if (!hooks?.length && (!inlineResults || inlineResults.size === 0)) {
    return;
  }

  console.log(chalk.blue('\n🔍 Hook Safety Analysis'));
  console.log('═'.repeat(50));

  displayFileBasedHooks(hooks);
  displayInlineHooks(inlineResults);
  displaySafetySummary(hooks, inlineResults);
}

/**
 * Display file-based hooks with their analysis
 */
function displayFileBasedHooks(hooks: unknown[]): void {
  if (!hooks?.length) {
    return;
  }

  console.log(chalk.cyan('\n📄 File-based hooks:'));
  hooks.forEach(hook => {
    displayHookAnalysis(hook);
  });
}

/**
 * Display analysis for a single hook
 */
function displayHookAnalysis(hook: unknown): void {
  if (!hook || typeof hook !== 'object') return;

  const hookObj = hook as Record<string, unknown>;
  const riskLevel = (hookObj.riskLevel as string) ?? 'safe';
  const name = hookObj.name as string;
  const type = (hookObj.type as string) ?? 'unknown';
  const description = hookObj.description as string;
  const scanResults = hookObj.scanResults as Record<string, unknown> | undefined;

  const riskEmoji = getRiskEmoji(riskLevel);
  console.log(`  ${riskEmoji} ${name} (${type})`);

  if (scanResults?.suspiciousPatterns) {
    const patterns = scanResults.suspiciousPatterns as string[];
    if (Array.isArray(patterns) && patterns.length > 0) {
      patterns.forEach((pattern: string) => {
        console.log(`    • ${chalk.gray(pattern)}`);
      });
    }
  }

  if (description) {
    console.log(`    ${chalk.gray(`Description: ${description}`)}`);
  }
}

/**
 * Display inline hooks with their analysis
 */
function displayInlineHooks(inlineResults?: Map<string, unknown>): void {
  if (!inlineResults || inlineResults.size === 0) {
    return;
  }

  console.log(chalk.cyan('\n📝 Inline hooks:'));
  for (const [hookPath, scanResult] of inlineResults) {
    displayInlineHookAnalysis(hookPath, scanResult);
  }
}

/**
 * Display analysis for a single inline hook
 */
function displayInlineHookAnalysis(hookPath: string, scanResult: unknown): void {
  if (!scanResult || typeof scanResult !== 'object') return;

  const result = scanResult as Record<string, unknown>;
  const riskScore = result.riskScore as number;
  const patterns = result.suspiciousPatterns as string[] | undefined;

  const riskLevel = calculateRiskLevel(riskScore);
  const riskEmoji = getRiskEmoji(riskLevel);
  console.log(`  ${riskEmoji} ${hookPath} (risk: ${riskScore})`);

  if (patterns && Array.isArray(patterns) && patterns.length > 0) {
    patterns.forEach((pattern: string) => {
      console.log(`    • ${chalk.gray(pattern)}`);
    });
  }
}

/**
 * Display summary of hook safety analysis
 */
function displaySafetySummary(hooks: unknown[], inlineResults?: Map<string, unknown>): void {
  const counts = calculateSafetyCounts(hooks, inlineResults);

  console.log(chalk.blue('\n📊 Summary:'));
  console.log(`  ✅ Safe: ${counts.safe} hooks`);
  console.log(`  ⚠️  Warning: ${counts.warning} hooks`);
  console.log(`  🔴 Dangerous: ${counts.dangerous} hooks`);
  console.log(`  📝 Inline hooks: ${inlineResults?.size ?? 0}`);
  console.log(`  📄 File hooks: ${hooks?.length ?? 0}`);
}

/**
 * Calculate safety counts for hooks
 */
function calculateSafetyCounts(hooks: unknown[], inlineResults?: Map<string, unknown>) {
  const fileHookCounts = calculateFileHookCounts(hooks);
  const inlineHookCounts = calculateInlineHookCounts(inlineResults);

  return {
    safe: fileHookCounts.safe + inlineHookCounts.safe,
    warning: fileHookCounts.warning + inlineHookCounts.warning,
    dangerous: fileHookCounts.dangerous + inlineHookCounts.dangerous,
  };
}

/**
 * Calculate counts for file-based hooks
 */
function calculateFileHookCounts(hooks: unknown[]) {
  const safeCount =
    hooks?.filter(h => {
      return h && typeof h === 'object' && (h as Record<string, unknown>).riskLevel === 'safe';
    }).length ?? 0;

  const warningCount =
    hooks?.filter(h => {
      return h && typeof h === 'object' && (h as Record<string, unknown>).riskLevel === 'warning';
    }).length ?? 0;

  const dangerousCount =
    hooks?.filter(h => {
      return h && typeof h === 'object' && (h as Record<string, unknown>).riskLevel === 'dangerous';
    }).length ?? 0;

  return {
    safe: safeCount,
    warning: warningCount,
    dangerous: dangerousCount,
  };
}

/**
 * Calculate counts for inline hooks
 */
function calculateInlineHookCounts(inlineResults?: Map<string, unknown>) {
  if (!inlineResults) {
    return { safe: 0, warning: 0, dangerous: 0 };
  }

  const values = Array.from(inlineResults.values());
  const safeCount = values.filter(r => {
    if (!r || typeof r !== 'object') return false;
    const riskScore = (r as Record<string, unknown>).riskScore as number;
    return calculateRiskLevel(riskScore) === 'safe';
  }).length;

  const warningCount = values.filter(r => {
    if (!r || typeof r !== 'object') return false;
    const riskScore = (r as Record<string, unknown>).riskScore as number;
    return calculateRiskLevel(riskScore) === 'warning';
  }).length;

  const dangerousCount = values.filter(r => {
    if (!r || typeof r !== 'object') return false;
    const riskScore = (r as Record<string, unknown>).riskScore as number;
    return calculateRiskLevel(riskScore) === 'dangerous';
  }).length;

  return {
    safe: safeCount,
    warning: warningCount,
    dangerous: dangerousCount,
  };
}

/**
 * Calculates risk level category based on numerical risk score
 *
 * Categorizes security risk scores into meaningful levels for user decision making.
 * Uses established thresholds to determine if code execution poses safety concerns.
 *
 * @param riskScore - Numerical risk score (0-100 scale)
 * @returns Risk level category for user display and decision making
 *
 * @example
 * ```typescript
 * const level = calculateRiskLevel(85); // 'dangerous'
 * const level = calculateRiskLevel(45); // 'warning'
 * const level = calculateRiskLevel(10); // 'safe'
 * ```
 *
 * @since 1.2.0
 * @public
 */
function calculateRiskLevel(riskScore: number): 'safe' | 'warning' | 'dangerous' {
  if (riskScore >= 70) return 'dangerous';
  if (riskScore >= 30) return 'warning';
  return 'safe';
}

/**
 * Gets appropriate emoji icon for risk level visualization
 *
 * Provides visual indicators to help users quickly assess security risk levels
 * in console output and user interfaces.
 *
 * @param riskLevel - Risk level string ('safe', 'warning', 'dangerous')
 * @returns Emoji character representing the risk level
 *
 * @example
 * ```typescript
 * const emoji = getRiskEmoji('safe');      // '✅'
 * const emoji = getRiskEmoji('warning');   // '⚠️'
 * const emoji = getRiskEmoji('dangerous'); // '🔴'
 * const emoji = getRiskEmoji('unknown');   // '❓'
 * ```
 *
 * @since 1.2.0
 * @public
 */
function getRiskEmoji(riskLevel: string): string {
  const riskEmojis = {
    safe: '✅',
    warning: '⚠️',
    dangerous: '🔴',
  };
  return riskEmojis[riskLevel as keyof typeof riskEmojis] || '❓';
}

// Export the new hook-related display functions
export { displayHookSafetySummary, getRiskEmoji, calculateRiskLevel };
