import { PrismaClient } from '@prisma/client'
import { 
  cleanDatabase, 
  seedTestData, 
  createTestSecurity, 
  findSecuritiesByTicker,
  waitForDatabase,
  disconnectDatabase,
  createTestSecurityData
} from './helpers/phase3b-helpers.js'

const prisma = new PrismaClient({ 
  datasourceUrl: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
})

describe('Securities Integration Tests Phase 3B', () => {
  let testData

  beforeAll(async () => {
    await waitForDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()
    testData = await seedTestData()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectDatabase()
  })

  describe('Security CRUD Operations', () => {
    it('should create security with real database', async () => {
      const securityData = createTestSecurityData({
        ticker: 'NEWTEST',
        name: 'New Test Security Inc.',
        type: 'Stock',
        exchange: 'NYSE'
      })

      const security = await createTestSecurity(securityData)

      expect(security).toBeDefined()
      expect(security.id).toBeDefined()
      expect(security.ticker).toBe('NEWTEST')
      expect(security.name).toBe('New Test Security Inc.')
      expect(security.type).toBe('Stock')
      expect(security.exchange).toBe('NYSE')
      expect(security.isActive).toBe(true)
      expect(security.createdAt).toBeInstanceOf(Date)
      expect(security.updatedAt).toBeInstanceOf(Date)

      // Verify it's actually in the database
      const foundSecurity = await prisma.security.findUnique({
        where: { id: security.id }
      })
      expect(foundSecurity).toBeTruthy()
      expect(foundSecurity.ticker).toBe('NEWTEST')
    })

    it('should enforce unique ticker constraint', async () => {
      // Create first security
      await createTestSecurity({
        ticker: 'UNIQUE',
        name: 'First Security'
      })

      // Try to create second security with same ticker
      await expect(
        createTestSecurity({
          ticker: 'UNIQUE',
          name: 'Second Security'
        })
      ).rejects.toThrow()

      // Verify only one security exists
      const securities = await prisma.security.findMany({
        where: { ticker: 'UNIQUE' }
      })
      expect(securities).toHaveLength(1)
      expect(securities[0].name).toBe('First Security')
    })

    it('should update security and verify changes persist', async () => {
      const security = await createTestSecurity({
        ticker: 'UPDATE',
        name: 'Original Name',
        type: 'Stock'
      })

      // Update the security
      const updatedSecurity = await prisma.security.update({
        where: { id: security.id },
        data: {
          name: 'Updated Name',
          type: 'Bond',
          isActive: false
        }
      })

      expect(updatedSecurity.name).toBe('Updated Name')
      expect(updatedSecurity.type).toBe('Bond')
      expect(updatedSecurity.isActive).toBe(false)
      expect(updatedSecurity.ticker).toBe('UPDATE') // Should remain unchanged

      // Verify persistence by refetching
      const refetchedSecurity = await prisma.security.findUnique({
        where: { id: security.id }
      })
      expect(refetchedSecurity.name).toBe('Updated Name')
      expect(refetchedSecurity.type).toBe('Bond')
      expect(refetchedSecurity.isActive).toBe(false)
    })

    it('should delete security and verify removal', async () => {
      const security = await createTestSecurity({
        ticker: 'DELETE',
        name: 'To Be Deleted'
      })

      // Verify it exists
      let foundSecurity = await prisma.security.findUnique({
        where: { id: security.id }
      })
      expect(foundSecurity).toBeTruthy()

      // Delete the security
      await prisma.security.delete({
        where: { id: security.id }
      })

      // Verify it's gone
      foundSecurity = await prisma.security.findUnique({
        where: { id: security.id }
      })
      expect(foundSecurity).toBeNull()
    })

    it('should handle cascade behavior when security is referenced', async () => {
      // Create a security
      const security = await createTestSecurity({
        ticker: 'CASCADE',
        name: 'Security with References'
      })

      // Create an account that might reference this security (placeholder)
      // Note: This depends on your actual schema relationships
      // If securities are referenced in accounts or other tables,
      // test the cascade behavior here

      // For now, just verify the security can be deleted
      await prisma.security.delete({
        where: { id: security.id }
      })

      const deletedSecurity = await prisma.security.findUnique({
        where: { id: security.id }
      })
      expect(deletedSecurity).toBeNull()
    })
  })

  describe('Security Search and Filtering', () => {
    beforeEach(async () => {
      // Create additional test securities for search testing
      await createTestSecurity({
        ticker: 'APPLE',
        name: 'Apple Inc.',
        type: 'Stock',
        exchange: 'NASDAQ'
      })

      await createTestSecurity({
        ticker: 'MSFT',
        name: 'Microsoft Corporation',
        type: 'Stock',
        exchange: 'NASDAQ'
      })

      await createTestSecurity({
        ticker: 'BOND1',
        name: 'Government Bond Fund',
        type: 'Bond',
        exchange: 'NYSE'
      })
    })

    it('should search by ticker with real data', async () => {
      const appleResults = await findSecuritiesByTicker('APPLE')
      expect(appleResults).toHaveLength(1)
      expect(appleResults[0].ticker).toBe('APPLE')
      expect(appleResults[0].name).toBe('Apple Inc.')

      const testResults = await findSecuritiesByTicker('TEST')
      expect(testResults.length).toBeGreaterThan(0)
      testResults.forEach(security => {
        expect(security.ticker).toMatch(/TEST/i)
      })
    })

    it('should perform case-insensitive search', async () => {
      const results = await findSecuritiesByTicker('apple')
      expect(results).toHaveLength(1)
      expect(results[0].ticker).toBe('APPLE')

      const msftResults = await findSecuritiesByTicker('msft')
      expect(msftResults).toHaveLength(1)
      expect(msftResults[0].ticker).toBe('MSFT')
    })

    it('should filter by type', async () => {
      const stockSecurities = await prisma.security.findMany({
        where: { type: 'Stock' }
      })
      expect(stockSecurities.length).toBeGreaterThan(0)
      stockSecurities.forEach(security => {
        expect(security.type).toBe('Stock')
      })

      const bondSecurities = await prisma.security.findMany({
        where: { type: 'Bond' }
      })
      expect(bondSecurities.length).toBeGreaterThan(0)
      bondSecurities.forEach(security => {
        expect(security.type).toBe('Bond')
      })
    })

    it('should filter by exchange', async () => {
      const nasdaqSecurities = await prisma.security.findMany({
        where: { exchange: 'NASDAQ' }
      })
      expect(nasdaqSecurities.length).toBeGreaterThan(0)
      nasdaqSecurities.forEach(security => {
        expect(security.exchange).toBe('NASDAQ')
      })

      const nyseSecurities = await prisma.security.findMany({
        where: { exchange: 'NYSE' }
      })
      expect(nyseSecurities.length).toBeGreaterThan(0)
      nyseSecurities.forEach(security => {
        expect(security.exchange).toBe('NYSE')
      })
    })

    it('should filter by active status', async () => {
      // Create an inactive security
      await createTestSecurity({
        ticker: 'INACTIVE',
        name: 'Inactive Security',
        isActive: false
      })

      const activeSecurities = await prisma.security.findMany({
        where: { isActive: true }
      })
      activeSecurities.forEach(security => {
        expect(security.isActive).toBe(true)
      })

      const inactiveSecurities = await prisma.security.findMany({
        where: { isActive: false }
      })
      expect(inactiveSecurities).toHaveLength(1)
      expect(inactiveSecurities[0].ticker).toBe('INACTIVE')
    })

    it('should handle complex search queries', async () => {
      const results = await prisma.security.findMany({
        where: {
          AND: [
            { type: 'Stock' },
            { exchange: 'NASDAQ' },
            { isActive: true },
            {
              OR: [
                { ticker: { contains: 'APPLE', mode: 'insensitive' } },
                { name: { contains: 'Microsoft', mode: 'insensitive' } }
              ]
            }
          ]
        }
      })

      expect(results.length).toBeGreaterThan(0)
      results.forEach(security => {
        expect(security.type).toBe('Stock')
        expect(security.exchange).toBe('NASDAQ')
        expect(security.isActive).toBe(true)
        expect(
          security.ticker.toLowerCase().includes('apple') ||
          security.name.toLowerCase().includes('microsoft')
        ).toBe(true)
      })
    })
  })

  describe('Security Data Validation', () => {
    it('should validate required fields', async () => {
      // Missing ticker
      await expect(
        prisma.security.create({
          data: {
            name: 'Test Security',
            type: 'Stock',
            exchange: 'NASDAQ'
          }
        })
      ).rejects.toThrow()

      // Missing name
      await expect(
        prisma.security.create({
          data: {
            ticker: 'TEST',
            type: 'Stock',
            exchange: 'NASDAQ'
          }
        })
      ).rejects.toThrow()
    })

    it('should enforce ticker format constraints', async () => {
      // Ticker too long (assuming there's a constraint)
      const longTicker = 'A'.repeat(50)
      
      await expect(
        createTestSecurity({
          ticker: longTicker,
          name: 'Test Security'
        })
      ).rejects.toThrow()
    })

    it('should handle special characters in ticker and name', async () => {
      // Test with valid special characters
      const security = await createTestSecurity({
        ticker: 'TEST-A',
        name: 'Test Security & Co.'
      })

      expect(security.ticker).toBe('TEST-A')
      expect(security.name).toBe('Test Security & Co.')
    })
  })

  describe('Security Timestamps and Audit', () => {
    it('should set creation and update timestamps', async () => {
      const beforeCreate = new Date()
      
      const security = await createTestSecurity({
        ticker: 'TIMESTAMP',
        name: 'Timestamp Test'
      })

      const afterCreate = new Date()

      expect(security.createdAt).toBeInstanceOf(Date)
      expect(security.updatedAt).toBeInstanceOf(Date)
      expect(security.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(security.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(security.updatedAt.getTime()).toBe(security.createdAt.getTime())
    })

    it('should update timestamp on modification', async () => {
      const security = await createTestSecurity({
        ticker: 'UPDATE_TS',
        name: 'Update Timestamp Test'
      })

      const originalUpdatedAt = security.updatedAt

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      const updatedSecurity = await prisma.security.update({
        where: { id: security.id },
        data: { name: 'Modified Name' }
      })

      expect(updatedSecurity.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
      expect(updatedSecurity.createdAt.getTime()).toBe(security.createdAt.getTime())
    })
  })

  describe('Bulk Operations', () => {
    it('should handle bulk security creation', async () => {
      const securitiesData = []
      for (let i = 1; i <= 10; i++) {
        securitiesData.push(createTestSecurityData({
          ticker: `BULK${i}`,
          name: `Bulk Security ${i}`
        }))
      }

      const result = await prisma.security.createMany({
        data: securitiesData
      })

      expect(result.count).toBe(10)

      const createdSecurities = await prisma.security.findMany({
        where: {
          ticker: { startsWith: 'BULK' }
        }
      })

      expect(createdSecurities).toHaveLength(10)
    })

    it('should handle bulk updates', async () => {
      // Create test securities
      for (let i = 1; i <= 5; i++) {
        await createTestSecurity({
          ticker: `BATCH${i}`,
          name: `Batch Security ${i}`,
          type: 'Stock'
        })
      }

      // Update all batch securities to bonds
      const result = await prisma.security.updateMany({
        where: {
          ticker: { startsWith: 'BATCH' }
        },
        data: {
          type: 'Bond'
        }
      })

      expect(result.count).toBe(5)

      // Verify updates
      const updatedSecurities = await prisma.security.findMany({
        where: {
          ticker: { startsWith: 'BATCH' }
        }
      })

      updatedSecurities.forEach(security => {
        expect(security.type).toBe('Bond')
      })
    })

    it('should handle bulk deletion', async () => {
      // Create test securities
      for (let i = 1; i <= 3; i++) {
        await createTestSecurity({
          ticker: `DEL${i}`,
          name: `Delete Security ${i}`
        })
      }

      // Delete all DEL securities
      const result = await prisma.security.deleteMany({
        where: {
          ticker: { startsWith: 'DEL' }
        }
      })

      expect(result.count).toBe(3)

      // Verify deletion
      const remainingSecurities = await prisma.security.findMany({
        where: {
          ticker: { startsWith: 'DEL' }
        }
      })

      expect(remainingSecurities).toHaveLength(0)
    })
  })
})