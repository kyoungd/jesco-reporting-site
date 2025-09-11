/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // Phase 2: Unit tests for lib functions (Node environment)
    {
      displayName: 'unit-lib-phase2',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/unit/lib_phase2/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'lib/**/*.{js,jsx}',
        '!lib/db.js',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
    },
    // Phase 3A: Unit tests for client components (React Testing Library)
    {
      displayName: 'unit-clients-phase3a',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/unit/clients_phase3a/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/clients/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
    },
    // Phase 3A: Unit tests for API routes (Node environment)
    {
      displayName: 'unit-api-phase3a',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/unit/api_phase3a/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/api/clients/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
    },
    // Phase 2: Integration tests with real database
    {
      displayName: 'integration-phase2',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/lib_phase2/**/*.test.js'],
      setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup.js',
        '<rootDir>/__tests__/setup/db-test-utils.js'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 30000,
      maxWorkers: 1,
    },
    // Phase 3A: Integration tests with real database
    {
      displayName: 'integration-phase3a',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/clients_phase3a/**/*.test.js'],
      setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup.js',
        '<rootDir>/__tests__/setup/db-test-utils.js'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 30000,
      maxWorkers: 1,
    },
    // Phase 3B: Unit tests for securities components (React Testing Library)
    {
      displayName: 'unit-securities-phase3b',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/app/securities/**/*.test_phase3b.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/securities/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
    },
    // Phase 3B: Unit tests for accounts components (React Testing Library)
    {
      displayName: 'unit-accounts-phase3b',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/app/accounts/**/*.test_phase3b.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/accounts/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
    },
    // Phase 3B: Unit tests for securities/accounts API routes (Node environment)
    {
      displayName: 'unit-api-phase3b',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/app/api/**/*.test_phase3b.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'app/api/securities/**/*.{js,jsx}',
        'app/api/accounts/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
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