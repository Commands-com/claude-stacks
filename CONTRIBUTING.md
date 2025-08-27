# Contributing to Claude Stacks

Thank you for your interest in contributing to Claude Stacks! This guide will help you get started with contributing to the project.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/claude-stacks.git
   cd claude-stacks
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the project**

   ```bash
   npm run build
   ```

4. **Run tests to ensure everything works**
   ```bash
   npm test
   ```

## Development Workflow

### Available Scripts

- `npm run dev` - Run in development mode with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run test` - Run complete test suite with coverage
- `npm run test:watch` - Run tests in watch mode during development
- `npm run test:unit` - Run only unit tests
- `npm run test:integration` - Run only integration tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix auto-fixable linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run typecheck` - Run TypeScript type checking
- `npm run quality` - Run all quality checks (lint + format + typecheck)
- `npm run quality:fix` - Fix all auto-fixable quality issues

### Code Quality Standards

This project maintains high code quality standards:

- **Test Coverage**: Maintain 95%+ test coverage
- **Linting**: All code must pass ESLint checks
- **Formatting**: Code must be formatted with Prettier
- **Type Safety**: All TypeScript code must pass type checking
- **Git Hooks**: Pre-commit hooks ensure quality standards

### Testing Guidelines

#### Test Structure

The project uses Jest with comprehensive test coverage organized as:

```
tests/
├── unit/           # Unit tests for individual functions/classes
├── integration/    # Integration tests for service interactions
├── e2e/           # End-to-end tests for full workflows
└── performance/   # Performance and load tests
```

#### Writing Tests

- **Unit tests**: Test individual functions in isolation with mocks
- **Integration tests**: Test service interactions with real dependencies
- **E2E tests**: Test complete user workflows
- **Mock isolation**: Always reset mocks in `beforeEach()` to prevent test interference

#### Test Patterns

```typescript
// Good: Proper mock setup and isolation
beforeEach(() => {
  jest.clearAllMocks();

  // Reset module-level mocks explicitly
  const { colors } = require('../../../src/utils/colors.ts');
  colors.info = jest.fn().mockImplementation((text: string) => text);

  const pathConstants = require('../../../src/constants/paths.ts');
  pathConstants.getLocalClaudeDir = jest.fn(() => '/test/project/.claude');
});

// Good: Test exact console output expectations
expect(mockConsoleLog).toHaveBeenCalledWith(
  '📥 Fetching stack test-org/test-stack from Commands.com...'
);
```

#### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run specific test files
npm test -- tests/unit/actions/install.test.ts

# Run tests with specific name pattern
npm test -- --testNamePattern="should install a stack"

# Debug test failures
npm run test:debug
```

## Code Style and Architecture

### File Organization

```
src/
├── actions/        # CLI command implementations
├── controllers/    # High-level business logic controllers
├── services/       # Core business services
├── utils/          # Utility functions and helpers
├── types/          # TypeScript type definitions
├── constants/      # Application constants
└── ui/            # User interface utilities
```

### Coding Conventions

- **TypeScript**: Use strict TypeScript with proper typing
- **Error Handling**: Use custom error types from `src/types/errors.ts`
- **Logging**: Use the color utility functions from `src/utils/colors.ts`
- **Services**: Follow dependency injection patterns
- **Actions**: Extend `BaseAction` for CLI commands
- **Testing**: Mock external dependencies, test error scenarios

### Architecture Patterns

- **Service Layer**: Business logic separated into focused services
- **Controller Pattern**: High-level orchestration in controllers
- **Command Pattern**: CLI commands as action classes
- **Dependency Injection**: Services injected via constructors
- **Error Boundaries**: Proper error handling and user feedback

## Submitting Changes

### Pull Request Process

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes following the coding standards**

3. **Write or update tests**
   - Add tests for new functionality
   - Update existing tests if changing behavior
   - Ensure all tests pass

4. **Run quality checks**

   ```bash
   npm run quality
   ```

5. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

6. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
   - Use a clear, descriptive title
   - Include a detailed description of changes
   - Reference any related issues
   - Include screenshots for UI changes

### Commit Message Convention

Use conventional commits format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:

```
feat: add support for exporting global configurations
fix: resolve authentication token refresh issue
docs: update README with new installation instructions
test: add integration tests for stack publishing
```

### Pull Request Checklist

- [ ] Code follows the project's style guidelines
- [ ] Self-review of the code has been performed
- [ ] Tests have been added/updated and all pass
- [ ] Documentation has been updated if necessary
- [ ] Changes generate no new warnings
- [ ] Any dependent changes have been merged and published

## Types of Contributions

### Bug Reports

When reporting bugs, please include:

- **Clear description** of the issue
- **Steps to reproduce** the bug
- **Expected behavior** vs actual behavior
- **Environment details** (OS, Node.js version, etc.)
- **Error messages** or logs if applicable
- **Screenshots** if relevant

### Feature Requests

For feature requests, please provide:

- **Clear description** of the proposed feature
- **Use case** and problem it solves
- **Proposed solution** or implementation ideas
- **Alternatives considered**

### Code Contributions

We welcome contributions for:

- Bug fixes
- New features
- Performance improvements
- Documentation improvements
- Test coverage improvements
- Code refactoring

## Development Tips

### Debugging

- Use `npm run test:debug` to debug failing tests
- Check `lint_failures.log` for detailed linting issues
- Use the development scripts for faster iteration

### Understanding the Codebase

1. Start with `src/cli.ts` to understand the CLI structure
2. Look at `src/actions/` for command implementations
3. Review `src/services/` for core business logic
4. Check `tests/` for usage examples and edge cases

### Working with the API

- API integration is in `src/services/ApiService.ts`
- Authentication logic is in `src/utils/auth.ts`
- Test API interactions with mocked responses

## Getting Help

- **Documentation**: Check the README and inline code comments
- **Issues**: Browse existing GitHub issues for similar problems
- **Discussions**: Start a GitHub discussion for questions
- **Tests**: Look at test files for usage examples

## Code of Conduct

This project follows a standard code of conduct:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

Thank you for contributing to Claude Stacks! 🚀
