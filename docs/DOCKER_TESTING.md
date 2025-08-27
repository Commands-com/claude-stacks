# Docker Testing Guide for Claude Stacks

This document provides comprehensive guidance for testing claude-stacks functionality using Docker containers. Docker testing ensures consistent, isolated environments that closely mirror real-world user scenarios.

## Table of Contents

- [Overview](#overview)
- [Basic Testing Setup](#basic-testing-setup)
- [Testing Scenarios](#testing-scenarios)
- [Advanced Testing Patterns](#advanced-testing-patterns)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

Docker testing for claude-stacks serves several key purposes:

1. **Environment Isolation**: Test in clean environments without local configuration interference
2. **Platform Consistency**: Ensure functionality works across different operating systems
3. **Real-world Simulation**: Test actual npm installation and usage patterns
4. **Regression Prevention**: Validate that new changes don't break existing functionality

## Basic Testing Setup

### Prerequisites

- Docker installed and running
- Access to npm registry (for testing published versions)
- Understanding of claude-stacks CLI commands

### Base Test Template

```bash
docker run --rm alpine sh -c "
echo '=== Setting up Alpine container ===' &&
apk add --no-cache nodejs npm &&
echo 'Node version:' && node --version &&
echo 'NPM version:' && npm --version &&

echo '=== Installing claude-stacks ===' &&
npm install -g claude-stacks &&

echo '=== Your test scenarios here ===' &&
# Add your specific test commands

echo '=== Test completed ==='
"
```

## Testing Scenarios

### 1. Fresh Installation Testing

Tests claude-stacks installation from npm and basic stack installation functionality.

```bash
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&
npm install -g claude-stacks &&

mkdir -p /test-project && cd /test-project &&
claude-stacks install commands-com/claude-stacks-development-stack &&

echo '=== Verifying installation results ===' &&
ls -la .claude/ &&
ls -la .claude/commands/ &&
ls -la .claude/agents/ &&
cat ~/.claude.json
"
```

**Expected Results:**

- `.claude` directory created with commands and agents
- `~/.claude.json` contains MCP server configuration
- Settings file created at `.claude/settings.local.json`

### 2. Merge Functionality Testing

Tests that existing configurations are preserved when installing stacks.

```bash
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&

# Create existing configurations
mkdir -p ~/.claude &&
cat > ~/.claude.json << 'EOF'
{
  \"globalSetting\": \"should-be-preserved\",
  \"projects\": {
    \"/existing-project\": {
      \"allowedTools\": [\"existing-tool\"],
      \"mcpServers\": {
        \"existing-server\": {
          \"type\": \"stdio\",
          \"command\": \"existing-command\"
        }
      }
    }
  }
}
EOF

mkdir -p /test-project/.claude && cd /test-project &&
cat > .claude/settings.local.json << 'EOF'
{
  \"existingLocalSetting\": \"should-be-kept\",
  \"theme\": \"dark\",
  \"features\": {
    \"autoSave\": true,
    \"customFeature\": \"preserve-me\"
  }
}
EOF

npm install -g claude-stacks &&
claude-stacks install commands-com/claude-stacks-development-stack &&

echo '=== Verifying merge behavior ===' &&
grep 'should-be-preserved' ~/.claude.json && echo '✅ Global settings preserved' || echo '❌ Global settings lost' &&
grep 'existing-project' ~/.claude.json && echo '✅ Existing project preserved' || echo '❌ Existing project lost' &&
grep 'should-be-kept' .claude/settings.local.json && echo '✅ Local settings preserved' || echo '❌ Local settings lost' &&
grep 'test-project' ~/.claude.json && echo '✅ New project added' || echo '❌ New project missing'
"
```

**Expected Results:**

- All existing configurations preserved
- New stack components added alongside existing ones
- No data loss during installation

### 3. Overwrite Functionality Testing

Tests the `--overwrite` flag behavior for selective overwriting.

```bash
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&

mkdir -p /test-project/.claude && cd /test-project &&

# Create existing settings with mix of stack and non-stack fields
cat > .claude/settings.local.json << 'EOF'
{
  \"existingLocalSetting\": \"SHOULD-REMAIN-NOT-IN-STACK\",
  \"theme\": \"dark\",
  \"features\": {
    \"autoSave\": true,
    \"customFeature\": \"SHOULD-REMAIN\"
  },
  \"statusLine\": {
    \"type\": \"old\",
    \"command\": \"SHOULD-BE-OVERWRITTEN\"
  },
  \"permissions\": {
    \"allow\": [\"old-permission\"]
  }
}
EOF

npm install -g claude-stacks &&
claude-stacks install commands-com/claude-stacks-development-stack --overwrite &&

echo '=== Verifying selective overwrite ===' &&
grep 'SHOULD-REMAIN-NOT-IN-STACK' .claude/settings.local.json && echo '✅ Non-stack setting preserved' || echo '❌ Non-stack setting lost' &&
grep 'dark' .claude/settings.local.json && echo '✅ Theme preserved' || echo '❌ Theme lost' &&
grep 'SHOULD-BE-OVERWRITTEN' .claude/settings.local.json && echo '❌ Status line NOT overwritten' || echo '✅ Status line overwritten' &&
grep 'old-permission' .claude/settings.local.json && echo '❌ Permissions NOT overwritten' || echo '✅ Permissions overwritten'
"
```

**Expected Results:**

- Non-stack fields preserved (`existingLocalSetting`, `theme`, `features.customFeature`)
- Stack fields overwritten (`statusLine`, `permissions`)
- Success message shows "selective" overwrite

### 4. Version Compatibility Testing

Tests different versions of claude-stacks for compatibility.

```bash
# Test specific version
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&
npm install -g claude-stacks@1.3.2 &&
mkdir -p /test-project && cd /test-project &&
claude-stacks install commands-com/claude-stacks-development-stack &&
echo 'Version test completed successfully'
"

# Test latest version
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&
npm install -g claude-stacks@latest &&
mkdir -p /test-project && cd /test-project &&
claude-stacks install commands-com/claude-stacks-development-stack &&
echo 'Latest version test completed successfully'
"
```

### 5. Error Handling Testing

Tests error scenarios and recovery mechanisms.

```bash
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&
npm install -g claude-stacks &&
mkdir -p /test-project && cd /test-project &&

echo '=== Testing invalid stack ID ===' &&
claude-stacks install invalid-org/non-existent-stack 2>&1 || echo 'Expected error handled correctly' &&

echo '=== Testing network timeout scenarios ===' &&
timeout 5 claude-stacks install commands-com/claude-stacks-development-stack 2>&1 || echo 'Timeout handled correctly' &&

echo '=== Testing permission scenarios ===' &&
# Create read-only directory
mkdir -p /readonly-test && chmod 444 /readonly-test &&
cd /readonly-test &&
claude-stacks install commands-com/claude-stacks-development-stack 2>&1 || echo 'Permission error handled correctly'
"
```

### 6. Multi-Stack Installation Testing

Tests installing multiple stacks to the same project.

```bash
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&
npm install -g claude-stacks &&
mkdir -p /test-project && cd /test-project &&

echo '=== Installing first stack ===' &&
claude-stacks install commands-com/claude-stacks-development-stack &&

echo '=== Installing second stack (if available) ===' &&
# Note: Replace with actual second stack when available
# claude-stacks install commands-com/another-stack &&

echo '=== Verifying multi-stack configuration ===' &&
cat ~/.claude.json | jq '.projects.\"/test-project\".mcpServers | keys | length' &&
ls .claude/commands/ | wc -l &&
ls .claude/agents/ | wc -l
"
```

### 7. Cross-Platform Testing

Tests on different base images to ensure cross-platform compatibility.

```bash
# Alpine Linux (minimal)
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&
npm install -g claude-stacks &&
claude-stacks install commands-com/claude-stacks-development-stack &&
echo 'Alpine test completed'
"

# Ubuntu (full-featured)
docker run --rm ubuntu sh -c "
apt-get update && apt-get install -y nodejs npm &&
npm install -g claude-stacks &&
claude-stacks install commands-com/claude-stacks-development-stack &&
echo 'Ubuntu test completed'
"

# Node.js official image
docker run --rm node:18-alpine sh -c "
npm install -g claude-stacks &&
claude-stacks install commands-com/claude-stacks-development-stack &&
echo 'Node.js official image test completed'
"
```

## Advanced Testing Patterns

### Performance Testing

```bash
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm time &&
npm install -g claude-stacks &&
mkdir -p /test-project && cd /test-project &&

echo '=== Performance test - Installation time ===' &&
time claude-stacks install commands-com/claude-stacks-development-stack &&

echo '=== Performance test - File operations ===' &&
time ls -la .claude/ &&
time cat ~/.claude.json > /dev/null
"
```

### Memory Usage Testing

```bash
docker run --rm --memory=512m alpine sh -c "
apk add --no-cache nodejs npm &&
npm install -g claude-stacks &&
mkdir -p /test-project && cd /test-project &&

echo '=== Testing with memory constraints ===' &&
claude-stacks install commands-com/claude-stacks-development-stack &&
echo 'Memory-constrained test completed'
"
```

### Concurrent Installation Testing

```bash
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&
npm install -g claude-stacks &&

echo '=== Testing concurrent installations ===' &&
mkdir -p /project1 && cd /project1 &&
claude-stacks install commands-com/claude-stacks-development-stack &
PID1=\$! &&

mkdir -p /project2 && cd /project2 &&
claude-stacks install commands-com/claude-stacks-development-stack &
PID2=\$! &&

wait \$PID1 && echo 'Project 1 completed' &&
wait \$PID2 && echo 'Project 2 completed' &&

echo '=== Verifying both installations ===' &&
ls /project1/.claude/ && ls /project2/.claude/
"
```

## Troubleshooting

### Common Issues

1. **Node.js Version Incompatibility**

   ```bash
   # Test with specific Node.js version
   docker run --rm node:18-alpine sh -c "
   npm install -g claude-stacks &&
   claude-stacks install commands-com/claude-stacks-development-stack
   "
   ```

2. **Network Connectivity Issues**

   ```bash
   # Test with network diagnostics
   docker run --rm alpine sh -c "
   apk add --no-cache nodejs npm curl &&
   curl -I https://registry.npmjs.org/ &&
   npm install -g claude-stacks
   "
   ```

3. **File Permission Problems**
   ```bash
   # Test with explicit permissions
   docker run --rm alpine sh -c "
   apk add --no-cache nodejs npm &&
   npm install -g claude-stacks &&
   mkdir -p /test-project && chmod 755 /test-project &&
   cd /test-project &&
   claude-stacks install commands-com/claude-stacks-development-stack
   "
   ```

### Debug Commands

```bash
# Enable verbose logging
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm &&
npm install -g claude-stacks &&
mkdir -p /test-project && cd /test-project &&
DEBUG=claude-stacks:* claude-stacks install commands-com/claude-stacks-development-stack
"

# Inspect created files
docker run --rm alpine sh -c "
apk add --no-cache nodejs npm jq &&
npm install -g claude-stacks &&
mkdir -p /test-project && cd /test-project &&
claude-stacks install commands-com/claude-stacks-development-stack &&
echo '=== File inspection ===' &&
find .claude -type f -exec echo 'File: {}' \; -exec head -5 {} \; -exec echo '---' \;
"
```

## Best Practices

### 1. Test Isolation

- Always use `--rm` flag to remove containers after testing
- Use fresh containers for each test scenario
- Don't rely on previous test state

### 2. Comprehensive Validation

```bash
# Always validate multiple aspects
echo '=== Comprehensive validation template ===' &&
test -d .claude && echo '✅ .claude directory created' || echo '❌ .claude directory missing' &&
test -f .claude/settings.local.json && echo '✅ Settings file created' || echo '❌ Settings file missing' &&
test -d .claude/commands && echo '✅ Commands directory created' || echo '❌ Commands directory missing' &&
test -f ~/.claude.json && echo '✅ Global config created' || echo '❌ Global config missing' &&
ls .claude/commands/ | wc -l | xargs echo 'Commands count:' &&
ls .claude/agents/ | wc -l | xargs echo 'Agents count:'
```

### 3. Error Detection

```bash
# Capture and analyze errors
claude-stacks install commands-com/claude-stacks-development-stack 2>&1 | tee install.log &&
grep -i error install.log && echo '❌ Errors found' || echo '✅ No errors detected' &&
grep -i warning install.log && echo '⚠️ Warnings found' || echo '✅ No warnings'
```

### 4. Version Testing Matrix

Create a test matrix for different versions:

```bash
#!/bin/bash
versions=("1.3.0" "1.3.1" "1.3.2" "latest")
for version in "${versions[@]}"; do
  echo "Testing version $version"
  docker run --rm alpine sh -c "
    apk add --no-cache nodejs npm &&
    npm install -g claude-stacks@$version &&
    mkdir -p /test && cd /test &&
    claude-stacks install commands-com/claude-stacks-development-stack &&
    echo 'Version $version: SUCCESS'
  " || echo "Version $version: FAILED"
done
```

### 5. Automated Test Execution

```bash
#!/bin/bash
# run-docker-tests.sh

set -e

echo "Starting Docker test suite..."

# Test 1: Fresh installation
echo "=== Test 1: Fresh Installation ==="
docker run --rm alpine sh -c "$(cat tests/docker/fresh-install.sh)"

# Test 2: Merge functionality
echo "=== Test 2: Merge Functionality ==="
docker run --rm alpine sh -c "$(cat tests/docker/merge-test.sh)"

# Test 3: Overwrite functionality
echo "=== Test 3: Overwrite Functionality ==="
docker run --rm alpine sh -c "$(cat tests/docker/overwrite-test.sh)"

echo "All Docker tests completed successfully!"
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Docker Integration Tests

on: [push, pull_request]

jobs:
  docker-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['16', '18', '20']
        base-image: ['alpine', 'ubuntu:latest']

    steps:
      - uses: actions/checkout@v3

      - name: Run Docker tests
        run: |
          docker run --rm ${{ matrix.base-image }} sh -c "
            if command -v apk > /dev/null; then
              apk add --no-cache nodejs npm
            else
              apt-get update && apt-get install -y nodejs npm
            fi &&
            npm install -g claude-stacks@latest &&
            mkdir -p /test && cd /test &&
            claude-stacks install commands-com/claude-stacks-development-stack
          "
```

This comprehensive Docker testing approach ensures that claude-stacks works reliably across different environments and usage scenarios, providing confidence in releases and catching issues before they reach users.
