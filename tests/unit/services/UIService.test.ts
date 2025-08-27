import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Mock console methods
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();

// Mock input utility
const mockReadSingleChar = jest.fn();
jest.mock('../../../src/utils/input.js', () => ({
  readSingleChar: mockReadSingleChar,
}));

// Create mock color functions that return the text unchanged
const createMockColorFunction = () => jest.fn((text: string) => text);

// Mock the colors module completely
const mockColors = {
  info: createMockColorFunction(),
  error: createMockColorFunction(),
  success: createMockColorFunction(),
  warning: createMockColorFunction(),
  meta: createMockColorFunction(),
  stackName: createMockColorFunction(),
  description: createMockColorFunction(),
  highlight: createMockColorFunction(),
  number: createMockColorFunction(),
};

jest.mock('../../../src/utils/colors.js', () => ({
  colors: mockColors,
}));

// Import UIService after setting up mocks
import { UIService } from '../../../src/services/UIService.js';

describe('UIService', () => {
  let uiService: UIService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Replace console methods with mocks
    console.log = mockConsoleLog;
    console.error = mockConsoleError;

    // Reset all mock functions
    mockReadSingleChar.mockReset();
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();

    // Reset all color mocks and ensure they return the input text
    Object.values(mockColors).forEach(mockFn => {
      mockFn.mockReset();
      mockFn.mockImplementation((text: string) => text);
    });

    uiService = new UIService();
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    jest.resetAllMocks();
  });

  describe('console output methods', () => {
    describe('info', () => {
      it('should display info message with colors', () => {
        uiService.info('Test info message');

        expect(mockColors.info).toHaveBeenCalledWith('Test info message');
        expect(mockConsoleLog).toHaveBeenCalledWith('Test info message');
      });

      it('should handle empty strings', () => {
        uiService.info('');

        expect(mockColors.info).toHaveBeenCalledWith('');
        expect(mockConsoleLog).toHaveBeenCalledWith('');
      });
    });

    describe('error', () => {
      it('should display error message without details', () => {
        uiService.error('Test error message');

        expect(mockColors.error).toHaveBeenCalledWith('Test error message');
        expect(mockConsoleError).toHaveBeenCalledWith('Test error message');
      });

      it('should display error message with details', () => {
        uiService.error('Test error message', 'Additional details');

        expect(mockColors.error).toHaveBeenCalledWith('Test error message');
        expect(mockConsoleError).toHaveBeenCalledWith('Test error message', 'Additional details');
      });

      it('should handle undefined details', () => {
        uiService.error('Test error message', undefined);

        expect(mockColors.error).toHaveBeenCalledWith('Test error message');
        expect(mockConsoleError).toHaveBeenCalledWith('Test error message');
      });
    });

    describe('success', () => {
      it('should display success message with colors', () => {
        uiService.success('Operation completed');

        expect(mockColors.success).toHaveBeenCalledWith('Operation completed');
        expect(mockConsoleLog).toHaveBeenCalledWith('Operation completed');
      });
    });

    describe('warning', () => {
      it('should display warning message with colors', () => {
        uiService.warning('Warning message');

        expect(mockColors.warning).toHaveBeenCalledWith('Warning message');
        expect(mockConsoleLog).toHaveBeenCalledWith('Warning message');
      });
    });

    describe('meta', () => {
      it('should display meta message with colors', () => {
        uiService.meta('Meta information');

        expect(mockColors.meta).toHaveBeenCalledWith('Meta information');
        expect(mockConsoleLog).toHaveBeenCalledWith('Meta information');
      });
    });

    describe('stackName', () => {
      it('should display stack name with colors', () => {
        uiService.stackName('my-stack');

        expect(mockColors.stackName).toHaveBeenCalledWith('my-stack');
        expect(mockConsoleLog).toHaveBeenCalledWith('my-stack');
      });
    });

    describe('description', () => {
      it('should display description with colors', () => {
        uiService.description('Stack description');

        expect(mockColors.description).toHaveBeenCalledWith('Stack description');
        expect(mockConsoleLog).toHaveBeenCalledWith('Stack description');
      });
    });

    describe('highlight', () => {
      it('should display highlighted text', () => {
        uiService.highlight('Important text');

        expect(mockColors.highlight).toHaveBeenCalledWith('Important text');
        expect(mockConsoleLog).toHaveBeenCalledWith('Important text');
      });
    });

    describe('number', () => {
      it('should display number with string input', () => {
        uiService.number('42');

        expect(mockColors.number).toHaveBeenCalledWith('42');
        expect(mockConsoleLog).toHaveBeenCalledWith('42');
      });

      it('should display number with numeric input', () => {
        uiService.number(123);

        expect(mockColors.number).toHaveBeenCalledWith('123');
        expect(mockConsoleLog).toHaveBeenCalledWith('123');
      });

      it('should handle zero', () => {
        uiService.number(0);

        expect(mockColors.number).toHaveBeenCalledWith('0');
        expect(mockConsoleLog).toHaveBeenCalledWith('0');
      });
    });

    describe('log', () => {
      it('should display plain message without styling', () => {
        uiService.log('Plain message');

        expect(mockConsoleLog).toHaveBeenCalledWith('Plain message');
        // Verify no color functions were called
        expect(mockColors.info).not.toHaveBeenCalled();
        expect(mockColors.error).not.toHaveBeenCalled();
        expect(mockColors.success).not.toHaveBeenCalled();
      });

      it('should handle multiline messages', () => {
        const multiline = 'Line 1\nLine 2\nLine 3';
        uiService.log(multiline);

        expect(mockConsoleLog).toHaveBeenCalledWith(multiline);
      });
    });
  });

  describe('input methods', () => {
    describe('readSingleChar', () => {
      it('should read single character with prompt', async () => {
        mockReadSingleChar.mockResolvedValue('y');

        const result = await uiService.readSingleChar('Continue? (y/n): ');

        expect(mockReadSingleChar).toHaveBeenCalledWith('Continue? (y/n): ');
        expect(result).toBe('y');
      });

      it('should handle special characters', async () => {
        mockReadSingleChar.mockResolvedValue('\n');

        const result = await uiService.readSingleChar('Press Enter: ');

        expect(result).toBe('\n');
      });

      it('should handle input errors', async () => {
        mockReadSingleChar.mockRejectedValue(new Error('Input error'));

        await expect(uiService.readSingleChar('Prompt: ')).rejects.toThrow('Input error');
      });
    });

    describe('readMultipleLines', () => {
      it('should display prompt and return empty array (placeholder implementation)', async () => {
        const result = await uiService.readMultipleLines('Enter multiple lines:');

        expect(mockConsoleLog).toHaveBeenCalledWith('Enter multiple lines:');
        expect(result).toEqual([]);
      });

      it('should handle empty prompt', async () => {
        const result = await uiService.readMultipleLines('');

        expect(mockConsoleLog).toHaveBeenCalledWith('');
        expect(result).toEqual([]);
      });
    });
  });

  describe('inline color methods', () => {
    describe('colorStackName', () => {
      it('should return colored stack name string', () => {
        const result = uiService.colorStackName('my-stack');

        expect(mockColors.stackName).toHaveBeenCalledWith('my-stack');
        expect(result).toBe('my-stack');
      });
    });

    describe('colorDescription', () => {
      it('should return colored description string', () => {
        const result = uiService.colorDescription('Stack description');

        expect(mockColors.description).toHaveBeenCalledWith('Stack description');
        expect(result).toBe('Stack description');
      });
    });

    describe('colorInfo', () => {
      it('should return colored info string', () => {
        const result = uiService.colorInfo('Info text');

        expect(mockColors.info).toHaveBeenCalledWith('Info text');
        expect(result).toBe('Info text');
      });
    });

    describe('colorMeta', () => {
      it('should return colored meta string', () => {
        const result = uiService.colorMeta('Meta text');

        expect(mockColors.meta).toHaveBeenCalledWith('Meta text');
        expect(result).toBe('Meta text');
      });
    });

    describe('colorError', () => {
      it('should return colored error string', () => {
        const result = uiService.colorError('Error text');

        expect(mockColors.error).toHaveBeenCalledWith('Error text');
        expect(result).toBe('Error text');
      });
    });

    describe('colorSuccess', () => {
      it('should return colored success string', () => {
        const result = uiService.colorSuccess('Success text');

        expect(mockColors.success).toHaveBeenCalledWith('Success text');
        expect(result).toBe('Success text');
      });
    });

    describe('colorWarning', () => {
      it('should return colored warning string', () => {
        const result = uiService.colorWarning('Warning text');

        expect(mockColors.warning).toHaveBeenCalledWith('Warning text');
        expect(result).toBe('Warning text');
      });
    });

    describe('colorHighlight', () => {
      it('should return colored highlight string', () => {
        const result = uiService.colorHighlight('Highlighted text');

        expect(mockColors.highlight).toHaveBeenCalledWith('Highlighted text');
        expect(result).toBe('Highlighted text');
      });
    });

    describe('colorNumber', () => {
      it('should return colored number string with string input', () => {
        const result = uiService.colorNumber('42');

        expect(mockColors.number).toHaveBeenCalledWith('42');
        expect(result).toBe('42');
      });

      it('should return colored number string with numeric input', () => {
        const result = uiService.colorNumber(123);

        expect(mockColors.number).toHaveBeenCalledWith('123');
        expect(result).toBe('123');
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      uiService.info(longMessage);

      expect(mockColors.info).toHaveBeenCalledWith(longMessage);
      expect(mockConsoleLog).toHaveBeenCalledWith(longMessage);
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Message with special chars: !@#$%^&*(){}[]|\\:";\'<>?,./ 🚀 ✅';
      uiService.success(specialMessage);

      expect(mockColors.success).toHaveBeenCalledWith(specialMessage);
      expect(mockConsoleLog).toHaveBeenCalledWith(specialMessage);
    });

    it('should handle null-like values as strings', () => {
      uiService.number(null as any);
      expect(mockColors.number).toHaveBeenCalledWith('null');

      uiService.number(undefined as any);
      expect(mockColors.number).toHaveBeenCalledWith('undefined');
    });

    it('should handle errors from color functions', () => {
      mockColors.info.mockImplementation(() => {
        throw new Error('Color function error');
      });

      expect(() => uiService.info('Test message')).toThrow('Color function error');
    });
  });

  describe('integration scenarios', () => {
    it('should handle mixed output types in sequence', () => {
      uiService.info('Starting operation...');
      uiService.warning('This might take a while');
      uiService.success('Operation completed');
      uiService.meta('Details: 5 files processed');
      uiService.error('Minor issue detected', 'File was skipped');

      expect(mockConsoleLog).toHaveBeenCalledTimes(4);
      expect(mockConsoleError).toHaveBeenCalledTimes(1);

      expect(mockConsoleLog).toHaveBeenNthCalledWith(1, 'Starting operation...');
      expect(mockConsoleLog).toHaveBeenNthCalledWith(2, 'This might take a while');
      expect(mockConsoleLog).toHaveBeenNthCalledWith(3, 'Operation completed');
      expect(mockConsoleLog).toHaveBeenNthCalledWith(4, 'Details: 5 files processed');
      expect(mockConsoleError).toHaveBeenCalledWith('Minor issue detected', 'File was skipped');
    });

    it('should compose colored text properly', () => {
      const stackName = uiService.colorStackName('my-stack');
      const description = uiService.colorDescription('A useful stack');
      const composed = `Stack: ${stackName} - ${description}`;

      uiService.log(composed);

      expect(mockConsoleLog).toHaveBeenCalledWith('Stack: my-stack - A useful stack');
    });

    it('should handle rapid successive calls', () => {
      for (let i = 0; i < 100; i++) {
        uiService.number(i);
      }

      expect(mockConsoleLog).toHaveBeenCalledTimes(100);
      expect(mockColors.number).toHaveBeenCalledTimes(100);
    });
  });

  describe('method chaining and composition', () => {
    it('should work with method chaining patterns', () => {
      // Simulate a pattern where you get colored strings and combine them
      const parts = [
        uiService.colorStackName('stack-name'),
        uiService.colorDescription('description'),
        uiService.colorNumber(42),
      ];

      const combined = parts.join(' | ');
      uiService.log(combined);

      expect(mockConsoleLog).toHaveBeenCalledWith('stack-name | description | 42');
    });

    it('should handle complex formatting scenarios', () => {
      const name = uiService.colorStackName('test-stack');
      const version = uiService.colorNumber('1.0.0');
      const status = uiService.colorSuccess('published');

      const message = `📦 ${name} v${version} is now ${status}!`;
      uiService.info(message);

      expect(mockColors.info).toHaveBeenCalledWith('📦 test-stack v1.0.0 is now published!');
    });
  });
});
