# Tree-sitter Security Queries

This directory contains Tree-sitter query files (`.scm`) for detecting security risks in different programming languages. Each language has its own subdirectory containing categorized query files.

## Structure

```
queries/
├── python/
│   ├── dangerous-exec.scm      # Process execution patterns
│   ├── dangerous-fs.scm        # File system operations
│   ├── dangerous-network.scm   # Network requests
│   ├── suspicious-imports.scm  # Dynamic imports
│   └── env-access.scm          # Environment variable access
├── bash/
│   ├── dangerous-network.scm   # Network-based execution
│   ├── dangerous-eval.scm      # Command evaluation
│   └── dangerous-fs.scm        # File system operations
└── README.md                   # This file
```

## Query Categories and Risk Levels

### Python Queries

- **dangerous-exec.scm**: Detects subprocess execution, os.system calls, eval/exec operations
  - `danger.exec` (30 points): Direct process execution
  - `danger.eval` (30 points): Code evaluation functions
- **dangerous-fs.scm**: File system operations that could be destructive
  - `danger.fswrite` (25 points): Write to sensitive system paths
  - `danger.fsdelete` (25 points): Destructive file operations (shutil.rmtree)
  - `warn.fswrite` (10 points): File writes with variables
  - `warn.fs` (10 points): General file operations with variables
- **dangerous-network.scm**: Network requests that could lead to SSRF
  - `warn.net` (10 points): HTTP requests with dynamic URLs
- **suspicious-imports.scm**: Dynamic imports that could load arbitrary code
  - `danger.import` (20 points): **import**, importlib.import_module
- **env-access.scm**: Environment variable access patterns
  - `warn.env` (10 points): os.environ access
  - `taint.env` (5 points): Access to sensitive environment variables

### Bash Queries

- **dangerous-network.scm**: Network-based execution patterns
  - `danger.netexec` (30 points): curl|wget piped to shell interpreters
- **dangerous-eval.scm**: Command evaluation and expansion
  - `danger.eval` (30 points): eval builtin, sh -c patterns
  - `danger.unquoted_expansion` (15 points): Unquoted variable expansions
  - `danger.subst` (15 points): Command substitution patterns
- **dangerous-fs.scm**: File system operations
  - `danger.fsdelete` (25 points): rm -rf patterns
  - `danger.fswrite` (25 points): Redirects to sensitive system paths

## Query Syntax

Tree-sitter queries use S-expression syntax with pattern matching:

```scheme
; Basic pattern matching
((
  call
    function: (identifier) @func_name
    arguments: (argument_list (string) @arg))
  (#eq? @func_name "dangerous_function")) @risk.category

; With predicates
((
  call
    function: (attribute
      object: (identifier) @module
      attribute: (identifier) @method))
  (#eq? @module "subprocess")
  (#match? @method "^(run|Popen)$")) @danger.exec
```

### Available Predicates

- `#eq? @capture "exact_string"`: Exact string matching
- `#match? @capture "regex_pattern"`: Regex matching
- `#not-eq? @capture "string"`: Negation of exact match
- `#not-match? @capture "pattern"`: Negation of regex match

### Capture Names and Risk Scoring

Capture names follow the pattern `{severity}.{category}`:

- **Severity levels**:
  - `danger.*`: High risk (20-30 points)
  - `warn.*`: Medium risk (10 points)
  - `taint.*`: Low risk (5 points)

- **Categories**:
  - `exec`: Process execution
  - `eval`: Code evaluation
  - `fs*`: File system operations
  - `net*`: Network operations
  - `import`: Dynamic imports
  - `env`: Environment access

## Adding New Languages

1. Create a new language directory: `src/queries/{language}/`
2. Add query files organized by security category
3. Update `treeSitterEngine.ts`:
   - Add language to `SupportedLanguage` type
   - Add file extension mapping in `EXTENSION_MAP`
   - Add query file list in `loadQueriesFromFiles()`
4. Update build script to copy new query files

## Adding New Query Files

1. Create `.scm` file in appropriate language directory
2. Add queries using Tree-sitter syntax
3. Use consistent capture naming for proper risk scoring
4. Add filename to `queryFiles` array in `loadQueriesFromFiles()`
5. Test with sample code to verify patterns work correctly

## Query Development Tips

1. **Use Tree-sitter Playground**: Test queries at https://tree-sitter.github.io/tree-sitter/playground
2. **Start Specific**: Begin with specific patterns, then generalize
3. **Consider Context**: Use surrounding AST nodes to reduce false positives
4. **Document Patterns**: Add comments explaining what each query detects
5. **Test Thoroughly**: Verify queries work with real code samples

## Performance Considerations

- Queries are cached after first load to avoid repeated file I/O
- Keep queries focused and specific to minimize parsing overhead
- Use predicates effectively to filter matches at query time
- Consider splitting complex patterns into multiple simpler queries

## Graceful Fallback

The query loading system includes graceful fallback:

- If query files are missing, scanning falls back to regex patterns
- Individual query parsing errors are caught and skipped
- Missing language support gracefully returns empty results

This ensures the security scanner remains functional even if Tree-sitter queries are unavailable.
