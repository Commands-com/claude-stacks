---
description: Comprehensive security audit to identify vulnerabilities, authentication issues, and security best practices gaps
model: opus
---

Use the @security-auditor agent to perform a comprehensive security audit of this TypeScript CLI project, focusing on identifying vulnerabilities, security anti-patterns, and opportunities to strengthen defensive security measures.

## Security Audit Scope

### Phase 1: Vulnerability Assessment
Conduct thorough security vulnerability analysis:

1. **Input Validation & Sanitization**
   - Review CLI argument parsing for injection vulnerabilities
   - Check file path validation and directory traversal prevention
   - Analyze user input handling in interactive prompts
   - Verify proper escaping of shell commands and file operations

2. **Authentication & Authorization**
   - Review authentication flow and token handling
   - Check for secure credential storage practices
   - Analyze API authentication mechanisms
   - Verify proper session management

3. **Dependency Security**
   - Scan for known vulnerabilities in npm dependencies
   - Review dependency update policies and practices
   - Check for supply chain security risks
   - Analyze transitive dependency security

### Phase 2: Data Protection & Privacy
Analyze data handling and privacy protection:

1. **Sensitive Data Handling**
   - Identify locations where sensitive data is processed
   - Review logging practices for credential leakage
   - Check for proper data sanitization before output
   - Analyze temporary file handling and cleanup

2. **Network Security**
   - Review HTTPS usage and certificate validation
   - Check API endpoint security configurations
   - Analyze request/response data exposure
   - Verify secure communication patterns

3. **File System Security**
   - Review file permission handling
   - Check for secure temporary file creation
   - Analyze configuration file security
   - Verify proper path validation and sanitization

### Phase 3: Security Best Practices
Evaluate adherence to security best practices:

1. **Error Handling**
   - Review error messages for information disclosure
   - Check for proper error sanitization
   - Analyze stack trace exposure risks
   - Verify graceful failure handling

2. **Configuration Security**
   - Review default configuration security
   - Check for hardcoded secrets or credentials
   - Analyze environment variable handling
   - Verify secure configuration storage

3. **Code Security Patterns**
   - Identify use of deprecated or insecure APIs
   - Review cryptographic implementations
   - Check for race conditions and timing attacks
   - Analyze async operation security

## Specific Security Focus Areas for CLI Tools

### Command Injection Prevention
- Shell command execution security
- Argument sanitization and validation
- Process spawning security measures
- Environment variable injection risks

### File System Security
- Path traversal prevention mechanisms
- Secure file creation and permissions
- Configuration file protection
- Temporary file handling security

### API Security Integration
- Authentication token management
- Secure API communication protocols
- Rate limiting and abuse prevention
- Response data validation and sanitization

### Supply Chain Security
- Dependency vulnerability management
- Package integrity verification
- Third-party service integration security
- Build and deployment security

## Output Requirements

### Vulnerability Report
- **Critical Issues**: Immediate security risks requiring urgent attention
- **High Priority**: Significant vulnerabilities with clear exploitation paths
- **Medium Priority**: Potential security weaknesses requiring attention
- **Low Priority**: Security improvements and hardening opportunities
- **False Positives**: Identified non-issues with explanations

### Security Recommendations
- **Immediate Actions**: Critical fixes with implementation guidance
- **Short-term Improvements**: Security enhancements for next development cycle
- **Long-term Strategy**: Ongoing security practices and monitoring
- **Compliance Considerations**: Industry standard adherence recommendations

### Implementation Guidance
- **Code Examples**: Secure coding patterns and fixes
- **Configuration Changes**: Security-focused configuration improvements
- **Testing Strategies**: Security testing approaches and tools
- **Monitoring Setup**: Security event logging and alerting

### Security Checklist
- **Authentication & Authorization**: Secure access control implementation
- **Input Validation**: Comprehensive input sanitization coverage
- **Error Handling**: Secure error management without information leakage  
- **Dependency Management**: Vulnerability scanning and update processes
- **Logging & Monitoring**: Security event tracking without credential exposure

The security audit should provide actionable recommendations that strengthen the application's security posture while maintaining functionality and usability. Focus on defensive security measures that protect against common attack vectors and ensure secure handling of user data and credentials.