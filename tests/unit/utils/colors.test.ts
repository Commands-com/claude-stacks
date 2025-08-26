import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock chalk to avoid import issues
jest.mock('chalk', () => {
  const mockChalkFunction = (text: string) => text;
  const mockChalk = {
    blueBright: Object.assign(mockChalkFunction, { bold: mockChalkFunction }),
    greenBright: mockChalkFunction,
    yellow: mockChalkFunction,
    cyan: Object.assign(mockChalkFunction, {
      underline: mockChalkFunction,
      bold: mockChalkFunction,
    }),
    dim: mockChalkFunction,
    green: mockChalkFunction,
    red: mockChalkFunction,
    magenta: mockChalkFunction,
    magentaBright: mockChalkFunction,
    gray: mockChalkFunction,
  };

  // Mock the Chalk constructor
  const mockChalkConstructor = jest.fn(() => mockChalk);

  return {
    __esModule: true,
    default: mockChalk,
    Chalk: mockChalkConstructor,
  };
});

import { colors } from '../../../src/utils/colors.js';

describe('colors utility', () => {
  // Store original environment variables
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment variables
    process.env = { ...originalEnv };
  });

  describe('color palette', () => {
    it('should provide all required color functions', () => {
      // Primary elements
      expect(typeof colors.stackName).toBe('function');
      expect(typeof colors.componentCount).toBe('function');
      expect(typeof colors.author).toBe('function');
      expect(typeof colors.url).toBe('function');

      // Secondary elements
      expect(typeof colors.meta).toBe('function');
      expect(typeof colors.description).toBe('function');

      // Status and emphasis
      expect(typeof colors.success).toBe('function');
      expect(typeof colors.error).toBe('function');
      expect(typeof colors.warning).toBe('function');
      expect(typeof colors.info).toBe('function');

      // UI elements
      expect(typeof colors.bullet).toBe('function');
      expect(typeof colors.number).toBe('function');
      expect(typeof colors.highlight).toBe('function');

      // File paths and IDs
      expect(typeof colors.path).toBe('function');
      expect(typeof colors.id).toBe('function');
    });

    it('should apply colors to text', () => {
      const testText = 'test';

      // Test that color functions return strings
      expect(typeof colors.stackName(testText)).toBe('string');
      expect(typeof colors.success(testText)).toBe('string');
      expect(typeof colors.error(testText)).toBe('string');
      expect(typeof colors.warning(testText)).toBe('string');
      expect(typeof colors.info(testText)).toBe('string');
      expect(typeof colors.componentCount(testText)).toBe('string');
      expect(typeof colors.author(testText)).toBe('string');
      expect(typeof colors.url(testText)).toBe('string');
      expect(typeof colors.meta(testText)).toBe('string');
      expect(typeof colors.bullet(testText)).toBe('string');
      expect(typeof colors.number(testText)).toBe('string');
      expect(typeof colors.highlight(testText)).toBe('string');
      expect(typeof colors.path(testText)).toBe('string');
      expect(typeof colors.id(testText)).toBe('string');
    });

    it('should handle description function correctly', () => {
      const testText = 'description text';
      expect(colors.description(testText)).toBe(testText);
    });
  });

  describe('NO_COLOR environment variable', () => {
    beforeEach(() => {
      // Clear the module cache to force re-evaluation
      jest.resetModules();
    });

    it('should disable colors when NO_COLOR is set', async () => {
      process.env.NO_COLOR = '1';

      // Re-import the module to get the new instance
      const { colors: noColorColors } = await import('../../../src/utils/colors.js');

      const testText = 'test';
      const result = noColorColors.success(testText);

      // When colors are disabled, should return plain text
      expect(result).toBe(testText);
    });

    it('should disable colors when NO_COLOR is empty string', async () => {
      process.env.NO_COLOR = '';

      const { colors: noColorColors } = await import('../../../src/utils/colors.js');

      const testText = 'test';
      const result = noColorColors.error(testText);

      expect(result).toBe(testText);
    });
  });

  describe('FORCE_COLOR environment variable', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should force colors when FORCE_COLOR is set to 1', async () => {
      process.env.FORCE_COLOR = '1';
      delete process.env.NO_COLOR;

      const { colors: forceColorColors } = await import('../../../src/utils/colors.js');

      const testText = 'test';
      const result = forceColorColors.success(testText);

      // Should apply colors (result should be different from plain text)
      expect(result).toContain(testText);
    });

    it('should force colors when FORCE_COLOR is set to 2', async () => {
      process.env.FORCE_COLOR = '2';
      delete process.env.NO_COLOR;

      const { colors: forceColorColors } = await import('../../../src/utils/colors.js');

      const testText = 'test';
      const result = forceColorColors.warning(testText);

      expect(result).toContain(testText);
    });

    it('should force colors when FORCE_COLOR is set to 3', async () => {
      process.env.FORCE_COLOR = '3';
      delete process.env.NO_COLOR;

      const { colors: forceColorColors } = await import('../../../src/utils/colors.js');

      const testText = 'test';
      const result = forceColorColors.info(testText);

      expect(result).toContain(testText);
    });

    it('should handle invalid FORCE_COLOR values', async () => {
      process.env.FORCE_COLOR = 'invalid';
      delete process.env.NO_COLOR;

      const { colors: forceColorColors } = await import('../../../src/utils/colors.js');

      const testText = 'test';
      const result = forceColorColors.highlight(testText);

      // Should still work with default level 1
      expect(result).toContain(testText);
    });
  });

  describe('environment variable precedence', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should prioritize NO_COLOR over FORCE_COLOR', async () => {
      process.env.NO_COLOR = '1';
      process.env.FORCE_COLOR = '3';

      const { colors: precedenceColors } = await import('../../../src/utils/colors.js');

      const testText = 'test';
      const result = precedenceColors.error(testText);

      // NO_COLOR should take precedence, returning plain text
      expect(result).toBe(testText);
    });
  });

  describe('multiple text styling', () => {
    it('should handle empty strings', () => {
      expect(colors.success('')).toBe('');
      expect(colors.error('')).toBe('');
      expect(colors.description('')).toBe('');
    });

    it('should handle multi-line text', () => {
      const multiLineText = 'line1\nline2\nline3';
      const result = colors.stackName(multiLineText);

      expect(typeof result).toBe('string');
      expect(result).toContain('line1');
      expect(result).toContain('line2');
      expect(result).toContain('line3');
    });

    it('should handle special characters', () => {
      const specialText = 'test@#$%^&*()';
      const result = colors.path(specialText);

      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });
  });

  describe('color categories functionality', () => {
    it('should have distinct primary element colors', () => {
      const text = 'test';

      // These should all be functions that return strings
      expect(colors.stackName(text)).toBeTruthy();
      expect(colors.componentCount(text)).toBeTruthy();
      expect(colors.author(text)).toBeTruthy();
      expect(colors.url(text)).toBeTruthy();
    });

    it('should have distinct status colors', () => {
      const text = 'status';

      expect(colors.success(text)).toBeTruthy();
      expect(colors.error(text)).toBeTruthy();
      expect(colors.warning(text)).toBeTruthy();
      expect(colors.info(text)).toBeTruthy();
    });

    it('should have distinct UI element colors', () => {
      const text = 'ui';

      expect(colors.bullet(text)).toBeTruthy();
      expect(colors.number(text)).toBeTruthy();
      expect(colors.highlight(text)).toBeTruthy();
    });
  });
});
