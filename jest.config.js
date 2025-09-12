/** @type {import('jest').Config} */
module.exports = {
  // Global transform for all projects
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },
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
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
    },
    // Phase 4: Unit tests for calculation libraries (Node environment)
    {
      displayName: 'unit-calculations-phase4',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/unit/*_phase4.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'lib/calculations/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
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
    // Phase 4: Integration tests for calculations with real database
    {
      displayName: 'integration-phase4',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/*_phase4.test.js'],
      setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup.js',
        '<rootDir>/__tests__/setup/db-test-utils.js'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 30000,
      maxWorkers: 1,
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
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
    },
    // Phase 4A: Unit tests for authentication/invitation system (Node environment)
    {
      displayName: 'unit-auth-phase4a',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/unit/*_phase4a.test.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      collectCoverageFrom: [
        'lib/email.js',
        'middleware.js',
        'app/api/invites/**/*.{js,jsx}',
        'app/api/auth/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
    },
    // Phase 4A: Integration tests for authentication with real database
    {
      displayName: 'integration-auth-phase4a',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/*_phase4a.test.js'],
      setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup.js',
        '<rootDir>/__tests__/setup/db-test-utils.js'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 30000,
      maxWorkers: 1,
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
    },
    // Phase 5: Unit tests for reports UI (React Testing Library)
    {
      displayName: 'unit-reports-phase5',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/unit/*_phase5.test.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^lucide-react$': '<rootDir>/__tests__/__mocks__/lucide-react.js',
      },
      collectCoverageFrom: [
        'app/reports/**/*.{js,jsx}',
        'components/reports/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
      transformIgnorePatterns: [
        'node_modules/(?!(@clerk|lucide-react)/)'
      ],
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
    },
    // Phase 5: Unit tests for report components (React Testing Library)
    {
      displayName: 'unit-components-phase5',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/unit/components_phase5.test.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^lucide-react$': '<rootDir>/__tests__/__mocks__/lucide-react.js',
      },
      collectCoverageFrom: [
        'components/reports/**/*.{js,jsx}',
        '!**/*.d.ts',
      ],
      testTimeout: 10000,
      transformIgnorePatterns: [
        'node_modules/(?!(@clerk|lucide-react)/)'
      ],
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
    },
    // Phase 5: API integration tests with real database
    {
      displayName: 'integration-api-phase5',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/api_phase5.test.js'],
      setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup.js',
        '<rootDir>/__tests__/setup/db-test-utils.js'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 30000,
      maxWorkers: 1,
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
    },
    // Phase 5: Flow integration tests with real database
    {
      displayName: 'integration-flows-phase5',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/flows_phase5.test.js'],
      setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup.js',
        '<rootDir>/__tests__/setup/db-test-utils.js'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testTimeout: 30000,
      maxWorkers: 1,
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
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