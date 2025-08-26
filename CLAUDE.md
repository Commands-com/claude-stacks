# Claude Stacks Development Guide

## Test Suite Architecture & Common Issues

### Mock Isolation Issues in Jest Tests

**Problem**: Tests fail with `undefined` values from mocked functions when run together, but pass when run individually. This indicates test isolation problems where mocks aren't properly reset between tests.

**Root Cause**: Jest's `jest.clearAllMocks()` and `jest.resetAllMocks()` don't always properly reset module-level mocks, especially for:

- Color utility functions (`src/utils/colors.ts`)
- Path constants (`src/constants/paths.ts`)

**Solution Pattern**:

```typescript
beforeEach(() => {
  jest.clearAllMocks();

  // Reset all mock functions explicitly
  mockConsoleLog.mockReset();
  mockConsoleError.mockReset();
  mockProcessExit.mockReset();

  // Re-setup color mocks to ensure they work correctly
  const { colors } = require('../../../src/utils/colors.ts');
  colors.info = jest.fn().mockImplementation((text: string) => text);
  colors.meta = jest.fn().mockImplementation((text: string) => text);
  colors.stackName = jest.fn().mockImplementation((text: string) => text);
  colors.description = jest.fn().mockImplementation((text: string) => text);
  colors.error = jest.fn().mockImplementation((text: string) => text);
  colors.success = jest.fn().mockImplementation((text: string) => text);
  colors.warning = jest.fn().mockImplementation((text: string) => text);
  colors.number = jest.fn().mockImplementation((text: string) => text);

  // Re-setup path mocks to ensure they work correctly
  const pathConstants = require('../../../src/constants/paths.ts');
  pathConstants.getLocalClaudeDir = jest.fn(() => '/test/project/.claude');
});
```

### Testing Console Output with Colors

**Issue**: When testing functions that use `colors.info()`, `colors.error()`, etc., the test expectations must account for the fact that:

1. In production: `console.log(colors.info('text'))` outputs colored text
2. In tests: The color function should return the original text for assertions

**Correct Test Patterns**:

```typescript
// ✅ Correct: Expect the actual text that would be logged
expect(mockConsoleLog).toHaveBeenCalledWith(
  '📥 Fetching stack test-org/test-stack from Commands.com...'
);

// ✅ Correct: For error handling, expect separate arguments
expect(mockConsoleError).toHaveBeenCalledWith(
  'Installation failed:',
  expect.stringContaining('Network error')
);

// ❌ Wrong: Expecting stringContaining when exact text is known
expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Fetching stack'));
```

### RemoteStack API Structure

**Issue**: Tests were using an old API structure with `files` field containing `claude_desktop_config.json`, but the current implementation expects `mcpServers` directly on the `RemoteStack` object.

**Current Structure**:

```typescript
interface RemoteStack {
  org: string;
  name: string;
  title?: string; // Used for display, falls back to name
  description: string;
  version?: string;
  author?: string;
  mcpServers?: StackMcpServer[]; // Direct field, not in files
  commands?: StackCommand[];
  agents?: StackAgent[];
  settings?: StackSettings;
}
```

### Test Isolation Best Practices

1. **Always reset mocks in beforeEach**: Don't rely on automatic cleanup
2. **Re-initialize module mocks**: Explicitly reset color and path mocks
3. **Test in isolation**: Run individual tests to verify they work alone
4. **Test in groups**: Run pairs of tests to catch isolation issues
5. **Use consistent mock patterns**: Apply the same reset logic across all test files

### Running Specific Tests for Debugging

```bash
# Test single function
npm test -- tests/unit/actions/install.test.ts --testNamePattern="should install a stack successfully"

# Test multiple related tests for isolation issues
npm test -- tests/unit/actions/install.test.ts --testNamePattern="should install|should show local dev"

# Run full test suite for specific file
npm test -- tests/unit/actions/install.test.ts
```

### Color Mock Debug Pattern

If you see `undefined` in console expectations, add temporary debugging:

```typescript
console.log('DEBUG: mockConsoleLog calls:', mockConsoleLog.mock.calls);
expect(mockConsoleLog).toHaveBeenCalledWith('Expected text');
```

The test suite has excellent coverage and stability:

- **Overall Coverage**: 96.96% statements, 89.01% branches, 98.21% functions, 97.16% lines
- **Test Files**: Comprehensive unit and integration tests covering all major components
- **Key Test Categories**:
  - **Actions**: install, export, publish, list, clean, delete, rename, restore, browse
  - **Services**: AuthService, UIService, FileService, ConfigService, ApiService, StackService, etc.
  - **Controllers**: StackController with full CRUD operations
  - **Utils**: auth, colors, dependencies, metadata, version handling
  - **UI**: display functions, menus, and user interactions

## Lint Failures Tracking

**Lint Hook Configuration**: The project has a hook that captures all lint failures and logs them to `lint_failures.log` for debugging purposes.

**Usage**:

- Check `lint_failures.log` after running linting commands to see detailed failure reports
- The log file is automatically updated whenever linting is performed
- Use this file to track and resolve linting issues systematically
