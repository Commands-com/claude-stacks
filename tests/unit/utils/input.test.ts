import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readSingleChar } from '../../../src/utils/input.js';

// Mock the process stdin/stdout
const mockStdin = {
  isTTY: true,
  setRawMode: jest.fn(),
  resume: jest.fn(),
  pause: jest.fn(),
  setEncoding: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
};

const mockStdout = {
  write: jest.fn(),
};

const mockProcessExit = jest.fn();

describe('input utilities', () => {
  // Store original values
  const originalStdin = process.stdin;
  const originalStdout = process.stdout;
  const originalExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();

    // Recreate mocks to ensure they're fresh
    mockStdin.setRawMode = jest.fn();
    mockStdin.resume = jest.fn();
    mockStdin.pause = jest.fn();
    mockStdin.setEncoding = jest.fn();
    mockStdin.on = jest.fn();
    mockStdin.removeListener = jest.fn();
    mockStdout.write = jest.fn();

    // Mock process methods
    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(process, 'stdout', {
      value: mockStdout,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(process, 'exit', {
      value: mockProcessExit,
      writable: true,
      configurable: true,
    });

    // Reset mock implementations
    mockStdin.isTTY = true;
    mockStdin.setRawMode.mockImplementation(() => {});
    mockStdin.resume.mockImplementation(() => {});
    mockStdin.pause.mockImplementation(() => {});
    mockStdin.setEncoding.mockImplementation(() => {});
    mockStdin.on.mockImplementation(() => {});
    mockStdin.removeListener.mockImplementation(() => {});
    mockStdout.write.mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(process, 'stdout', {
      value: originalStdout,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(process, 'exit', {
      value: originalExit,
      writable: true,
      configurable: true,
    });
  });

  describe('readSingleChar', () => {
    it('should write prompt to stdout', async () => {
      const prompt = 'Enter choice: ';

      // Mock the data event to resolve immediately
      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('a'));
        }
      });

      const promise = readSingleChar(prompt);
      await promise;

      expect(mockStdout.write).toHaveBeenCalledWith(prompt);
    });

    it('should setup stdin properly when TTY is available', async () => {
      mockStdin.isTTY = true;

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('a'));
        }
      });

      const promise = readSingleChar('Test: ');
      await promise;

      expect(mockStdin.setRawMode).toHaveBeenCalledWith(true);
      expect(mockStdin.resume).toHaveBeenCalled();
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8');
      expect(mockStdin.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should not set raw mode when TTY is not available', async () => {
      mockStdin.isTTY = false;

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('a'));
        }
      });

      const promise = readSingleChar('Test: ');
      await promise;

      expect(mockStdin.setRawMode).not.toHaveBeenCalled();
      expect(mockStdin.resume).toHaveBeenCalled();
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8');
    });

    it('should handle normal character input in raw mode', async () => {
      mockStdin.isTTY = true;

      let dataCallback: Function;
      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          dataCallback = callback;
          setImmediate(() => callback('A'));
        }
      });

      const promise = readSingleChar('Choice: ');
      const result = await promise;

      expect(result).toBe('a'); // Should be lowercase
      expect(mockStdin.setRawMode).toHaveBeenCalledWith(false); // Should disable raw mode after
      expect(mockStdin.pause).toHaveBeenCalled();
      expect(mockStdin.removeListener).toHaveBeenCalledWith('data', dataCallback);
      expect(mockStdout.write).toHaveBeenCalledWith('\n'); // Should write newline in raw mode
    });

    it('should handle normal character input in non-raw mode', async () => {
      mockStdin.isTTY = false;

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('xyz\n'));
        }
      });

      const promise = readSingleChar('Choice: ');
      const result = await promise;

      expect(result).toBe('x'); // Should get first character
      expect(mockStdout.write).toHaveBeenCalledWith(''); // Should not write newline in non-raw mode
    });

    it('should handle Enter key as empty selection', async () => {
      mockStdin.isTTY = true;

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('\r'));
        }
      });

      const promise = readSingleChar('Press Enter: ');
      const result = await promise;

      expect(result).toBe('');
      expect(mockStdout.write).toHaveBeenCalledWith('\n');
    });

    it('should handle newline character as empty selection', async () => {
      mockStdin.isTTY = true;

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('\n'));
        }
      });

      const promise = readSingleChar('Press Enter: ');
      const result = await promise;

      expect(result).toBe('');
      expect(mockStdout.write).toHaveBeenCalledWith('\n');
    });

    it('should handle Ctrl+C by calling process.exit', async () => {
      mockStdin.isTTY = true;

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('\u0003')); // Ctrl+C
        }
      });

      const promise = readSingleChar('Choice: ');

      // Give it a moment to process
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should cleanup stdin state after input', async () => {
      mockStdin.isTTY = true;

      let dataCallback: Function;
      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          dataCallback = callback;
          setImmediate(() => callback('x'));
        }
      });

      const promise = readSingleChar('Test: ');
      await promise;

      expect(mockStdin.setRawMode).toHaveBeenCalledWith(false);
      expect(mockStdin.pause).toHaveBeenCalled();
      expect(mockStdin.removeListener).toHaveBeenCalledWith('data', dataCallback);
    });

    it('should handle when setRawMode is not available even with TTY', async () => {
      mockStdin.isTTY = true;
      delete (mockStdin as any).setRawMode; // Remove setRawMode function

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('z'));
        }
      });

      const promise = readSingleChar('Test: ');
      const result = await promise;

      expect(result).toBe('z');
      // Should not attempt to call setRawMode since it's not available
    });

    it('should convert input to lowercase', async () => {
      mockStdin.isTTY = true;

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('Z'));
        }
      });

      const promise = readSingleChar('Upper: ');
      const result = await promise;

      expect(result).toBe('z');
    });

    it('should handle empty input properly', async () => {
      mockStdin.isTTY = true;

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback(''));
        }
      });

      const promise = readSingleChar('Empty: ');
      const result = await promise;

      expect(result).toBe('');
    });

    it('should handle special characters', async () => {
      mockStdin.isTTY = true;

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setImmediate(() => callback('@'));
        }
      });

      const promise = readSingleChar('Special: ');
      const result = await promise;

      expect(result).toBe('@');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple rapid inputs', async () => {
      mockStdin.isTTY = true;

      let callCount = 0;
      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callCount++;
          if (callCount === 1) {
            setImmediate(() => callback('first'));
          }
        }
      });

      const promise = readSingleChar('Multi: ');
      const result = await promise;

      expect(result).toBe('first');
      // Should cleanup after first input, preventing multiple callbacks
      expect(mockStdin.removeListener).toHaveBeenCalled();
    });
  });
});
