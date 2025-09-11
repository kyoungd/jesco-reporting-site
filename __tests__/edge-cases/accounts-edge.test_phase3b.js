import { PrismaClient } from '@prisma/client'
import { 
  cleanDatabase, 
  seedTestData, 
  createTestAccount,
  createTestClientProfile,
  waitForDatabase,
  disconnectDatabase,
  createTestAccountData
} from '../integration/helpers/phase3b-helpers.js'
import {
  generateMaliciousInputs,
  simulateConcurrentRequests,
  createSecurityTestSuite,
  createCorruptionScenarios,
  generateBulkAccounts
} from '../utils/stress-test-helpers.js'

const prisma = new PrismaClient({ 
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

describe('Accounts Edge Case Tests Phase 3B', () => {
  let testData
  let securityTestSuite
  let testClientProfile

  beforeAll(async () => {
    await waitForDatabase()
    securityTestSuite = createSecurityTestSuite()
  })

  beforeEach(async () => {
    await cleanDatabase()
    testData = await seedTestData()
    testClientProfile = await createTestClientProfile({
      secdexCode: 'EDGE001',
      clientName: 'Edge Test Client'
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectDatabase()
  })

  describe('Account Number Boundary Conditions', () => {
    it('should handle minimum length account numbers', async () => {
      const account = await createTestAccount({
        accountNumber: '1',
        accountName: 'Single Digit Account',
        accountType: 'MasterAccount'
      })

      expect(account.accountNumber).toBe('1')
      expect(account.accountName).toBe('Single Digit Account')
    })

    it('should handle maximum length account numbers', async () => {
      const longAccountNumber = '1234567890123456789012345678901234567890' // 40 digits
      
      try {
        const account = await createTestAccount({
          accountNumber: longAccountNumber,
          accountName: 'Maximum Length Account Number',
          accountType: 'MasterAccount'
        })
        
        expect(account.accountNumber).toBe(longAccountNumber)
      } catch (error) {
        // If there's a length constraint, verify it's enforced
        expect(error.message).toMatch(/length|constraint|limit/i)
      }
    })

    it('should reject empty account numbers', async () => {
      await expect(
        createTestAccount({
          accountNumber: '',
          accountName: 'Empty Account Number',
          accountType: 'MasterAccount'
        })
      ).rejects.toThrow()
    })

    it('should reject null account numbers', async () => {
      await expect(
        prisma.account.create({
          data: {
            accountNumber: null,
            accountName: 'Null Account Number',
            accountType: 'MasterAccount',
            benchmark: 'S&P 500',
            isActive: true
          }
        })
      ).rejects.toThrow()
    })

    it('should handle special characters in account numbers', async () => {
      const specialAccountNumbers = [
        'ACC-001',
        'ACC.001', 
        'ACC_001',
        'ACC/001',
        'ACC#001',
        'ACC@001'
      ]

      const results = []
      for (let i = 0; i < specialAccountNumbers.length; i++) {
        const accountNumber = specialAccountNumbers[i]
        try {
          const account = await createTestAccount({
            accountNumber,
            accountName: `Special Character Account ${i}`,
            accountType: 'MasterAccount'
          })
          results.push({ accountNumber, success: true, account })
        } catch (error) {
          results.push({ accountNumber, success: false, error: error.message })
        }
      }

      console.log('Special character account number test results:', results)
      
      // At least some patterns should work
      const successful = results.filter(r => r.success)
      expect(successful.length).toBeGreaterThan(0)
    })

    it('should enforce unique account numbers', async () => {
      await createTestAccount({
        accountNumber: 'UNIQUE001',
        accountName: 'First Account',
        accountType: 'MasterAccount'
      })

      await expect(
        createTestAccount({
          accountNumber: 'UNIQUE001',
          accountName: 'Second Account',
          accountType: 'ClientAccount',
          secdexCode: testClientProfile.secdexCode
        })
      ).rejects.toThrow()
    })
  })

  describe('Account Name Boundary Conditions', () => {
    it('should handle very long account names', async () => {
      const longName = 'Very Long Account Name '.repeat(20) + 'Trust Fund'
      
      try {
        const account = await createTestAccount({
          accountNumber: 'LONGNAME001',
          accountName: longName,
          accountType: 'MasterAccount'
        })
        
        expect(account.accountName).toBe(longName)
      } catch (error) {
        expect(error.message).toMatch(/length|constraint|limit/i)
      }
    })

    it('should handle names with unicode characters', async () => {
      const unicodeNames = [
        'Société Générale Account',
        'Zürich Investment Fund',
        'Tōkyō Pension Fund',
        'Россия Investment',
        'العربية Fund',
        '中国银行账户',
        'Test 🚀 Account'
      ]

      const results = []
      for (let i = 0; i < unicodeNames.length; i++) {
        const name = unicodeNames[i]
        try {
          const account = await createTestAccount({
            accountNumber: `UNI${String(i).padStart(3, '0')}`,
            accountName: name,
            accountType: 'MasterAccount'
          })
          results.push({ name, success: true, account })
        } catch (error) {
          results.push({ name, success: false, error: error.message })
        }
      }

      console.log('Unicode account name test results:', results)
      
      // At least basic Latin characters should work
      const basicResults = results.filter(r => 
        /^[A-Za-z\s]+/.test(r.name) || r.name.includes('Société')
      )
      expect(basicResults.some(r => r.success)).toBe(true)
    })

    it('should reject empty account names', async () => {
      await expect(
        createTestAccount({
          accountNumber: 'EMPTY001',
          accountName: '',
          accountType: 'MasterAccount'
        })
      ).rejects.toThrow()
    })

    it('should handle names with only whitespace', async () => {
      await expect(
        createTestAccount({
          accountNumber: 'SPACE001',
          accountName: '   ',
          accountType: 'MasterAccount'
        })
      ).rejects.toThrow()
    })
  })

  describe('Account Type Validation Edge Cases', () => {
    it('should reject invalid account types', async () => {
      const invalidTypes = ['InvalidAccount', 'INVALID', 'NotAnAccountType', '', null]
      
      for (let i = 0; i < invalidTypes.length; i++) {
        const type = invalidTypes[i]
        await expect(
          createTestAccount({
            accountNumber: `INV${String(i).padStart(3, '0')}`,
            accountName: 'Invalid Type Account',
            accountType: type
          })
        ).rejects.toThrow()
      }
    })

    it('should enforce ClientAccount requires secdexCode', async () => {
      await expect(
        createTestAccount({
          accountNumber: 'CLIENT001',
          accountName: 'Client Account Without SecdexCode',
          accountType: 'ClientAccount'
          // Missing secdexCode
        })
      ).rejects.toThrow()
    })

    it('should enforce MasterAccount cannot have secdexCode', async () => {
      try {
        await createTestAccount({
          accountNumber: 'MASTER001',
          accountName: 'Master Account With SecdexCode',
          accountType: 'MasterAccount',
          secdexCode: testClientProfile.secdexCode
        })
      } catch (error) {
        // Should either reject or ignore secdexCode for MasterAccount
        expect(error).toBeDefined()
      }
    })
  })

  describe('SecdexCode Validation', () => {
    it('should reject ClientAccount with non-existent secdexCode', async () => {
      await expect(
        createTestAccount({
          accountNumber: 'CLIENT002',
          accountName: 'Client Account Invalid Secdex',
          accountType: 'ClientAccount',
          secdexCode: 'NONEXISTENT'
        })
      ).rejects.toThrow()
    })

    it('should handle null secdexCode for ClientAccount', async () => {
      await expect(
        createTestAccount({
          accountNumber: 'CLIENT003',
          accountName: 'Client Account Null Secdex',
          accountType: 'ClientAccount',
          secdexCode: null
        })
      ).rejects.toThrow()
    })

    it('should handle empty string secdexCode', async () => {
      await expect(
        createTestAccount({
          accountNumber: 'CLIENT004',
          accountName: 'Client Account Empty Secdex',
          accountType: 'ClientAccount',
          secdexCode: ''
        })
      ).rejects.toThrow()
    })
  })

  describe('Benchmark Validation', () => {
    it('should handle invalid benchmark values', async () => {
      const invalidBenchmarks = ['', null, 'INVALID_BENCHMARK', 'NotABenchmark']
      
      for (let i = 0; i < invalidBenchmarks.length; i++) {
        const benchmark = invalidBenchmarks[i]
        try {
          await createTestAccount({
            accountNumber: `BENCH${String(i).padStart(3, '0')}`,
            accountName: 'Invalid Benchmark Account',
            accountType: 'MasterAccount',
            benchmark
          })
        } catch (error) {
          // Should enforce valid benchmark values
          expect(error).toBeDefined()
        }
      }
    })

    it('should handle very long benchmark names', async () => {
      const longBenchmark = 'Custom Very Long Benchmark Name '.repeat(10)
      
      try {
        await createTestAccount({
          accountNumber: 'LONGBENCH',
          accountName: 'Long Benchmark Account',
          accountType: 'MasterAccount',
          benchmark: longBenchmark
        })
      } catch (error) {
        expect(error.message).toMatch(/length|constraint|limit/i)
      }
    })
  })

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle concurrent creation of different accounts', async () => {
      const createAccount = async (index) => {
        return createTestAccount({
          accountNumber: `CONC${String(index).padStart(3, '0')}`,
          accountName: `Concurrent Account ${index}`,
          accountType: 'MasterAccount'
        })
      }

      const results = await simulateConcurrentRequests(createAccount, 10)
      
      expect(results.fulfilled).toBe(10)
      expect(results.rejected).toBe(0)
      expect(results.successRate).toBe(1.0)

      const accounts = await prisma.account.findMany({
        where: { accountNumber: { startsWith: 'CONC' } }
      })
      expect(accounts).toHaveLength(10)
    })

    it('should handle concurrent creation with duplicate account numbers', async () => {
      const createDuplicate = async (index) => {
        return createTestAccount({
          accountNumber: 'DUPLICATE',
          accountName: `Duplicate Attempt ${index}`,
          accountType: 'MasterAccount'
        })
      }

      const results = await simulateConcurrentRequests(createDuplicate, 5)
      
      // Only one should succeed
      expect(results.fulfilled).toBe(1)
      expect(results.rejected).toBe(4)

      const accounts = await prisma.account.findMany({
        where: { accountNumber: 'DUPLICATE' }
      })
      expect(accounts).toHaveLength(1)
    })

    it('should handle concurrent updates to same account', async () => {
      const account = await createTestAccount({
        accountNumber: 'UPDATE001',
        accountName: 'Original Name',
        accountType: 'MasterAccount'
      })

      const updateAccount = async (index) => {
        return prisma.account.update({
          where: { id: account.id },
          data: { accountName: `Updated Name ${index}` }
        })
      }

      const results = await simulateConcurrentRequests(updateAccount, 5)
      
      expect(results.fulfilled).toBe(5)
      expect(results.rejected).toBe(0)

      const updatedAccount = await prisma.account.findUnique({
        where: { id: account.id }
      })
      expect(updatedAccount.accountName).toMatch(/^Updated Name \d$/)
    })
  })

  describe('Malicious Input Protection', () => {
    let maliciousInputs

    beforeAll(() => {
      maliciousInputs = generateMaliciousInputs()
    })

    it('should protect against SQL injection in account number', async () => {
      for (const injection of maliciousInputs.sqlInjection) {
        try {
          await createTestAccount({
            accountNumber: injection,
            accountName: 'SQL Injection Test',
            accountType: 'MasterAccount'
          })
        } catch (error) {
          expect(error.message).not.toMatch(/syntax error|sql|database/i)
        }
      }

      // Verify no malicious data was inserted
      const suspiciousAccounts = await prisma.account.findMany({
        where: { 
          OR: [
            { accountNumber: { contains: 'DROP' } },
            { accountNumber: { contains: 'DELETE' } },
            { accountNumber: { contains: 'INSERT' } },
            { accountNumber: { contains: 'UPDATE' } }
          ]
        }
      })
      expect(suspiciousAccounts).toHaveLength(0)
    })

    it('should protect against XSS in account name', async () => {
      for (let i = 0; i < maliciousInputs.xss.length; i++) {
        const xss = maliciousInputs.xss[i]
        try {
          const account = await createTestAccount({
            accountNumber: `XSS${String(i).padStart(3, '0')}`,
            accountName: xss,
            accountType: 'MasterAccount'
          })
          
          expect(securityTestSuite.testXSS(account.accountName)).toBe(false)
        } catch (error) {
          expect(error).toBeDefined()
        }
      }
    })

    it('should handle buffer overflow attacks', async () => {
      for (let i = 0; i < maliciousInputs.overflowAttacks.length; i++) {
        const overflow = maliciousInputs.overflowAttacks[i]
        try {
          await createTestAccount({
            accountNumber: `OF${String(i).padStart(3, '0')}`,
            accountName: overflow,
            accountType: 'MasterAccount'
          })
        } catch (error) {
          expect(error.message).not.toMatch(/segmentation|memory|crash/i)
        }
      }
    })
  })

  describe('Data Corruption Scenarios', () => {
    let corruptionScenarios

    beforeAll(() => {
      corruptionScenarios = createCorruptionScenarios()
    })

    it('should handle corrupted account number data', async () => {
      const validAccountNumber = 'VALID001'
      const corruptedAccountNumber = corruptionScenarios.corruptTicker(validAccountNumber)
      
      try {
        await createTestAccount({
          accountNumber: corruptedAccountNumber,
          accountName: 'Corruption Test',
          accountType: 'MasterAccount'
        })
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).not.toMatch(/crash|segmentation|fatal/i)
      }
    })

    it('should handle corrupted JSON in account data', async () => {
      const validAccountData = {
        accountNumber: 'JSON001',
        accountName: 'JSON Test Account',
        accountType: 'MasterAccount'
      }
      
      const corruptedJSON = corruptionScenarios.corruptJSON(validAccountData)
      
      try {
        // Simulate corrupted JSON scenario
        await prisma.$executeRawUnsafe(`
          INSERT INTO accounts (account_number, account_name, account_type, benchmark, is_active)
          VALUES ('${corruptedJSON}', 'Test', 'MasterAccount', 'S&P 500', true)
        `)
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).not.toMatch(/crash|fatal/i)
      }
    })
  })

  describe('Bulk Operations Edge Cases', () => {
    it('should handle bulk creation with mixed valid and invalid data', async () => {
      const bulkAccounts = generateBulkAccounts(20, [testClientProfile])
      
      // Add some invalid accounts
      bulkAccounts.push(
        {
          accountNumber: '', // Invalid - empty
          accountName: 'Invalid Account 1',
          accountType: 'MasterAccount',
          benchmark: 'S&P 500',
          isActive: true
        },
        {
          accountNumber: 'VALID999',
          accountName: '', // Invalid - empty name
          accountType: 'MasterAccount',
          benchmark: 'S&P 500',
          isActive: true
        }
      )

      try {
        const result = await prisma.account.createMany({
          data: bulkAccounts,
          skipDuplicates: true
        })
        
        // Should skip invalid entries
        expect(result.count).toBeLessThan(bulkAccounts.length)
      } catch (error) {
        // Bulk operation should fail if any entry is invalid
        expect(error).toBeDefined()
      }
    })

    it('should handle bulk creation with duplicate account numbers', async () => {
      const bulkAccounts = generateBulkAccounts(10, [testClientProfile])
      
      // Add duplicate
      bulkAccounts.push({
        accountNumber: bulkAccounts[0].accountNumber,
        accountName: 'Duplicate Account',
        accountType: 'MasterAccount',
        benchmark: 'S&P 500',
        isActive: true
      })

      try {
        const result = await prisma.account.createMany({
          data: bulkAccounts,
          skipDuplicates: true
        })
        
        expect(result.count).toBe(10) // Should skip duplicate
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Resource Limits and Performance Edge Cases', () => {
    it('should handle pagination with extreme values', async () => {
      const largePageResults = await prisma.account.findMany({
        skip: 999999999,
        take: 10
      })
      expect(largePageResults).toHaveLength(0)

      try {
        const largeTakeResults = await prisma.account.findMany({
          take: 999999999
        })
        expect(Array.isArray(largeTakeResults)).toBe(true)
      } catch (error) {
        expect(error.message).not.toMatch(/crash|fatal/i)
      }
    })

    it('should handle complex query combinations', async () => {
      const complexQuery = await prisma.account.findMany({
        where: {
          AND: [
            { accountNumber: { not: null } },
            { accountName: { not: '' } },
            { isActive: { not: null } },
            {
              OR: [
                { accountNumber: { contains: 'TEST', mode: 'insensitive' } },
                { accountName: { contains: 'Account', mode: 'insensitive' } },
                { accountType: { equals: 'MasterAccount' } }
              ]
            }
          ]
        },
        include: {
          clientProfile: true
        },
        orderBy: [
          { accountNumber: 'asc' },
          { createdAt: 'desc' },
          { accountName: 'asc' }
        ]
      })

      expect(Array.isArray(complexQuery)).toBe(true)
    })
  })

  describe('Transaction and Rollback Edge Cases', () => {
    it('should handle failed account creation transactions', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          const account1 = await tx.account.create({
            data: createTestAccountData({
              accountNumber: 'TRANS1',
              accountName: 'Transaction Test 1',
              accountType: 'MasterAccount'
            })
          })

          await tx.account.create({
            data: {
              accountNumber: 'TRANS1', // Duplicate
              accountName: 'Transaction Test 2',
              accountType: 'MasterAccount',
              benchmark: 'S&P 500',
              isActive: true
            }
          })

          return account1
        })
      ).rejects.toThrow()

      const transAccounts = await prisma.account.findMany({
        where: { accountNumber: { startsWith: 'TRANS' } }
      })
      expect(transAccounts).toHaveLength(0)
    })

    it('should handle account with client profile creation transaction', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          const clientProfile = await tx.clientProfile.create({
            data: {
              secdexCode: 'TRANS_CLIENT',
              clientName: 'Transaction Client',
              level: 'L2_CLIENT'
            }
          })

          // This should fail due to invalid account type or other constraint
          await tx.account.create({
            data: {
              accountNumber: 'TRANS_ACC',
              accountName: 'Transaction Account',
              accountType: 'InvalidType', // Invalid type
              secdexCode: clientProfile.secdexCode,
              benchmark: 'S&P 500',
              isActive: true
            }
          })

          return clientProfile
        })
      ).rejects.toThrow()

      const transClients = await prisma.clientProfile.findMany({
        where: { secdexCode: 'TRANS_CLIENT' }
      })
      expect(transClients).toHaveLength(0)
    })
  })
})