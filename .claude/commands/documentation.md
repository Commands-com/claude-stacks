---
description: Focus on improving JSDoc coverage across the codebase and maintaining documentation tracking
model: opus
---

Use the @docs-architect agent to systematically improve JSDoc coverage across the codebase. This command focuses specifically on analyzing existing JSDoc comments, identifying gaps, and generating comprehensive inline documentation.

## JSDoc Coverage Analysis & Improvement

### Primary Objectives

1. **JSDoc Gap Analysis**: Systematically audit all TypeScript files for missing or incomplete JSDoc
2. **Coverage Tracking**: Maintain `docs/JSDOC_COVERAGE.md` with detailed coverage status
3. **Incremental Improvement**: Focus on high-impact files first (services, public APIs, utilities)
4. **Quality Assurance**: Ensure JSDoc follows consistent patterns with proper tags

### Phase 1: Coverage Assessment & Tracking

**IMPORTANT**
check to see if `docs/JSDOC_COVERAGE.md` exists. If exists, skip initial analysis. 

**Initial Analysis**:
- Run `npm run jsdoc:summary` to get quick count of undocumented items
- Run `npm run jsdoc:coverage` to generate detailed coverage warnings
- Use the script output to identify specific files and functions without JSDoc
- Categorize by priority: Critical (services/APIs) > Important (actions/controllers) > Supporting (utils/types)
- Generate initial `docs/JSDOC_COVERAGE.md` tracking file based on script output

**Tracking File Structure** (`docs/JSDOC_COVERAGE.md`):
```markdown
# JSDoc Coverage Tracking

Last Updated: YYYY-MM-DD
Overall Coverage: X% (YYY/ZZZ items documented)

## Coverage by Category

### Services (Priority: Critical)
- [ ] `src/services/StackService.ts` - 2/12 methods documented (17%)
- [ ] `src/services/ConfigService.ts` - 1/8 methods documented (12%)
- [x] `src/services/AuthService.ts` - 8/8 methods documented (100%)
- [ ] `src/services/ApiService.ts` - 0/15 methods documented (0%)

### Actions (Priority: Important) 
- [ ] `src/actions/export.ts` - 0/5 functions documented (0%)
- [ ] `src/actions/install.ts` - 0/8 functions documented (0%)

### Utilities (Priority: Important)
- [ ] `src/utils/colors.ts` - 0/12 functions documented (0%)
- [ ] `src/utils/validators.ts` - 0/6 functions documented (0%)

## Coverage Scripts Output
```bash
# Quick summary from npm run jsdoc:summary
Total undocumented items: 127
Services: 45 undocumented
Actions: 38 undocumented  
Utils: 28 undocumented
Types: 16 undocumented
```

## Recent Progress
- 2024-XX-XX: Added JSDoc to AuthService (8 methods) - `npm run jsdoc:coverage` shows no warnings
- 2024-XX-XX: Started StackService documentation (2/12 complete) - reduced warnings from 12 to 10
```

### Phase 2: Systematic JSDoc Enhancement

**Priority Order**:
1. **Services** (`src/services/`) - Core business logic APIs
2. **Public APIs** (exported functions, main interfaces)
3. **Action classes** (`src/actions/`) - CLI command implementations  
4. **Utility functions** (`src/utils/`) - Shared helper functions
5. **Type definitions** (`src/types/`) - Complex interfaces and types
6. **Controllers** (`src/controllers/`) - Orchestration logic

**JSDoc Standards**:
```typescript
/**
 * Brief one-line description of the function/class
 * 
 * Longer description if needed, explaining the purpose,
 * context, and any important behavioral notes.
 *
 * @param paramName - Description of parameter and its constraints
 * @param optionalParam - Description with default value info
 * @returns Description of return value and possible types
 * @throws {ErrorType} When this specific error occurs
 * @example
 * ```typescript
 * const result = await myFunction('example', { option: true });
 * console.log(result.data);
 * ```
 * @since 1.2.0 - Version when introduced
 * @public - Visibility (public/private/internal)
 */
```

### Phase 3: Quality Assurance & Validation

**Validation Checks**:
- All public methods have comprehensive JSDoc
- All parameters documented with types and constraints
- Return values clearly described
- Error conditions documented with @throws
- At least one @example for complex functions
- Consistent terminology and style

**Coverage Metrics**:
- Track percentage coverage by file and category
- Measure before/after improvement
- Identify files reaching 100% coverage
- Highlight remaining gaps for future work

## Implementation Strategy

### High-Impact Files (Address First)

**Services Layer** - Most critical for API documentation:
- `src/services/StackService.ts` - Core stack operations
- `src/services/ConfigService.ts` - Configuration management  
- `src/services/FileService.ts` - File system operations
- `src/services/ApiService.ts` - HTTP API client
- `src/services/HookScannerService.ts` - Security analysis

**Public APIs** - External interfaces:
- `src/types/index.ts` - Main type exports
- `src/types/stack.ts` - Stack schema definitions
- `src/types/api.ts` - API interfaces
- Exported functions from actions and utilities

### Documentation Workflow

**Coordinator Responsibilities**:
1. **Run Coverage Analysis**: Execute `npm run jsdoc:summary` and `npm run jsdoc:coverage` to identify gaps
2. **Prioritize Files**: Choose specific file(s) that need JSDoc improvement based on script output
3. **Assign Work**: Provide specific file path(s) to @docs-architect agent for documentation
4. **Validate Results**: Re-run `npm run jsdoc:coverage` after agent work to verify improvements
5. **Update Tracking**: Maintain `docs/JSDOC_COVERAGE.md` with progress

**Agent Workflow** (receives specific file assignment):
1. **Read Target File(s)**: Analyze the assigned file(s) to understand existing documentation state
2. **Generate JSDoc**: Add comprehensive JSDoc comments to all undocumented public methods/functions
3. **Follow Standards**: Ensure consistency with existing patterns (like AuthService.ts)
4. **Provide Complete Documentation**: Return fully documented file(s) ready for validation

### Coverage Milestones

- **Phase 1**: Services reach 80%+ coverage (most critical)
- **Phase 2**: Actions and utilities reach 60%+ coverage  
- **Phase 3**: Overall codebase reaches 70%+ coverage
- **Final Goal**: All public APIs have comprehensive JSDoc

## Coordination & Progress Tracking

The `docs/JSDOC_COVERAGE.md` file serves as the central coordination point:
- Updated before starting work on any file
- Shows current coverage percentages
- Tracks recent progress and milestones
- Identifies next priority files
- Documents JSDoc patterns and standards used

This focused approach ensures systematic improvement of code documentation while maintaining coordination between team members working on documentation tasks.
