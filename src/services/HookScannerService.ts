import type { HookScanResult, StackHook, StackSettings } from '../types/index.js';

export class HookScannerService {
  private readonly dangerousPatterns = {
    fileSystemDelete: /(?:shutil\.rmtree|os\.remove|fs\.unlink|rm\s+-rf|del\s+|Remove-Item)/gi,
    networkRequests:
      /(?:requests\.|urllib\.|fetch\(|axios|curl\s+|wget\s+|Invoke-WebRequest|Net\.WebClient)/gi,
    processExecution:
      /(?:subprocess\.|os\.system|exec\(|eval\(|shell_exec|system\(|popen|Invoke-Expression|Start-Process)/gi,
    dangerousImports:
      /import\s+(?:subprocess|shutil|requests|urllib|os|sys)(?:\s|;|$)|from\s+(?:subprocess|shutil|requests|urllib|os|sys)\s+import/gi,
    credentialAccess:
      /(?:password|token|secret|api_key|credential|ssh|gpg|aws_access_key|github_token)/gi,
    envVarAccess:
      /(?:os\.environ|process\.env|\$\{?\w+\}?|getenv\(|Environment\.GetEnvironmentVariable)/gi,
    fileSystemWrite: /(?:open\([^,]*,\s*['"]\w*w|fs\.writeFile|File\.WriteAllText|Out-File|>\s*)/gi,
    databaseAccess: /(?:sqlite3|mysql|postgresql|mongodb|redis|connect\(.*database)/gi,
    cryptoOperations: /(?:hashlib|crypto|bcrypt|scrypt|pbkdf2|AES|RSA|encrypt|decrypt)/gi,
    systemModification: /(?:chmod|chown|mkdir|rmdir|mv|cp|move|copy|New-Item|Set-Acl)/gi,
  };

  scanHook(content: string): HookScanResult {
    const results: HookScanResult = {
      hasFileSystemAccess: false,
      hasNetworkAccess: false,
      hasProcessExecution: false,
      hasDangerousImports: false,
      hasCredentialAccess: false,
      suspiciousPatterns: [],
      riskScore: 0,
    };

    this.analyzePatterns(content, results);
    results.riskScore = Math.min(results.riskScore, 100);

    return results;
  }

  private analyzePatterns(content: string, results: HookScanResult): void {
    for (const [patternName, pattern] of Object.entries(this.dangerousPatterns)) {
      const matches = content.match(pattern);
      if (matches) {
        results.suspiciousPatterns.push(`${patternName}: ${matches.length} occurrence(s)`);
        this.updateRiskFlags(patternName, results);
      }
    }
  }

  private updateRiskFlags(patternName: string, results: HookScanResult): void {
    const riskScores: Record<string, number> = {
      fileSystemDelete: 20,
      fileSystemWrite: 20,
      systemModification: 20,
      networkRequests: 15,
      processExecution: 25,
      dangerousImports: 10,
      credentialAccess: 30,
      envVarAccess: 5,
      databaseAccess: 10,
      cryptoOperations: 5,
    };

    switch (patternName) {
      case 'fileSystemDelete':
      case 'fileSystemWrite':
      case 'systemModification':
        results.hasFileSystemAccess = true;
        break;
      case 'networkRequests':
        results.hasNetworkAccess = true;
        break;
      case 'processExecution':
        results.hasProcessExecution = true;
        break;
      case 'dangerousImports':
        results.hasDangerousImports = true;
        break;
      case 'credentialAccess':
        results.hasCredentialAccess = true;
        break;
    }

    results.riskScore += riskScores[patternName] ?? 0;
  }

  scanSettingsHooks(settings: StackSettings): Map<string, HookScanResult> {
    const results = new Map<string, HookScanResult>();

    if (!this.hasHooksConfig(settings)) {
      return results;
    }

    const hooksConfig = settings.hooks as Record<string, unknown>;
    this.processHooksConfig(hooksConfig, results);

    return results;
  }

  private hasHooksConfig(settings: StackSettings): boolean {
    return (
      settings.hooks !== undefined && typeof settings.hooks === 'object' && settings.hooks !== null
    );
  }

  private processHooksConfig(
    hooksConfig: Record<string, unknown>,
    results: Map<string, HookScanResult>
  ): void {
    for (const [eventType, hookConfigs] of Object.entries(hooksConfig)) {
      if (Array.isArray(hookConfigs)) {
        this.processHookConfigs(eventType, hookConfigs, results);
      }
    }
  }

  private processHookConfigs(
    eventType: string,
    hookConfigs: unknown[],
    results: Map<string, HookScanResult>
  ): void {
    for (let i = 0; i < hookConfigs.length; i++) {
      const config = hookConfigs[i];
      this.processHookConfig(eventType, i, config, results);
    }
  }

  private processHookConfig(
    eventType: string,
    index: number,
    config: unknown,
    results: Map<string, HookScanResult>
  ): void {
    if (!config || typeof config !== 'object') return;

    const configObj = config as Record<string, unknown>;

    // Scan inline code
    if (typeof configObj.code === 'string') {
      const scanResult = this.scanHook(configObj.code);
      results.set(`${eventType}[${index}].inline`, scanResult);
    }

    // Handle matchers with hooks arrays
    if (Array.isArray(configObj.hooks)) {
      this.processNestedHooks(eventType, index, configObj.hooks, results);
    }
  }

  private processNestedHooks(
    eventType: string,
    configIndex: number,
    hooks: unknown[],
    results: Map<string, HookScanResult>
  ): void {
    for (let j = 0; j < hooks.length; j++) {
      const hook = hooks[j];
      if (hook && typeof hook === 'object') {
        const hookObj = hook as Record<string, unknown>;
        if (typeof hookObj.code === 'string') {
          const scanResult = this.scanHook(hookObj.code);
          results.set(`${eventType}[${configIndex}].hooks[${j}].inline`, scanResult);
        }
      }
    }
  }

  calculateRiskLevel(scanResults: HookScanResult): 'safe' | 'warning' | 'dangerous' {
    if (scanResults.riskScore >= 70) return 'dangerous';
    if (scanResults.riskScore >= 30) return 'warning';
    return 'safe';
  }

  generateSafetyReport(hooks: StackHook[], inlineResults?: Map<string, HookScanResult>): string {
    const lines: string[] = [];

    if (hooks.length > 0) {
      lines.push('\n📄 File-based hooks:');
      this.addFileHooksReport(hooks, lines);
    }

    if (inlineResults && inlineResults.size > 0) {
      lines.push('\n📝 Inline hooks:');
      this.addInlineHooksReport(inlineResults, lines);
    }

    return lines.join('\n');
  }

  private addFileHooksReport(hooks: StackHook[], lines: string[]): void {
    for (const hook of hooks) {
      const riskEmoji = this.getRiskEmoji(hook.riskLevel ?? 'safe');
      lines.push(`  ${riskEmoji} ${hook.name} (${hook.type ?? 'unknown'})`);

      if (hook.scanResults?.suspiciousPatterns.length) {
        for (const pattern of hook.scanResults.suspiciousPatterns) {
          lines.push(`    • ${pattern}`);
        }
      }

      if (hook.description) {
        lines.push(`    Description: ${hook.description}`);
      }
    }
  }

  private addInlineHooksReport(inlineResults: Map<string, HookScanResult>, lines: string[]): void {
    for (const [hookPath, scanResult] of inlineResults) {
      const riskLevel = this.calculateRiskLevel(scanResult);
      const riskEmoji = this.getRiskEmoji(riskLevel);
      lines.push(`  ${riskEmoji} ${hookPath} (risk: ${scanResult.riskScore})`);

      if (scanResult.suspiciousPatterns.length > 0) {
        for (const pattern of scanResult.suspiciousPatterns) {
          lines.push(`    • ${pattern}`);
        }
      }
    }
  }

  private getRiskEmoji(riskLevel: string): string {
    const riskEmojis = {
      safe: '✅',
      warning: '⚠️',
      dangerous: '🔴',
    };
    return riskEmojis[riskLevel as keyof typeof riskEmojis] ?? '❓';
  }
}
