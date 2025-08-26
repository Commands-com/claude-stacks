import 'jest-extended';
import { jest } from '@jest/globals';

// Global test configuration
const originalConsole = global.console;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  if (process.env.TEST_VERBOSE !== 'true') {
    global.console = {
      ...originalConsole,
      log: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    } as any;
  }

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.CLAUDE_STACKS_TEST_MODE = 'true';
});

afterAll(() => {
  // Restore console
  global.console = originalConsole;
});

// Global test utilities
global.flushPromises = () => new Promise(setImmediate);

// Mock global dependencies
jest.mock('node-fetch', () => ({
  default: jest.fn(),
}));

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

jest.mock('ora', () => {
  const mockSpinner = {
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    text: '',
  };
  return jest.fn(() => mockSpinner);
});

// Extend Jest matchers
expect.extend({
  toBeValidStackId(received: string) {
    const isValid = /^[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+$/.test(received);
    return {
      message: () =>
        `expected ${received} ${isValid ? 'not ' : ''}to be a valid stack ID (format: org/name)`,
      pass: isValid,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidStackId(): R;
    }
  }

  var flushPromises: () => Promise<void>;
}

export {};
