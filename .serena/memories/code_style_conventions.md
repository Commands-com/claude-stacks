# Code Style and Conventions

## TypeScript Configuration

- **Target**: ES2020
- **Module System**: ESM (ES2020 modules)
- **Strict Mode**: Enabled
- **Module Resolution**: Node
- Source maps and declaration files generated

## File Organization

- **Barrel exports**: Used in types/index.ts for centralized type exports
- **File extensions**: All imports use .js extensions (ESM requirement)
- **Directory structure**: Organized by feature (actions/, utils/, ui/, types/)

## Naming Conventions

- **Files**: kebab-case (e.g., `export-action.ts`, `api-config.ts`)
- **Functions**: camelCase (e.g., `exportAction`, `getApiConfig`)
- **Interfaces**: PascalCase with descriptive names (e.g., `DeveloperStack`, `ExportOptions`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `OAUTH_CONFIG`)

## Code Patterns

- **Async/await**: Preferred over Promises
- **Error handling**: Try-catch blocks with meaningful error messages
- **Type safety**: Interfaces for all major data structures
- **Import organization**: Types imported separately from implementation
- **CLI structure**: Commander.js with action functions in separate files

## Documentation

- **TSDoc**: Basic function documentation present
- **Inline comments**: Used for complex business logic
- **Type annotations**: Explicit where TypeScript inference isn't clear

## Dependencies and Imports

- **ESM modules**: All files use import/export syntax
- **Relative imports**: Use .js extensions for compiled output
- **Type-only imports**: Uses `import type` where appropriate
