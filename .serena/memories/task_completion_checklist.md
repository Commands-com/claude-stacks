# Task Completion Checklist

## Before Committing Changes

1. **Type Check**: Run `tsc --noEmit` to ensure no TypeScript errors
2. **Build**: Run `npm run build` to compile and check for build errors
3. **Manual Testing**: Test affected CLI commands manually
4. **Code Review**: Ensure changes follow established patterns and conventions

## Code Quality Checks

- Verify proper ESM import syntax with `.js` extensions
- Ensure all functions have proper TypeScript types
- Check for consistent error handling patterns
- Validate that utility functions are properly modularized

## Architecture Compliance

- Maintain separation between actions, utils, types, and UI
- Ensure new functionality fits existing patterns
- Verify dependency flow doesn't create circular dependencies
- Check that new types are added to `src/types/index.ts`

## Testing Considerations

- Test CLI commands with various option combinations
- Verify OAuth flow works correctly
- Test both local and global configuration scenarios
- Ensure error messages are user-friendly

## Release Process

1. Update version in package.json if needed
2. Run `npm run build` to generate dist/
3. Test built CLI with sample commands
4. Commit and push changes
5. Use `npm publish` for npm registry release
