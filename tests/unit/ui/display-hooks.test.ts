import {
  displayHookSafetySummary,
  getRiskEmoji,
  calculateRiskLevel,
} from '../../../src/ui/display.js';

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text: string) => text;

  // Add chainable properties
  const chainableMethods = [
    'cyan',
    'blue',
    'green',
    'red',
    'yellow',
    'magenta',
    'bold',
    'blueBright',
    'greenBright',
    'underline',
  ];

  chainableMethods.forEach(method => {
    Object.defineProperty(mockChalk, method, {
      get() {
        return mockChalk;
      },
    });
  });

  return mockChalk;
});

// Mock colors utility
jest.mock('../../../src/utils/colors.js', () => ({
  colors: {
    info: jest.fn().mockImplementation((text: string) => text),
    meta: jest.fn().mockImplementation((text: string) => text),
    stackName: jest.fn().mockImplementation((text: string) => text),
    description: jest.fn().mockImplementation((text: string) => text),
    error: jest.fn().mockImplementation((text: string) => text),
    success: jest.fn().mockImplementation((text: string) => text),
    warning: jest.fn().mockImplementation((text: string) => text),
    number: jest.fn().mockImplementation((text: string) => text),
    id: jest.fn().mockImplementation((text: string) => text),
  },
}));

const mockConsoleLog = jest.fn();

describe('Hook Display Functions', () => {
  const originalConsoleLog = console.log;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
    mockConsoleLog.mockReset();

    // Re-setup color mocks to ensure they work correctly
    const { colors } = require('../../../src/utils/colors.js');
    colors.info = jest.fn().mockImplementation((text: string) => text);
    colors.meta = jest.fn().mockImplementation((text: string) => text);
    colors.stackName = jest.fn().mockImplementation((text: string) => text);
    colors.description = jest.fn().mockImplementation((text: string) => text);
    colors.error = jest.fn().mockImplementation((text: string) => text);
    colors.success = jest.fn().mockImplementation((text: string) => text);
    colors.warning = jest.fn().mockImplementation((text: string) => text);
    colors.number = jest.fn().mockImplementation((text: string) => text);
    colors.id = jest.fn().mockImplementation((text: string) => text);
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

  describe('calculateRiskLevel', () => {
    it('should return dangerous for risk score >= 70', () => {
      expect(calculateRiskLevel(70)).toBe('dangerous');
      expect(calculateRiskLevel(85)).toBe('dangerous');
      expect(calculateRiskLevel(100)).toBe('dangerous');
    });

    it('should return warning for risk score >= 30 and < 70', () => {
      expect(calculateRiskLevel(30)).toBe('warning');
      expect(calculateRiskLevel(50)).toBe('warning');
      expect(calculateRiskLevel(69)).toBe('warning');
    });

    it('should return safe for risk score < 30', () => {
      expect(calculateRiskLevel(0)).toBe('safe');
      expect(calculateRiskLevel(15)).toBe('safe');
      expect(calculateRiskLevel(29)).toBe('safe');
    });
  });

  describe('getRiskEmoji', () => {
    it('should return correct emoji for safe', () => {
      expect(getRiskEmoji('safe')).toBe('✅');
    });

    it('should return correct emoji for warning', () => {
      expect(getRiskEmoji('warning')).toBe('⚠️');
    });

    it('should return correct emoji for dangerous', () => {
      expect(getRiskEmoji('dangerous')).toBe('🔴');
    });

    it('should return question mark for unknown risk level', () => {
      expect(getRiskEmoji('unknown')).toBe('❓');
      expect(getRiskEmoji('')).toBe('❓');
    });
  });

  describe('displayHookSafetySummary', () => {
    it('should not display anything when no hooks and no inline results', () => {
      displayHookSafetySummary([], undefined);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should not display anything when empty hooks and empty inline results', () => {
      displayHookSafetySummary([], new Map());
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should display header when hooks are present', () => {
      const mockHooks = [{ name: 'test-hook', type: 'pre-tool-use', riskScore: 25 }];

      displayHookSafetySummary(mockHooks, undefined);

      expect(mockConsoleLog).toHaveBeenCalledWith('\n🔍 Hook Safety Analysis');
      expect(mockConsoleLog).toHaveBeenCalledWith('═'.repeat(50));
    });

    it('should display header when inline results are present', () => {
      const inlineResults = new Map();
      inlineResults.set('test-hook.sh', { riskScore: 40 });

      displayHookSafetySummary([], inlineResults);

      expect(mockConsoleLog).toHaveBeenCalledWith('\n🔍 Hook Safety Analysis');
      expect(mockConsoleLog).toHaveBeenCalledWith('═'.repeat(50));
    });

    it('should handle null hooks parameter', () => {
      // @ts-expect-error Testing null case
      displayHookSafetySummary(null, undefined);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });
});
