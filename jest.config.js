/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // Unit tests for components (React Testing Library)
    {
      displayName: 'unit-components',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/unit/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/**/*.{js,jsx}',
        'components/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
    },
    // Unit tests for API routes and lib functions (Node environment)
    {
      displayName: 'unit-api',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/__tests__/unit/api/**/*.test.js',
        '<rootDir>/__tests__/unit/lib/**/*.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/api/**/*.{js,jsx}',
        'lib/**/*.{js,jsx}',
        '!lib/db.js',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
      globals: {
        'ts-jest': {
          useESM: true
        }
      },
    },
    // Integration tests with real database
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/**/*.test.js'],
      setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup.js',
        '<rootDir>/__tests__/setup/db-test-utils.js'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 30000,
      maxWorkers: 1, // Run integration tests serially
    }
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx}',
    'components/**/*.{js,jsx}',
    'lib/**/*.{js,jsx}',
    '!lib/db.js',
    '!**/*.d.ts',
    '!**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
}