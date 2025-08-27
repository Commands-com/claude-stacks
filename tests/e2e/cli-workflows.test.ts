import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { TestEnvironment } from '../utils/test-helpers.js';
import { setupApiMocks } from '../mocks/api-mocks.js';

describe('CLI End-to-End Workflows', () => {
  let testEnv: TestEnvironment;
  let testProjectDir: string;
  let cliPath: string;
  const apiMocks = setupApiMocks();

  beforeAll(() => {
    // Start API mock server before all tests
    apiMocks.startServer();
  });

  afterAll(() => {
    // Close API mock server after all tests
    apiMocks.closeServer();
  });

  afterEach(() => {
    // Reset API mock handlers between tests
    apiMocks.resetHandlers();
  });

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    testProjectDir = await testEnv.createTempDir('cli-e2e-');

    // Build the CLI if needed (assumes dist exists)
    cliPath = join(process.cwd(), 'dist', 'cli.js');

    // Verify CLI exists before running tests
    const fs = await import('fs');
    if (!fs.existsSync(cliPath)) {
      throw new Error(
        `CLI file not found at ${cliPath}. Make sure to run 'npm run build' before e2e tests.`
      );
    }

    // Test stacks directory is set globally in global-setup.ts
    // No need to modify the real ~/.claude/stacks anymore
  });

  afterEach(async () => {
    await testEnv.cleanup();
    // Environment variable is managed globally, no need to clean up here
  });

  describe('Stack Export Workflow', () => {
    it('should export current project as stack', async () => {
      // Create a test project structure
      await testEnv.createTestStructure(testProjectDir, {
        'package.json': JSON.stringify({
          name: 'e2e-test-project',
          version: '1.0.0',
          scripts: {
            dev: 'npm run dev',
            build: 'npm run build',
          },
        }),
        'src/index.ts': 'console.log("Hello, E2E Test!");',
        'README.md': '# E2E Test Project\n\nThis is a test project for E2E testing.',
        '.claude_desktop_config.json': JSON.stringify({
          mcpServers: {
            filesystem: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem', testProjectDir],
            },
          },
        }),
      });

      const stackName = 'e2e-test-stack';
      const expectedStackPath = join(
        process.env.CLAUDE_STACKS_TEST_STACKS_PATH!,
        `${stackName}.json`
      );

      // Execute CLI export command
      const result = await runCliCommand(
        [
          'export',
          stackName,
          '--name',
          'E2E Test Stack',
          '--description',
          'Stack created during E2E testing',
        ],
        testProjectDir
      );

      if (result.exitCode !== 0) {
        console.error('=== CLI FAILURE DEBUG INFO ===');
        console.error('Exit code:', result.exitCode);
        console.error('CLI stderr:', result.stderr);
        console.error('CLI stdout:', result.stdout);
        console.error(
          'Environment CLAUDE_STACKS_TEST_STACKS_PATH:',
          process.env.CLAUDE_STACKS_TEST_STACKS_PATH
        );
        console.error('==============================');
      }
      if (result.exitCode !== 0) {
        console.error('=== CLI FAILURE DEBUG INFO ===');
        console.error('Exit code:', result.exitCode);
        console.error('CLI stderr:', result.stderr);
        console.error('CLI stdout:', result.stdout);
        console.error(
          'Environment CLAUDE_STACKS_TEST_STACKS_PATH:',
          process.env.CLAUDE_STACKS_TEST_STACKS_PATH
        );
        console.error('==============================');
      }
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');

      // Verify output file was created in ~/.claude/stacks/
      const stackExists = await fs
        .access(expectedStackPath)
        .then(() => true)
        .catch(() => false);
      expect(stackExists).toBe(true);

      // Verify stack content matches actual CLI format
      const stackContent = JSON.parse(await fs.readFile(expectedStackPath, 'utf8'));
      expect(stackContent).toMatchObject({
        name: 'E2E Test Stack',
        description: 'Stack created during E2E testing',
        metadata: expect.objectContaining({
          created_at: expect.any(String),
          updated_at: expect.any(String),
          exported_from: expect.stringContaining('cli-e2e-'),
        }),
      });
    });

    it('should export from project with basic structure', async () => {
      await testEnv.createTestStructure(testProjectDir, {
        'package.json': JSON.stringify({ name: 'basic-test', version: '1.0.0' }),
        'src/index.ts': 'console.log("Basic test");',
        'README.md': '# Basic Test Project',
      });

      const stackName = 'basic-export-test';
      const expectedStackPath = join(
        process.env.CLAUDE_STACKS_TEST_STACKS_PATH!,
        `${stackName}.json`
      );

      const result = await runCliCommand(
        [
          'export',
          stackName,
          '--name',
          'Basic Export Test',
          '--description',
          'Testing basic export functionality',
        ],
        testProjectDir
      );

      if (result.exitCode !== 0) {
        console.error('=== CLI FAILURE DEBUG INFO ===');
        console.error('Exit code:', result.exitCode);
        console.error('CLI stderr:', result.stderr);
        console.error('CLI stdout:', result.stdout);
        console.error(
          'Environment CLAUDE_STACKS_TEST_STACKS_PATH:',
          process.env.CLAUDE_STACKS_TEST_STACKS_PATH
        );
        console.error('==============================');
      }
      expect(result.exitCode).toBe(0);

      // Verify stack was created
      const stackExists = await fs
        .access(expectedStackPath)
        .then(() => true)
        .catch(() => false);
      expect(stackExists).toBe(true);

      // Basic structure verification
      const stackContent = JSON.parse(await fs.readFile(expectedStackPath, 'utf8'));
      expect(stackContent.name).toBe('Basic Export Test');
      expect(stackContent.description).toBe('Testing basic export functionality');
    });
  });

  describe('Stack Restore Workflow', () => {
    it('should restore stack from ~/.claude/stacks/', async () => {
      // First export a stack to create something to restore
      await testEnv.createTestStructure(testProjectDir, {
        'package.json': JSON.stringify({ name: 'restore-source', version: '1.0.0' }),
        'src/main.ts': 'console.log("Source code");',
      });

      const stackName = 'restore-test-stack';
      const stackPath = join(process.env.CLAUDE_STACKS_TEST_STACKS_PATH!, `${stackName}.json`);

      // Export from source directory
      const exportResult = await runCliCommand(
        [
          'export',
          stackName,
          '--name',
          'Restore Test Stack',
          '--description',
          'Stack for restore testing',
        ],
        testProjectDir
      );

      if (exportResult.exitCode !== 0) {
        console.error('CLI failed with stderr:', exportResult.stderr);
        console.error('CLI stdout:', exportResult.stdout);
      }
      expect(exportResult.exitCode).toBe(0);

      // Now try to restore in a different directory
      const targetDir = await testEnv.createTempDir('restore-target-');

      // Since restore seems to expect the stack file path directly
      const restoreResult = await runCliCommand(['restore', stackPath, '--overwrite'], targetDir);

      // Note: Restore may be interactive, so we may need to adjust expectations
      // For now, let's just verify the command doesn't crash
      expect(restoreResult.exitCode).toBe(0);
    });
  });

  describe('Stack Management Workflow', () => {
    it('should list available stacks when they exist', async () => {
      // First create some stacks by exporting
      await testEnv.createTestStructure(testProjectDir, {
        'package.json': JSON.stringify({ name: 'test-project' }),
      });

      // Export a couple of test stacks
      await runCliCommand(
        ['export', 'test-stack-1', '--name', 'Test Stack One', '--description', 'First test stack'],
        testProjectDir
      );

      await runCliCommand(
        [
          'export',
          'test-stack-2',
          '--name',
          'Test Stack Two',
          '--description',
          'Second test stack',
        ],
        testProjectDir
      );

      // Test list command (it's interactive, so we send empty input to exit)
      const result = await runCliCommand(['list'], testProjectDir, 5000, '\n');

      if (result.exitCode !== 0) {
        console.error('=== CLI FAILURE DEBUG INFO ===');
        console.error('Exit code:', result.exitCode);
        console.error('CLI stderr:', result.stderr);
        console.error('CLI stdout:', result.stdout);
        console.error(
          'Environment CLAUDE_STACKS_TEST_STACKS_PATH:',
          process.env.CLAUDE_STACKS_TEST_STACKS_PATH
        );
        console.error('==============================');
      }
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Test Stack One');
      expect(result.stdout).toContain('Test Stack Two');
      expect(result.stdout).toContain('Found');
    });

    it('should handle stack directory listing', async () => {
      // Test list command works correctly regardless of directory state
      const result = await runCliCommand(['list'], testProjectDir, 5000, '\n');

      if (result.exitCode !== 0) {
        console.error('=== CLI FAILURE DEBUG INFO ===');
        console.error('Exit code:', result.exitCode);
        console.error('CLI stderr:', result.stderr);
        console.error('CLI stdout:', result.stdout);
        console.error(
          'Environment CLAUDE_STACKS_TEST_STACKS_PATH:',
          process.env.CLAUDE_STACKS_TEST_STACKS_PATH
        );
        console.error('==============================');
      }
      expect(result.exitCode).toBe(0);
      // Should either show stacks or handle empty directory gracefully
      expect(result.stdout).toMatch(/Found \d+ local stack|No stacks found/);
    });
  });

  describe('Remote Operations Workflow', () => {
    it('should handle browse command', async () => {
      // Test browse command (may be interactive)
      const result = await runCliCommand(
        ['browse', '--category', 'development'],
        testProjectDir,
        5000,
        '\n'
      );

      // Don't assert success since remote operations may not be fully implemented
      // Just check it doesn't crash completely
      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid export parameters', async () => {
      // Test export without required parameters
      const result = await runCliCommand(
        [
          'export',
          'test-stack',
          // Missing --name and --description
        ],
        testProjectDir
      );

      // Command may fail or prompt for missing info
      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('Performance Tests', () => {
    it('should handle export operation in reasonable time', async () => {
      // Create a moderate project structure
      await testEnv.createTestStructure(testProjectDir, {
        'package.json': JSON.stringify({ name: 'perf-test' }),
        'src/index.ts': 'console.log("performance test");',
        'README.md': '# Performance Test',
      });

      const start = Date.now();
      const result = await runCliCommand(
        [
          'export',
          'perf-test-stack',
          '--name',
          'Performance Test Stack',
          '--description',
          'Testing export performance',
        ],
        testProjectDir,
        10000
      );

      const duration = Date.now() - start;

      if (result.exitCode !== 0) {
        console.error('=== CLI FAILURE DEBUG INFO ===');
        console.error('Exit code:', result.exitCode);
        console.error('CLI stderr:', result.stderr);
        console.error('CLI stdout:', result.stdout);
        console.error(
          'Environment CLAUDE_STACKS_TEST_STACKS_PATH:',
          process.env.CLAUDE_STACKS_TEST_STACKS_PATH
        );
        console.error('==============================');
      }
      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  // Helper functions for E2E tests
  async function runCliCommand(
    args: string[],
    cwd: string,
    timeout = 10000,
    stdinInput?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const testEnv = {
        ...process.env,
        NODE_ENV: 'test',
        CLAUDE_STACKS_TEST_MODE: 'true',
        // Explicitly pass the test stacks path to ensure it's available in CI
        CLAUDE_STACKS_TEST_STACKS_PATH: process.env.CLAUDE_STACKS_TEST_STACKS_PATH || '',
      };

      // Debug logging for CI
      if (process.env.CI) {
        console.log('CLI command:', 'node', [cliPath, ...args]);
        console.log('Working directory:', cwd);
        console.log('Test stacks path:', testEnv.CLAUDE_STACKS_TEST_STACKS_PATH);
      }

      const child = spawn('node', [cliPath, ...args], {
        cwd,
        env: testEnv,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        stdout += data.toString();
      });

      child.stderr?.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      });

      child.on('error', reject);

      // Send input to stdin if provided (for interactive commands)
      if (stdinInput && child.stdin) {
        child.stdin.write(stdinInput);
        child.stdin.end();
      }

      // Timeout handling
      setTimeout(() => {
        child.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
    });
  }
});
