import {
  isLocalPath,
  isCommonExecutable,
  sanitizePath,
  sanitizeArgs,
  sanitizeEnvVars,
  sanitizeCommand,
  sanitizeMcpServer,
  sanitizeMcpServers,
  containsSensitiveData,
  getSanitizationSummary,
} from '../../../src/utils/sanitize.js';

import type { StackMcpServer } from '../../../src/types/index.js';

describe('sanitize utilities', () => {
  describe('isLocalPath', () => {
    it('should detect absolute Unix paths', () => {
      expect(isLocalPath('/usr/local/bin/node')).toBe(true);
      expect(isLocalPath('/Users/johndoe/project/script.js')).toBe(true);
      expect(isLocalPath('/home/user/app.py')).toBe(true);
    });

    it('should detect absolute Windows paths', () => {
      expect(isLocalPath('C:\\Program Files\\nodejs\\node.exe')).toBe(true);
      expect(isLocalPath('D:\\Projects\\app\\index.js')).toBe(true);
    });

    it('should detect relative paths', () => {
      expect(isLocalPath('./script.js')).toBe(true);
      expect(isLocalPath('../config/settings.json')).toBe(true);
      expect(isLocalPath('./../app.py')).toBe(true);
    });

    it('should detect paths with user directories', () => {
      expect(isLocalPath('/Users/john/Documents/config.json')).toBe(true);
      expect(isLocalPath('/home/john/project/script.py')).toBe(true);
      expect(isLocalPath('C:\\Users\\John\\Desktop\\app.js')).toBe(true);
    });

    it('should detect paths with script extensions', () => {
      expect(isLocalPath('script.js')).toBe(true);
      expect(isLocalPath('config.json')).toBe(true);
      expect(isLocalPath('app.py')).toBe(true);
      expect(isLocalPath('setup.sh')).toBe(true);
    });

    it('should NOT detect command flags', () => {
      expect(isLocalPath('-i')).toBe(false);
      expect(isLocalPath('--interactive')).toBe(false);
      expect(isLocalPath('--rm')).toBe(false);
      expect(isLocalPath('-e')).toBe(false);
    });

    it('should NOT detect URLs', () => {
      expect(isLocalPath('https://example.com')).toBe(false);
      expect(isLocalPath('http://localhost:3000')).toBe(false);
    });

    it('should NOT detect Docker images', () => {
      expect(isLocalPath('mcp/cyreslab-ai-shodan:latest')).toBe(false);
      expect(isLocalPath('ubuntu:20.04')).toBe(false);
      expect(isLocalPath('registry.com/myapp:v1.0')).toBe(false);
    });

    it('should NOT detect common commands', () => {
      expect(isLocalPath('node')).toBe(false);
      expect(isLocalPath('python')).toBe(false);
      expect(isLocalPath('run')).toBe(false);
      expect(isLocalPath('install')).toBe(false);
    });

    it('should NOT detect environment variable names', () => {
      expect(isLocalPath('SHODAN_API_KEY')).toBe(false);
      expect(isLocalPath('NODE_ENV')).toBe(false);
      expect(isLocalPath('$HOME')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isLocalPath('')).toBe(false);
      expect(isLocalPath(' ')).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isLocalPath(null)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isLocalPath(undefined)).toBe(false);
    });
  });

  describe('isCommonExecutable', () => {
    it('should detect common Node.js paths', () => {
      expect(isCommonExecutable('/usr/bin/node')).toBe(true);
      expect(isCommonExecutable('/usr/local/bin/node')).toBe(true);
      expect(isCommonExecutable('/opt/homebrew/bin/node')).toBe(true);
      expect(isCommonExecutable('C:\\Program Files\\nodejs\\node.exe')).toBe(true);
    });

    it('should detect common Python paths', () => {
      expect(isCommonExecutable('/usr/bin/python')).toBe(true);
      expect(isCommonExecutable('/usr/bin/python3')).toBe(true);
      expect(isCommonExecutable('/usr/local/bin/python')).toBe(true);
    });

    it('should NOT detect other paths', () => {
      expect(isCommonExecutable('/Users/john/script.js')).toBe(false);
      expect(isCommonExecutable('/custom/app/binary')).toBe(false);
    });
  });

  describe('sanitizePath', () => {
    it('should map common executables to generic commands', () => {
      expect(sanitizePath('/usr/bin/node')).toBe('node');
      expect(sanitizePath('/usr/local/bin/python3')).toBe('python3');
      expect(sanitizePath('C:\\Program Files\\nodejs\\node.exe')).toBe('node');
    });

    it('should create generic placeholders for script files', () => {
      expect(sanitizePath('/Users/john/project/app.js')).toBe('/path/to/app.js');
      expect(sanitizePath('/home/user/config.json')).toBe('/path/to/config.json');
      expect(sanitizePath('C:\\Projects\\script.py')).toBe('/path/to/script.py');
    });

    it('should handle files without extensions', () => {
      expect(sanitizePath('/usr/local/bin/myapp')).toBe('/path/to/myapp');
      expect(sanitizePath('/Users/john/Documents/README')).toBe('/path/to/README');
    });

    it('should handle relative paths', () => {
      expect(sanitizePath('./config.json')).toBe('/path/to/config.json');
      expect(sanitizePath('../app.js')).toBe('/path/to/app.js');
    });

    it('should return original value for non-string inputs', () => {
      expect(sanitizePath('')).toBe('');
      // @ts-expect-error Testing invalid input
      expect(sanitizePath(null)).toBe(null);
      // @ts-expect-error Testing invalid input
      expect(sanitizePath(undefined)).toBe(undefined);
    });
  });

  describe('sanitizeArgs', () => {
    it('should sanitize paths in args while preserving commands', () => {
      const input = [
        'run',
        '-i',
        '--rm',
        '/Users/john/script.js',
        '-e',
        'API_KEY',
        'mcp/app:latest',
      ];

      const expected = [
        'run',
        '-i',
        '--rm',
        '/path/to/script.js',
        '-e',
        'API_KEY',
        'mcp/app:latest',
      ];

      expect(sanitizeArgs(input)).toEqual(expected);
    });

    it('should handle undefined and empty arrays', () => {
      expect(sanitizeArgs(undefined)).toBe(undefined);
      expect(sanitizeArgs([])).toEqual([]);
    });

    it('should handle non-array input gracefully', () => {
      // @ts-expect-error Testing invalid input
      expect(sanitizeArgs('not-an-array')).toBe('not-an-array');
    });
  });

  describe('sanitizeEnvVars', () => {
    it('should sanitize file paths in environment variables', () => {
      const input = {
        GOOGLE_OAUTH_CREDENTIALS: '/Users/john/client_secret.json',
        CONFIG_PATH: './config/app.yaml',
        API_KEY: 'secret123',
        NODE_ENV: 'production',
      };

      const expected = {
        GOOGLE_OAUTH_CREDENTIALS: '/path/to/client_secret.json',
        CONFIG_PATH: '/path/to/app.yaml',
        API_KEY: 'secret123',
        NODE_ENV: 'production',
      };

      expect(sanitizeEnvVars(input)).toEqual(expected);
    });

    it('should handle undefined and empty objects', () => {
      expect(sanitizeEnvVars(undefined)).toBe(undefined);
      expect(sanitizeEnvVars({})).toEqual({});
    });

    it('should handle non-object input gracefully', () => {
      // @ts-expect-error Testing invalid input
      expect(sanitizeEnvVars('not-an-object')).toBe('not-an-object');
    });
  });

  describe('sanitizeCommand', () => {
    it('should sanitize command paths', () => {
      expect(sanitizeCommand('/usr/bin/node')).toBe('node');
      expect(sanitizeCommand('/Users/john/app/server.js')).toBe('/path/to/server.js');
    });

    it('should preserve non-path commands', () => {
      expect(sanitizeCommand('node')).toBe('node');
      expect(sanitizeCommand('python')).toBe('python');
    });

    it('should handle undefined input', () => {
      expect(sanitizeCommand(undefined)).toBe(undefined);
    });
  });

  describe('sanitizeMcpServer', () => {
    it('should sanitize all fields in an MCP server', () => {
      const input: StackMcpServer = {
        name: 'google-calendar',
        type: 'stdio' as const,
        command: '/Users/john/.nvm/versions/node/v20/bin/node',
        args: ['/Users/john/Code/calendar/build/index.js', '--verbose'],
        env: {
          GOOGLE_OAUTH_CREDENTIALS: '/Users/john/Code/calendar/client_secret.json',
          NODE_ENV: 'production',
        },
      };

      const expected: StackMcpServer = {
        name: 'google-calendar',
        type: 'stdio' as const,
        command: 'node',
        args: ['/path/to/index.js', '--verbose'],
        env: {
          GOOGLE_OAUTH_CREDENTIALS: '/path/to/client_secret.json',
          NODE_ENV: 'production',
        },
      };

      expect(sanitizeMcpServer(input)).toEqual(expected);
    });

    it('should handle servers without sensitive data', () => {
      const input: StackMcpServer = {
        name: 'docker-mcp',
        type: 'stdio' as const,
        command: 'docker',
        args: ['run', '-i', '--rm', 'mcp/app:latest'],
        env: {
          API_KEY: 'secret123',
        },
      };

      // Should remain unchanged since no paths detected
      expect(sanitizeMcpServer(input)).toEqual(input);
    });
  });

  describe('sanitizeMcpServers', () => {
    it('should sanitize array of MCP servers', () => {
      const input: StackMcpServer[] = [
        {
          name: 'local-script',
          type: 'stdio' as const,
          command: '/Users/john/script.js',
        },
        {
          name: 'docker-app',
          type: 'stdio' as const,
          command: 'docker',
          args: ['run', 'app:latest'],
        },
      ];

      const expected: StackMcpServer[] = [
        {
          name: 'local-script',
          type: 'stdio' as const,
          command: '/path/to/script.js',
        },
        {
          name: 'docker-app',
          type: 'stdio' as const,
          command: 'docker',
          args: ['run', 'app:latest'],
        },
      ];

      expect(sanitizeMcpServers(input)).toEqual(expected);
    });

    it('should handle undefined and empty arrays', () => {
      expect(sanitizeMcpServers(undefined)).toBe(undefined);
      expect(sanitizeMcpServers([])).toEqual([]);
    });
  });

  describe('containsSensitiveData', () => {
    it('should detect sensitive data in command', () => {
      const server: StackMcpServer = {
        name: 'test',
        type: 'stdio' as const,
        command: '/Users/john/script.js',
      };

      expect(containsSensitiveData(server)).toBe(true);
    });

    it('should detect sensitive data in args', () => {
      const server: StackMcpServer = {
        name: 'test',
        type: 'stdio' as const,
        command: 'node',
        args: ['/Users/john/app.js'],
      };

      expect(containsSensitiveData(server)).toBe(true);
    });

    it('should detect sensitive data in env', () => {
      const server: StackMcpServer = {
        name: 'test',
        type: 'stdio' as const,
        command: 'node',
        env: {
          CONFIG_PATH: '/Users/john/config.json',
        },
      };

      expect(containsSensitiveData(server)).toBe(true);
    });

    it('should return false when no sensitive data', () => {
      const server: StackMcpServer = {
        name: 'test',
        type: 'stdio' as const,
        command: 'docker',
        args: ['run', 'app:latest'],
        env: {
          API_KEY: 'secret123',
        },
      };

      expect(containsSensitiveData(server)).toBe(false);
    });
  });

  describe('getSanitizationSummary', () => {
    it('should provide summary of sensitive fields', () => {
      const server: StackMcpServer = {
        name: 'google-calendar',
        type: 'stdio' as const,
        command: '/usr/local/bin/node',
        args: ['/Users/john/calendar/index.js', '--verbose'],
        env: {
          GOOGLE_OAUTH_CREDENTIALS: '/Users/john/client_secret.json',
          CONFIG_PATH: '/Users/john/config.json',
          API_KEY: 'secret123',
        },
      };

      const summary = getSanitizationSummary(server);

      expect(summary.serverName).toBe('google-calendar');
      expect(summary.sensitiveFields).toContain('command');
      expect(summary.sensitiveFields).toContain('args');
      expect(summary.sensitiveFields).toContain('env (GOOGLE_OAUTH_CREDENTIALS, CONFIG_PATH)');
      expect(summary.sensitiveFields).not.toContain('API_KEY');
    });

    it('should handle servers with no sensitive data', () => {
      const server: StackMcpServer = {
        name: 'clean-server',
        type: 'stdio' as const,
        command: 'docker',
        args: ['run', 'app:latest'],
      };

      const summary = getSanitizationSummary(server);

      expect(summary.serverName).toBe('clean-server');
      expect(summary.sensitiveFields).toEqual([]);
    });
  });
});
