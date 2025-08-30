/**
 * Optional Tree-sitter engine for multi-language hook scanning.
 *
 * This module loads Tree-sitter (WASM) grammars at runtime and applies
 * a small set of security-oriented queries for Python and Bash hooks.
 *
 * It is enabled by default with graceful fallback. If the web-tree-sitter module or
 * grammar files are not available, it fails gracefully and returns null
 * so the caller can fall back to other scanners.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type { HookScanResult } from '../types/index.js';

// Tree-sitter is enabled by default with graceful fallback
function isEnabled(): boolean {
  return true;
}

type SupportedLanguage = 'python' | 'bash' | 'js' | 'ts';

// Lazy singletons
let parserInitPromise: Promise<void> | null = null;
let Parser: any = null; // web-tree-sitter Parser (typed as any to avoid hard dep)
const languages: Record<SupportedLanguage, any | null> = {
  python: null,
  bash: null,
  js: null,
  ts: null,
};

function resolveGrammarWasm(lang: SupportedLanguage): string | null {
  // Attempt to locate grammars relative to this file under a conventional folder
  // e.g., src/grammars/tree-sitter-python.wasm (built into your package)
  const files: Record<SupportedLanguage, string> = {
    python: '../grammars/tree-sitter-python.wasm',
    bash: '../grammars/tree-sitter-bash.wasm',
    js: '../grammars/tree-sitter-javascript.wasm',
    ts: '../grammars/tree-sitter-typescript.wasm',
  };
  const rel = files[lang];
  try {
    // Handle both Node.js and test environments
    if (import.meta?.url) {
      // Use import.meta.url resolution in Node.js
      const url = new URL(rel, import.meta.url);
      // Convert file URL to file path manually (avoiding require in ES module)
      return url.pathname;
    } else {
      // Fallback for test environments or older Node.js

      // eslint-disable-next-line no-undef
      const path = require('path');

      const __dirname = path.dirname(__filename || '');

      return path.resolve(__dirname, rel);
    }
  } catch {
    return null;
  }
}

function dynamicImport(moduleName: string): Promise<any> {
  // Use Function constructor to avoid TypeScript/module resolver trying to resolve at build time
  // eslint-disable-next-line no-new-func
  const importer = new Function('m', 'return import(m)');
  return importer(moduleName);
}

async function ensureParser(): Promise<boolean> {
  if (Parser) return true;
  try {
    // Dynamic import avoids build-time resolution errors when dependency isn't installed
    const mod = await dynamicImport('web-tree-sitter');
    Parser = mod.default ?? mod;
    parserInitPromise ??= Parser.init();
    await parserInitPromise;
    return true;
  } catch {
    return false;
  }
}

async function loadLanguage(lang: SupportedLanguage): Promise<any | null> {
  if (!Parser) {
    return null;
  }
  if (languages[lang]) {
    return languages[lang];
  }
  const wasm = resolveGrammarWasm(lang);
  if (!wasm) return null;
  try {
    const Language = await Parser.Language.load(wasm);
    languages[lang] = Language;
    return Language;
  } catch {
    return null;
  }
}

const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  '.py': 'python',
  '.sh': 'bash',
  '.bash': 'bash',
  '.ts': 'ts',
  '.tsx': 'ts',
  '.js': 'js',
  '.jsx': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
};

export function detectLanguageFromFilename(filename?: string): SupportedLanguage | null {
  if (!filename) return null;
  const lower = filename.toLowerCase();
  const ext = lower.substring(lower.lastIndexOf('.'));
  return EXTENSION_MAP[ext] ?? null;
}

// Query bundles for Python and Bash - Refined to reduce false positives
const PY_QUERIES = [
  // Dangerous subprocess execution - only flag clearly dangerous patterns
  `((
    call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @func)
      arguments: (argument_list 
        (list 
          (identifier) @cmd_var)))
    (#eq? @mod "subprocess")
    (#match? @func "^(run|Popen|call|check_call|check_output)$")) @danger.exec`,

  // Subprocess with shell=True and string (very dangerous)
  `((
    call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @func)
      arguments: (argument_list
        (string) @cmd_str
        (keyword_argument
          name: (identifier) @kwarg
          value: (true))))
    (#eq? @mod "subprocess")
    (#match? @func "^(run|Popen|call|check_call|check_output)$")
    (#eq? @kwarg "shell")) @danger.exec`,

  // Subprocess with dangerous hardcoded commands
  `((
    call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @func)
      arguments: (argument_list 
        (list 
          (string) @cmd)))
    (#eq? @mod "subprocess")
    (#match? @func "^(run|Popen|call|check_call|check_output)$")
    (#match? @cmd "^(rm|rmdir|dd|mkfs|fdisk|sudo|su|chmod|chown|kill|pkill)$")) @danger.exec`,

  // os.system (always dangerous)
  `((
    call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @func))
    (#eq? @mod "os")
    (#eq? @func "system")) @danger.exec`,

  // eval/exec with variables (dangerous)
  `((
    call
      function: (identifier) @name
      arguments: (argument_list 
        (identifier))) 
    (#match? @name "^(eval|exec)$")) @danger.eval`,

  // eval/exec with user input patterns
  `((
    call
      function: (identifier) @name
      arguments: (argument_list 
        (subscript))) 
    (#match? @name "^(eval|exec)$")) @danger.eval`,

  // File operations with variables (potential path injection)
  `((
    call
      function: (identifier) @func
      arguments: (argument_list 
        (identifier) @path_var
        (string) @mode))
    (#eq? @func "open")
    (#match? @mode "^[wa]")) @warn.fswrite`,

  // File operations to suspicious paths
  `((
    call
      function: (identifier) @func
      arguments: (argument_list 
        (string) @path
        (string) @mode))
    (#eq? @func "open")
    (#match? @mode "^[wa]")
    (#match? @path "^/(etc|bin|sbin|usr/bin|usr/sbin|root|home/[^/]+/\\.)")) @danger.fswrite`,

  // shutil.rmtree with variables (dangerous)
  `((
    call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @func)
      arguments: (argument_list 
        (identifier)))
    (#eq? @mod "shutil")
    (#eq? @func "rmtree")) @danger.fsdelete`,

  // os file operations with variables
  `((
    call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @func)
      arguments: (argument_list 
        (identifier)))
    (#eq? @mod "os")
    (#match? @func "^(remove|unlink|rmdir)$")) @warn.fs`,

  // Network requests with variable URLs (potential SSRF)
  `((
    call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @method)
      arguments: (argument_list 
        (identifier) @url_var))
    (#eq? @mod "requests")
    (#match? @method "^(get|post|put|delete|patch|head)$")) @warn.net`,

  // Environment access with variables (credential access)
  `((
    subscript
      value: (attribute
        object: (identifier) @obj
        attribute: (identifier) @attr)
      subscript: (identifier) @key_var)
    (#eq? @obj "os")
    (#eq? @attr "environ")) @warn.env`,

  // Sensitive environment variables by name
  `((
    subscript
      value: (attribute
        object: (identifier) @obj
        attribute: (identifier) @attr)
      subscript: (string) @key)
    (#eq? @obj "os")
    (#eq? @attr "environ")
    (#match? @key "(?i)(password|secret|key|token|credential|auth)")) @taint.env`,

  // Dynamic imports (code injection risk)
  `((
    call
      function: (identifier) @func
      arguments: (argument_list 
        (identifier) @module_var))
    (#eq? @func "__import__")) @danger.eval`,

  // exec/eval with f-strings or concatenation
  `((
    call
      function: (identifier) @name
      arguments: (argument_list 
        (formatted_string)))
    (#match? @name "^(eval|exec)$")) @danger.eval`,
];

const BASH_QUERIES = [
  // curl|wget | sh|bash
  `((
    pipeline
      (command (command_name (word) @cmd1))
      (command (command_name (word) @cmd2)))
    (#match? @cmd1 "^(curl|wget)$")
    (#match? @cmd2 "^(sh|bash)$")) @danger.netexec`,
  // sh -c "...$VAR..."
  `((
    command
      (command_name (word) @name)
      (word) @flag)
    (#match? @name "^(sh|bash)$")
    (#eq? @flag "-c")) @danger.eval`,
  // eval builtin
  `((
    command (command_name (word) @cmd))
    (#eq? @cmd "eval")) @danger.eval`,
  // rm -rf
  `((
    command
      (command_name (word) @cmd)
      (word) @arg)
    (#eq? @cmd "rm")
    (#match? @arg "^-.*r.*f.*$")) @danger.fsdelete`,
  // unquoted expansions as command/arg
  `((command (command_name (word (expansion) @exp)))) @danger.unquoted_expansion`,
  `((command (word (expansion) @exp))) @danger.unquoted_expansion`,
  // command substitution
  `((command (command_substitution) @subst)) @danger.subst`,
  // redirect to sensitive paths
  `((
    redirect (word) @target)
    (#match? @target "^/(etc|dev|proc|sys)\\b")) @danger.fswrite`,
];

const SEVERITY_MAP = [
  { prefixes: ['danger.exec', 'danger.netexec', 'danger.eval'], score: 30 },
  { prefixes: ['danger.fsdelete', 'danger.fswrite'], score: 25 },
  { prefixes: ['danger.fs', 'danger.net'], score: 20 },
  { prefixes: ['warn.fswrite', 'warn.fs', 'warn.net', 'warn.env'], score: 10 },
  { prefixes: ['danger.unquoted_expansion', 'danger.subst'], score: 15 },
  { prefixes: ['taint.env'], score: 5 },
];

function severityForCapture(capture: string): number {
  for (const { prefixes, score } of SEVERITY_MAP) {
    if (prefixes.some(prefix => capture.startsWith(prefix))) {
      return score;
    }
  }
  return 5;
}

function flagsForCapture(capture: string, results: HookScanResult): void {
  if (capture.includes('fs')) results.hasFileSystemAccess = true;
  if (capture.includes('net')) results.hasNetworkAccess = true;
  if (capture.includes('exec') || capture.includes('eval')) results.hasProcessExecution = true;
  if (capture.includes('taint.env')) results.hasCredentialAccess = true;
}

// eslint-disable-next-line max-lines-per-function, complexity
export async function scanWithTreeSitter(
  content: string,
  options: { language?: SupportedLanguage; filename?: string } = {}
): Promise<HookScanResult | null> {
  if (!isEnabled()) {
    return null;
  }

  const ok = await ensureParser();
  if (!ok) return null;

  const lang = options.language ?? detectLanguageFromFilename(options.filename) ?? null;
  if (!lang) return null;

  const Language = await loadLanguage(lang);
  if (!Language) return null;

  const parser = new Parser();
  parser.setLanguage(Language);
  const tree = parser.parse(content);

  const queries = lang === 'python' ? PY_QUERIES : lang === 'bash' ? BASH_QUERIES : [];
  if (queries.length === 0) return null;

  const results: HookScanResult = {
    hasFileSystemAccess: false,
    hasNetworkAccess: false,
    hasProcessExecution: false,
    hasDangerousImports: false,
    hasCredentialAccess: false,
    suspiciousPatterns: [],
    riskScore: 0,
  };

  for (const q of queries) {
    let queryObj: any;
    try {
      queryObj = Language.query(q);
    } catch {
      continue;
    }
    const matches = queryObj.matches(tree.rootNode);
    for (const m of matches) {
      // Capture kind and a representative node for location
      // eslint-disable-next-line prefer-destructuring
      const cap = m.captures[0];
      if (!cap?.name || !cap.node) continue;
      const name: string = String(cap.name);

      const { node } = cap;
      const start = node.startPosition; // {row, column}
      const captureId = name;
      results.suspiciousPatterns.push(`${captureId} at ${start.row + 1}:${start.column + 1}`);
      results.riskScore += severityForCapture(captureId);
      flagsForCapture(captureId, results);
    }
  }

  // Cap the score, dedupe patterns
  results.riskScore = Math.min(results.riskScore, 100);
  results.suspiciousPatterns = Array.from(new Set(results.suspiciousPatterns));
  return results;
}
