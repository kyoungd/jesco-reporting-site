/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverageFrom: [
    'lib/**/*.{js,jsx}',
    'components/**/*.{js,jsx}',
    '!lib/db.js',
    '!**/*.d.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/integration/'
  ],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  testTimeout: 10000
}