---
description: Set up comprehensive test suite for TypeScript/Node.js projects with coverage reporting, CI integration, and performance testing
model: sonnet
---

Use the @test-automator agent to set up a complete, production-ready test suite for this TypeScript/Node.js project. The agent will analyze the project and create appropriate test infrastructure.

## Project Analysis Phase
First, analyze the current project structure to determine:
1. **Project Type**: CLI tool, REST API, library, web application, monorepo
2. **Module System**: CommonJS, ESM, or hybrid configuration
3. **Dependencies**: External APIs, databases, file systems, third-party integrations
4. **Critical Business Logic**: Core functionality that must be thoroughly tested
5. **Existing Test Infrastructure**: What's already in place vs. what's needed

## Testing Infrastructure Setup

### 1. Core Testing Framework
- **Framework Selection**: Jest (default), Vitest, or Mocha based on project needs
- **TypeScript Integration**: Compilation, source maps, type checking in tests
- **ESM/CommonJS Support**: Proper module resolution for project's module system
- **Configuration Files**: Jest/Vitest config with appropriate presets and transforms

### 2. Package.json Test Scripts
Add comprehensive test scripts:
```json
{
  "scripts": {
    "test": "run tests with coverage reporting",
    "test:watch": "run tests in watch mode for development",
    "test:coverage": "generate detailed coverage reports", 
    "test:ci": "run tests optimized for CI environments",
    "test:unit": "run only unit tests",
    "test:integration": "run only integration tests",
    "test:e2e": "run end-to-end tests",
    "test:performance": "run performance and benchmark tests"
  }
}
```

### 3. Coverage Configuration
Set up coverage thresholds and reporting:
- **Statements**: 85%+ critical modules, 70%+ overall
- **Branches**: 80%+ business logic, 65%+ overall
- **Functions**: 90%+ public APIs, 75%+ overall
- **Lines**: 85%+ core functionality, 70%+ overall
- **Reports**: HTML, JSON, LCOV, and console formats
- **Threshold Enforcement**: Fail builds when coverage drops

### 4. Dependencies Installation
Install appropriate testing dependencies:
- Core framework (jest, vitest, mocha)
- TypeScript support (@types packages)
- Assertion libraries (expect, chai)
- Mocking utilities (jest mocks, sinon)
- Coverage tools (c8, nyc, istanbul)
- Testing utilities specific to project type

## Test Suite Structure

### 1. Unit Tests (70-80% of tests)
Test individual functions, classes, and modules:
- Pure functions and business logic
- Utility modules and helper functions  
- Data transformations and calculations
- Error handling and edge cases
- Input validation and sanitization

### 2. Integration Tests (15-25% of tests)
Test component interactions:
- API endpoint testing (for web services)
- Database operations and queries
- External service integrations
- File system operations
- Module integration points

### 3. End-to-End Tests (5-10% of tests)
Test complete user workflows:
- Critical user journeys
- Cross-system interactions
- CLI command execution (for CLI tools)
- Full application workflows
- Error scenarios and recovery

### 4. Performance Tests
Benchmark and performance monitoring:
- Response time testing
- Memory usage monitoring
- Throughput testing
- Performance regression detection
- Load testing for services

## Mock and Test Data Strategy

### Mocking Approach
- **HTTP Requests**: MSW (Mock Service Worker) or nock for API mocking
- **File System**: Mock fs or temporary directories for file operations
- **External Dependencies**: Dependency injection or module mocking
- **Environment Variables**: Test-specific configurations
- **Time/Dates**: Deterministic time control for consistent tests

### Test Data Management
- **Factories**: Generate realistic test data programmatically
- **Fixtures**: Static test data files for complex scenarios
- **Builders**: Fluent API for constructing test objects
- **Cleanup**: Proper test data isolation and cleanup between tests

## Reporting and Metrics

### Coverage Reports
- **HTML Report**: Detailed line-by-line coverage with highlighting
- **Console Output**: Real-time coverage summary during test runs
- **JSON/LCOV**: Machine-readable formats for CI integration
- **Coverage Badges**: Visual coverage percentage for README
- **Trend Tracking**: Coverage changes over time

### Test Execution Reports
- **Test Results**: Pass/fail counts, execution times, error details
- **Performance Metrics**: Slowest tests, memory usage, benchmark results
- **Flaky Test Detection**: Identify and flag unreliable tests
- **Test Organization**: Group results by type, module, or feature

### CI Integration
- **GitHub Actions**: Automated test execution on PRs and pushes
- **Quality Gates**: Block merges on test failures or coverage drops
- **PR Comments**: Automated coverage and test result comments
- **Artifact Storage**: Store coverage reports and test results
- **Status Checks**: Integration with GitHub/GitLab merge requirements

## Advanced Testing Features

### Performance Testing
- **Benchmark Suite**: Performance regression detection
- **Memory Profiling**: Memory leak detection for long-running processes
- **Load Testing**: Stress testing for APIs and services
- **Bundle Analysis**: Size and performance optimization for client apps

### Quality Assurance
- **Mutation Testing**: Test the tests themselves for effectiveness
- **Property-Based Testing**: Generate test cases automatically
- **Contract Testing**: API schema and interface validation
- **Visual Regression**: UI component testing (if applicable)

The goal is to create a robust, maintainable test suite with excellent coverage, clear metrics, and seamless CI/CD integration that scales with the project.