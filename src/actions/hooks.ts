import { FileService } from '../services/FileService.js';
import { HookScannerService } from '../services/HookScannerService.js';
import { UIService } from '../services/UIService.js';
import { displayHookSafetySummary } from '../ui/display.js';
import type { StackHook } from '../types/index.js';

const fileService = new FileService();
const hookScanner = new HookScannerService();
const ui = new UIService();

/**
 * View a specific hook from a stack file or project
 */
export async function viewHookAction(stackFile: string, hookName: string): Promise<void> {
  try {
    const hooks = await loadHooksFromSource(stackFile);
    const hook = hooks.find(h => h.name === hookName);

    if (!hook) {
      console.error(ui.colorError(`Hook "${hookName}" not found`));
      if (process.env.NODE_ENV === 'test') {
        throw new Error(`Hook "${hookName}" not found`);
      }
      process.exit(1);
    }

    // Display hook details
    console.log(ui.colorInfo(`\n📋 Hook: ${hook.name}`));
    console.log(ui.colorMeta(`Type: ${hook.type}`));
    if (hook.description) {
      console.log(ui.colorMeta(`Description: ${hook.description}`));
    }
    if (hook.matcher) {
      console.log(ui.colorMeta(`Matcher: ${hook.matcher}`));
    }

    console.log(ui.colorMeta(`\n📁 Content:`));
    console.log(hook.content);

    // Show safety analysis
    if (hook.scanResults) {
      console.log(ui.colorMeta(`\n🔍 Safety Analysis:`));
      displayHookSafetySummary([hook]);
    }
  } catch (error) {
    console.error(
      ui.colorError('Failed to view hook:'),
      error instanceof Error ? error.message : String(error)
    );
    if (process.env.NODE_ENV === 'test') {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

/**
 * Scan hooks for security issues
 */
export async function scanHooksAction(
  stackFile: string | undefined,
  options: { showSafe?: boolean; details?: boolean }
): Promise<void> {
  try {
    const hooks = await loadHooksFromSource(stackFile);

    if (hooks.length === 0) {
      console.log(ui.colorInfo('No hooks found to scan'));
      return;
    }

    console.log(ui.colorInfo(`🔍 Scanning ${hooks.length} hooks for security issues...`));

    const scannedHooks = scanAllHooks(hooks);
    const hooksToShow = filterHooksByRisk(scannedHooks, options.showSafe);

    displayScanResults(hooksToShow, options.details);
  } catch (error) {
    console.error(
      ui.colorError('Failed to scan hooks:'),
      error instanceof Error ? error.message : String(error)
    );
    if (process.env.NODE_ENV === 'test') {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

/**
 * Scan all hooks for security issues
 */
function scanAllHooks(hooks: StackHook[]): StackHook[] {
  const scannedHooks: StackHook[] = [];
  for (const hook of hooks) {
    const scanResult = hookScanner.scanHook(hook.content);
    scannedHooks.push({
      ...hook,
      scanResults: scanResult,
      riskLevel: getRiskLevel(scanResult.riskScore),
    });
  }
  return scannedHooks;
}

/**
 * Filter hooks by risk level
 */
function filterHooksByRisk(hooks: StackHook[], showSafe?: boolean): StackHook[] {
  if (showSafe) {
    return hooks;
  }
  return hooks.filter(h => h.riskLevel !== 'safe');
}

/**
 * Display scan results
 */
function displayScanResults(hooksToShow: StackHook[], showDetails?: boolean): void {
  if (hooksToShow.length === 0) {
    console.log(ui.colorSuccess('✅ All hooks are safe'));
    return;
  }

  // Display results
  console.log(ui.colorMeta('\n📊 Scan Results:'));
  displayHookSafetySummary(hooksToShow);

  if (showDetails) {
    displayDetailedResults(hooksToShow);
  }
}

/**
 * Display detailed scan results
 */
function displayDetailedResults(hooks: StackHook[]): void {
  console.log(ui.colorMeta('\n📋 Detailed Results:'));
  for (const hook of hooks) {
    console.log(`\n${ui.colorInfo(hook.name)} (${hook.type})`);
    console.log(`  Risk Level: ${getRiskLevelDisplay(hook.riskLevel!)}`);
    console.log(`  Score: ${hook.scanResults!.riskScore}/100`);
    if (hook.scanResults!.suspiciousPatterns && hook.scanResults!.suspiciousPatterns.length > 0) {
      console.log(`  Suspicious Patterns: ${hook.scanResults!.suspiciousPatterns.join(', ')}`);
    }
  }
}

/**
 * List hooks in a stack or project
 */
export async function listHooksAction(
  stackFile: string | undefined,
  options: { type?: string; riskLevel?: string }
): Promise<void> {
  try {
    const hooks = await loadHooksFromSource(stackFile);

    if (hooks.length === 0) {
      console.log(ui.colorInfo('No hooks found'));
      return;
    }

    // Apply filters
    let filteredHooks = hooks;

    if (options.type) {
      filteredHooks = filteredHooks.filter(h => h.type === options.type);
    }

    if (options.riskLevel) {
      filteredHooks = filteredHooks.filter(h => h.riskLevel === options.riskLevel);
    }

    if (filteredHooks.length === 0) {
      console.log(ui.colorInfo('No hooks match the specified filters'));
      return;
    }

    console.log(ui.colorInfo(`📋 Found ${filteredHooks.length} hooks:`));
    displaySimpleHookList(filteredHooks);
  } catch (error) {
    console.error(
      ui.colorError('Failed to list hooks:'),
      error instanceof Error ? error.message : String(error)
    );
    if (process.env.NODE_ENV === 'test') {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

/**
 * Load hooks from a stack file or current project
 */
async function loadHooksFromSource(stackFile: string | undefined): Promise<StackHook[]> {
  if (stackFile) {
    // Load from stack file
    if (await fileService.exists(stackFile)) {
      const stackData = JSON.parse(await fileService.readTextFile(stackFile)) as {
        hooks?: StackHook[];
      };
      return stackData.hooks ?? [];
    } else {
      throw new Error(`Stack file not found: ${stackFile}`);
    }
  } else {
    // Load from current project
    const projectHooksDir = '.claude/hooks';
    if (!(await fileService.exists(projectHooksDir))) {
      return [];
    }

    const hooks: StackHook[] = [];
    const hookFiles = await fileService.listFiles(projectHooksDir);

    for (const file of hookFiles) {
      if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.py')) {
        const filePath = `${projectHooksDir}/${file}`;
        // eslint-disable-next-line no-await-in-loop
        const content = await fileService.readTextFile(filePath);
        const hookName = file.replace(/\.(js|ts|py)$/, '');

        // Try to determine hook type from filename or content
        const hookType = inferHookType(hookName);

        hooks.push({
          name: hookName,
          type: hookType,
          filePath,
          content,
        });
      }
    }

    return hooks;
  }
}

/**
 * Infer hook type from filename or content
 */
function inferHookType(name: string): StackHook['type'] {
  const lowerName = name.toLowerCase();

  return getHookTypeFromName(lowerName);
}

/**
 * Helper to determine hook type from filename
 */
function getHookTypeFromName(lowerName: string): StackHook['type'] {
  // Check for post-tool patterns
  if (checkPostToolPattern(lowerName)) return 'PostToolUse';

  // Check for pre-tool patterns
  if (checkPreToolPattern(lowerName)) return 'PreToolUse';

  // Check for session patterns
  const sessionType = checkSessionPattern(lowerName);
  if (sessionType) return sessionType;

  // Check for other patterns
  const otherType = checkOtherPatterns(lowerName);
  if (otherType) return otherType;

  // Default to PreToolUse if can't determine
  return 'PreToolUse';
}

/**
 * Check if name contains post-tool patterns
 */
function checkPostToolPattern(lowerName: string): boolean {
  return lowerName.includes('post-tool') || lowerName.includes('posttool');
}

/**
 * Check if name contains pre-tool patterns
 */
function checkPreToolPattern(lowerName: string): boolean {
  return lowerName.includes('pre-tool') || lowerName.includes('pretool');
}

/**
 * Check for session-related hook patterns
 */
function checkSessionPattern(lowerName: string): StackHook['type'] | null {
  if (lowerName.includes('session-start') || lowerName.includes('sessionstart')) {
    return 'SessionStart';
  }
  if (lowerName.includes('session-end') || lowerName.includes('sessionend')) {
    return 'SessionEnd';
  }
  return null;
}

/**
 * Check for other hook patterns
 */
function checkOtherPatterns(lowerName: string): StackHook['type'] | null {
  if (lowerName.includes('user-prompt') || lowerName.includes('prompt')) {
    return 'UserPromptSubmit';
  }
  if (lowerName.includes('notification')) {
    return 'Notification';
  }
  if (lowerName.includes('subagent-stop') || lowerName.includes('subagentstop')) {
    return 'SubagentStop';
  }
  if (lowerName.includes('pre-compact') || lowerName.includes('precompact')) {
    return 'PreCompact';
  }
  if (lowerName.includes('stop')) {
    return 'Stop';
  }
  return null;
}

/**
 * Convert numeric score to risk level
 */
function getRiskLevel(score: number): 'safe' | 'warning' | 'dangerous' {
  if (score >= 70) return 'dangerous';
  if (score >= 30) return 'warning';
  return 'safe';
}

/**
 * Get display string for risk level
 */
function getRiskLevelDisplay(level: string): string {
  switch (level) {
    case 'safe':
      return '✅ Safe';
    case 'warning':
      return '⚠️  Warning';
    case 'dangerous':
      return '🚨 Dangerous';
    default:
      return level;
  }
}

/**
 * Simple hook list display
 */
function displaySimpleHookList(hooks: StackHook[]): void {
  for (const hook of hooks) {
    const riskDisplay = hook.riskLevel ? getRiskLevelDisplay(hook.riskLevel) : '';
    console.log(`  • ${ui.colorInfo(hook.name)} (${hook.type}) ${riskDisplay}`);
    if (hook.description) {
      console.log(`    ${ui.colorMeta(hook.description)}`);
    }
    if (hook.filePath) {
      console.log(`    📁 ${ui.colorMeta(hook.filePath)}`);
    }
  }
}
