/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  runInBand: true,
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/__tests__/integration/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/integration/**/*.integration.test.js'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/unit/'
  ],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  globalSetup: '<rootDir>/__tests__/integration/globalSetup.js',
  globalTeardown: '<rootDir>/__tests__/integration/globalTeardown.js'
}