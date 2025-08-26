/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, max-lines-per-function */
import type {
  AuthToken,
  RemoteStack,
  StackAgent,
  StackCommand,
  StackMcpServer,
  StackSettings,
} from '../types/index.js';

/**
 * Validates that a value is a non-empty string
 */
function isValidString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${fieldName}: must be a non-empty string`);
  }
  return value;
}

/**
 * Validates that a value is a string (can be empty)
 */
function isOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error('Value must be a string if provided');
  }
  return value;
}

/**
 * Validates that a value is a number
 */
function isValidNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`Invalid ${fieldName}: must be a number`);
  }
  return value;
}

/**
 * Validates that a value is an array
 */
function isValidArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${fieldName}: must be an array`);
  }
  return value;
}

/**
 * Validates MCP Server configuration
 */
function validateMcpServer(server: unknown): StackMcpServer {
  if (!server || typeof server !== 'object') {
    throw new Error('Invalid MCP server: must be an object');
  }

  const s = server as any;
  return {
    name: isValidString(s.name, 'MCP server name'),
    type: s.type && ['stdio', 'http', 'sse'].includes(s.type) ? s.type : 'stdio',
    command: isOptionalString(s.command),
    args: Array.isArray(s.args) ? s.args : undefined,
    url: isOptionalString(s.url),
    env: s.env && typeof s.env === 'object' ? s.env : undefined,
  };
}

/**
 * Validates Stack Command configuration
 */
function validateStackCommand(command: unknown): StackCommand {
  if (!command || typeof command !== 'object') {
    throw new Error('Invalid stack command: must be an object');
  }

  const c = command as any;
  return {
    name: isValidString(c.name, 'command name'),
    filePath: isValidString(c.filePath, 'command filePath'),
    content: isValidString(c.content, 'command content'),
    description: isOptionalString(c.description),
  };
}

/**
 * Validates Stack Agent configuration
 */
function validateStackAgent(agent: unknown): StackAgent {
  if (!agent || typeof agent !== 'object') {
    throw new Error('Invalid stack agent: must be an object');
  }

  const a = agent as any;
  return {
    name: isValidString(a.name, 'agent name'),
    filePath: isValidString(a.filePath, 'agent filePath'),
    content: isValidString(a.content, 'agent content'),
    description: isOptionalString(a.description),
  };
}

/**
 * Validates Stack Settings configuration
 */
function validateStackSettings(settings: unknown): StackSettings {
  if (!settings || typeof settings !== 'object') {
    throw new Error('Invalid stack settings: must be an object');
  }

  const s = settings as any;
  return {
    theme: isOptionalString(s.theme),
    fontSize: s.fontSize !== undefined ? isValidNumber(s.fontSize, 'fontSize') : undefined,
    // Add other settings validation as needed
  };
}

/**
 * Validates a RemoteStack object from API response
 *
 * @param data - Unknown data to validate
 * @returns Validated RemoteStack object
 * @throws Error if validation fails
 */
export function validateRemoteStack(data: unknown): RemoteStack {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid stack response: not an object');
  }

  const stack = data as any;

  // Validate required fields
  const org = isValidString(stack.org, 'org');
  const name = isValidString(stack.name, 'name');
  const description = isValidString(stack.description, 'description');

  // Validate optional fields
  const title = isOptionalString(stack.title);
  const version = isOptionalString(stack.version);
  const author = isOptionalString(stack.author);

  // Validate optional arrays
  let mcpServers: StackMcpServer[] | undefined;
  if (stack.mcpServers !== undefined) {
    const servers = isValidArray(stack.mcpServers, 'mcpServers');
    mcpServers = servers.map(validateMcpServer);
  }

  let commands: StackCommand[] | undefined;
  if (stack.commands !== undefined) {
    const cmds = isValidArray(stack.commands, 'commands');
    commands = cmds.map(validateStackCommand);
  }

  let agents: StackAgent[] | undefined;
  if (stack.agents !== undefined) {
    const agts = isValidArray(stack.agents, 'agents');
    agents = agts.map(validateStackAgent);
  }

  let settings: StackSettings | undefined;
  if (stack.settings !== undefined) {
    settings = validateStackSettings(stack.settings);
  }

  return {
    org,
    name,
    title,
    description,
    version,
    author,
    mcpServers,
    commands,
    agents,
    settings,
  };
}

/**
 * Validates an AuthToken object from API response
 *
 * @param data - Unknown data to validate
 * @returns Validated AuthToken object
 * @throws Error if validation fails
 */
export function validateAuthToken(data: unknown): AuthToken {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid token response: not an object');
  }

  const token = data as any;

  // Validate required fields
  const access_token = isValidString(token.access_token, 'access_token');

  // Validate optional fields
  const token_type = isOptionalString(token.token_type);
  const refresh_token = isOptionalString(token.refresh_token);

  // Validate expires_at (should be number)
  let expires_at: number | undefined;
  if (token.expires_at !== undefined) {
    if (typeof token.expires_at === 'number') {
      ({ expires_at } = token);
    } else if (typeof token.expires_at === 'string') {
      // Convert string to number if possible
      const parsed = parseInt(token.expires_at, 10);
      if (isNaN(parsed)) {
        throw new Error('Invalid expires_at: string cannot be converted to number');
      }
      expires_at = parsed;
    } else {
      throw new Error('Invalid expires_at: must be a number or numeric string');
    }
  }

  return {
    access_token,
    token_type,
    refresh_token,
    expires_at,
  };
}

/**
 * Validates a generic object response (for publish/rename operations)
 *
 * @param data - Unknown data to validate
 * @returns Validated object
 * @throws Error if validation fails
 */
export function validateObjectResponse(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response: not an object');
  }

  return data as Record<string, unknown>;
}

/**
 * Validates that an array contains only valid strings
 *
 * @param data - Unknown data to validate
 * @param fieldName - Name of the field being validated
 * @returns Validated string array
 * @throws Error if validation fails
 */
export function validateStringArray(data: unknown, fieldName: string): string[] {
  const arr = isValidArray(data, fieldName);
  return arr.map((item, index) => {
    if (typeof item !== 'string') {
      throw new Error(`Invalid ${fieldName}[${index}]: must be a string`);
    }
    return item;
  });
}
