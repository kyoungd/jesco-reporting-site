/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // Node environment tests (API routes, utilities)
    {
      displayName: 'phase3b-node',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/__tests__/simple-phase3b.test.js',
        '<rootDir>/__tests__/fixtures/*.test.js',
        '<rootDir>/__tests__/app/api/**/*.test_phase3b.js',
        '<rootDir>/__tests__/edge-cases/**/*.test_phase3b.js',
        '<rootDir>/__tests__/security/**/*.test_phase3b.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 10000,
    },
    // jsdom environment tests (React components)
    {
      displayName: 'phase3b-jsdom',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/__tests__/app/securities/**/*.test_phase3b.js',
        '<rootDir>/__tests__/app/accounts/**/*.test_phase3b.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 10000,
    },
    // Integration tests with real database
    {
      displayName: 'phase3b-integration',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/__tests__/integration/**/*.integration.test_phase3b.js',
        '<rootDir>/__tests__/e2e/**/*.integration.test_phase3b.js'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup.js',
        '<rootDir>/__tests__/setup/db-test-utils.js'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 30000,
      maxWorkers: 1, // Run integration tests sequentially to avoid DB conflicts
    }
  ],
  verbose: true
}