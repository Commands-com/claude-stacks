import {
  validateRemoteStack,
  validateAuthToken,
  validateObjectResponse,
  validateStringArray,
} from '../../../src/utils/validators.js';
import type {
  RemoteStack,
  AuthToken,
  StackMcpServer,
  StackCommand,
  StackAgent,
  StackSettings,
} from '../../../src/types/index.js';

describe('validators', () => {
  describe('validateRemoteStack', () => {
    describe('valid inputs', () => {
      it('should validate minimal valid stack', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
        };

        const result = validateRemoteStack(input);

        expect(result).toEqual({
          org: 'test-org',
          name: 'test-stack',
          title: undefined,
          description: 'Test description',
          version: undefined,
          author: undefined,
          mcpServers: undefined,
          commands: undefined,
          agents: undefined,
          settings: undefined,
        });
      });

      it('should validate complete valid stack with all fields', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          title: 'Test Stack Title',
          description: 'Test description',
          version: '1.0.0',
          author: 'Test Author',
          mcpServers: [
            {
              name: 'test-server',
              type: 'stdio',
              command: 'test-command',
              args: ['--flag'],
              env: { VAR: 'value' },
            },
          ],
          commands: [
            {
              name: 'test-command',
              filePath: '/path/to/command',
              content: 'command content',
              description: 'Test command',
            },
          ],
          agents: [
            {
              name: 'test-agent',
              filePath: '/path/to/agent',
              content: 'agent content',
              description: 'Test agent',
            },
          ],
          settings: {
            theme: 'dark',
            fontSize: 14,
          },
        };

        const result = validateRemoteStack(input);

        expect(result.org).toBe('test-org');
        expect(result.name).toBe('test-stack');
        expect(result.title).toBe('Test Stack Title');
        expect(result.description).toBe('Test description');
        expect(result.version).toBe('1.0.0');
        expect(result.author).toBe('Test Author');
        expect(result.mcpServers).toHaveLength(1);
        expect(result.commands).toHaveLength(1);
        expect(result.agents).toHaveLength(1);
        expect(result.settings).toEqual({ theme: 'dark', fontSize: 14 });
      });

      it('should handle optional fields as null', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          title: null,
          version: null,
          author: null,
        };

        const result = validateRemoteStack(input);

        expect(result.title).toBeUndefined();
        expect(result.version).toBeUndefined();
        expect(result.author).toBeUndefined();
      });

      it('should handle empty arrays', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          mcpServers: [],
          commands: [],
          agents: [],
        };

        const result = validateRemoteStack(input);

        expect(result.mcpServers).toEqual([]);
        expect(result.commands).toEqual([]);
        expect(result.agents).toEqual([]);
      });
    });

    describe('invalid inputs', () => {
      it('should throw error for null/undefined input', () => {
        expect(() => validateRemoteStack(null)).toThrow('Invalid stack response: not an object');
        expect(() => validateRemoteStack(undefined)).toThrow(
          'Invalid stack response: not an object'
        );
      });

      it('should throw error for non-object input', () => {
        expect(() => validateRemoteStack('string')).toThrow(
          'Invalid stack response: not an object'
        );
        expect(() => validateRemoteStack(123)).toThrow('Invalid stack response: not an object');
        expect(() => validateRemoteStack([])).toThrow('Invalid org: must be a non-empty string');
      });

      it('should throw error for missing required fields', () => {
        expect(() => validateRemoteStack({})).toThrow('Invalid org: must be a non-empty string');

        expect(() => validateRemoteStack({ org: 'test' })).toThrow(
          'Invalid name: must be a non-empty string'
        );

        expect(() => validateRemoteStack({ org: 'test', name: 'stack' })).toThrow(
          'Invalid description: must be a non-empty string'
        );
      });

      it('should throw error for empty string required fields', () => {
        expect(() => validateRemoteStack({ org: '', name: 'test', description: 'desc' })).toThrow(
          'Invalid org: must be a non-empty string'
        );

        expect(() => validateRemoteStack({ org: 'test', name: '', description: 'desc' })).toThrow(
          'Invalid name: must be a non-empty string'
        );

        expect(() => validateRemoteStack({ org: 'test', name: 'stack', description: '' })).toThrow(
          'Invalid description: must be a non-empty string'
        );
      });

      it('should throw error for whitespace-only required fields', () => {
        expect(() =>
          validateRemoteStack({ org: '   ', name: 'test', description: 'desc' })
        ).toThrow('Invalid org: must be a non-empty string');
      });

      it('should throw error for non-string required fields', () => {
        expect(() => validateRemoteStack({ org: 123, name: 'test', description: 'desc' })).toThrow(
          'Invalid org: must be a non-empty string'
        );
      });

      it('should throw error for non-array components', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          mcpServers: 'not-array',
        };

        expect(() => validateRemoteStack(input)).toThrow('Invalid mcpServers: must be an array');
      });
    });

    describe('MCP server validation', () => {
      it('should validate MCP server with all fields', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          mcpServers: [
            {
              name: 'test-server',
              type: 'http',
              command: 'test-command',
              args: ['arg1', 'arg2'],
              url: 'https://example.com',
              env: { KEY: 'value' },
            },
          ],
        };

        const result = validateRemoteStack(input);
        const server = result.mcpServers![0];

        expect(server.name).toBe('test-server');
        expect(server.type).toBe('http');
        expect(server.command).toBe('test-command');
        expect(server.args).toEqual(['arg1', 'arg2']);
        expect(server.url).toBe('https://example.com');
        expect(server.env).toEqual({ KEY: 'value' });
      });

      it('should default type to stdio when missing', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          mcpServers: [{ name: 'test-server' }],
        };

        const result = validateRemoteStack(input);
        const server = result.mcpServers![0];

        expect(server.type).toBe('stdio');
      });

      it('should default type to stdio for invalid type', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          mcpServers: [{ name: 'test-server', type: 'invalid' }],
        };

        const result = validateRemoteStack(input);
        const server = result.mcpServers![0];

        expect(server.type).toBe('stdio');
      });

      it('should handle optional MCP server fields as undefined', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          mcpServers: [{ name: 'test-server' }],
        };

        const result = validateRemoteStack(input);
        const server = result.mcpServers![0];

        expect(server.command).toBeUndefined();
        expect(server.args).toBeUndefined();
        expect(server.url).toBeUndefined();
        expect(server.env).toBeUndefined();
      });

      it('should throw error for invalid MCP server', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          mcpServers: ['invalid'],
        };

        expect(() => validateRemoteStack(input)).toThrow('Invalid MCP server: must be an object');
      });

      it('should throw error for MCP server without name', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          mcpServers: [{}],
        };

        expect(() => validateRemoteStack(input)).toThrow(
          'Invalid MCP server name: must be a non-empty string'
        );
      });
    });

    describe('command validation', () => {
      it('should validate command with all fields', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          commands: [
            {
              name: 'test-command',
              filePath: '/path/to/command',
              content: 'command content',
              description: 'Test command description',
            },
          ],
        };

        const result = validateRemoteStack(input);
        const command = result.commands![0];

        expect(command.name).toBe('test-command');
        expect(command.filePath).toBe('/path/to/command');
        expect(command.content).toBe('command content');
        expect(command.description).toBe('Test command description');
      });

      it('should handle optional description as undefined', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          commands: [
            {
              name: 'test-command',
              filePath: '/path/to/command',
              content: 'command content',
            },
          ],
        };

        const result = validateRemoteStack(input);
        const command = result.commands![0];

        expect(command.description).toBeUndefined();
      });

      it('should throw error for invalid command', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          commands: ['invalid'],
        };

        expect(() => validateRemoteStack(input)).toThrow(
          'Invalid stack command: must be an object'
        );
      });

      it('should throw error for command missing required fields', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          commands: [{}],
        };

        expect(() => validateRemoteStack(input)).toThrow(
          'Invalid command name: must be a non-empty string'
        );
      });
    });

    describe('agent validation', () => {
      it('should validate agent with all fields', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          agents: [
            {
              name: 'test-agent',
              filePath: '/path/to/agent',
              content: 'agent content',
              description: 'Test agent description',
            },
          ],
        };

        const result = validateRemoteStack(input);
        const agent = result.agents![0];

        expect(agent.name).toBe('test-agent');
        expect(agent.filePath).toBe('/path/to/agent');
        expect(agent.content).toBe('agent content');
        expect(agent.description).toBe('Test agent description');
      });

      it('should handle optional description as undefined', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          agents: [
            {
              name: 'test-agent',
              filePath: '/path/to/agent',
              content: 'agent content',
            },
          ],
        };

        const result = validateRemoteStack(input);
        const agent = result.agents![0];

        expect(agent.description).toBeUndefined();
      });

      it('should throw error for invalid agent', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          agents: ['invalid'],
        };

        expect(() => validateRemoteStack(input)).toThrow('Invalid stack agent: must be an object');
      });

      it('should throw error for agent missing required fields', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          agents: [{}],
        };

        expect(() => validateRemoteStack(input)).toThrow(
          'Invalid agent name: must be a non-empty string'
        );
      });
    });

    describe('settings validation', () => {
      it('should validate settings with all fields', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          settings: {
            theme: 'dark',
            fontSize: 14,
          },
        };

        const result = validateRemoteStack(input);

        expect(result.settings).toEqual({
          theme: 'dark',
          fontSize: 14,
        });
      });

      it('should handle optional settings fields', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          settings: {},
        };

        const result = validateRemoteStack(input);

        expect(result.settings).toEqual({
          theme: undefined,
          fontSize: undefined,
        });
      });

      it('should throw error for invalid settings', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          settings: 'invalid',
        };

        expect(() => validateRemoteStack(input)).toThrow(
          'Invalid stack settings: must be an object'
        );
      });

      it('should throw error for invalid fontSize', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          settings: {
            fontSize: 'invalid',
          },
        };

        expect(() => validateRemoteStack(input)).toThrow('Invalid fontSize: must be a number');
      });

      it('should throw error for NaN fontSize', () => {
        const input = {
          org: 'test-org',
          name: 'test-stack',
          description: 'Test description',
          settings: {
            fontSize: NaN,
          },
        };

        expect(() => validateRemoteStack(input)).toThrow('Invalid fontSize: must be a number');
      });
    });
  });

  describe('validateAuthToken', () => {
    describe('valid inputs', () => {
      it('should validate minimal valid token', () => {
        const input = {
          access_token: 'test-access-token',
        };

        const result = validateAuthToken(input);

        expect(result).toEqual({
          access_token: 'test-access-token',
          token_type: undefined,
          refresh_token: undefined,
          expires_at: undefined,
        });
      });

      it('should validate complete valid token', () => {
        const input = {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          refresh_token: 'test-refresh-token',
          expires_at: 1234567890,
        };

        const result = validateAuthToken(input);

        expect(result).toEqual({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          refresh_token: 'test-refresh-token',
          expires_at: 1234567890,
        });
      });

      it('should convert string expires_at to number', () => {
        const input = {
          access_token: 'test-access-token',
          expires_at: '1234567890',
        };

        const result = validateAuthToken(input);

        expect(result.expires_at).toBe(1234567890);
        expect(typeof result.expires_at).toBe('number');
      });

      it('should handle optional fields as undefined', () => {
        const input = {
          access_token: 'test-access-token',
          token_type: undefined,
          refresh_token: undefined,
          expires_at: undefined,
        };

        const result = validateAuthToken(input);

        expect(result.token_type).toBeUndefined();
        expect(result.refresh_token).toBeUndefined();
        expect(result.expires_at).toBeUndefined();
      });
    });

    describe('invalid inputs', () => {
      it('should throw error for null/undefined input', () => {
        expect(() => validateAuthToken(null)).toThrow('Invalid token response: not an object');
        expect(() => validateAuthToken(undefined)).toThrow('Invalid token response: not an object');
      });

      it('should throw error for non-object input', () => {
        expect(() => validateAuthToken('string')).toThrow('Invalid token response: not an object');
        expect(() => validateAuthToken(123)).toThrow('Invalid token response: not an object');
        expect(() => validateAuthToken([])).toThrow(
          'Invalid access_token: must be a non-empty string'
        );
      });

      it('should throw error for missing access_token', () => {
        expect(() => validateAuthToken({})).toThrow(
          'Invalid access_token: must be a non-empty string'
        );
      });

      it('should throw error for empty access_token', () => {
        expect(() => validateAuthToken({ access_token: '' })).toThrow(
          'Invalid access_token: must be a non-empty string'
        );
      });

      it('should throw error for whitespace-only access_token', () => {
        expect(() => validateAuthToken({ access_token: '   ' })).toThrow(
          'Invalid access_token: must be a non-empty string'
        );
      });

      it('should throw error for non-string access_token', () => {
        expect(() => validateAuthToken({ access_token: 123 })).toThrow(
          'Invalid access_token: must be a non-empty string'
        );
      });

      it('should throw error for non-convertible expires_at string', () => {
        const input = {
          access_token: 'test-token',
          expires_at: 'invalid-number',
        };

        expect(() => validateAuthToken(input)).toThrow(
          'Invalid expires_at: string cannot be converted to number'
        );
      });

      it('should throw error for invalid expires_at type', () => {
        const input = {
          access_token: 'test-token',
          expires_at: {},
        };

        expect(() => validateAuthToken(input)).toThrow(
          'Invalid expires_at: must be a number or numeric string'
        );
      });
    });
  });

  describe('validateObjectResponse', () => {
    it('should validate valid object response', () => {
      const input = { success: true, message: 'OK' };
      const result = validateObjectResponse(input);

      expect(result).toEqual(input);
    });

    it('should validate empty object', () => {
      const input = {};
      const result = validateObjectResponse(input);

      expect(result).toEqual({});
    });

    it('should throw error for null/undefined input', () => {
      expect(() => validateObjectResponse(null)).toThrow('Invalid response: not an object');
      expect(() => validateObjectResponse(undefined)).toThrow('Invalid response: not an object');
    });

    it('should throw error for non-object input', () => {
      expect(() => validateObjectResponse('string')).toThrow('Invalid response: not an object');
      expect(() => validateObjectResponse(123)).toThrow('Invalid response: not an object');
      expect(() => validateObjectResponse(true)).toThrow('Invalid response: not an object');
    });

    it('should accept arrays as objects', () => {
      const input = ['array', 'is', 'object'];
      const result = validateObjectResponse(input);

      expect(result).toBe(input);
    });
  });

  describe('validateStringArray', () => {
    it('should validate array of strings', () => {
      const input = ['string1', 'string2', 'string3'];
      const result = validateStringArray(input, 'testField');

      expect(result).toEqual(['string1', 'string2', 'string3']);
    });

    it('should validate empty array', () => {
      const input: string[] = [];
      const result = validateStringArray(input, 'testField');

      expect(result).toEqual([]);
    });

    it('should throw error for non-array input', () => {
      expect(() => validateStringArray('not-array', 'testField')).toThrow(
        'Invalid testField: must be an array'
      );

      expect(() => validateStringArray({}, 'testField')).toThrow(
        'Invalid testField: must be an array'
      );
    });

    it('should throw error for array with non-string elements', () => {
      expect(() => validateStringArray(['valid', 123, 'valid'], 'testField')).toThrow(
        'Invalid testField[1]: must be a string'
      );

      expect(() => validateStringArray([{}], 'testField')).toThrow(
        'Invalid testField[0]: must be a string'
      );
    });

    it('should throw error for null/undefined input', () => {
      expect(() => validateStringArray(null, 'testField')).toThrow(
        'Invalid testField: must be an array'
      );

      expect(() => validateStringArray(undefined, 'testField')).toThrow(
        'Invalid testField: must be an array'
      );
    });
  });
});
