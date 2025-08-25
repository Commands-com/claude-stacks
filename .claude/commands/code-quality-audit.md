---
description: Comprehensive code quality audit with architectural review and TypeScript optimization for enterprise-grade code quality
model: opus
---

Use the @architect-reviewer and @typescript-pro agents to perform a comprehensive code quality audit of this TypeScript project, combining architectural review and TypeScript optimization to ensure enterprise-grade standards.

## Audit Scope

### Phase 1: Architectural Review (architect-reviewer)
Conduct a thorough architectural assessment:

1. **Pattern Analysis**: Review the codebase for architectural patterns and consistency
   - Examine modular structure and separation of concerns
   - Check for SOLID principle adherence
   - Identify any architectural anti-patterns

2. **Dependency Structure**: Analyze module dependencies and coupling
   - Map dependency flows between modules
   - Identify circular dependencies or inappropriate coupling
   - Review abstraction levels and interface boundaries

3. **Scalability Assessment**: Evaluate architectural decisions for future growth
   - Identify potential bottlenecks or scalability issues
   - Review error handling and resilience patterns
   - Assess maintainability and extensibility

### Phase 2: TypeScript Optimization (typescript-pro)
Deep TypeScript analysis and improvement:

1. **Type System Review**: Analyze current TypeScript usage
   - Review type definitions and interfaces
   - Check for proper use of generics and utility types
   - Identify opportunities for better type inference

2. **Configuration Optimization**: Review and optimize TypeScript configuration
   - Analyze tsconfig.json for strict settings
   - Recommend compiler options for better type safety
   - Optimize build performance and incremental compilation

3. **Advanced Typing Patterns**: Implement enterprise-grade TypeScript features
   - Create robust type definitions for better developer experience
   - Implement type guards and branded types where appropriate
   - Add comprehensive JSDoc/TSDoc documentation

## Output Requirements

### Architectural Review Report
- **Impact Assessment**: High/Medium/Low impact findings
- **Pattern Compliance**: Checklist of architectural patterns and adherence
- **Dependency Analysis**: Visual map of module dependencies and coupling issues
- **Risk Assessment**: Potential maintenance and scaling risks
- **Recommendations**: Prioritized list of architectural improvements

### TypeScript Optimization Report  
- **Type Coverage Analysis**: Current type safety coverage and gaps
- **Configuration Recommendations**: Optimized tsconfig.json settings
- **Type System Enhancements**: Specific type definitions and utility types to add
- **Performance Optimizations**: Build time and runtime optimizations
- **Best Practices Implementation**: Enterprise TypeScript patterns and conventions

### Combined Action Plan
- **Critical Issues**: Must-fix architectural or typing problems
- **Quick Wins**: Easy improvements with high impact
- **Long-term Improvements**: Larger refactoring efforts for future consideration
- **Standards Documentation**: Code style guide and architectural decision records

## Specific Focus Areas for This Project

### CLI Tool Architecture
- Command parsing and validation architecture
- Error handling and user feedback patterns
- Configuration management and settings persistence
- File system operations and data transformation layers

### TypeScript Patterns
- Strong typing for CLI arguments and options
- Type-safe configuration objects and validation
- Generic utilities for data transformations
- Proper error types and exception handling
- API response typing and validation

### Code Quality Metrics
- Cyclomatic complexity analysis
- Code duplication identification
- Test coverage gaps related to architecture
- Documentation completeness assessment

The audit should result in actionable recommendations that improve code maintainability, type safety, and architectural consistency while maintaining the project's current functionality and performance characteristics.