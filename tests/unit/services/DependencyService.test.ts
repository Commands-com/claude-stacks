import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import type { StackMcpServer, MissingDependency } from '../../../src/types/index.js';

// Mock the dependencies utilities before importing DependencyService
const mockCheckMcpDependencies = jest.fn();
const mockDisplayMissingDependencies = jest.fn();

jest.mock('../../../src/utils/dependencies.ts', () => ({
  checkMcpDependencies: mockCheckMcpDependencies,
  displayMissingDependencies: mockDisplayMissingDependencies,
}));

// Import DependencyService after setting up mocks
import { DependencyService } from '../../../src/services/DependencyService.js';

describe('DependencyService', () => {
  let dependencyService: DependencyService;

  const mockMcpServers: StackMcpServer[] = [
    {
      name: 'test-server-1',
      type: 'stdio',
      command: 'node',
      args: ['server1.js'],
    },
    {
      name: 'test-server-2', 
      type: 'stdio',
      command: 'python',
      args: ['server2.py'],
    },
    {
      name: 'test-server-3',
      type: 'sse',
      url: 'http://localhost:3000',
    },
  ];

  const mockMissingDependencies: MissingDependency[] = [
    {
      command: 'python',
      servers: ['test-server-2'],
      installInstructions: 'Install Python from python.org',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockCheckMcpDependencies.mockReset();
    mockDisplayMissingDependencies.mockReset();
    
    dependencyService = new DependencyService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('checkMcpDependencies', () => {
    it('should call checkMcpDependencies utility and return result', async () => {
      mockCheckMcpDependencies.mockResolvedValue(mockMissingDependencies);

      const result = await dependencyService.checkMcpDependencies(mockMcpServers);

      expect(mockCheckMcpDependencies).toHaveBeenCalledWith(mockMcpServers);
      expect(result).toEqual(mockMissingDependencies);
    });

    it('should return empty array when all dependencies are satisfied', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.checkMcpDependencies(mockMcpServers);

      expect(mockCheckMcpDependencies).toHaveBeenCalledWith(mockMcpServers);
      expect(result).toEqual([]);
    });

    it('should handle empty MCP servers array', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.checkMcpDependencies([]);

      expect(mockCheckMcpDependencies).toHaveBeenCalledWith([]);
      expect(result).toEqual([]);
    });

    it('should propagate errors from checkMcpDependencies utility', async () => {
      const error = new Error('Dependency check failed');
      mockCheckMcpDependencies.mockRejectedValue(error);

      await expect(
        dependencyService.checkMcpDependencies(mockMcpServers)
      ).rejects.toThrow('Dependency check failed');
    });
  });

  describe('displayMissingDependencies', () => {
    it('should call displayMissingDependencies utility', () => {
      dependencyService.displayMissingDependencies(mockMissingDependencies);

      expect(mockDisplayMissingDependencies).toHaveBeenCalledWith(mockMissingDependencies);
    });

    it('should handle empty missing dependencies array', () => {
      dependencyService.displayMissingDependencies([]);

      expect(mockDisplayMissingDependencies).toHaveBeenCalledWith([]);
    });

    it('should handle multiple missing dependencies', () => {
      const multipleMissing: MissingDependency[] = [
        ...mockMissingDependencies,
        {
          command: 'node',
          servers: ['test-server-1'],
          installInstructions: 'Install Node.js from nodejs.org',
        },
      ];

      dependencyService.displayMissingDependencies(multipleMissing);

      expect(mockDisplayMissingDependencies).toHaveBeenCalledWith(multipleMissing);
    });
  });

  describe('checkAndDisplayMissingDependencies', () => {
    it('should return true when no dependencies are missing', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.checkAndDisplayMissingDependencies(mockMcpServers);

      expect(result).toBe(true);
      expect(mockCheckMcpDependencies).toHaveBeenCalledWith(mockMcpServers);
      expect(mockDisplayMissingDependencies).not.toHaveBeenCalled();
    });

    it('should return false and display missing dependencies when some are missing', async () => {
      mockCheckMcpDependencies.mockResolvedValue(mockMissingDependencies);

      const result = await dependencyService.checkAndDisplayMissingDependencies(mockMcpServers);

      expect(result).toBe(false);
      expect(mockCheckMcpDependencies).toHaveBeenCalledWith(mockMcpServers);
      expect(mockDisplayMissingDependencies).toHaveBeenCalledWith(mockMissingDependencies);
    });

    it('should handle dependency check errors', async () => {
      const error = new Error('Check failed');
      mockCheckMcpDependencies.mockRejectedValue(error);

      await expect(
        dependencyService.checkAndDisplayMissingDependencies(mockMcpServers)
      ).rejects.toThrow('Check failed');
    });
  });

  describe('getDependencySummary', () => {
    it('should return correct summary when no dependencies are missing', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.getDependencySummary(mockMcpServers);

      expect(result).toEqual({
        total: 3,
        missing: 0,
        satisfied: 3,
        missingDependencies: [],
      });
    });

    it('should return correct summary when some dependencies are missing', async () => {
      mockCheckMcpDependencies.mockResolvedValue(mockMissingDependencies);

      const result = await dependencyService.getDependencySummary(mockMcpServers);

      expect(result).toEqual({
        total: 3,
        missing: 1,
        satisfied: 2,
        missingDependencies: mockMissingDependencies,
      });
    });

    it('should handle empty MCP servers array', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.getDependencySummary([]);

      expect(result).toEqual({
        total: 0,
        missing: 0,
        satisfied: 0,
        missingDependencies: [],
      });
    });

    it('should handle all dependencies missing', async () => {
      const allMissing: MissingDependency[] = [
        {
          command: 'node',
          servers: ['test-server-1'],
          installInstructions: 'Install Node.js',
        },
        {
          command: 'python', 
          servers: ['test-server-2'],
          installInstructions: 'Install Python',
        },
      ];

      mockCheckMcpDependencies.mockResolvedValue(allMissing);

      const result = await dependencyService.getDependencySummary(mockMcpServers);

      expect(result).toEqual({
        total: 3,
        missing: 2,
        satisfied: 1,
        missingDependencies: allMissing,
      });
    });
  });

  describe('areAllDependenciesSatisfied', () => {
    it('should return true when no dependencies are missing', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.areAllDependenciesSatisfied(mockMcpServers);

      expect(result).toBe(true);
      expect(mockCheckMcpDependencies).toHaveBeenCalledWith(mockMcpServers);
    });

    it('should return false when some dependencies are missing', async () => {
      mockCheckMcpDependencies.mockResolvedValue(mockMissingDependencies);

      const result = await dependencyService.areAllDependenciesSatisfied(mockMcpServers);

      expect(result).toBe(false);
      expect(mockCheckMcpDependencies).toHaveBeenCalledWith(mockMcpServers);
    });

    it('should handle empty MCP servers array', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.areAllDependenciesSatisfied([]);

      expect(result).toBe(true);
    });

    it('should propagate errors from dependency check', async () => {
      const error = new Error('Dependency check failed');
      mockCheckMcpDependencies.mockRejectedValue(error);

      await expect(
        dependencyService.areAllDependenciesSatisfied(mockMcpServers)
      ).rejects.toThrow('Dependency check failed');
    });
  });

  describe('getMissingDependencyNames', () => {
    it('should return empty array when no dependencies are missing', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.getMissingDependencyNames(mockMcpServers);

      expect(result).toEqual([]);
    });

    it('should return command names of missing dependencies', async () => {
      mockCheckMcpDependencies.mockResolvedValue(mockMissingDependencies);

      const result = await dependencyService.getMissingDependencyNames(mockMcpServers);

      expect(result).toEqual(['python']);
    });

    it('should return multiple missing dependency names', async () => {
      const multipleMissing: MissingDependency[] = [
        {
          command: 'python',
          servers: ['test-server-2'],
          installInstructions: 'Install Python',
        },
        {
          command: 'ruby',
          servers: ['test-server-3'],
          installInstructions: 'Install Ruby',
        },
      ];

      mockCheckMcpDependencies.mockResolvedValue(multipleMissing);

      const result = await dependencyService.getMissingDependencyNames(mockMcpServers);

      expect(result).toEqual(['python', 'ruby']);
    });

    it('should handle empty MCP servers array', async () => {
      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.getMissingDependencyNames([]);

      expect(result).toEqual([]);
    });

    it('should propagate errors from dependency check', async () => {
      const error = new Error('Dependency check failed');
      mockCheckMcpDependencies.mockRejectedValue(error);

      await expect(
        dependencyService.getMissingDependencyNames(mockMcpServers)
      ).rejects.toThrow('Dependency check failed');
    });
  });

  describe('integration tests', () => {
    it('should handle complex MCP server configurations', async () => {
      const complexServers: StackMcpServer[] = [
        {
          name: 'local-server',
          type: 'stdio',
          command: 'node',
          args: ['./local-server.js'],
        },
        {
          name: 'remote-server',
          type: 'sse',
          url: 'https://remote.example.com/mcp',
        },
        {
          name: 'python-server',
          type: 'stdio',
          command: 'python3',
          args: ['-m', 'my_mcp_server'],
        },
      ];

      mockCheckMcpDependencies.mockResolvedValue([
        {
          command: 'python3',
          servers: ['python-server'],
          installInstructions: 'Install Python 3',
        },
      ]);

      const summary = await dependencyService.getDependencySummary(complexServers);
      const satisfied = await dependencyService.areAllDependenciesSatisfied(complexServers);
      const missingNames = await dependencyService.getMissingDependencyNames(complexServers);

      expect(summary.total).toBe(3);
      expect(summary.missing).toBe(1);
      expect(summary.satisfied).toBe(2);
      expect(satisfied).toBe(false);
      expect(missingNames).toEqual(['python3']);
    });

    it('should handle edge case with duplicate commands', async () => {
      const duplicateCommandServers: StackMcpServer[] = [
        {
          name: 'server-1',
          type: 'stdio',
          command: 'node',
          args: ['server1.js'],
        },
        {
          name: 'server-2',
          type: 'stdio', 
          command: 'node',
          args: ['server2.js'],
        },
      ];

      mockCheckMcpDependencies.mockResolvedValue([]);

      const result = await dependencyService.areAllDependenciesSatisfied(duplicateCommandServers);

      expect(result).toBe(true);
      expect(mockCheckMcpDependencies).toHaveBeenCalledWith(duplicateCommandServers);
    });
  });
});