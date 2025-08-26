/** @type {import('jest').Config} */
export default {
  // Project Configuration
  displayName: 'claude-stacks',
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],

  // Module Configuration for ESM
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES2022',
          target: 'ES2022',
          moduleResolution: 'Node',
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
        },
      },
    ],
  },

  // Module Resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Transform ESM modules
  transformIgnorePatterns: ['node_modules/(?!(chalk|ora|open|node-fetch|inquirer|#ansi-styles)/)'],

  // Test Environment
  testEnvironment: 'node',

  // Test File Patterns
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.spec.ts'],

  // Setup Files
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],

  // Coverage Configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json', 'clover'],

  // Coverage Collection
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli.ts', // Entry point excluded from coverage
    '!src/types/**/*', // Type definitions excluded
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],

  // Coverage Thresholds
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 65,
      functions: 75,
      lines: 70,
    },
    // Higher thresholds for critical modules
    './src/services/': {
      statements: 85,
      branches: 80,
      functions: 90,
      lines: 85,
    },
    './src/controllers/': {
      statements: 85,
      branches: 80,
      functions: 90,
      lines: 85,
    },
    './src/utils/': {
      statements: 80,
      branches: 75,
      functions: 85,
      lines: 80,
    },
  },

  // Test Timeout
  testTimeout: 10000,

  // Performance Configuration
  maxWorkers: '50%',

  // Clear Mocks
  clearMocks: true,
  restoreMocks: true,

  // Verbose Output
  verbose: false,

  // Error Handling
  bail: 0,

  // Watch Mode Configuration
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],

  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Claude Stacks Test Report',
      },
    ],
  ],

  // Global Setup/Teardown
  globalSetup: '<rootDir>/tests/setup/global-setup.ts',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.ts',

  // Test Sequencer for Deterministic Test Order
  // testSequencer: '<rootDir>/tests/setup/test-sequencer.cjs'
};
