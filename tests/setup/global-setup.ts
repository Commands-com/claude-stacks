import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';

export default async function globalSetup(): Promise<void> {
  // Create temporary directories for test isolation
  const testTmpDir = await mkdtemp(join(tmpdir(), 'claude-stacks-test-'));

  // Store paths in global for cleanup
  (globalThis as any).__TEST_TMP_DIR__ = testTmpDir;

  // Set environment variables for tests
  process.env.CLAUDE_STACKS_TEST_TMP_DIR = testTmpDir;
  process.env.CLAUDE_STACKS_CONFIG_DIR = join(testTmpDir, '.claude-stacks');
  process.env.CLAUDE_STACKS_CACHE_DIR = join(testTmpDir, '.cache');

  console.log('Test setup complete. Temporary directory:', testTmpDir);
}
