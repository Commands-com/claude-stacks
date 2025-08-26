import { describe, it, expect } from '@jest/globals';
import {
  parseVersion,
  formatVersion,
  compareVersions,
  isValidVersion,
  bumpVersion,
  suggestVersionBump,
  generateSuggestedVersion,
  getDefaultVersion,
} from '../../../src/utils/version.js';

describe('Version Utility Functions', () => {
  describe('parseVersion', () => {
    it('should parse valid semantic versions', () => {
      expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
      expect(parseVersion('0.0.1')).toEqual({ major: 0, minor: 0, patch: 1 });
      expect(parseVersion('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30 });
    });

    it('should throw error for invalid versions', () => {
      expect(() => parseVersion('1.2')).toThrow('Invalid version format');
      expect(() => parseVersion('1.2.3.4')).toThrow('Invalid version format');
      expect(() => parseVersion('v1.2.3')).toThrow('Invalid version format');
      expect(() => parseVersion('1.a.3')).toThrow('Invalid version format');
    });

    it('should handle edge cases', () => {
      expect(() => parseVersion('')).toThrow('Invalid version format');
      expect(() => parseVersion('...')).toThrow('Invalid version format');
      expect(() => parseVersion('1..3')).toThrow('Invalid version format');
    });
  });

  describe('formatVersion', () => {
    it('should format version objects to strings', () => {
      expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
      expect(formatVersion({ major: 0, minor: 0, patch: 1 })).toBe('0.0.1');
      expect(formatVersion({ major: 10, minor: 20, patch: 30 })).toBe('10.20.30');
    });
  });

  describe('compareVersions', () => {
    it('should compare versions correctly', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);

      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);

      expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
      expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
    });

    it('should handle complex version comparisons', () => {
      expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
      expect(compareVersions('10.0.0', '2.0.0')).toBe(1);
    });
  });

  describe('isValidVersion', () => {
    it('should validate semantic versions', () => {
      expect(isValidVersion('1.2.3')).toBe(true);
      expect(isValidVersion('0.0.1')).toBe(true);
      expect(isValidVersion('10.20.30')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(isValidVersion('1.2')).toBe(false);
      expect(isValidVersion('1.2.3.4')).toBe(false);
      expect(isValidVersion('v1.2.3')).toBe(false);
      expect(isValidVersion('1.a.3')).toBe(false);
      expect(isValidVersion('')).toBe(false);
    });
  });

  describe('bumpVersion', () => {
    it('should bump patch version', () => {
      expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
      expect(bumpVersion('0.0.1', 'patch')).toBe('0.0.2');
      expect(bumpVersion('1.0.9', 'patch')).toBe('1.0.10');
    });

    it('should bump minor version', () => {
      expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
      expect(bumpVersion('0.0.1', 'minor')).toBe('0.1.0');
      expect(bumpVersion('1.9.5', 'minor')).toBe('1.10.0');
    });

    it('should bump major version', () => {
      expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
      expect(bumpVersion('0.1.2', 'major')).toBe('1.0.0');
      expect(bumpVersion('9.8.7', 'major')).toBe('10.0.0');
    });

    it('should throw error for invalid version or bump type', () => {
      expect(() => bumpVersion('invalid', 'patch')).toThrow();
      expect(() => bumpVersion('1.2.3', 'invalid' as any)).toThrow();
    });
  });

  describe('getDefaultVersion', () => {
    it('should return default version', () => {
      const defaultVersion = getDefaultVersion();
      expect(isValidVersion(defaultVersion)).toBe(true);
      expect(defaultVersion).toBe('1.0.0');
    });
  });

  describe('suggestVersionBump', () => {
    const mockCurrentConfig = {
      name: 'test-stack',
      description: 'test',
      mcpServers: [{ name: 'server1', type: 'stdio' as const }],
      agents: [{ name: 'agent1', type: 'test' }],
      commands: [{ name: 'command1' }],
      settings: { key: 'value' },
    };

    const mockNewConfig = {
      name: 'test-stack',
      description: 'test',
      mcpServers: [
        { name: 'server1', type: 'stdio' as const },
        { name: 'server2', type: 'stdio' as const },
      ],
      agents: [
        { name: 'agent1', type: 'test' },
        { name: 'agent2', type: 'test' },
      ],
      commands: [{ name: 'command1' }, { name: 'command2' }],
      settings: { key: 'new-value', newKey: 'value' },
    };

    it('should suggest major bump for breaking changes', () => {
      const configWithRemovedServer = {
        name: 'test-stack',
        description: 'test',
        mcpServers: [], // Removed all servers
        agents: [{ name: 'agent1', type: 'test' }],
        commands: [{ name: 'command1' }],
        settings: { key: 'value' },
      };

      expect(suggestVersionBump(mockCurrentConfig, configWithRemovedServer)).toBe('major');
    });

    it('should suggest minor bump for new features', () => {
      expect(suggestVersionBump(mockCurrentConfig, mockNewConfig)).toBe('minor');
    });

    it('should suggest patch bump for small changes', () => {
      const configWithSettingChange = {
        ...mockCurrentConfig,
        settings: { key: 'updated-value' },
      };

      expect(suggestVersionBump(mockCurrentConfig, configWithSettingChange)).toBe('patch');
    });

    it('should handle identical configurations', () => {
      expect(suggestVersionBump(mockCurrentConfig, mockCurrentConfig)).toBe('patch');
    });
  });

  describe('generateSuggestedVersion', () => {
    it('should generate suggested version based on changes', () => {
      const currentConfig = {
        name: 'test-stack',
        description: 'test',
        mcpServers: [{ name: 'server1', type: 'stdio' as const }],
        agents: [] as any[],
        commands: [] as any[],
        settings: {},
      };

      const newConfig = {
        name: 'test-stack',
        description: 'test',
        mcpServers: [
          { name: 'server1', type: 'stdio' as const },
          { name: 'server2', type: 'stdio' as const },
        ],
        agents: [{ name: 'agent1', type: 'test' }],
        commands: [{ name: 'command1' }],
        settings: { key: 'value' },
      };

      const result = generateSuggestedVersion('1.0.0', currentConfig, newConfig);
      expect(result).toBe('1.1.0');
    });

    it('should handle invalid current version', () => {
      const result = generateSuggestedVersion(
        'invalid',
        { name: 'test', description: 'test' },
        { name: 'test', description: 'test' }
      );
      expect(result).toBe('1.0.0'); // Should return default version
      expect(isValidVersion(result)).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle version parsing efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        parseVersion(`${i}.${i}.${i}`);
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle version comparison efficiently', () => {
      const versions = Array.from({ length: 100 }, (_, i) => `${i}.0.0`);

      const start = performance.now();
      versions.sort(compareVersions);
      const end = performance.now();

      expect(end - start).toBeLessThan(50); // Should complete within 50ms
    });
  });

  describe('Edge Cases', () => {
    it('should handle version comparison with different number lengths', () => {
      expect(compareVersions('1.10.0', '1.2.0')).toBe(1);
      expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
      expect(compareVersions('10.0.0', '9.99.99')).toBe(1);
    });

    it('should handle zero versions', () => {
      expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
      expect(formatVersion({ major: 0, minor: 0, patch: 0 })).toBe('0.0.0');
      expect(bumpVersion('0.0.0', 'patch')).toBe('0.0.1');
    });
  });
});
