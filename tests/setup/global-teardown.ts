import { rm } from 'fs/promises';

export default async function globalTeardown(): Promise<void> {
  const testTmpDir = (globalThis as any).__TEST_TMP_DIR__;

  if (testTmpDir) {
    try {
      await rm(testTmpDir, { recursive: true, force: true });
      console.log('Test cleanup complete. Removed:', testTmpDir);
    } catch (error) {
      console.warn('Failed to cleanup test directory:', testTmpDir, error);
    }
  }

  // Clean up test environment variables
  delete process.env.CLAUDE_STACKS_TEST_STACKS_PATH;
  delete process.env.CLAUDE_STACKS_TEST_TMP_DIR;
  delete process.env.CLAUDE_STACKS_CONFIG_DIR;
  delete process.env.CLAUDE_STACKS_CACHE_DIR;
}
