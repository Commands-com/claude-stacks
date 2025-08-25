# Architectural Patterns and Design Guidelines

## Core Architectural Patterns

### Command Pattern

- Each CLI command implemented as separate action module
- Clean separation between command definition (cli.ts) and implementation (actions/)
- Consistent parameter passing via options objects

### Repository Pattern

- Authentication token storage in ~/.claude-stacks-auth.json
- Stack metadata management through metadata utilities
- File system operations abstracted through fs-extra

### Strategy Pattern

- Environment-based configuration (dev/prod API endpoints)
- Different authentication flows (OAuth with PKCE)
- Stack export/import strategies (local vs global)

## Modular Architecture

- **Separation of Concerns**: Clear boundaries between CLI, business logic, and utilities
- **Single Responsibility**: Each module has focused responsibility
- **Dependency Injection**: Configuration and dependencies passed as parameters

## Error Handling Strategy

- Consistent error propagation through async/await
- User-friendly error messages with colored output
- Graceful degradation for missing dependencies

## Design Principles Applied

- **DRY**: Shared utilities for common operations (colors, API config, file operations)
- **KISS**: Simple, focused functions with clear purposes
- **Open/Closed**: Extensible through new action modules without modifying core CLI
- **Interface Segregation**: Type definitions separated and focused on specific use cases
