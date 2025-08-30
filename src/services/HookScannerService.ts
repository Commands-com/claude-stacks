import type { HookScanResult, StackHook, StackSettings } from '../types/index.js';

/**
 * Service for scanning and analyzing security risks in stack hooks
 *
 * @remarks
 * This service provides comprehensive security analysis of both file-based and inline hooks
 * within Claude Stacks. It identifies potentially dangerous patterns, calculates risk scores,
 * and generates detailed safety reports to help users make informed decisions about stack security.
 *
 * The service scans for various categories of suspicious patterns including file system operations,
 * network requests, process execution, credential access, and other potentially harmful activities.
 * Each pattern is assigned a risk score that contributes to an overall assessment.
 *
 * @since 1.4.0
 * @public
 */
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

  /**
   * Scan a hook's content for potentially dangerous patterns and security risks
   *
   * Analyzes the provided hook content against a comprehensive set of dangerous patterns
   * including file system operations, network access, process execution, credential access,
   * and other security-sensitive operations. Returns a detailed analysis with risk flags
   * and an overall risk score.
   *
   * @param content - The hook code content to analyze for security risks
   * @returns A comprehensive scan result containing risk flags, suspicious patterns, and risk score
   * @throws {Error} Never throws - all parsing errors are handled gracefully
   * @example
   * ```typescript
   * const scanner = new HookScannerService();
   * const result = scanner.scanHook('import subprocess; subprocess.run("rm -rf /")')
   * console.log(result.riskScore); // High risk score due to dangerous patterns
   * console.log(result.hasProcessExecution); // true
   * console.log(result.hasFileSystemAccess); // true
   * ```
   * @since 1.4.0
   * @public
   */
  async scanHook(content: string, options: { filename?: string } = {}): Promise<HookScanResult> {
    // Try Tree-sitter first for more accurate analysis
    const treeSitterResult = await this.tryTreeSitterScan(content, options);

    if (treeSitterResult) {
      // Use Tree-sitter result as primary, with regex as complement
      const regexResult = this.scanWithRegex(content);
      return this.mergeResults(treeSitterResult, regexResult);
    }

    // Fall back to regex-only scanning if Tree-sitter fails
    return this.scanWithRegex(content);
  }

  /**
   * Try Tree-sitter scanning with dynamic import to avoid Jest parsing issues
   */
  private async tryTreeSitterScan(
    content: string,
    options: { filename?: string } = {}
  ): Promise<HookScanResult | null> {
    try {
      // Use dynamic import to avoid Jest parsing the import.meta syntax
      const { scanWithTreeSitter } = await import('../utils/treeSitterEngine.js');
      return await scanWithTreeSitter(content, options);
    } catch {
      // Tree-sitter not available or failed to import, gracefully fall back
      return null;
    }
  }

  /**
   * Legacy regex-based scanning method
   */
  private scanWithRegex(content: string): HookScanResult {
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

  /**
   * Merge Tree-sitter and regex results, prioritizing Tree-sitter findings
   */
  private mergeResults(
    treeSitterResult: HookScanResult,
    regexResult: HookScanResult
  ): HookScanResult {
    // Tree-sitter results take precedence for flags
    const merged: HookScanResult = {
      hasFileSystemAccess: treeSitterResult.hasFileSystemAccess || regexResult.hasFileSystemAccess,
      hasNetworkAccess: treeSitterResult.hasNetworkAccess || regexResult.hasNetworkAccess,
      hasProcessExecution: treeSitterResult.hasProcessExecution || regexResult.hasProcessExecution,
      hasDangerousImports: treeSitterResult.hasDangerousImports || regexResult.hasDangerousImports,
      hasCredentialAccess: treeSitterResult.hasCredentialAccess || regexResult.hasCredentialAccess,
      suspiciousPatterns: [],
      riskScore: 0,
    };

    // Merge suspicious patterns, deduplicating
    const allPatterns = [...treeSitterResult.suspiciousPatterns, ...regexResult.suspiciousPatterns];
    merged.suspiciousPatterns = Array.from(new Set(allPatterns));

    // Use higher risk score (Tree-sitter is usually more accurate)
    merged.riskScore = Math.max(treeSitterResult.riskScore, regexResult.riskScore);
    merged.riskScore = Math.min(merged.riskScore, 100);

    return merged;
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

  /**
   * Scan all inline hooks within stack settings for security risks
   *
   * Traverses the stack settings to find and analyze all inline hook code snippets.
   * This includes hooks defined directly in the settings configuration as well as
   * nested hooks within matcher configurations. Each discovered inline hook is
   * scanned using the same security analysis as file-based hooks.
   *
   * @param settings - Stack settings object that may contain inline hook configurations
   * @returns A map where keys are hook paths (e.g., "PreToolUse[0].inline") and values are scan results
   * @throws {Error} Never throws - malformed settings are handled gracefully
   * @example
   * ```typescript
   * const scanner = new HookScannerService();
   * const settings = {
   *   hooks: {
   *     PreToolUse: [{ code: 'console.log("safe")' }],
   *     PostToolUse: [{ code: 'subprocess.run("dangerous")' }]
   *   }
   * };
   * const results = scanner.scanSettingsHooks(settings);
   * console.log(results.get("PreToolUse[0].inline")?.riskScore); // Low risk
   * console.log(results.get("PostToolUse[0].inline")?.riskScore); // High risk
   * ```
   * @since 1.4.0
   * @public
   */
  async scanSettingsHooks(settings: StackSettings): Promise<Map<string, HookScanResult>> {
    const results = new Map<string, HookScanResult>();

    if (!this.hasHooksConfig(settings)) {
      return results;
    }

    const hooksConfig = settings.hooks as Record<string, unknown>;
    await this.processHooksConfig(hooksConfig, results);

    return results;
  }

  private hasHooksConfig(settings: StackSettings): boolean {
    return (
      settings.hooks !== undefined && typeof settings.hooks === 'object' && settings.hooks !== null
    );
  }

  private async processHooksConfig(
    hooksConfig: Record<string, unknown>,
    results: Map<string, HookScanResult>
  ): Promise<void> {
    const processingPromises = Object.entries(hooksConfig).map(async ([eventType, hookConfigs]) => {
      if (Array.isArray(hookConfigs)) {
        await this.processHookConfigs(eventType, hookConfigs, results);
      }
    });
    await Promise.all(processingPromises);
  }

  private async processHookConfigs(
    eventType: string,
    hookConfigs: unknown[],
    results: Map<string, HookScanResult>
  ): Promise<void> {
    const configPromises = hookConfigs.map(async (config, i) => {
      await this.processHookConfig(eventType, i, config, results);
    });
    await Promise.all(configPromises);
  }

  private async processHookConfig(
    eventType: string,
    index: number,
    config: unknown,
    results: Map<string, HookScanResult>
  ): Promise<void> {
    if (!config || typeof config !== 'object') return;

    const configObj = config as Record<string, unknown>;

    // Scan inline code
    if (typeof configObj.code === 'string') {
      const scanResult = await this.scanHook(configObj.code);
      results.set(`${eventType}[${index}].inline`, scanResult);
    }

    // Handle matchers with hooks arrays
    if (Array.isArray(configObj.hooks)) {
      await this.processNestedHooks(eventType, index, configObj.hooks, results);
    }
  }

  private async processNestedHooks(
    eventType: string,
    configIndex: number,
    hooks: unknown[],
    results: Map<string, HookScanResult>
  ): Promise<void> {
    const hookPromises = hooks.map(async (hook, j) => {
      if (hook && typeof hook === 'object') {
        const hookObj = hook as Record<string, unknown>;
        if (typeof hookObj.code === 'string') {
          const scanResult = await this.scanHook(hookObj.code);
          results.set(`${eventType}[${configIndex}].hooks[${j}].inline`, scanResult);
        }
      }
    });
    await Promise.all(hookPromises);
  }

  /**
   * Calculate the risk level category based on the scan results risk score
   *
   * Converts the numeric risk score (0-100) into a categorical risk level
   * for easier interpretation and display. The thresholds are designed to
   * provide clear guidance on the safety of hook execution.
   *
   * @param scanResults - The scan results containing the numeric risk score
   * @returns Risk level category: 'safe' (0-29), 'warning' (30-69), or 'dangerous' (70-100)
   * @throws {Error} Never throws - handles invalid inputs gracefully
   * @example
   * ```typescript
   * const scanner = new HookScannerService();
   * const lowRiskResult = { riskScore: 15, ... };
   * const mediumRiskResult = { riskScore: 45, ... };
   * const highRiskResult = { riskScore: 85, ... };
   *
   * console.log(scanner.calculateRiskLevel(lowRiskResult)); // 'safe'
   * console.log(scanner.calculateRiskLevel(mediumRiskResult)); // 'warning'
   * console.log(scanner.calculateRiskLevel(highRiskResult)); // 'dangerous'
   * ```
   * @since 1.4.0
   * @public
   */
  calculateRiskLevel(scanResults: HookScanResult): 'safe' | 'warning' | 'dangerous' {
    if (scanResults.riskScore >= 70) return 'dangerous';
    if (scanResults.riskScore >= 30) return 'warning';
    return 'safe';
  }

  /**
   * Generate a comprehensive human-readable safety report for all hooks
   *
   * Creates a formatted report that summarizes the security analysis of both
   * file-based hooks and inline hooks. The report includes risk indicators,
   * suspicious patterns found, and descriptions to help users understand
   * potential security implications.
   *
   * @param hooks - Array of file-based stack hooks with their scan results
   * @param inlineResults - Optional map of inline hook scan results from settings analysis
   * @returns Formatted multi-line string report with risk indicators and pattern details
   * @throws {Error} Never throws - handles missing or malformed data gracefully
   * @example
   * ```typescript
   * const scanner = new HookScannerService();
   * const hooks = [
   *   { name: 'setup.py', type: 'PreToolUse', scanResults: { riskScore: 75, ... } }
   * ];
   * const inlineResults = new Map([
   *   ['PostToolUse[0].inline', { riskScore: 25, suspiciousPatterns: ['networkRequests: 1'] }]
   * ]);
   *
   * const report = scanner.generateSafetyReport(hooks, inlineResults);
   * console.log(report);
   * // Output:
   * // 📄 File-based hooks:
   * //   🔴 setup.py (PreToolUse)
   * //     • fileSystemDelete: 2 occurrence(s)
   * //
   * // 📝 Inline hooks:
   * //   ⚠️ PostToolUse[0].inline (risk: 25)
   * //     • networkRequests: 1 occurrence(s)
   * ```
   * @since 1.4.0
   * @public
   */
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
