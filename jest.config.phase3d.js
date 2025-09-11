/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Phase 3D Price Entry Tests',
  projects: [
    // Unit tests for price API routes with mocked dependencies
    {
      displayName: 'unit-prices-phase3d',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/unit/*_phase3d.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/api/prices/**/*.js',
        'app/prices/**/*.js',
        '!**/*.d.ts',
      ],
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      testTimeout: 10000,
      maxWorkers: 4,
      // Mock configurations for unit tests
      globals: {
        'ts-jest': {
          useESM: true
        }
      }
    },
    // Integration tests with real database connections
    {
      displayName: 'integration-prices-phase3d',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/*_phase3d.test.js'],
      setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup.js'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/api/prices/**/*.js',
        '!**/*.d.ts',
      ],
      testTimeout: 30000,
      maxWorkers: 1, // Run integration tests sequentially to avoid database conflicts
      // Specific environment variables for integration tests
      testEnvironmentOptions: {
        NODE_ENV: 'test'
      }
    }
  ],
  // Global settings
  collectCoverageFrom: [
    'app/api/prices/**/*.{js,jsx}',
    'app/prices/**/*.{js,jsx}',
    '!app/api/prices/**/route.js', // Exclude Next.js route handlers from some coverage metrics
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!coverage/**'
  ],
  coverageDirectory: 'coverage/phase3d',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],
  // Coverage thresholds for the entire Phase 3D suite
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  // Test result processors
  reporters: [
    'default'
  ],
  // Global test patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/.next/',
    '/dist/'
  ],
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'jsx',
    'json',
    'node'
  ],
  // Transform configuration for ES6 modules
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  // Setup files
  setupFiles: [],
  // Global setup and teardown
  globalSetup: undefined,
  globalTeardown: undefined,
  // Verbose output for debugging
  verbose: true,
  // Detect open handles (useful for database connections)
  detectOpenHandles: true,
  // Force exit after tests complete
  forceExit: true,
  // Clear mocks between tests
  clearMocks: true,
  // Restore mocks after each test
  restoreMocks: true,
  // Mock static assets and CSS imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': 'jest-transform-stub'
  },
  // Ignore patterns for transformation
  transformIgnorePatterns: [
    '/node_modules/(?!(.*\\.mjs$|@babel|@clerk))',
  ],
  // Test environment variables
  testEnvironment: 'node',
  // Error handling
  errorOnDeprecated: true,
  // Bail configuration
  bail: false,
  // Watch plugins
  watchPlugins: [],
  // Snapshot serializers
  snapshotSerializers: [],
  // Test results cache
  cache: true,
  cacheDirectory: '/tmp/jest_cache_phase3d',
  // Performance monitoring
  logHeapUsage: false,
  // Test filtering
  testNamePattern: undefined,
  testRegex: undefined,
  // Notification settings
  notify: false,
  notifyMode: 'failure-change',
  // Update snapshots
  updateSnapshot: false,
  // Watch all files
  watchAll: false,
  // Roots for module resolution
  roots: ['<rootDir>'],
  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>'],
  // Extensions to resolve
  resolver: undefined,
  // Custom matchers
  setupFilesAfterEnv: [],
  // Silent mode
  silent: false,
  // Max concurrent workers
  maxWorkers: '50%',
  // Custom test runner
  runner: 'jest-runner',
  // Test sequence
  testSequencer: '@jest/test-sequencer'
};