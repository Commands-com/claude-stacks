# Full Test Update Plan for BaseAction Architecture

## Overview
This document outlines the comprehensive plan to update all tests to work with the new BaseAction architecture that was implemented to eliminate action layer coupling and circular dependencies.

## Problem Analysis

### Root Cause of Test Failures
1. **Module Loading Issue**: `BaseAction` → `services` → `path constants` → `os.homedir()` call happens before test mocks can be applied
2. **Missing Service Mocks**: Tests don't mock the new service layer dependencies
3. **Changed Error Messages**: New error handling uses different message formats than tests expect
4. **Behavioral Changes**: Some actions now use different internal patterns

### Current Status
- **Before Refactoring**: 705 tests passing (95.4% coverage)
- **After Refactoring**: 73 failing, 611 passing  
- **Architecture**: ✅ Coupling eliminated, ✅ No circular dependencies
- **TypeScript**: ✅ Clean compilation
- **Functionality**: ✅ Core features work correctly

## Phase 1: Add Service Mocks to All Action Tests

### Files Requiring Service Mocks
```
tests/unit/actions/
├── install.test.ts        ✅ Started - needs completion
├── restore.test.ts        ❌ Needs service mocks
├── clean.test.ts          ❌ Needs service mocks  
├── delete.test.ts         ❌ Needs service mocks
├── rename.test.ts         ❌ Needs service mocks
├── list.test.ts           ❌ Needs service mocks
├── export.test.ts         ❌ Needs service mocks (uses services)
├── publish.test.ts        ❌ Needs service mocks (uses services) 
├── browse.test.ts         ❌ Needs service mocks (uses services)
└── export-errors.test.ts  ❌ Needs service mocks
```

### Standard Service Mock Template
Add this to the top of each action test file:

```typescript
// Mock services to prevent os.homedir() call during module loading
jest.mock('../../../src/services/index.js', () => ({
  UIService: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    meta: jest.fn(),
    log: jest.fn(),
    colorInfo: jest.fn().mockImplementation((text: string) => text),
    colorError: jest.fn().mockImplementation((text: string) => text),
    colorSuccess: jest.fn().mockImplementation((text: string) => text),
    colorWarning: jest.fn().mockImplementation((text: string) => text),
    colorMeta: jest.fn().mockImplementation((text: string) => text),
    colorStackName: jest.fn().mockImplementation((text: string) => text),
    colorDescription: jest.fn().mockImplementation((text: string) => text),
    colorHighlight: jest.fn().mockImplementation((text: string) => text),
    colorNumber: jest.fn().mockImplementation((text: string) => text),
    readSingleChar: jest.fn(),
  })),
  AuthService: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue('mock-token'),
    getAccessToken: jest.fn().mockReturnValue('mock-token'),
  })),
  ApiService: jest.fn().mockImplementation(() => ({
    fetchStack: jest.fn(),
    publishStack: jest.fn(),
    getBaseUrl: jest.fn().mockReturnValue('https://api.commands.com'),
    getConfig: jest.fn().mockReturnValue({ baseUrl: 'https://api.commands.com' }),
    isLocalDev: jest.fn().mockReturnValue(false),
  })),
  MetadataService: jest.fn().mockImplementation(() => ({
    getPublishedStackMetadata: jest.fn(),
    savePublishedStackMetadata: jest.fn(),
    removePublishedStackMetadata: jest.fn(),
    findStackByStackId: jest.fn(),
    getAllPublishedStacks: jest.fn(),
    isValidVersion: jest.fn().mockReturnValue(true),
    generateSuggestedVersion: jest.fn().mockReturnValue('1.0.1'),
  })),
  DependencyService: jest.fn().mockImplementation(() => ({
    checkMcpDependencies: jest.fn().mockResolvedValue([]),
    displayMissingDependencies: jest.fn(),
    getMissingDependencyNames: jest.fn().mockResolvedValue([]),
  })),
  StackService: jest.fn(),
  FileService: jest.fn(),
  ConfigService: jest.fn(),
}));

jest.mock('../../../src/services/StackOperationService.js', () => ({
  StackOperationService: jest.fn().mockImplementation(() => ({
    performRestore: jest.fn().mockResolvedValue(undefined),
    performInstallation: jest.fn().mockResolvedValue(undefined),
    checkDependencies: jest.fn().mockResolvedValue(undefined),
  })),
}));
```

## Phase 2: Update Error Message Expectations

### Actions Using BaseAction Error Handling
- `install.ts` → `"Installation failed:"` 
- `restore.ts` → `"Restore failed:"`
- `clean.ts` → `"Clean failed:"`  
- `delete.ts` → `"Delete failed:"`
- `rename.ts` → `"Rename failed:"`
- `list.ts` → `"List failed:"`

