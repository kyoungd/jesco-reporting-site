// Phase 3D Integration Tests - Price Entry Database Operations
// Testing with real Prisma database connections and transactions

import { PrismaClient } from '@prisma/client'
import { jest } from '@jest/globals'
import { 
  testSecurities, 
  validPrices, 
  priceCreationData,
  bulkPriceData,
  mockUsers,
  expectPriceValidation 
} from '../fixtures/prices_phase3d.js'

// Mock Clerk authentication for integration tests
jest.mock('@clerk/nextjs', () => ({
  auth: jest.fn(() => ({ userId: 'integration-test-user' })),
  currentUser: jest.fn(() => ({
    id: 'integration-test-user',
    emailAddresses: [{ emailAddress: 'integration@test.com' }]
  }))
}))

describe('Phase 3D Price Entry Database Integration Tests', () => {
  let prisma
  let testSecurity1
  let testSecurity2
  let testOrganization
  let testClientProfile

  beforeAll(async () => {
    prisma = new PrismaClient()
    
    // Create test organization
    try {
      testOrganization = await prisma.organization.create({
        data: {
          name: 'Test Org Phase 3D',
          description: 'Test organization for Phase 3D price entry tests'
        }
      })
    } catch (error) {
      // If organization already exists, find it
      const existingOrgs = await prisma.organization.findMany({
        where: { name: 'Test Org Phase 3D' }
      })
      testOrganization = existingOrgs[0]
    }
    
    // Create test securities
    testSecurity1 = await prisma.security.upsert({
      where: { symbol: 'TEST3D1' },
      update: {},
      create: {
        symbol: 'TEST3D1',
        name: 'Test Security 3D 1',
        assetClass: 'EQUITY',
        exchange: 'TEST',
        currency: 'USD'
      }
    })
    
    testSecurity2 = await prisma.security.upsert({
      where: { symbol: 'TEST3D2' },
      update: {},
      create: {
        symbol: 'TEST3D2',
        name: 'Test Security 3D 2',
        assetClass: 'EQUITY',
        exchange: 'TEST',
        currency: 'USD'
      }
    })

    // Create test client profile for missing prices tests
    const testUser = await prisma.user.upsert({
      where: { clerkUserId: 'test-clerk-user-3d' },
      update: {},
      create: {
        clerkUserId: 'test-clerk-user-3d',
        email: 'test-3d@example.com',
        firstName: 'Test',
        lastName: 'User 3D',
        level: 'L2_CLIENT'
      }
    })

    testClientProfile = await prisma.clientProfile.upsert({
      where: { userId: testUser.id },
      update: {},
      create: {
        userId: testUser.id,
        organizationId: testOrganization.id,
        level: 'L2_CLIENT',
        companyName: 'Test Company 3D',
        contactName: 'Test Contact 3D'
      }
    })
  })

  beforeEach(async () => {
    // Clean up all test prices before each test
    await prisma.price.deleteMany({
      where: {
        OR: [
          { securityId: testSecurity1?.id },
          { securityId: testSecurity2?.id },
          { security: { symbol: { in: ['PERF1', 'PERF2', 'PERF3', 'CONC1'] } } }
        ]
      }
    })
    
    // Also clean up any performance test securities
    await prisma.security.deleteMany({
      where: {
        symbol: { in: ['PERF1', 'PERF2', 'PERF3', 'CONC1'] }
      }
    })
  })

  afterAll(async () => {
    try {
      // Clean up test data
      await prisma.position.deleteMany({
        where: { clientProfileId: testClientProfile.id }
      })
      
      await prisma.transaction.deleteMany({
        where: { clientProfileId: testClientProfile.id }
      })

      await prisma.price.deleteMany({
        where: {
          securityId: {
            in: [testSecurity1.id, testSecurity2.id]
          }
        }
      })

      await prisma.clientProfile.deleteMany({
        where: { organizationId: testOrganization.id }
      })
      
      await prisma.user.deleteMany({
        where: { email: { contains: 'test-3d@' } }
      })

      await prisma.security.deleteMany({
        where: {
          symbol: {
            in: ['TEST3D1', 'TEST3D2', 'PERF1', 'PERF2', 'PERF3', 'CONC1']
          }
        }
      })

      await prisma.organization.deleteMany({
        where: { name: 'Test Org Phase 3D' }
      })
    } catch (error) {
      console.error('Cleanup error:', error)
    } finally {
      await prisma.$disconnect()
    }
  })

  describe('Price CRUD Operations', () => {
    it('should create a new price entry', async () => {
      const priceData = {
        securityId: testSecurity1.id,
        date: new Date('2024-01-15'),
        open: 150.25,
        high: 152.80,
        low: 149.50,
        close: 151.75,
        volume: BigInt(1500000)
      }

      const createdPrice = await prisma.price.create({
        data: priceData,
        include: {
          security: {
            select: {
              symbol: true,
              name: true
            }
          }
        }
      })

      expect(createdPrice).toBeDefined()
      expect(createdPrice.securityId).toBe(testSecurity1.id)
      expect(Number(createdPrice.close)).toBe(priceData.close)
      expect(createdPrice.security.symbol).toBe('TEST3D1')
      expectPriceValidation(createdPrice)
    })

    it('should enforce unique constraint on securityId + date', async () => {
      const priceData = {
        securityId: testSecurity1.id,
        date: new Date('2024-01-15'),
        close: 150.00
      }

      // Create first price
      await prisma.price.create({ data: priceData })

      // Try to create duplicate - should fail
      await expect(
        prisma.price.create({ data: priceData })
      ).rejects.toThrow()
    })

    it('should update existing price with upsert', async () => {
      const initialData = {
        securityId: testSecurity1.id,
        date: new Date('2024-01-15'),
        close: 150.00,
        open: 149.50
      }

      // First upsert - creates new record
      const firstUpsert = await prisma.price.upsert({
        where: {
          securityId_date: {
            securityId: testSecurity1.id,
            date: new Date('2024-01-15')
          }
        },
        update: { close: 151.00 },
        create: initialData
      })

      expect(Number(firstUpsert.close)).toBe(150.00)

      // Second upsert - updates existing record
      const secondUpsert = await prisma.price.upsert({
        where: {
          securityId_date: {
            securityId: testSecurity1.id,
            date: new Date('2024-01-15')
          }
        },
        update: { close: 151.00 },
        create: initialData
      })

      expect(Number(secondUpsert.close)).toBe(151.00)
      expect(secondUpsert.id).toBe(firstUpsert.id) // Same record
    })

    it('should handle bulk price creation', async () => {
      const bulkPrices = [
        {
          securityId: testSecurity1.id,
          date: new Date('2024-01-15'),
          close: 150.00
        },
        {
          securityId: testSecurity1.id,
          date: new Date('2024-01-16'),
          close: 151.00
        },
        {
          securityId: testSecurity2.id,
          date: new Date('2024-01-15'),
          close: 2750.00
        }
      ]

      const result = await prisma.price.createMany({
        data: bulkPrices
      })

      expect(result.count).toBe(3)

      const createdPrices = await prisma.price.findMany({
        where: {
          securityId: {
            in: [testSecurity1.id, testSecurity2.id]
          }
        }
      })

      expect(createdPrices).toHaveLength(3)
    })

    it('should delete price entry', async () => {
      const priceData = {
        securityId: testSecurity1.id,
        date: new Date('2024-01-15'),
        close: 150.00
      }

      const createdPrice = await prisma.price.create({ data: priceData })

      await prisma.price.delete({
        where: { id: createdPrice.id }
      })

      const deletedPrice = await prisma.price.findUnique({
        where: { id: createdPrice.id }
      })

      expect(deletedPrice).toBeNull()
    })
  })

  describe('Price Queries and Filtering', () => {
    beforeEach(async () => {
      // Create test price data
      const testPrices = [
        {
          securityId: testSecurity1.id,
          date: new Date('2024-01-15'),
          close: 150.00,
          open: 149.50,
          high: 151.00,
          low: 149.00,
          volume: BigInt(1000000)
        },
        {
          securityId: testSecurity1.id,
          date: new Date('2024-01-16'),
          close: 151.50,
          open: 150.50,
          high: 152.00,
          low: 150.00,
          volume: BigInt(1200000)
        },
        {
          securityId: testSecurity2.id,
          date: new Date('2024-01-15'),
          close: 2750.00,
          open: 2740.00,
          high: 2760.00,
          low: 2730.00,
          volume: BigInt(800000)
        }
      ]

      await prisma.price.createMany({ data: testPrices })
    })

    it('should filter prices by date', async () => {
      const prices = await prisma.price.findMany({
        where: {
          date: new Date('2024-01-15')
        },
        include: {
          security: {
            select: { symbol: true }
          }
        }
      })

      expect(prices).toHaveLength(2)
      expect(prices.every(p => p.date.toISOString().startsWith('2024-01-15'))).toBe(true)
    })

    it('should filter prices by date range', async () => {
      const prices = await prisma.price.findMany({
        where: {
          date: {
            gte: new Date('2024-01-14'),
            lte: new Date('2024-01-17')
          }
        },
        orderBy: { date: 'asc' }
      })

      expect(prices).toHaveLength(3)
      
      // Verify ordering
      expect(prices[0].date <= prices[1].date).toBe(true)
      expect(prices[1].date <= prices[2].date).toBe(true)
    })

    it('should filter prices by security', async () => {
      const prices = await prisma.price.findMany({
        where: {
          securityId: testSecurity1.id
        }
      })

      expect(prices).toHaveLength(2)
      expect(prices.every(p => p.securityId === testSecurity1.id)).toBe(true)
    })

    it('should join with security information', async () => {
      const prices = await prisma.price.findMany({
        include: {
          security: {
            select: {
              symbol: true,
              name: true,
              assetClass: true
            }
          }
        },
        where: {
          securityId: testSecurity1.id
        }
      })

      expect(prices).toHaveLength(2)
      prices.forEach(price => {
        expect(price.security).toBeDefined()
        expect(price.security.symbol).toBe('TEST3D1')
        expect(price.security.assetClass).toBe('EQUITY')
      })
    })

    it('should aggregate price data', async () => {
      const stats = await prisma.price.aggregate({
        where: {
          securityId: testSecurity1.id
        },
        _count: { id: true },
        _avg: { close: true },
        _min: { close: true },
        _max: { close: true }
      })

      expect(stats._count.id).toBe(2)
      expect(Number(stats._avg.close)).toBe(150.75) // (150 + 151.5) / 2
      expect(Number(stats._min.close)).toBe(150.00)
      expect(Number(stats._max.close)).toBe(151.50)
    })
  })

  describe('Missing Prices Detection', () => {
    beforeEach(async () => {
      // Create test positions to simulate securities needing prices
      await prisma.position.create({
        data: {
          date: new Date('2024-01-15'),
          securityId: testSecurity1.id,
          quantity: 1000,
          averageCost: 148.50,
          marketValue: 150000.00,
          clientProfileId: testClientProfile.id
        }
      })

      await prisma.transaction.create({
        data: {
          transactionDate: new Date('2024-01-10'),
          transactionType: 'BUY',
          securityId: testSecurity1.id,
          quantity: 1000,
          price: 148.50,
          amount: 148500.00,
          clientProfileId: testClientProfile.id,
          entryStatus: 'POSTED'
        }
      })
    })

    it('should identify securities with positions but missing prices', async () => {
      // Create partial price data (missing some dates)
      await prisma.price.create({
        data: {
          securityId: testSecurity1.id,
          date: new Date('2024-01-15'),
          close: 150.00
        }
      })

      const securitiesWithPositions = await prisma.security.findMany({
        where: {
          positions: {
            some: {
              quantity: {
                not: 0
              }
            }
          }
        },
        include: {
          positions: {
            orderBy: { date: 'desc' },
            take: 1
          },
          _count: {
            select: {
              transactions: {
                where: {
                  transactionDate: {
                    gte: new Date('2024-01-01')
                  }
                }
              }
            }
          }
        }
      })

      expect(securitiesWithPositions).toHaveLength(1)
      expect(securitiesWithPositions[0].symbol).toBe('TEST3D1')
      expect(Number(securitiesWithPositions[0].positions[0].quantity)).toBe(1000)
      expect(securitiesWithPositions[0]._count.transactions).toBe(1)
    })

    it('should find missing price dates for a security', async () => {
      // Create prices for some dates but not others
      await prisma.price.createMany({
        data: [
          {
            securityId: testSecurity1.id,
            date: new Date('2024-01-15'),
            close: 150.00
          },
          {
            securityId: testSecurity1.id,
            date: new Date('2024-01-17'),
            close: 152.00
          }
        ]
      })

      const existingPrices = await prisma.price.findMany({
        where: {
          securityId: testSecurity1.id,
          date: {
            gte: new Date('2024-01-15'),
            lte: new Date('2024-01-19')
          }
        },
        select: { date: true }
      })

      const existingDates = existingPrices.map(p => p.date.toISOString().split('T')[0])
      
      // Generate business days
      const allDates = ['2024-01-15', '2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19']
      const missingDates = allDates.filter(date => !existingDates.includes(date))

      expect(missingDates).toContain('2024-01-16')
      expect(missingDates).toContain('2024-01-18')
      expect(missingDates).toContain('2024-01-19')
      expect(missingDates).not.toContain('2024-01-15')
      expect(missingDates).not.toContain('2024-01-17')
    })

    it('should prioritize missing prices by position value', async () => {
      // Create another position with different value
      await prisma.position.create({
        data: {
          date: new Date('2024-01-15'),
          securityId: testSecurity2.id,
          quantity: 10,
          averageCost: 2700.00,
          marketValue: 27000.00,
          clientProfileId: testClientProfile.id
        }
      })

      const securitiesWithPositions = await prisma.security.findMany({
        where: {
          positions: {
            some: {
              quantity: {
                not: 0
              }
            }
          }
        },
        include: {
          positions: {
            orderBy: { date: 'desc' },
            take: 1,
            select: {
              quantity: true,
              marketValue: true
            }
          }
        }
      })

      expect(securitiesWithPositions).toHaveLength(2)
      
      // Should be able to prioritize by market value
      const sortedByValue = securitiesWithPositions.sort((a, b) => 
        Number(b.positions[0].marketValue) - Number(a.positions[0].marketValue)
      )
      
      expect(Number(sortedByValue[0].positions[0].marketValue)).toBeGreaterThan(
        Number(sortedByValue[1].positions[0].marketValue)
      )
    })
  })

  describe('Database Constraints and Validation', () => {
    it('should enforce foreign key constraint on securityId', async () => {
      const invalidPriceData = {
        securityId: 'non-existent-security-id',
        date: new Date('2024-01-15'),
        close: 150.00
      }

      await expect(
        prisma.price.create({ data: invalidPriceData })
      ).rejects.toThrow()
    })

    it('should handle decimal precision correctly', async () => {
      const precisePrice = {
        securityId: testSecurity1.id,
        date: new Date('2024-01-15'),
        open: 123.456789,
        high: 124.987654,
        low: 122.123456,
        close: 123.789012,
        adjustedClose: 123.789012
      }

      const createdPrice = await prisma.price.create({
        data: precisePrice
      })

      // Prisma should handle decimal precision as defined in schema (18,6)
      expect(Number(createdPrice.open)).toBeCloseTo(123.456789, 6)
      expect(Number(createdPrice.high)).toBeCloseTo(124.987654, 6)
      expect(Number(createdPrice.low)).toBeCloseTo(122.123456, 6)
      expect(Number(createdPrice.close)).toBeCloseTo(123.789012, 6)
    })

    it('should handle large volume values as BigInt', async () => {
      const largeVolumePrice = {
        securityId: testSecurity1.id,
        date: new Date('2024-01-15'),
        close: 150.00,
        volume: BigInt('9223372036854775807') // Large BigInt value
      }

      const createdPrice = await prisma.price.create({
        data: largeVolumePrice
      })

      expect(createdPrice.volume).toBe(BigInt('9223372036854775807'))
    })

    it('should maintain referential integrity on security deletion', async () => {
      // Create a price entry that will prevent security deletion
      const priceData = {
        securityId: testSecurity1.id,
        date: new Date('2024-01-15'),
        close: 150.00
      }

      const createdPrice = await prisma.price.create({ data: priceData })
      
      // Verify price exists
      expect(createdPrice.id).toBeDefined()

      // Try to delete the security - behavior depends on schema configuration
      try {
        await prisma.security.delete({
          where: { id: testSecurity1.id }
        })
        
        // If deletion succeeded, it means cascade delete is configured
        // Verify the price was also deleted
        const price = await prisma.price.findUnique({
          where: { id: createdPrice.id }
        })
        expect(price).toBeNull()
        
        // Recreate the security for other tests
        const recreatedSecurity = await prisma.security.create({
          data: {
            symbol: 'TEST3D1',
            name: 'Test Security 3D 1',
            assetClass: 'EQUITY',
            exchange: 'TEST',
            currency: 'USD'
          }
        })
        testSecurity1 = recreatedSecurity
        
      } catch (error) {
        // If deletion failed, it means restrict constraint is configured
        expect(error.code).toBe('P2003') // Foreign key constraint violation
        
        // Price should still exist
        const price = await prisma.price.findUnique({
          where: { id: createdPrice.id }
        })
        expect(price).not.toBeNull()
      }
    })

    it('should cascade delete prices when security is deleted with proper setup', async () => {
      // This test demonstrates the cascade behavior defined in the schema
      // First create a temporary security for deletion testing
      const tempSecurity = await prisma.security.create({
        data: {
          symbol: 'TEMP3D',
          name: 'Temporary Security 3D',
          assetClass: 'EQUITY'
        }
      })

      const priceData = {
        securityId: tempSecurity.id,
        date: new Date('2024-01-15'),
        close: 150.00
      }

      const createdPrice = await prisma.price.create({ data: priceData })

      // Delete the security (this should cascade delete the price due to schema definition)
      await prisma.security.delete({
        where: { id: tempSecurity.id }
      })

      // Price should be deleted due to cascade
      const deletedPrice = await prisma.price.findUnique({
        where: { id: createdPrice.id }
      })
      expect(deletedPrice).toBeNull()
    })
  })

  describe('Performance and Indexing', () => {
    it('should perform well with date-based queries', async () => {
      // Ensure we have valid security for performance test
      const perfSecurity = await prisma.security.upsert({
        where: { symbol: 'PERF1' },
        update: {},
        create: {
          symbol: 'PERF1',
          name: 'Performance Test Security 1',
          assetClass: 'EQUITY',
          exchange: 'TEST',
          currency: 'USD'
        }
      })
      
      // Create a larger dataset for performance testing
      const largePriceSet = []
      const dates = []
      
      for (let i = 0; i < 100; i++) {
        const date = new Date('2024-01-01')
        date.setDate(date.getDate() + i)
        dates.push(new Date(date)) // Create new Date object
        
        largePriceSet.push({
          securityId: perfSecurity.id,
          date: new Date(date), // Create new Date object
          close: 150.00 + Math.random() * 10
        })
      }

      await prisma.price.createMany({ data: largePriceSet })

      const startTime = Date.now()
      
      const dateRangePrices = await prisma.price.findMany({
        where: {
          date: {
            gte: new Date('2024-02-01'),
            lte: new Date('2024-03-01')
          }
        },
        orderBy: { date: 'desc' }
      })

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(dateRangePrices.length).toBeGreaterThan(0)
      expect(queryTime).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should perform well with security-based queries', async () => {
      // Ensure we have valid securities for performance test
      const perfSecurity1 = await prisma.security.upsert({
        where: { symbol: 'PERF2' },
        update: {},
        create: {
          symbol: 'PERF2',
          name: 'Performance Test Security 2',
          assetClass: 'EQUITY',
          exchange: 'TEST',
          currency: 'USD'
        }
      })
      
      const perfSecurity2 = await prisma.security.upsert({
        where: { symbol: 'PERF3' },
        update: {},
        create: {
          symbol: 'PERF3',
          name: 'Performance Test Security 3',
          assetClass: 'EQUITY',
          exchange: 'TEST',
          currency: 'USD'
        }
      })
      
      // Create prices for multiple securities
      const multiSecurityPrices = []
      
      for (let i = 0; i < 30; i++) { // Reduced to 30 to stay within month bounds
        const dayStr = String(i + 1).padStart(2, '0')
        if (i + 1 <= 31) { // Only valid days
          multiSecurityPrices.push(
            {
              securityId: perfSecurity1.id,
              date: new Date(`2024-01-${dayStr}`),
              close: 150.00 + i
            },
            {
              securityId: perfSecurity2.id,
              date: new Date(`2024-01-${dayStr}`),
              close: 2750.00 + i * 10
            }
          )
        }
      }

      await prisma.price.createMany({ data: multiSecurityPrices })

      const startTime = Date.now()
      
      const securityPrices = await prisma.price.findMany({
        where: {
          securityId: perfSecurity1.id
        },
        orderBy: { date: 'desc' }
      })

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(securityPrices).toHaveLength(30)
      expect(queryTime).toBeLessThan(500) // Should complete within 0.5 seconds
    })
  })

  describe('Transaction Handling', () => {
    it('should maintain atomicity in bulk operations', async () => {
      const bulkPrices = [
        {
          securityId: testSecurity1.id,
          date: new Date('2024-01-15'),
          close: 150.00
        },
        {
          securityId: testSecurity1.id,
          date: new Date('2024-01-16'),
          close: 151.00
        },
        {
          // This will fail due to invalid security ID
          securityId: 'invalid-security-id',
          date: new Date('2024-01-17'),
          close: 152.00
        }
      ]

      // Use transaction to ensure atomicity
      await expect(
        prisma.$transaction(async (tx) => {
          for (const price of bulkPrices) {
            await tx.price.create({ data: price })
          }
        })
      ).rejects.toThrow()

      // Verify no prices were created due to rollback
      const createdPrices = await prisma.price.findMany({
        where: {
          securityId: testSecurity1.id,
          date: {
            in: [new Date('2024-01-15'), new Date('2024-01-16')]
          }
        }
      })

      expect(createdPrices).toHaveLength(0)
    })

    it('should handle concurrent price updates correctly', async () => {
      // Ensure we have valid security for concurrent test
      const concurrentSecurity = await prisma.security.upsert({
        where: { symbol: 'CONC1' },
        update: {},
        create: {
          symbol: 'CONC1',
          name: 'Concurrent Test Security',
          assetClass: 'EQUITY',
          exchange: 'TEST',
          currency: 'USD'
        }
      })
      
      // Create initial price
      const initialPrice = await prisma.price.create({
        data: {
          securityId: concurrentSecurity.id,
          date: new Date('2024-01-15'),
          close: 150.00
        }
      })

      // Simulate concurrent updates
      const update1 = prisma.price.update({
        where: { id: initialPrice.id },
        data: { close: 151.00 }
      })

      const update2 = prisma.price.update({
        where: { id: initialPrice.id },
        data: { high: 152.00 }
      })

      // Both updates should succeed
      await Promise.all([update1, update2])

      const finalPrice = await prisma.price.findUnique({
        where: { id: initialPrice.id }
      })

      // One of the updates should be reflected (last one wins)
      expect(finalPrice).not.toBeNull()
      expect(Number(finalPrice.close)).toBeGreaterThan(150.00)
    })
  })
})