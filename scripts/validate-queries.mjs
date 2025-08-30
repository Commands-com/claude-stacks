#!/usr/bin/env node
/**
 * Query Validation Script
 *
 * Loads all Tree-sitter grammars and compiles all .scm query files to validate syntax.
 * Useful for CI/CD and development to catch query syntax errors early.
 *
 * Usage: npm run scm
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const grammarDir = join(rootDir, 'dist', 'grammars');
const queryDir = join(rootDir, 'dist', 'queries');

// Language configuration
const LANGUAGES = {
  python: 'tree-sitter-python.wasm',
  bash: 'tree-sitter-bash.wasm',
  js: 'tree-sitter-javascript.wasm',
  ts: 'tree-sitter-typescript.wasm',
};

let totalQueries = 0;
let totalErrors = 0;
let totalWarnings = 0;

async function validateQueries() {
  console.log('🔍 Tree-sitter Query Validator');
  console.log('================================\n');

  // Check if dist directory exists
  if (!existsSync(grammarDir)) {
    console.error('❌ Grammar directory not found. Run `npm run build` first.');
    process.exit(1);
  }

  if (!existsSync(queryDir)) {
    console.error('❌ Query directory not found. Run `npm run build` first.');
    process.exit(1);
  }

  try {
    // Dynamic import to avoid module resolution issues
    const TreeSitter = await import('web-tree-sitter');
    const Parser = TreeSitter.default || TreeSitter;
    await Parser.init();

    for (const [langName, grammarFile] of Object.entries(LANGUAGES)) {
      await validateLanguage(Parser, langName, grammarFile);
    }

    console.log('\n📊 Summary:');
    console.log('===========');
    console.log(`Total queries processed: ${totalQueries}`);
    console.log(`✅ Successful: ${totalQueries - totalErrors}`);
    console.log(`❌ Errors: ${totalErrors}`);
    console.log(`⚠️  Warnings: ${totalWarnings}`);

    if (totalErrors > 0) {
      console.log(`\n❌ Validation failed with ${totalErrors} error(s)`);
      process.exit(1);
    } else {
      console.log('\n🎉 All queries validated successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Failed to initialize Tree-sitter:', error.message);
    process.exit(1);
  }
}

async function validateLanguage(Parser, langName, grammarFile) {
  const grammarPath = join(grammarDir, grammarFile);
  const langQueryDir = join(queryDir, langName);

  console.log(`📝 Validating ${langName.toUpperCase()} queries...`);

  // Check if grammar exists
  if (!existsSync(grammarPath)) {
    console.log(`⚠️  Grammar not found: ${grammarFile}`);
    totalWarnings++;
    return;
  }

  // Check if query directory exists
  if (!existsSync(langQueryDir)) {
    console.log(`⚠️  No queries found for ${langName}`);
    totalWarnings++;
    return;
  }

  try {
    // Load the grammar
    const Language = await Parser.Language.load(grammarPath);

    // Get all .scm files
    const queryFiles = readdirSync(langQueryDir, { withFileTypes: true })
      .filter(ent => ent.isFile() && ent.name.endsWith('.scm'))
      .map(ent => ent.name)
      .sort();

    if (queryFiles.length === 0) {
      console.log(`⚠️  No .scm files found in ${langName} directory`);
      totalWarnings++;
      return;
    }

    let langErrors = 0;
    let langQueries = 0;

    for (const file of queryFiles) {
      const filePath = join(langQueryDir, file);

      try {
        const content = readFileSync(filePath, 'utf-8');

        // Skip empty files
        const cleanContent = content.trim();
        if (!cleanContent) {
          console.log(`⚠️  Empty file: ${file}`);
          totalWarnings++;
          continue;
        }

        // Compile the query
        const query = Language.query(content);
        const captureCount = query.captureNames.length;

        console.log(`  ✅ ${file}: ${captureCount} captures`);
        langQueries++;
        totalQueries++;

        // Validate capture naming conventions
        validateCaptureNames(query.captureNames, file);
      } catch (error) {
        console.log(`  ❌ ${file}: ${error.message}`);
        langErrors++;
        totalErrors++;
      }
    }

    if (langErrors === 0) {
      console.log(`✅ ${langName}: ${langQueries} queries compiled successfully\n`);
    } else {
      console.log(`❌ ${langName}: ${langErrors}/${langQueries} queries failed\n`);
    }
  } catch (error) {
    console.log(`❌ Failed to load ${langName} grammar: ${error.message}\n`);
    totalErrors++;
  }
}

function validateCaptureNames(captureNames, filename) {
  const validPrefixes = [
    'danger.',
    'warn.',
    'taint.',
    // Allow intermediate captures without prefixes
    'mod',
    'func',
    'method',
    'name',
    'cmd',
    'arg',
    'flag',
    'target',
    'url_var',
    'url_template',
    'constructor',
    'require_func',
    'module_name',
    'http_lib',
    'cp_alias',
    'exp',
    'subst',
    'obj',
    'attr',
    'key_var',
    'key',
    'module_var',
    'module_str',
    'path_var',
    'mode',
    'path',
    'dest',
    'ctor',
    'cmd1',
    'cmd2',
    'sudo',
    'dl',
    'kwarg',
    'cmd_var',
    'cmd_str',
    'url_expr',
    // Recently added intermediates used in queries
    'http',
    'client',
    'conn_type',
    'pkg',
    'info.fs',
  ];

  for (const capture of captureNames) {
    // Skip if it matches known intermediate captures or has valid prefix
    if (validPrefixes.some(prefix => capture.startsWith(prefix) || capture === prefix)) {
      continue;
    }

    console.log(`  ⚠️  Unusual capture name in ${filename}: @${capture}`);
    totalWarnings++;
  }
}

// Run validation
validateQueries().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