### Test Pattern Updates Required
**Before:**
```typescript
expect(mockConsoleError).toHaveBeenCalledWith(
  expect.stringContaining('Restore failed:'),
  expect.stringContaining('Permission denied')
);
```

**After:** (No change needed - BaseAction now uses correct prefixes)

### Actions Using Service Pattern (Non-BaseAction)
- `export.ts`, `browse.ts`, `publish.ts` → Keep original error patterns

## Phase 3: Update Method Call Expectations

### BaseAction Tests Need Updated Expectations

**Console Output Changes:**
- Direct `console.log()` calls → `this.ui.info()`, `this.ui.error()`, etc.
- Color function calls → `this.ui.colorInfo()`, `this.ui.colorStackName()`, etc.

**API Call Changes:**
- Direct `authenticate()` → `this.auth.authenticate()`
- Direct `getApiConfig()` → `this.api.getConfig()`
- Direct utility calls → Service method calls

### Mock Setup Updates
Tests need to mock the service instances rather than the direct utilities:

**Before:**
```typescript
jest.mock('../../../src/utils/auth.js', () => ({
  authenticate: jest.fn().mockResolvedValue('token'),
}));
```

**After:**
```typescript
// Use the service mocks defined in Phase 1 template
```

## Phase 4: Integration and E2E Test Updates

### Files Requiring Updates
```
tests/integration/
├── actions/export.test.ts              ❌ May need service mocks
└── controllers/StackController.test.ts  ❌ May need service mocks

tests/e2e/
└── cli-workflows.test.ts               ❌ May need service mocks

tests/performance/
└── benchmark.test.ts                   ❌ May need service mocks
```

### Update Strategy
1. Add service mocks if they import actions directly
2. Update expectations for any changed behavior
3. Ensure end-to-end flows still work correctly

## Phase 5: Service and Utility Test Updates

### Service Tests
```
tests/unit/services/
├── StackService.test.ts     ❌ May have path loading issues
├── FileService.test.ts      ❌ May have path loading issues  
└── ConfigService.test.ts    ❌ May have path loading issues
```

**Strategy**: Add path constant mocks if needed

### Utility Tests
Most utility tests should continue working unchanged since utilities themselves weren't modified.

## Implementation Order

### Priority 1: Core Action Tests (High Impact)
1. `install.test.ts` - Complete the started work
2. `restore.test.ts` - High usage, BaseAction pattern  
3. `clean.test.ts` - BaseAction pattern
4. `delete.test.ts` - BaseAction pattern
5. `rename.test.ts` - BaseAction pattern
6. `list.test.ts` - BaseAction pattern

### Priority 2: Service-Based Action Tests
7. `export.test.ts` - Service pattern
8. `publish.test.ts` - Service pattern  
9. `browse.test.ts` - Service pattern
10. `export-errors.test.ts` - Service pattern

### Priority 3: Integration Tests
11. Integration and E2E tests
12. Performance tests
13. Service tests if affected

## Success Criteria

### Target Metrics
- ✅ **705+ tests passing** (match or exceed baseline)
- ✅ **95%+ test coverage** (maintain coverage levels)
- ✅ **0 TypeScript compilation errors**
- ✅ **All architectural benefits preserved**

### Validation Steps
1. Run full test suite: `npm test`
2. Check coverage: `npm run test:coverage`
3. Verify build: `npm run build`
4. Spot check: Run specific action tests individually
5. Integration check: Test CLI commands manually

## Estimated Timeline

### Time Estimates
- **Phase 1**: 2-3 hours (Service mocks for 10 action test files)
- **Phase 2**: 1 hour (Error message updates)  
- **Phase 3**: 1-2 hours (Method call expectation updates)
- **Phase 4**: 1 hour (Integration test updates)
- **Phase 5**: 30 minutes (Service test fixes)
- **Validation**: 30 minutes (Testing and verification)

**Total Estimated Time: 5.5-7 hours**

## Rollback Plan

If the update proves more complex than estimated:

### Option A: Partial Rollback
- Keep the service layer architecture
- Simplify actions to use direct service imports instead of BaseAction
- Maintain coupling elimination benefits with minimal test changes

### Option B: Full Rollback  
- Revert to commit `3ff9125` (705 tests passing baseline)
- Re-implement coupling fixes with a less invasive approach
- Preserve test compatibility throughout

## Notes

### Key Architectural Benefits to Preserve
- ✅ **No circular dependencies**
- ✅ **No direct utility imports in actions**
- ✅ **Service layer abstraction**  
- ✅ **Consistent error handling**
- ✅ **Dependency injection capability**

### Test Quality Improvements
- Better service mocking patterns
- More consistent test setup
- Cleaner separation of concerns in tests
- Enhanced maintainability for future changes

This plan ensures that we maintain all the architectural improvements while restoring full test compatibility and coverage.