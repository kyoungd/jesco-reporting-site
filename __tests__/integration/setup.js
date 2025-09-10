const { PrismaClient } = require('@prisma/client')
const { execSync } = require('child_process')

// Load test environment variables
require('dotenv').config({ path: '.env.test' })

// Fail fast if TEST_DATABASE_URL is missing
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL environment variable is required for integration tests.\n' +
    'Please create a .env.test file with TEST_DATABASE_URL set to your test database.'
  )
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL,
    },
  },
})

// Mock Clerk functions for integration tests
jest.mock('@clerk/nextjs', () => ({
  currentUser: jest.fn(),
  auth: jest.fn(() => ({ userId: 'test-clerk-user-id' })),
  ClerkProvider: ({ children }) => children,
}))

// Global setup for all integration tests
beforeAll(async () => {
  try {
    // Run database migrations
    console.log('Setting up test database...')
    execSync('npx prisma db push --force-reset', {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      stdio: 'inherit',
    })
    console.log('Test database setup complete.')
  } catch (error) {
    console.error('Failed to setup test database:', error)
    throw error
  }
})

// Clean database before each test
beforeEach(async () => {
  await cleanDatabase()
})

// Cleanup after all tests
afterAll(async () => {
  await cleanDatabase()
  await prisma.$disconnect()
})

// Helper function to clean database
async function cleanDatabase() {
  const tablenames = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  `
  
  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter(name => name !== '_prisma_migrations')
    .map(name => `"public"."${name}"`)
    .join(', ')

  if (tables.length > 0) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`)
    } catch (error) {
      console.log({ error })
    }
  }
}

// Make prisma and utilities available globally
global.prisma = prisma
global.cleanDatabase = cleanDatabase

module.exports = {
  prisma,
  cleanDatabase,
}