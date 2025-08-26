import * as path from 'path';
import * as os from 'os';
import {
  CLAUDE_CONFIG_PATH,
  STACKS_PATH,
  CONFIG_FILE,
  CLAUDE_JSON_PATH,
  AUTH_TOKEN_PATH,
  METADATA_FILE_PATH,
  getStackPath,
  getStackMetadataPath,
  getStackFilesPath,
  getLocalClaudeDir,
  getLocalCommandsDir,
  getLocalAgentsDir,
  getGlobalClaudeMdPath,
  getLocalClaudeMdPath,
  getLocalSettingsPath,
  getGlobalCommandsDir,
  getGlobalAgentsDir,
  getGlobalSettingsPath,
} from '../../../src/constants/paths.js';

// Mock os and path modules
jest.mock('os', () => ({
  homedir: jest.fn(() => '/Users/testuser'),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

describe('Path Constants', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Clear test environment variables to ensure clean test state
    delete process.env.CLAUDE_STACKS_TEST_STACKS_PATH;

    // Reset mocks to default behavior
    (os.homedir as jest.Mock).mockReturnValue('/Users/testuser');
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  describe('Base Path Constants', () => {
    it('should define base constants with expected structure', () => {
      // Test that constants are defined and have expected path structure
      expect(CLAUDE_CONFIG_PATH).toContain('.claude');
      expect(STACKS_PATH).toContain('stacks');
      expect(CONFIG_FILE).toContain('config.json');
      expect(CLAUDE_JSON_PATH).toContain('.claude.json');
      expect(AUTH_TOKEN_PATH).toContain('.claude-stacks-auth.json');
      expect(METADATA_FILE_PATH).toContain('.claude-stacks-meta.json');
    });
  });

  describe('Stack Path Functions', () => {
    it('should get stack path correctly', () => {
      const result = getStackPath('my-stack');

      expect(result).toBe('/Users/testuser/.claude/stacks/my-stack');
      expect(path.join).toHaveBeenCalledWith('/Users/testuser/.claude/stacks', 'my-stack');
    });

    it('should get stack metadata path correctly', () => {
      const result = getStackMetadataPath('my-stack');

      expect(result).toBe('/Users/testuser/.claude/stacks/my-stack/stack.json');
      expect(path.join).toHaveBeenCalledWith(
        '/Users/testuser/.claude/stacks/my-stack',
        'stack.json'
      );
    });

    it('should get stack files path correctly', () => {
      const result = getStackFilesPath('my-stack');

      expect(result).toBe('/Users/testuser/.claude/stacks/my-stack/files');
      expect(path.join).toHaveBeenCalledWith('/Users/testuser/.claude/stacks/my-stack', 'files');
    });

    it('should handle stack names with special characters', () => {
      const result = getStackPath('my-special-stack@v1.0');

      expect(result).toBe('/Users/testuser/.claude/stacks/my-special-stack@v1.0');
      expect(path.join).toHaveBeenCalledWith(
        '/Users/testuser/.claude/stacks',
        'my-special-stack@v1.0'
      );
    });

    it('should handle empty stack name', () => {
      const result = getStackPath('');

      expect(result).toBe('/Users/testuser/.claude/stacks/');
      expect(path.join).toHaveBeenCalledWith('/Users/testuser/.claude/stacks', '');
    });
  });

  describe('Local Path Functions', () => {
    // Mock process.cwd for consistent testing
    const mockCwd = jest.fn(() => '/current/project');
    Object.defineProperty(process, 'cwd', { value: mockCwd });

    beforeEach(() => {
      mockCwd.mockReturnValue('/current/project');
    });

    it('should get local claude directory with default project path', () => {
      const result = getLocalClaudeDir();

      expect(result).toBe('/default/cwd/.claude');
      expect(path.join).toHaveBeenCalledWith('/default/cwd', '.claude');
      expect(process.cwd).toHaveBeenCalled();
    });

    it('should get local claude directory with custom project path', () => {
      const result = getLocalClaudeDir('/custom/project');

      expect(result).toBe('/custom/project/.claude');
      expect(path.join).toHaveBeenCalledWith('/custom/project', '.claude');
      expect(process.cwd).not.toHaveBeenCalled();
    });

    it('should get local commands directory with default path', () => {
      const result = getLocalCommandsDir();

      expect(result).toBe('/default/cwd/.claude/commands');
      expect(path.join).toHaveBeenCalledWith('/default/cwd/.claude', 'commands');
    });

    it('should get local commands directory with custom project path', () => {
      const result = getLocalCommandsDir('/custom/project');

      expect(result).toBe('/custom/project/.claude/commands');
      expect(path.join).toHaveBeenCalledWith('/custom/project/.claude', 'commands');
    });

    it('should get local agents directory with default path', () => {
      const result = getLocalAgentsDir();

      expect(result).toBe('/default/cwd/.claude/agents');
      expect(path.join).toHaveBeenCalledWith('/default/cwd/.claude', 'agents');
    });

    it('should get local agents directory with custom project path', () => {
      const result = getLocalAgentsDir('/custom/project');

      expect(result).toBe('/custom/project/.claude/agents');
      expect(path.join).toHaveBeenCalledWith('/custom/project/.claude', 'agents');
    });

    it('should get local claude md path with default path', () => {
      const result = getLocalClaudeMdPath();

      expect(result).toBe('/default/cwd/.claude/CLAUDE.md');
      expect(path.join).toHaveBeenCalledWith('/default/cwd/.claude', 'CLAUDE.md');
    });

    it('should get local claude md path with custom project path', () => {
      const result = getLocalClaudeMdPath('/custom/project');

      expect(result).toBe('/custom/project/.claude/CLAUDE.md');
      expect(path.join).toHaveBeenCalledWith('/custom/project/.claude', 'CLAUDE.md');
    });

    it('should get local settings path with default path', () => {
      const result = getLocalSettingsPath();

      expect(result).toBe('/default/cwd/.claude/settings.local.json');
      expect(path.join).toHaveBeenCalledWith('/default/cwd/.claude', 'settings.local.json');
    });

    it('should get local settings path with custom project path', () => {
      const result = getLocalSettingsPath('/custom/project');

      expect(result).toBe('/custom/project/.claude/settings.local.json');
      expect(path.join).toHaveBeenCalledWith('/custom/project/.claude', 'settings.local.json');
    });
  });

  describe('Global Path Functions', () => {
    it('should get global claude md path correctly', () => {
      const result = getGlobalClaudeMdPath();

      expect(result).toBe('/Users/testuser/.claude/CLAUDE.md');
      expect(path.join).toHaveBeenCalledWith('/Users/testuser/.claude', 'CLAUDE.md');
    });

    it('should get global commands directory correctly', () => {
      const result = getGlobalCommandsDir();

      expect(result).toBe('/Users/testuser/.claude/commands');
      expect(path.join).toHaveBeenCalledWith('/Users/testuser/.claude', 'commands');
    });

    it('should get global agents directory correctly', () => {
      const result = getGlobalAgentsDir();

      expect(result).toBe('/Users/testuser/.claude/agents');
      expect(path.join).toHaveBeenCalledWith('/Users/testuser/.claude', 'agents');
    });

    it('should get global settings path correctly', () => {
      const result = getGlobalSettingsPath();

      expect(result).toBe('/Users/testuser/.claude/settings.json');
      expect(path.join).toHaveBeenCalledWith('/Users/testuser/.claude', 'settings.json');
    });
  });

  describe('Edge Cases', () => {
    it('should handle different types of stack names', () => {
      const result1 = getStackPath('simple-stack');
      const result2 = getStackPath('org/complex-stack');

      expect(result1).toContain('simple-stack');
      expect(result2).toContain('org/complex-stack');
    });

    it('should handle relative project paths', () => {
      const result = getLocalClaudeDir('./relative/path');

      expect(result).toBe('./relative/path/.claude');
      expect(path.join).toHaveBeenCalledWith('./relative/path', '.claude');
    });

    it('should handle empty string project paths', () => {
      const result = getLocalClaudeDir('');

      expect(result).toBe('/.claude');
      expect(path.join).toHaveBeenCalledWith('', '.claude');
    });

    it('should handle nested stack paths', () => {
      const result = getStackPath('org/nested/stack-name');

      expect(result).toBe('/Users/testuser/.claude/stacks/org/nested/stack-name');
      expect(path.join).toHaveBeenCalledWith(
        '/Users/testuser/.claude/stacks',
        'org/nested/stack-name'
      );
    });
  });

  describe('Function Parameter Defaults', () => {
    const mockCwd = jest.fn(() => '/default/cwd');
    Object.defineProperty(process, 'cwd', { value: mockCwd });

    beforeEach(() => {
      mockCwd.mockReturnValue('/default/cwd');
    });

    it('should use process.cwd() when projectPath is undefined for getLocalClaudeDir', () => {
      const result = getLocalClaudeDir(undefined);

      expect(result).toBe('/default/cwd/.claude');
      expect(mockCwd).toHaveBeenCalled();
    });

    it('should use process.cwd() when projectPath is undefined for getLocalCommandsDir', () => {
      const result = getLocalCommandsDir(undefined);

      expect(result).toBe('/default/cwd/.claude/commands');
      expect(mockCwd).toHaveBeenCalled();
    });

    it('should use process.cwd() when projectPath is undefined for getLocalAgentsDir', () => {
      const result = getLocalAgentsDir(undefined);

      expect(result).toBe('/default/cwd/.claude/agents');
      expect(mockCwd).toHaveBeenCalled();
    });

    it('should use process.cwd() when projectPath is undefined for getLocalClaudeMdPath', () => {
      const result = getLocalClaudeMdPath(undefined);

      expect(result).toBe('/default/cwd/.claude/CLAUDE.md');
      expect(mockCwd).toHaveBeenCalled();
    });

    it('should use process.cwd() when projectPath is undefined for getLocalSettingsPath', () => {
      const result = getLocalSettingsPath(undefined);

      expect(result).toBe('/default/cwd/.claude/settings.local.json');
      expect(mockCwd).toHaveBeenCalled();
    });
  });
});
