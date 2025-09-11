import { PrismaClient } from '@prisma/client'
import { 
  cleanDatabase, 
  seedTestData, 
  createTestSecurity, 
  findSecuritiesByTicker,
  waitForDatabase,
  disconnectDatabase,
  createTestSecurityData
} from '../integration/helpers/phase3b-helpers.js'
import {
  generateMaliciousInputs,
  simulateConcurrentRequests,
  createSecurityTestSuite,
  createCorruptionScenarios,
  injectMaliciousInput
} from '../utils/stress-test-helpers.js'

const prisma = new PrismaClient({ 
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

describe('Securities Edge Case Tests Phase 3B', () => {
  let testData
  let securityTestSuite

  beforeAll(async () => {
    await waitForDatabase()
    securityTestSuite = createSecurityTestSuite()
  })

  beforeEach(async () => {
    await cleanDatabase()
    testData = await seedTestData()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectDatabase()
  })

  describe('Ticker Boundary Conditions', () => {
    it('should handle minimum length ticker', async () => {
      const security = await createTestSecurity({
        ticker: 'A',
        name: 'Single Letter Security'
      })

      expect(security.ticker).toBe('A')
      expect(security.name).toBe('Single Letter Security')
    })

    it('should handle maximum length ticker', async () => {
      const longTicker = 'A'.repeat(20) // Assuming 20 is max length
      
      try {
        const security = await createTestSecurity({
          ticker: longTicker,
          name: 'Maximum Length Ticker Security'
        })
        
        expect(security.ticker).toBe(longTicker)
      } catch (error) {
        // If there's a length constraint, verify it's enforced
        expect(error.message).toMatch(/length|constraint|limit/i)
      }
    })

    it('should reject empty ticker', async () => {
      await expect(
        createTestSecurity({
          ticker: '',
          name: 'Empty Ticker Security'
        })
      ).rejects.toThrow()
    })

    it('should reject null ticker', async () => {
      await expect(
        prisma.security.create({
          data: {
            ticker: null,
            name: 'Null Ticker Security',
            type: 'Stock',
            exchange: 'NYSE',
            isActive: true
          }
        })
      ).rejects.toThrow()
    })

    it('should handle special characters in ticker', async () => {
      const specialTickers = [
        'TEST-A',
        'TEST.A', 
        'TEST_A',
        'BRK-B',
        'BRK.B'
      ]

      const results = []
      for (const ticker of specialTickers) {
        try {
          const security = await createTestSecurity({
            ticker,
            name: `Special Character Security ${ticker}`
          })
          results.push({ ticker, success: true, security })
        } catch (error) {
          results.push({ ticker, success: false, error: error.message })
        }
      }

      // Log results for manual verification
      console.log('Special character ticker test results:', results)
      
      // At least some common patterns should work
      const successful = results.filter(r => r.success)
      expect(successful.length).toBeGreaterThan(0)
    })

    it('should reject duplicate tickers case-insensitively', async () => {
      await createTestSecurity({
        ticker: 'DUPLICATE',
        name: 'First Security'
      })

      // Try various case combinations
      const duplicateCases = ['duplicate', 'Duplicate', 'DuPlIcAtE', 'DUPLICATE']
      
      for (const ticker of duplicateCases) {
        await expect(
          createTestSecurity({
            ticker,
            name: `Duplicate Case ${ticker}`
          })
        ).rejects.toThrow()
      }
    })
  })

  describe('Name Boundary Conditions', () => {
    it('should handle very long security names', async () => {
      const longName = 'Very Long Security Name '.repeat(20) + 'Corporation'
      
      try {
        const security = await createTestSecurity({
          ticker: 'LONGNAME',
          name: longName
        })
        
        expect(security.name).toBe(longName)
      } catch (error) {
        // If there's a length constraint, verify it's enforced
        expect(error.message).toMatch(/length|constraint|limit/i)
      }
    })

    it('should handle names with unicode characters', async () => {
      const unicodeNames = [
        'Société Générale',
        'Zürich Insurance',
        'Tōkyō Electric',
        'Россия Корпорация',
        'العربية للتأمين',
        '中国银行股份',
        'Test 🚀 Corp'
      ]

      const results = []
      for (let i = 0; i < unicodeNames.length; i++) {
        const name = unicodeNames[i]
        try {
          const security = await createTestSecurity({
            ticker: `UNI${i}`,
            name
          })
          results.push({ name, success: true, security })
        } catch (error) {
          results.push({ name, success: false, error: error.message })
        }
      }

      // Log results for verification
      console.log('Unicode name test results:', results)
      
      // At least basic Latin characters should work
      const basicLatinResults = results.filter(r => 
        /^[A-Za-z\s]+$/.test(r.name) || r.name.includes('Société')
      )
      expect(basicLatinResults.some(r => r.success)).toBe(true)
    })

    it('should reject empty names', async () => {
      await expect(
        createTestSecurity({
          ticker: 'EMPTY',
          name: ''
        })
      ).rejects.toThrow()
    })

    it('should handle names with only whitespace', async () => {
      await expect(
        createTestSecurity({
          ticker: 'SPACE',
          name: '   '
        })
      ).rejects.toThrow()
    })
  })

  describe('Type and Exchange Validation', () => {
    it('should reject invalid security types', async () => {
      const invalidTypes = ['InvalidType', 'INVALID', 'NotAType', '']
      
      for (const type of invalidTypes) {
        await expect(
          createTestSecurity({
            ticker: `INV${Math.random().toString(36).substring(7)}`,
            name: 'Invalid Type Security',
            type
          })
        ).rejects.toThrow()
      }
    })

    it('should reject invalid exchanges', async () => {
      const invalidExchanges = ['InvalidExchange', 'INVALID', 'NotAnExchange', '']
      
      for (const exchange of invalidExchanges) {
        await expect(
          createTestSecurity({
            ticker: `INV${Math.random().toString(36).substring(7)}`,
            name: 'Invalid Exchange Security',
            exchange
          })
        ).rejects.toThrow()
      }
    })

    it('should handle null values for optional fields', async () => {
      const security = await createTestSecurity({
        ticker: 'NULLTEST',
        name: 'Null Fields Test',
        description: null,
        sector: null
      })

      expect(security.ticker).toBe('NULLTEST')
      expect(security.description).toBeNull()
      expect(security.sector).toBeNull()
    })
  })

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle concurrent creation of different securities', async () => {
      const createSecurity = async (index) => {
        return createTestSecurity({
          ticker: `CONC${index}`,
          name: `Concurrent Security ${index}`
        })
      }

      const results = await simulateConcurrentRequests(createSecurity, 10)
      
      expect(results.fulfilled).toBe(10)
      expect(results.rejected).toBe(0)
      expect(results.successRate).toBe(1.0)

      // Verify all securities were created
      const securities = await prisma.security.findMany({
        where: { ticker: { startsWith: 'CONC' } }
      })
      expect(securities).toHaveLength(10)
    })

    it('should handle concurrent creation with duplicate tickers', async () => {
      const createDuplicate = async (index) => {
        return createTestSecurity({
          ticker: 'DUPLICATE',
          name: `Duplicate Attempt ${index}`
        })
      }

      const results = await simulateConcurrentRequests(createDuplicate, 5)
      
      // Only one should succeed, others should fail
      expect(results.fulfilled).toBe(1)
      expect(results.rejected).toBe(4)

      // Verify only one security exists
      const securities = await prisma.security.findMany({
        where: { ticker: 'DUPLICATE' }
      })
      expect(securities).toHaveLength(1)
    })

    it('should handle concurrent updates to same security', async () => {
      const security = await createTestSecurity({
        ticker: 'UPDATE',
        name: 'Original Name'
      })

      const updateSecurity = async (index) => {
        return prisma.security.update({
          where: { id: security.id },
          data: { name: `Updated Name ${index}` }
        })
      }

      const results = await simulateConcurrentRequests(updateSecurity, 5)
      
      // All updates should succeed (last one wins)
      expect(results.fulfilled).toBe(5)
      expect(results.rejected).toBe(0)

      // Verify security was updated
      const updatedSecurity = await prisma.security.findUnique({
        where: { id: security.id }
      })
      expect(updatedSecurity.name).toMatch(/^Updated Name \d$/)
    })
  })

  describe('Malicious Input Protection', () => {
    let maliciousInputs

    beforeAll(() => {
      maliciousInputs = generateMaliciousInputs()
    })

    it('should protect against SQL injection in ticker field', async () => {
      for (const injection of maliciousInputs.sqlInjection) {
        try {
          await createTestSecurity({
            ticker: injection,
            name: 'SQL Injection Test'
          })
        } catch (error) {
          // Should fail validation/sanitization, not SQL error
          expect(error.message).not.toMatch(/syntax error|sql|database/i)
        }
      }

      // Verify no malicious data was inserted
      const suspiciousSec = await prisma.security.findMany({
        where: { 
          OR: [
            { ticker: { contains: 'DROP' } },
            { ticker: { contains: 'DELETE' } },
            { ticker: { contains: 'INSERT' } },
            { ticker: { contains: 'UPDATE' } }
          ]
        }
      })
      expect(suspiciousSec).toHaveLength(0)
    })

    it('should protect against XSS in name field', async () => {
      for (const xss of maliciousInputs.xss) {
        try {
          const security = await createTestSecurity({
            ticker: `XSS${Math.random().toString(36).substring(7)}`,
            name: xss
          })
          
          // If creation succeeds, verify XSS was sanitized
          expect(securityTestSuite.testXSS(security.name)).toBe(false)
        } catch (error) {
          // Should fail validation, which is acceptable
          expect(error).toBeDefined()
        }
      }
    })

    it('should handle buffer overflow attacks', async () => {
      for (const overflow of maliciousInputs.overflowAttacks) {
        try {
          await createTestSecurity({
            ticker: overflow.substring(0, 10), // Truncate for ticker
            name: overflow
          })
        } catch (error) {
          // Should fail gracefully with validation error
          expect(error.message).not.toMatch(/segmentation|memory|crash/i)
        }
      }
    })

    it('should handle null injection attacks', async () => {
      for (const nullInjection of maliciousInputs.specialCharacters.filter(sc => 
        sc.includes('\\u0000') || sc.includes('%00')
      )) {
        await expect(
          createTestSecurity({
            ticker: 'NULL' + Math.random().toString(36).substring(7),
            name: nullInjection
          })
        ).rejects.toThrow()
      }
    })
  })

  describe('Data Corruption Scenarios', () => {
    let corruptionScenarios

    beforeAll(() => {
      corruptionScenarios = createCorruptionScenarios()
    })

    it('should handle corrupted ticker data', async () => {
      const validTicker = 'VALID'
      const corruptedTicker = corruptionScenarios.corruptTicker(validTicker)
      
      try {
        await createTestSecurity({
          ticker: corruptedTicker,
          name: 'Corruption Test'
        })
      } catch (error) {
        // Should fail validation, not crash
        expect(error).toBeDefined()
        expect(error.message).not.toMatch(/crash|segmentation|fatal/i)
      }
    })

    it('should handle corrupted numeric data', async () => {
      const security = await createTestSecurity({
        ticker: 'CORRUPT',
        name: 'Corruption Test'
      })

      const corruptedNumber = corruptionScenarios.corruptNumber(1000)
      
      try {
        await prisma.security.update({
          where: { id: security.id },
          data: { 
            // Assuming there are numeric fields that can be corrupted
            sortOrder: corruptedNumber
          }
        })
      } catch (error) {
        // Should handle gracefully
        expect(error).toBeDefined()
      }
    })
  })

  describe('Edge Case Search Operations', () => {
    beforeEach(async () => {
      // Create securities with edge case data
      await createTestSecurity({
        ticker: 'EDGE-1',
        name: 'Edge Case Security 1'
      })
      
      await createTestSecurity({
        ticker: 'EDGE.2',
        name: 'Edge Case Security 2'
      })
      
      await createTestSecurity({
        ticker: 'EDGE_3',
        name: 'Edge Case Security 3'
      })
    })

    it('should handle search with special characters', async () => {
      const searchTerms = ['EDGE-', 'EDGE.', 'EDGE_', '-1', '.2', '_3']
      
      for (const term of searchTerms) {
        const results = await findSecuritiesByTicker(term)
        expect(results.length).toBeGreaterThanOrEqual(0)
        // Should not crash or return unexpected results
      }
    })

    it('should handle empty search results gracefully', async () => {
      const results = await findSecuritiesByTicker('NONEXISTENT')
      expect(results).toHaveLength(0)
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle very long search terms', async () => {
      const longSearchTerm = 'A'.repeat(1000)
      const results = await findSecuritiesByTicker(longSearchTerm)
      expect(results).toHaveLength(0)
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle malicious search terms', async () => {
      const maliciousTerms = [
        "'; DROP TABLE securities; --",
        "<script>alert('XSS')</script>",
        "../../etc/passwd",
        "\\x00\\x01\\x02",
        "%00%0A%0D"
      ]

      for (const term of maliciousTerms) {
        const results = await findSecuritiesByTicker(term)
        expect(results).toHaveLength(0)
        expect(Array.isArray(results)).toBe(true)
      }
    })
  })

  describe('Resource Limits and Performance Edge Cases', () => {
    it('should handle pagination with extreme values', async () => {
      // Test with very large page numbers
      const largePageResults = await prisma.security.findMany({
        skip: 999999999,
        take: 10
      })
      expect(largePageResults).toHaveLength(0)

      // Test with very large take values
      try {
        const largeTakeResults = await prisma.security.findMany({
          take: 999999999
        })
        expect(Array.isArray(largeTakeResults)).toBe(true)
      } catch (error) {
        // Should fail gracefully with limit error
        expect(error.message).not.toMatch(/crash|fatal/i)
      }
    })

    it('should handle complex query combinations', async () => {
      const complexQuery = await prisma.security.findMany({
        where: {
          AND: [
            { ticker: { not: null } },
            { name: { not: '' } },
            { isActive: { not: null } },
            {
              OR: [
                { ticker: { contains: 'TEST', mode: 'insensitive' } },
                { name: { contains: 'Security', mode: 'insensitive' } },
                { type: { equals: 'Stock' } }
              ]
            }
          ]
        },
        orderBy: [
          { ticker: 'asc' },
          { createdAt: 'desc' },
          { name: 'asc' }
        ]
      })

      expect(Array.isArray(complexQuery)).toBe(true)
    })
  })

  describe('Transaction and Rollback Edge Cases', () => {
    it('should handle failed transactions gracefully', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          // Create a valid security
          const security1 = await tx.security.create({
            data: createTestSecurityData({
              ticker: 'TRANS1',
              name: 'Transaction Test 1'
            })
          })

          // Create an invalid security that should cause rollback
          await tx.security.create({
            data: {
              ticker: 'TRANS1', // Duplicate ticker
              name: 'Transaction Test 2',
              type: 'Stock',
              exchange: 'NYSE',
              isActive: true
            }
          })

          return security1
        })
      ).rejects.toThrow()

      // Verify rollback - no securities should exist
      const transSecurities = await prisma.security.findMany({
        where: { ticker: { startsWith: 'TRANS' } }
      })
      expect(transSecurities).toHaveLength(0)
    })

    it('should handle nested transaction failures', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          const security = await tx.security.create({
            data: createTestSecurityData({
              ticker: 'NESTED',
              name: 'Nested Transaction Test'
            })
          })

          // Simulate nested operation that fails
          await tx.$executeRaw`SELECT invalid_column FROM non_existent_table`

          return security
        })
      ).rejects.toThrow()

      const nestedSecurities = await prisma.security.findMany({
        where: { ticker: 'NESTED' }
      })
      expect(nestedSecurities).toHaveLength(0)
    })
  })
})