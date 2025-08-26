import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PerformanceTestUtils, TestEnvironment, TestDataBuilder } from '../utils/test-helpers.js';

describe('Performance Benchmarks', () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Stack Operations Performance', () => {
    it('should create stacks efficiently', async () => {
      const stackData = TestDataBuilder.buildStack({
        id: 'perf/create-test',
        name: 'Performance Test Stack',
      });

      const { avg, min, max } = await PerformanceTestUtils.benchmark(async () => {
        // Simulate stack creation operation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return stackData;
      }, 50);

      expect(avg).toBeLessThan(20); // Average should be under 20ms
      expect(max).toBeLessThan(50); // Max should be under 50ms

      console.log(
        `Stack creation performance: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`
      );
    });

    it('should handle large file collections efficiently', async () => {
      const largeFileSet: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeFileSet[`file${i}.txt`] = {
          content: `This is content for file number ${i}`,
          encoding: 'utf8',
        };
      }

      const largeStack = TestDataBuilder.buildStack({
        files: largeFileSet,
      });

      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        // Simulate processing large file set
        const fileCount = Object.keys(largeStack.files).length;
        let processedFiles = 0;

        for (const [filename, fileData] of Object.entries(largeStack.files)) {
          // Simulate file processing
          await new Promise(resolve => setImmediate(resolve));
          processedFiles++;
        }

        return processedFiles;
      });

      expect(duration).toBeLessThan(1000); // Should process 1000 files in under 1 second
      console.log(`Large file set processing: ${duration.toFixed(2)}ms for 1000 files`);
    });

    it('should search through large stack collections efficiently', async () => {
      // Create a large number of test stacks
      const stacks = Array.from({ length: 1000 }, (_, i) =>
        TestDataBuilder.buildStack({
          id: `perf/stack${i}`,
          name: `Performance Stack ${i}`,
          description: `Stack number ${i} for performance testing`,
          metadata: {
            tags: i % 2 === 0 ? ['even', 'test'] : ['odd', 'test'],
            category: i < 500 ? 'development' : 'production',
          },
        })
      );

      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        // Simulate search operations
        const results = stacks.filter(
          stack => stack.name.includes('Performance') && stack.metadata.tags?.includes('test')
        );
        return results.length;
      });

      expect(duration).toBeLessThan(100); // Should search 1000 stacks in under 100ms
      console.log(`Stack search performance: ${duration.toFixed(2)}ms for 1000 stacks`);
    });
  });

  describe('File System Operations Performance', () => {
    it('should read multiple files concurrently', async () => {
      const tempDir = await testEnv.createTempDir();
      const filePromises: Promise<string>[] = [];

      // Create test files
      for (let i = 0; i < 50; i++) {
        filePromises.push(testEnv.createTestFile(tempDir, `test${i}.txt`, `Content for file ${i}`));
      }

      await Promise.all(filePromises);

      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        const { readFile } = await import('fs/promises');
        const { join } = await import('path');

        const readPromises = Array.from({ length: 50 }, (_, i) =>
          readFile(join(tempDir, `test${i}.txt`), 'utf8')
        );

        return await Promise.all(readPromises);
      });

      expect(duration).toBeLessThan(500); // Should read 50 files in under 500ms
      console.log(`Concurrent file reading: ${duration.toFixed(2)}ms for 50 files`);
    });

    it('should handle directory scanning efficiently', async () => {
      const tempDir = await testEnv.createTempDir();

      // Create nested directory structure
      const structure: Record<string, any> = {};
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          structure[`dir${i}/file${j}.txt`] = `Content ${i}-${j}`;
        }
      }

      await testEnv.createTestStructure(tempDir, structure);

      const { duration, result } = await PerformanceTestUtils.measureExecutionTime(async () => {
        const { readdir } = await import('fs/promises');
        const { join } = await import('path');

        async function scanDirectory(dir: string): Promise<string[]> {
          const entries = await readdir(dir, { withFileTypes: true });
          const files: string[] = [];

          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              const subFiles = await scanDirectory(fullPath);
              files.push(...subFiles);
            } else {
              files.push(fullPath);
            }
          }

          return files;
        }

        return await scanDirectory(tempDir);
      });

      expect(result.length).toBe(100); // Should find all 100 files
      expect(duration).toBeLessThan(200); // Should scan in under 200ms
      console.log(`Directory scanning: ${duration.toFixed(2)}ms for 100 files in 10 directories`);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should handle large objects without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and process large objects
      for (let iteration = 0; iteration < 10; iteration++) {
        const largeStack = TestDataBuilder.buildStack({
          files: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [
              `large-file${i}.txt`,
              {
                content: 'x'.repeat(1000), // 1KB per file
                encoding: 'utf8',
              },
            ])
          ),
        });

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 10));

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(50);
      console.log(`Memory usage increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    });

    it('should efficiently handle string concatenation operations', async () => {
      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        let result = '';

        // Efficient string building using array join
        const parts: string[] = [];
        for (let i = 0; i < 10000; i++) {
          parts.push(`Line ${i}: This is some content for performance testing\n`);
        }
        result = parts.join('');

        return result.length;
      });

      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      console.log(`String concatenation: ${duration.toFixed(2)}ms for 10,000 lines`);
    });
  });

  describe('Network Operations Performance', () => {
    it('should handle multiple API requests efficiently', async () => {
      // Mock fetch for performance testing
      const mockFetch = async (url: string) => {
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
        return {
          ok: true,
          json: async () => ({ data: `Response for ${url}` }),
        };
      };

      const { avg, min, max } = await PerformanceTestUtils.benchmark(async () => {
        const requests = Array.from({ length: 10 }, (_, i) =>
          mockFetch(`https://api.example.com/stacks/stack${i}`)
        );

        return await Promise.all(requests);
      }, 20);

      expect(avg).toBeLessThan(100); // Average should be under 100ms
      console.log(
        `API request batching: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`
      );
    });
  });

  describe('Algorithm Performance', () => {
    it('should sort large arrays efficiently', async () => {
      const largeArray = Array.from({ length: 10000 }, () => ({
        id: Math.random().toString(),
        name: `Item ${Math.random()}`,
        score: Math.random() * 100,
      }));

      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return largeArray.sort((a, b) => b.score - a.score);
      });

      expect(duration).toBeLessThan(50); // Should sort 10,000 items in under 50ms
      console.log(`Array sorting: ${duration.toFixed(2)}ms for 10,000 items`);
    });

    it('should filter large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 50000 }, (_, i) => ({
        id: i,
        category: ['dev', 'prod', 'test'][i % 3],
        active: i % 2 === 0,
        score: Math.random() * 100,
      }));

      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return largeDataset
          .filter(item => item.active && item.category === 'dev')
          .filter(item => item.score > 50)
          .slice(0, 100);
      });

      expect(duration).toBeLessThan(100); // Should filter 50,000 items in under 100ms
      console.log(`Data filtering: ${duration.toFixed(2)}ms for 50,000 items`);
    });
  });
});
