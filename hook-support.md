# Hook Support Implementation Plan for Claude-Stacks

## Executive Summary

Enhance claude-stacks to bundle hook files with exports and provide comprehensive safety scanning for both inline and file-based hooks.

### Current State

- Claude-stacks **already supports hooks** in settings.json (they're displayed in stack preview)
- Hooks can be either:
  - **Inline code** directly in settings.json (already fully supported)
  - **File references** to `.claude/hooks/*.py` or `.claude/hooks/*.sh` files
- Settings (including hooks) are exported/imported as part of stacks
- All 9 hook types are available: PreToolUse, PostToolUse, Notification, UserPromptSubmit, Stop, SubagentStop, SessionEnd, PreCompact, SessionStart

### The Gap

When exporting a stack that references hook files in `.claude/hooks/`, the settings.json includes the file paths but the actual Python/shell files aren't bundled with the stack. This means file-based hooks won't work when the stack is installed elsewhere, while inline hooks work fine.

### Implementation Steps

#### 1. Extend Stack Types for Hook Files

Add to `src/types/index.ts`:

```typescript
export interface StackHook {
  name: string;
  type:
    | 'PreToolUse'
    | 'PostToolUse'
    | 'Notification'
    | 'UserPromptSubmit'
    | 'Stop'
    | 'SubagentStop'
    | 'SessionEnd'
    | 'PreCompact'
    | 'SessionStart';
  filePath: string;
  content: string;
  description?: string;
  matcher?: string; // Tool pattern matcher (regex or exact)
  riskLevel?: 'safe' | 'warning' | 'dangerous';
  scanResults?: HookScanResult;
}

export interface HookScanResult {
  hasFileSystemAccess: boolean;
  hasNetworkAccess: boolean;
  hasProcessExecution: boolean;
  hasDangerousImports: boolean;
  hasCredentialAccess: boolean;
  suspiciousPatterns: string[];
  riskScore: number; // 0-100
}

export interface DeveloperStack {
  // ... existing fields
  hooks?: StackHook[];
}
```

#### 2. Create Hook Safety Scanner Service

New file `src/services/HookScannerService.ts`:

```typescript
class HookScannerService {
  private dangerousPatterns = {
    fileSystemDelete: /(?:shutil\.rmtree|os\.remove|fs\.unlink|rm\s+-rf)/,
    networkRequests: /(?:requests\.|urllib\.|fetch\(|axios|curl\s+|wget\s+)/,
    processExecution: /(?:subprocess\.|os\.system|exec\(|eval\()/,
    dangerousImports: /import\s+(?:subprocess|shutil|requests|urllib|os)/,
    credentialAccess: /(?:password|token|secret|api_key|credential|ssh|gpg)/i,
    envVarAccess: /(?:os\.environ|process\.env|\$\{?\w+\}?)/,
  };

  scanHook(content: string): HookScanResult {
    // Analyze Python/shell code for dangerous patterns
    // Calculate risk score based on operations found
    // Return comprehensive risk assessment
  }

  // Scan hooks in settings (both inline and file references)
  scanSettingsHooks(settings: StackSettings): Map<string, HookScanResult> {
    const results = new Map<string, HookScanResult>();

    if (settings.hooks && typeof settings.hooks === 'object') {
      const hooksConfig = settings.hooks as Record<string, any>;

      for (const [eventType, hookConfigs] of Object.entries(hooksConfig)) {
        if (Array.isArray(hookConfigs)) {
          for (let i = 0; i < hookConfigs.length; i++) {
            const config = hookConfigs[i];

            // Scan inline code
            if (config.code && typeof config.code === 'string') {
              const scanResult = this.scanHook(config.code);
              results.set(`${eventType}[${i}].inline`, scanResult);
            }

            // Handle matchers with hooks arrays
            if (config.hooks && Array.isArray(config.hooks)) {
              for (let j = 0; j < config.hooks.length; j++) {
                const hook = config.hooks[j];
                if (hook.code && typeof hook.code === 'string') {
                  const scanResult = this.scanHook(hook.code);
                  results.set(`${eventType}[${i}].hooks[${j}].inline`, scanResult);
                }
              }
            }
          }
        }
      }
    }

    return results;
  }

  generateSafetyReport(hooks: StackHook[], inlineResults?: Map<string, HookScanResult>): string {
    // Generate human-readable safety report for both file and inline hooks
    // Group by risk level
    // Provide clear explanations
  }

  calculateRiskLevel(scanResults: HookScanResult): 'safe' | 'warning' | 'dangerous' {
    if (scanResults.riskScore >= 70) return 'dangerous';
    if (scanResults.riskScore >= 30) return 'warning';
    return 'safe';
  }
}
```

#### 3. Update Export Action

Modify `src/actions/export.ts`:

```typescript
// Hooks are collected BY DEFAULT when settings reference them
// Only supports .claude/hooks/ directory (no global hooks)
async function collectHooks(
  settings: StackSettings,
  excludeHooks: boolean = false // New option to skip hooks
): Promise<StackHook[]> {
  // Skip hook collection if explicitly excluded
  if (excludeHooks) {
    return [];
  }

  const hooks: StackHook[] = [];
  const scanner = new HookScannerService();

  // Parse settings to find referenced hook files
  // Note: Inline hooks remain in settings.json, only file refs are collected
  const hookPaths = extractHookFilePaths(settings);

  for (const hookPath of hookPaths) {
    // Only support .claude/hooks/ directory
    if (!hookPath.startsWith('.claude/hooks/')) {
      console.warn(`Skipping hook outside .claude/hooks/: ${hookPath}`);
      continue;
    }

    const resolvedPath = path.join(process.cwd(), hookPath);

    if (await fs.pathExists(resolvedPath)) {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const scanResults = scanner.scanHook(content);

      hooks.push({
        name: path.basename(resolvedPath, path.extname(resolvedPath)),
        filePath: hookPath, // Store original path from settings
        content,
        description: extractHookDescription(content),
        riskLevel: scanner.calculateRiskLevel(scanResults),
        scanResults,
      });
    } else {
      console.warn(`Warning: Hook file not found: ${hookPath}`);
    }
  }

  return hooks;
}

function extractHookFilePaths(settings: StackSettings): string[] {
  const paths: string[] = [];

  if (settings.hooks && typeof settings.hooks === 'object') {
    const hooksConfig = settings.hooks as Record<string, any>;

    // Iterate through hook events (PreToolUse, PostToolUse, etc.)
    for (const hookConfigs of Object.values(hooksConfig)) {
      if (Array.isArray(hookConfigs)) {
        for (const config of hookConfigs) {
          // Handle matchers with hooks arrays
          if (config.hooks && Array.isArray(config.hooks)) {
            for (const hook of config.hooks) {
              // Skip inline code (type: 'inline' or has 'code' field)
              if (hook.type === 'inline' || hook.code) continue;

              // Collect file references
              if (hook.command && typeof hook.command === 'string') {
                paths.push(hook.command);
              }
            }
          }
          // Handle direct hook configs
          else if (
            config.type !== 'inline' &&
            !config.code &&
            config.command &&
            typeof config.command === 'string'
          ) {
            paths.push(config.command);
          }
        }
      }
    }
  }

  return paths;
}
```

#### 4. Update Install/Restore Actions

Modify `src/actions/restore.ts`:

```typescript
async function restoreHooks(hooks: StackHook[], settings: StackSettings, options: RestoreOptions) {
  const scanner = new HookScannerService();

  // Scan inline hooks from settings
  const inlineResults = scanner.scanSettingsHooks(settings);

  // Generate combined safety report for file and inline hooks
  const safetyReport = scanner.generateSafetyReport(hooks, inlineResults);

  // Display safety analysis
  console.log('\n🔍 Hook Safety Analysis');
  console.log('═'.repeat(50));
  console.log(safetyReport);

  // Group all hooks (file + inline) by risk level
  const dangerousCount =
    hooks.filter(h => h.riskLevel === 'dangerous').length +
    Array.from(inlineResults.values()).filter(r => scanner.calculateRiskLevel(r) === 'dangerous')
      .length;
  const warningCount =
    hooks.filter(h => h.riskLevel === 'warning').length +
    Array.from(inlineResults.values()).filter(r => scanner.calculateRiskLevel(r) === 'warning')
      .length;
  const safeCount =
    hooks.filter(h => h.riskLevel === 'safe').length +
    Array.from(inlineResults.values()).filter(r => scanner.calculateRiskLevel(r) === 'safe').length;

  // Show summary
  console.log('\n📊 Summary:');
  console.log(`  ✅ Safe: ${safeCount} hooks`);
  console.log(`  ⚠️  Warning: ${warningCount} hooks`);
  console.log(`  🔴 Dangerous: ${dangerousCount} hooks`);
  console.log(`  📝 Inline hooks: ${inlineResults.size}`);
  console.log(`  📄 File hooks: ${hooks.length}`);

  // Require explicit confirmation for risky hooks (both file and inline)
  if (dangerousCount > 0 || warningCount > 0) {
    console.log('\n⚠️  This stack contains hooks that perform sensitive operations.');
    console.log('Review the analysis above carefully before proceeding.');

    const proceed = await ui.confirm('Install hooks? (y/N)');
    if (!proceed) {
      throw new Error('Hook installation cancelled by user');
    }
  }

  // Install hook files to their original locations
  for (const hook of hooks) {
    const targetPath = hook.filePath.startsWith('~')
      ? path.join(os.homedir(), hook.filePath.slice(1))
      : path.join(process.cwd(), hook.filePath);

    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, hook.content);

    // Make shell scripts executable
    if (hook.content.startsWith('#!/')) {
      await fs.chmod(targetPath, '755');
    }
  }

  // Register hooks for uninstallation tracking
  await registerHooksForUninstall(hooks, stack.name);

  console.log(`\n✅ Installed ${hooks.length} hooks successfully`);
  console.log('Note: Hooks are already configured in settings.json');
}

async function registerHooksForUninstall(hooks: StackHook[], stackName: string): Promise<void> {
  // Register hooks in the same registry system used for commands/agents
  const registry = await StackRegistryService.getInstance();

  for (const hook of hooks) {
    await registry.registerComponent({
      name: hook.name,
      type: 'hook',
      filePath: hook.filePath,
      stackName,
      installedAt: new Date().toISOString(),
    });
  }
}
```

#### 5. Safety Report Display

```typescript
function displayHookSafety(hook: StackHook): string {
  const { scanResults, riskLevel } = hook;
  let output = [];

  const riskEmoji = {
    safe: '✅',
    warning: '⚠️',
    dangerous: '🔴',
  };

  output.push(`\n${riskEmoji[riskLevel]} Hook: ${hook.name} (${hook.type})`);
  output.push(`   Risk Level: ${riskLevel.toUpperCase()}`);

  if (scanResults) {
    const risks = [];
    if (scanResults.hasFileSystemAccess) risks.push('File system access');
    if (scanResults.hasNetworkAccess) risks.push('Network requests');
    if (scanResults.hasProcessExecution) risks.push('Process execution');
    if (scanResults.hasCredentialAccess) risks.push('Credential handling');

    if (risks.length > 0) {
      output.push(`   Operations: ${risks.join(', ')}`);
    }

    if (scanResults.suspiciousPatterns.length > 0) {
      output.push(`   Patterns: ${scanResults.suspiciousPatterns.join(', ')}`);
    }
  }

  if (hook.description) {
    output.push(`   Description: ${hook.description}`);
  }

  return output.join('\n');
}
```

#### 6. Update Uninstall Action

Modify `src/actions/uninstall.ts`:

```typescript
async function uninstallHooks(stackName: string, options: UninstallOptions): Promise<void> {
  const registry = await StackRegistryService.getInstance();
  const hookComponents = await registry.getComponentsByStack(stackName, 'hook');

  if (hookComponents.length === 0) return;

  console.log(`\n🗑️  Uninstalling ${hookComponents.length} hooks...`);

  for (const component of hookComponents) {
    const targetPath = component.filePath.startsWith('~')
      ? path.join(os.homedir(), component.filePath.slice(1))
      : path.join(process.cwd(), component.filePath);

    if (await fs.pathExists(targetPath)) {
      if (!options.dryRun) {
        await fs.remove(targetPath);
        console.log(`  ✅ Removed ${component.filePath}`);
      } else {
        console.log(`  🔍 Would remove ${component.filePath}`);
      }
    }

    if (!options.dryRun) {
      await registry.unregisterComponent(component.name, 'hook', stackName);
    }
  }

  // Note: We don't modify settings.json hooks configuration
  // User may want to keep hook configs even if files are removed
  console.log('\nNote: Hook configurations in settings.json were preserved');
  console.log('Remove manually if no longer needed');
}
```

#### 7. Update Registry Service

Extend `src/services/StackRegistryService.ts` to support hook components:

```typescript
interface RegistryComponent {
  name: string;
  type: 'command' | 'agent' | 'hook'; // Add 'hook' type
  filePath: string;
  stackName: string;
  installedAt: string;
}

// Update methods to handle hook type
async getComponentsByStack(stackName: string, type?: 'command' | 'agent' | 'hook'): Promise<RegistryComponent[]>
```

#### 8. New CLI Commands

Add to CLI:

- `claude-stacks view-hook <stack-file> <hook-name>` - Display hook source code
- `claude-stacks scan-hooks [stack-file]` - Scan all hooks in stack/project
- `claude-stacks list-hooks [stack-file]` - List all hooks with safety ratings
- `claude-stacks export --no-hooks` - Exclude hooks from export (hooks included by default)

## Testing the Implementation

### Test Cases

1. **Export with file-based hooks**

   ```bash
   # Project with hooks in .claude/hooks/
   claude-stacks export test-stack
   # Should bundle hook files and show safety analysis
   ```

2. **Export with inline hooks**

   ```bash
   # Project with inline hooks in settings.json
   claude-stacks export test-stack
   # Should analyze inline code and warn about risks
   ```

3. **Install with mixed hooks**

   ```bash
   claude-stacks install mixed-hooks-stack.json
   # Should show comprehensive safety report for both types
   # Should require confirmation for risky hooks
   ```

4. **Skip hooks during install**

   ```bash
   claude-stacks install risky-stack.json --no-hooks
   # Should install everything except hook files
   # Inline hooks remain in settings but user is warned
   ```

5. **Uninstall hooks**

   ```bash
   claude-stacks uninstall test-stack
   # Should remove hook files and unregister from tracking
   # Should preserve settings.json hook configs with warning
   ```

6. **List installed hooks**
   ```bash
   claude-stacks list-hooks
   # Should show all installed hook files with source stacks
   ```

### Expected Benefits

1. **Complete hook portability** - Stacks with file-based hooks will work anywhere
2. **Security transparency** - Users see exactly what code will execute
3. **Flexible deployment** - Can choose to include/exclude hooks as needed
4. **Better user experience** - No more broken stacks due to missing hook files

### Implementation Priority

1. **Phase 1**: Basic hook file bundling (export/install)
2. **Phase 2**: Safety scanning and reporting
3. **Phase 3**: CLI commands for hook management
4. **Phase 4**: Enhanced UI and documentation
