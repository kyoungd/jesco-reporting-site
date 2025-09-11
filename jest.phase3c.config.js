/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // Unit tests for lib functions
    {
      displayName: 'unit-lib-phase3c',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/lib/*transactions*phase3c*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 10000,
    },
    // Unit tests for API routes
    {
      displayName: 'unit-api-phase3c',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/api/*transactions*phase3c*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 15000,
    },
    // Integration tests with real database
    {
      displayName: 'integration-transactions-phase3c',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/*transactions*phase3c*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      maxWorkers: 1,
      testTimeout: 30000,
    },
    // React component tests
    {
      displayName: 'components-phase3c',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/components/*transactions*phase3c*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 10000,
    },
    // Performance tests
    {
      displayName: 'performance-phase3c',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/performance/*phase3c*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      maxWorkers: 1,
      testTimeout: 60000,
    }
  ],
  collectCoverageFrom: [
    'lib/transactions.js',
    'app/api/transactions/**/*.js',
    'app/transactions/**/*.js',
  ],
}