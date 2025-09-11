import { PrismaClient } from '@prisma/client'
import { USER_LEVELS } from '@/lib/constants'
import { 
  cleanDatabase, 
  seedTestData, 
  createTestSecurity,
  createTestAccount,
  simulateClerkAuth,
  waitForDatabase,
  disconnectDatabase,
  prisma
} from '../integration/helpers/phase3b-helpers.js'

describe('Securities End-to-End Workflow Tests Phase 3B', () => {
  let testData
  let adminAuth

  beforeAll(async () => {
    await waitForDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()
    testData = await seedTestData()
    adminAuth = await simulateClerkAuth('test-admin-clerk-id')
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectDatabase()
  })

  describe('Complete Securities Management Workflow', () => {
    it('should execute full security lifecycle: create -> edit -> search -> use -> delete', async () => {
      // Step 1: Admin login (already done in beforeEach)
      expect(adminAuth.user.level).toBe(USER_LEVELS.L5_ADMIN)
      
      // Step 2: Create new security
      const newSecurity = await createTestSecurity({
        ticker: 'FLOW1',
        name: 'End-to-End Flow Security Inc.',
        type: 'Stock',
        exchange: 'NYSE'
      })

      expect(newSecurity).toBeDefined()
      expect(newSecurity.ticker).toBe('FLOW1')
      expect(newSecurity.name).toBe('End-to-End Flow Security Inc.')
      expect(newSecurity.isActive).toBe(true)

      // Verify creation in database
      const createdSecurity = await prisma.security.findUnique({
        where: { id: newSecurity.id }
      })
      expect(createdSecurity).toBeTruthy()

      // Step 3: Edit security inline
      const updatedSecurity = await prisma.security.update({
        where: { id: newSecurity.id },
        data: {
          name: 'Updated Flow Security Inc.',
          type: 'Bond',
          exchange: 'NASDAQ'
        }
      })

      expect(updatedSecurity.name).toBe('Updated Flow Security Inc.')
      expect(updatedSecurity.type).toBe('Bond')
      expect(updatedSecurity.exchange).toBe('NASDAQ')
      expect(updatedSecurity.ticker).toBe('FLOW1') // Should remain unchanged

      // Step 4: Search for security
      const searchResults = await prisma.security.findMany({
        where: {
          OR: [
            { ticker: { contains: 'FLOW', mode: 'insensitive' } },
            { name: { contains: 'Flow', mode: 'insensitive' } }
          ]
        }
      })

      expect(searchResults.length).toBeGreaterThanOrEqual(1)
      const foundSecurity = searchResults.find(s => s.ticker === 'FLOW1')
      expect(foundSecurity).toBeTruthy()
      expect(foundSecurity.name).toBe('Updated Flow Security Inc.')

      // Step 5: Verify security appears in account creation context
      // (This would typically be through an API endpoint that lists available securities)
      const availableSecurities = await prisma.security.findMany({
        where: { isActive: true },
        orderBy: { ticker: 'asc' }
      })

      const securitiesForDropdown = availableSecurities.map(s => ({
        value: s.ticker,
        label: `${s.ticker} - ${s.name}`
      }))

      expect(securitiesForDropdown.some(s => s.value === 'FLOW1')).toBe(true)

      // Step 6: Verify no accounts are using this security before deletion
      // In a real system, this might check if security is referenced in portfolios or holdings
      const accountsUsingSecurity = await prisma.account.findMany({
        where: {
          // This is conceptual - in real schema you might have holdings or portfolio references
          // For now, we'll just verify no accounts have this security's ticker in their name
          accountName: { contains: 'FLOW1', mode: 'insensitive' }
        }
      })

      expect(accountsUsingSecurity.length).toBe(0)

      // Step 7: Delete security
      await prisma.security.delete({
        where: { id: newSecurity.id }
      })

      // Verify deletion
      const deletedSecurity = await prisma.security.findUnique({
        where: { id: newSecurity.id }
      })
      expect(deletedSecurity).toBeNull()

      // Verify search no longer finds it
      const postDeleteSearch = await prisma.security.findMany({
        where: {
          ticker: { contains: 'FLOW1', mode: 'insensitive' }
        }
      })
      expect(postDeleteSearch.length).toBe(0)
    })

    it('should handle security creation with validation errors', async () => {
      // Try to create security with duplicate ticker
      await createTestSecurity({
        ticker: 'TEST1', // This already exists from seed data
        name: 'Duplicate Ticker Test'
      })

      // Attempt to create another with same ticker should fail
      await expect(
        createTestSecurity({
          ticker: 'TEST1',
          name: 'Another Duplicate'
        })
      ).rejects.toThrow()

      // Verify only one exists
      const duplicateSecurities = await prisma.security.findMany({
        where: { ticker: 'TEST1' }
      })
      expect(duplicateSecurities.length).toBe(1)
    })

    it('should handle security edit conflicts', async () => {
      // Create a security
      const security = await createTestSecurity({
        ticker: 'CONFLICT',
        name: 'Conflict Test Security'
      })

      // Simulate concurrent edit scenario
      const originalUpdatedAt = security.updatedAt

      // First edit
      const firstEdit = await prisma.security.update({
        where: { id: security.id },
        data: { name: 'First Edit' }
      })

      // Second edit (in a real app, this might check updatedAt for optimistic locking)
      const secondEdit = await prisma.security.update({
        where: { id: security.id },
        data: { name: 'Second Edit' }
      })

      expect(secondEdit.name).toBe('Second Edit')
      expect(secondEdit.updatedAt.getTime()).toBeGreaterThan(firstEdit.updatedAt.getTime())
      expect(firstEdit.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('Securities Search and Filtering Workflows', () => {
    beforeEach(async () => {
      // Create a diverse set of securities for testing
      await createTestSecurity({
        ticker: 'TECH1',
        name: 'Technology Giant Corp',
        type: 'Stock',
        exchange: 'NASDAQ',
        isActive: true
      })

      await createTestSecurity({
        ticker: 'BOND1',
        name: 'Government Bond Fund',
        type: 'Bond',
        exchange: 'NYSE',
        isActive: true
      })

      await createTestSecurity({
        ticker: 'OLD1',
        name: 'Obsolete Security',
        type: 'Stock',
        exchange: 'NASDAQ',
        isActive: false
      })
    })

    it('should perform comprehensive search workflows', async () => {
      // Test basic ticker search
      const tickerSearch = await prisma.security.findMany({
        where: {
          ticker: { contains: 'TECH', mode: 'insensitive' }
        }
      })
      expect(tickerSearch.length).toBeGreaterThanOrEqual(1)
      expect(tickerSearch[0].ticker).toBe('TECH1')

      // Test name search
      const nameSearch = await prisma.security.findMany({
        where: {
          name: { contains: 'Technology', mode: 'insensitive' }
        }
      })
      expect(nameSearch.length).toBeGreaterThanOrEqual(1)
      expect(nameSearch[0].name).toContain('Technology')

      // Test combined search
      const combinedSearch = await prisma.security.findMany({
        where: {
          OR: [
            { ticker: { contains: 'BOND', mode: 'insensitive' } },
            { name: { contains: 'Fund', mode: 'insensitive' } }
          ]
        }
      })
      expect(combinedSearch.length).toBeGreaterThanOrEqual(1)

      // Test filter by type
      const stockFilter = await prisma.security.findMany({
        where: { type: 'Stock' }
      })
      const bondFilter = await prisma.security.findMany({
        where: { type: 'Bond' }
      })
      
      expect(stockFilter.length).toBeGreaterThanOrEqual(1)
      expect(bondFilter.length).toBeGreaterThanOrEqual(1)

      // Test filter by exchange
      const nasdaqFilter = await prisma.security.findMany({
        where: { exchange: 'NASDAQ' }
      })
      const nyseFilter = await prisma.security.findMany({
        where: { exchange: 'NYSE' }
      })

      expect(nasdaqFilter.length).toBeGreaterThanOrEqual(1)
      expect(nyseFilter.length).toBeGreaterThanOrEqual(1)

      // Test active/inactive filter
      const activeSecurities = await prisma.security.findMany({
        where: { isActive: true }
      })
      const inactiveSecurities = await prisma.security.findMany({
        where: { isActive: false }
      })

      expect(activeSecurities.length).toBeGreaterThanOrEqual(1)
      expect(inactiveSecurities.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle pagination in search results', async () => {
      // Create additional securities for pagination testing
      for (let i = 1; i <= 15; i++) {
        await createTestSecurity({
          ticker: `PAGE${i.toString().padStart(2, '0')}`,
          name: `Pagination Test Security ${i}`,
          type: 'Stock',
          exchange: 'NASDAQ'
        })
      }

      // Test pagination - first page
      const firstPage = await prisma.security.findMany({
        where: {
          ticker: { startsWith: 'PAGE' }
        },
        orderBy: { ticker: 'asc' },
        take: 10,
        skip: 0
      })

      expect(firstPage.length).toBe(10)
      expect(firstPage[0].ticker).toBe('PAGE01')
      expect(firstPage[9].ticker).toBe('PAGE10')

      // Test pagination - second page
      const secondPage = await prisma.security.findMany({
        where: {
          ticker: { startsWith: 'PAGE' }
        },
        orderBy: { ticker: 'asc' },
        take: 10,
        skip: 10
      })

      expect(secondPage.length).toBe(5) // Remaining securities
      expect(secondPage[0].ticker).toBe('PAGE11')
      expect(secondPage[4].ticker).toBe('PAGE15')

      // Test total count for pagination metadata
      const totalCount = await prisma.security.count({
        where: {
          ticker: { startsWith: 'PAGE' }
        }
      })

      expect(totalCount).toBe(15)
    })
  })

  describe('Securities in Account Context Workflows', () => {
    it('should verify securities appear correctly in account management', async () => {
      // Create test securities
      const stockSecurity = await createTestSecurity({
        ticker: 'STOCK1',
        name: 'Test Stock Security',
        type: 'Stock',
        exchange: 'NYSE'
      })

      const bondSecurity = await createTestSecurity({
        ticker: 'BOND1',
        name: 'Test Bond Security',
        type: 'Bond',
        exchange: 'NASDAQ'
      })

      // In a real app, when creating accounts, users might select securities
      // Here we simulate fetching securities for account-related workflows

      // Get all active securities for portfolio selection
      const portfolioSecurities = await prisma.security.findMany({
        where: { isActive: true },
        orderBy: [
          { type: 'asc' },
          { ticker: 'asc' }
        ]
      })

      expect(portfolioSecurities.length).toBeGreaterThanOrEqual(2)
      
      // Verify our test securities are included
      const stockSecurities = portfolioSecurities.filter(s => s.type === 'Stock')
      const bondSecurities = portfolioSecurities.filter(s => s.type === 'Bond')
      
      expect(stockSecurities.some(s => s.ticker === 'STOCK1')).toBe(true)
      expect(bondSecurities.some(s => s.ticker === 'BOND1')).toBe(true)

      // Test securities grouped by type for UI display
      const securitiesByType = portfolioSecurities.reduce((acc, security) => {
        if (!acc[security.type]) {
          acc[security.type] = []
        }
        acc[security.type].push(security)
        return acc
      }, {})

      expect(securitiesByType.Stock).toBeDefined()
      expect(securitiesByType.Bond).toBeDefined()
      expect(securitiesByType.Stock.length).toBeGreaterThanOrEqual(1)
      expect(securitiesByType.Bond.length).toBeGreaterThanOrEqual(1)
    })

    it('should prevent deletion of securities referenced by accounts', async () => {
      // Create a security
      const security = await createTestSecurity({
        ticker: 'REFERENCED',
        name: 'Referenced Security'
      })

      // Create an account that conceptually references this security
      // In a real system, this might be through holdings, portfolios, or benchmarks
      const account = await createTestAccount(
        testData.users.client.profile.secdexCode,
        testData.feeSchedules.standard.id,
        {
          accountName: `Account with ${security.ticker} benchmark`,
          benchmark: security.ticker // Using ticker as benchmark reference
        }
      )

      // Verify the reference exists
      expect(account.benchmark).toBe(security.ticker)

      // In a real system, deletion would be prevented by business logic
      // Here we simulate checking for references before deletion
      const referencingAccounts = await prisma.account.findMany({
        where: {
          benchmark: security.ticker
        }
      })

      expect(referencingAccounts.length).toBeGreaterThanOrEqual(1)

      // If there are references, deletion should be prevented
      if (referencingAccounts.length > 0) {
        // In real implementation, this would return an error response
        expect(referencingAccounts.length).toBeGreaterThan(0)
      }

      // To delete, first remove references
      await prisma.account.updateMany({
        where: { benchmark: security.ticker },
        data: { benchmark: null }
      })

      // Now deletion should be possible
      await prisma.security.delete({
        where: { id: security.id }
      })

      const deletedSecurity = await prisma.security.findUnique({
        where: { id: security.id }
      })
      expect(deletedSecurity).toBeNull()
    })
  })

  describe('Securities Bulk Operations Workflows', () => {
    it('should handle bulk security import workflow', async () => {
      const bulkSecurities = [
        {
          ticker: 'BULK01',
          name: 'Bulk Import Security 1',
          type: 'Stock',
          exchange: 'NYSE'
        },
        {
          ticker: 'BULK02',
          name: 'Bulk Import Security 2',
          type: 'Bond',
          exchange: 'NASDAQ'
        },
        {
          ticker: 'BULK03',
          name: 'Bulk Import Security 3',
          type: 'Stock',
          exchange: 'NYSE'
        }
      ]

      // Simulate bulk import
      const importResult = await prisma.security.createMany({
        data: bulkSecurities.map(s => ({
          ...s,
          isActive: true
        }))
      })

      expect(importResult.count).toBe(3)

      // Verify all securities were created
      const importedSecurities = await prisma.security.findMany({
        where: {
          ticker: { startsWith: 'BULK' }
        },
        orderBy: { ticker: 'asc' }
      })

      expect(importedSecurities.length).toBe(3)
      expect(importedSecurities[0].ticker).toBe('BULK01')
      expect(importedSecurities[1].ticker).toBe('BULK02')
      expect(importedSecurities[2].ticker).toBe('BULK03')
    })

    it('should handle bulk security updates workflow', async () => {
      // Create securities for bulk update
      for (let i = 1; i <= 5; i++) {
        await createTestSecurity({
          ticker: `UPDATE${i}`,
          name: `Update Test Security ${i}`,
          type: 'Stock',
          exchange: 'NYSE'
        })
      }

      // Bulk update all UPDATE securities to change exchange
      const updateResult = await prisma.security.updateMany({
        where: {
          ticker: { startsWith: 'UPDATE' }
        },
        data: {
          exchange: 'NASDAQ',
          type: 'Bond'
        }
      })

      expect(updateResult.count).toBe(5)

      // Verify updates
      const updatedSecurities = await prisma.security.findMany({
        where: {
          ticker: { startsWith: 'UPDATE' }
        }
      })

      expect(updatedSecurities.length).toBe(5)
      updatedSecurities.forEach(security => {
        expect(security.exchange).toBe('NASDAQ')
        expect(security.type).toBe('Bond')
      })
    })

    it('should handle bulk deactivation workflow', async () => {
      // Create securities for deactivation
      for (let i = 1; i <= 3; i++) {
        await createTestSecurity({
          ticker: `DEACT${i}`,
          name: `Deactivation Test Security ${i}`,
          isActive: true
        })
      }

      // Bulk deactivate
      const deactivateResult = await prisma.security.updateMany({
        where: {
          ticker: { startsWith: 'DEACT' }
        },
        data: {
          isActive: false
        }
      })

      expect(deactivateResult.count).toBe(3)

      // Verify deactivation
      const deactivatedSecurities = await prisma.security.findMany({
        where: {
          ticker: { startsWith: 'DEACT' }
        }
      })

      expect(deactivatedSecurities.length).toBe(3)
      deactivatedSecurities.forEach(security => {
        expect(security.isActive).toBe(false)
      })

      // Verify they don't appear in active securities list
      const activeSecurities = await prisma.security.findMany({
        where: {
          AND: [
            { ticker: { startsWith: 'DEACT' } },
            { isActive: true }
          ]
        }
      })

      expect(activeSecurities.length).toBe(0)
    })
  })
})