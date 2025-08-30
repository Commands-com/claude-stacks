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
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';

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
      // Convert file URL to file path in a cross-platform way
      return fileURLToPath(url);
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
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = lower.substring(dot);
  return EXTENSION_MAP[ext] ?? null;
}

// Query caches
// - file list cache: language -> list of .scm files
// - compiled query cache: language -> Query[] compiled for the loaded Language instance
const queryFileCache: Record<SupportedLanguage, string[] | null> = {
  python: null,
  bash: null,
  js: null,
  ts: null,
};
const compiledQueryCache: Record<SupportedLanguage, any[] | null> = {
  python: null,
  bash: null,
  js: null,
  ts: null,
};

/**
 * List all .scm query files for a language, sorted by name
 */
function listQueryFiles(lang: SupportedLanguage): string[] {
  if (queryFileCache[lang]) return queryFileCache[lang] as string[];
  const files: string[] = [];
  try {
    const dirPath = resolveQueryDir(lang);
    if (!dirPath) return files;
    const names = readdirSync(dirPath, { withFileTypes: true });
    for (const ent of names) {
      if (ent.isFile() && ent.name.endsWith('.scm')) {
        const p = resolveQueryFile(lang, ent.name);
        if (p) files.push(p);
      }
    }
    files.sort();
  } catch {
    // ignore
  }
  queryFileCache[lang] = files;
  return files;
}

/**
 * Compile and cache queries for a language using the given Language
 */
function ensureCompiledQueries(lang: SupportedLanguage, Language: any): any[] {
  if (compiledQueryCache[lang] && (compiledQueryCache[lang] as any[]).length > 0) {
    return compiledQueryCache[lang] as any[];
  }
  const compiled: any[] = [];
  const files = listQueryFiles(lang);
  for (const f of files) {
    try {
      const content = readFileSync(f, 'utf-8');
      const q = Language.query(content);
      compiled.push(q);
    } catch {
      // Skip invalid query files gracefully
      continue;
    }
  }
  compiledQueryCache[lang] = compiled;
  return compiled;
}

/**
 * Resolve path to a query file
 * @param lang Language name
 * @param filename Query filename
 * @returns Full path to query file, or null if not found
 */
function resolveQueryFile(lang: SupportedLanguage, filename: string): string | null {
  try {
    // Handle both Node.js and test environments
    if (import.meta?.url) {
      // Use import.meta.url resolution in Node.js
      const url = new URL(`../queries/${lang}/${filename}`, import.meta.url);
      return fileURLToPath(url);
    } else {
      // Fallback for test environments or older Node.js
      // eslint-disable-next-line no-undef
      const path = require('path');
      const __dirname = path.dirname(__filename || '');
      return path.resolve(__dirname, `../queries/${lang}/${filename}`);
    }
  } catch {
    return null;
  }
}

function resolveQueryDir(lang: SupportedLanguage): string | null {
  return resolveQueryFile(lang, '.');
}

// Query bundles are now loaded dynamically from directory structure

const SEVERITY_MAP = [
  { prefixes: ['danger.exec', 'danger.netexec', 'danger.eval'], score: 30 },
  { prefixes: ['danger.import'], score: 20 },
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
  if (capture.includes('danger.import')) results.hasDangerousImports = true;
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

  const compiledQueries = ensureCompiledQueries(lang, Language);
  if (compiledQueries.length === 0) return null;

  const results: HookScanResult = {
    hasFileSystemAccess: false,
    hasNetworkAccess: false,
    hasProcessExecution: false,
    hasDangerousImports: false,
    hasCredentialAccess: false,
    suspiciousPatterns: [],
    riskScore: 0,
  };

  const scoredRanges = new Set<string>();
  for (const queryObj of compiledQueries) {
    const matches = queryObj.matches(tree.rootNode);
    for (const m of matches) {
      // Capture kind and a representative node for location
      // eslint-disable-next-line prefer-destructuring
      const cap = m.captures[0];
      if (!cap?.name || !cap.node) continue;
      const name: string = String(cap.name);

      const { node } = cap;
      const start = node.startPosition; // {row, column}
      const startIndex: number = node.startIndex ?? 0;
      const endIndex: number = node.endIndex ?? startIndex;
      const rangeKey = `${startIndex}:${endIndex}`;
      // Extract a short snippet for context
      const rawSnippet = content.slice(startIndex, Math.min(endIndex, startIndex + 160));
      const snippet = rawSnippet.replace(/\s+/g, ' ').trim().slice(0, 140);
      const captureId = name;
      results.suspiciousPatterns.push(
        `${captureId} at ${start.row + 1}:${start.column + 1} => ${snippet}`
      );
      if (!scoredRanges.has(rangeKey)) {
        results.riskScore += severityForCapture(captureId);
        flagsForCapture(captureId, results);
        scoredRanges.add(rangeKey);
      }
    }
  }

  // Cap the score, dedupe patterns
  results.riskScore = Math.min(results.riskScore, 100);
  results.suspiciousPatterns = Array.from(new Set(results.suspiciousPatterns));
  return results;
}
