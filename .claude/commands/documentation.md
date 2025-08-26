---
description: Generate comprehensive technical documentation using the docs-architect agent for system architecture, API reference, and implementation guides
model: opus
---

Use the @docs-architect agent to create comprehensive technical documentation from the existing codebase. This command analyzes the architecture, design patterns, and implementation details to produce long-form technical manuals and documentation.

## Documentation Scope

### Phase 1: System Architecture Documentation
Create high-level architectural documentation:

1. **System Overview**: Generate comprehensive system architecture documentation
   - Core system components and their interactions
   - Data flow diagrams and system boundaries
   - Technology stack and dependency analysis
   - Design patterns and architectural decisions

2. **Module Structure**: Document modular organization
   - Directory structure and organization principles
   - Module responsibilities and interfaces
   - Inter-module communication patterns
   - Dependency graphs and coupling analysis

3. **Configuration & Setup**: Installation and configuration guides
   - Environment setup and prerequisites
   - Configuration options and their effects
   - Deployment strategies and best practices

### Phase 2: API & Interface Documentation
Generate detailed API and interface documentation:

1. **Public APIs**: Document all public interfaces
   - Function signatures and parameter descriptions
   - Return types and possible exceptions
   - Usage examples and common patterns
   - Integration guidelines and best practices

2. **Internal APIs**: Document internal system interfaces
   - Service layer interfaces and contracts
   - Data access patterns and repository interfaces
   - Event handling and notification systems
   - Plugin and extension points

3. **Data Models**: Document data structures and schemas
   - Core data models and their relationships
   - Validation rules and constraints
   - Serialization formats and protocols
   - Migration strategies and versioning

### Phase 3: Implementation Guides
Create detailed implementation and usage guides:

1. **Developer Guides**: How to work with the codebase
   - Development environment setup
   - Code organization and style guidelines
   - Testing strategies and practices
   - Debugging and troubleshooting guides

2. **Feature Implementation**: Step-by-step implementation guides
   - Adding new features and components
   - Extending existing functionality
   - Integration with external systems
   - Performance optimization techniques

3. **Maintenance Documentation**: Ongoing maintenance procedures
   - Code review checklists and standards
   - Monitoring and logging strategies
   - Error handling and recovery procedures
   - Security considerations and best practices

## Output Requirements

### Architecture Documentation
- **System Architecture Guide**: Complete system overview with diagrams
- **Component Documentation**: Detailed component descriptions and interactions
- **Integration Guide**: How different parts of the system work together
- **Decision Records**: Architectural decisions and their rationale

### API Reference
- **Complete API Reference**: All public and internal APIs documented
- **Usage Examples**: Practical examples for each major API
- **Integration Patterns**: Common integration scenarios and solutions
- **Error Handling Guide**: Comprehensive error scenarios and handling

### Implementation Manuals
- **Developer Handbook**: Complete guide for developers working on the project
- **Feature Development Guide**: Step-by-step process for adding new features
- **Troubleshooting Guide**: Common issues and their solutions
- **Best Practices Manual**: Coding standards and recommended patterns

### Technical Deep-Dives
- **Performance Analysis**: System performance characteristics and optimization
- **Security Architecture**: Security considerations and implementation details
- **Scalability Guide**: How the system handles growth and scaling
- **Monitoring & Observability**: Logging, metrics, and monitoring strategies

## Specific Focus Areas for This Project

### CLI Tool Documentation
- Command-line interface design and usage patterns
- Configuration management and settings documentation
- File processing and transformation workflows
- Error handling and user feedback systems

### TypeScript Implementation Details
- Type system architecture and custom type definitions
- Generic utilities and reusable components
- Module organization and export strategies
- Build system and compilation processes

### Integration Documentation
- External service integrations and API clients
- File system operations and data persistence
- Authentication and authorization flows
- Plugin and extension architecture

### User Experience Documentation
- Installation and setup procedures
- Common usage patterns and workflows
- Troubleshooting common user issues
- Migration guides and upgrade procedures

## Documentation Standards

### Technical Writing Requirements
- Clear, concise explanations with practical examples
- Consistent terminology and naming conventions
- Progressive complexity from basic to advanced topics
- Cross-references and navigation aids

### Code Examples and Samples
- Working code examples for all major features
- Complete sample applications and use cases
- Test cases that demonstrate proper usage
- Performance benchmarks and optimization examples

### Visual Documentation
- Architecture diagrams and flow charts
- Sequence diagrams for complex interactions
- Class diagrams for object relationships
- Network diagrams for system topology

The documentation should serve as both a comprehensive reference for experienced developers and a learning resource for new team members, covering everything from high-level architecture to specific implementation details.