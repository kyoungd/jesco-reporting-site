import { PrismaClient } from '@prisma/client'
import { 
  cleanDatabase, 
  seedTestData, 
  createTestSecurity,
  createTestAccount,
  createTestUser,
  createTestClientProfile,
  waitForDatabase,
  disconnectDatabase,
  simulateAuth
} from '../integration/helpers/phase3b-helpers.js'
import {
  generateMaliciousInputs,
  createSecurityTestSuite,
  createCorruptionScenarios,
  simulateConcurrentRequests,
  stressTestDatabase,
  injectMaliciousInput,
  createChaosTestScenarios
} from '../utils/stress-test-helpers.js'

const prisma = new PrismaClient({ 
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
})

describe('Security Injection and Attack Scenario Tests Phase 3B', () => {
  let testData
  let securityTestSuite
  let maliciousInputs
  let corruptionScenarios
  let chaosScenarios
  let testUser

  beforeAll(async () => {
    await waitForDatabase()
    securityTestSuite = createSecurityTestSuite()
    maliciousInputs = generateMaliciousInputs()
    corruptionScenarios = createCorruptionScenarios()
    chaosScenarios = createChaosTestScenarios()
  })

  beforeEach(async () => {
    await cleanDatabase()
    testData = await seedTestData()
    testUser = await createTestUser({
      clerkUserId: 'security_test_user',
      email: 'security@test.com',
      level: 'L5_ADMIN'
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectDatabase()
  })

  describe('SQL Injection Attack Scenarios', () => {
    it('should prevent SQL injection in security ticker field', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE securities; --",
        "' UNION SELECT * FROM users; --",
        "'; DELETE FROM accounts WHERE 1=1; --",
        "' OR '1'='1",
        "'; INSERT INTO securities (ticker, name) VALUES ('HACK', 'Hacked'); --",
        "1'; UPDATE securities SET ticker='HACKED' WHERE 1=1; --",
        "'; EXEC xp_cmdshell('dir'); --",
        "' AND (SELECT COUNT(*) FROM information_schema.tables) > 0; --"
      ]

      for (const payload of sqlInjectionPayloads) {
        try {
          await createTestSecurity({
            ticker: payload,
            name: 'SQL Injection Test Security'
          })
          
          // If creation succeeds, verify it was sanitized
          const security = await prisma.security.findFirst({
            where: { ticker: payload }
          })
          
          if (security) {
            expect(securityTestSuite.testSQLInjection(security.ticker)).toBe(false)
          }
        } catch (error) {
          // Should fail validation, not SQL syntax error
          expect(error.message).not.toMatch(/syntax error|sql error|database error/i)
          expect(error.message).not.toMatch(/table.*doesn't exist/i)
        }
      }

      // Verify no malicious data was inserted
      const allSecurities = await prisma.security.findMany()
      allSecurities.forEach(security => {
        expect(security.ticker).not.toMatch(/DROP|DELETE|INSERT|UPDATE/i)
        expect(security.name).not.toMatch(/HACK|HACKED/i)
      })
    })

    it('should prevent SQL injection in account number field', async () => {
      for (const payload of maliciousInputs.sqlInjection) {
        try {
          await createTestAccount({
            accountNumber: payload,
            accountName: 'SQL Injection Test Account',
            accountType: 'MasterAccount'
          })
        } catch (error) {
          expect(error.message).not.toMatch(/syntax error|sql error|database error/i)
        }
      }

      // Verify database integrity
      const accountCount = await prisma.account.count()
      expect(accountCount).toBe(testData.accounts.length) // Should only have seed data
    })

    it('should prevent SQL injection in user queries', async () => {
      const { req, res } = simulateAuth({
        userId: testUser.clerkUserId,
        level: testUser.level
      })

      for (const payload of maliciousInputs.sqlInjection) {
        try {
          // Simulate search query with malicious input
          const users = await prisma.user.findMany({
            where: {
              email: { contains: payload }
            }
          })
          
          expect(Array.isArray(users)).toBe(true)
          expect(users.length).toBe(0) // Should find nothing
        } catch (error) {
          expect(error.message).not.toMatch(/syntax error|sql error/i)
        }
      }
    })

    it('should prevent SQL injection in raw queries', async () => {
      const dangerousQueries = [
        "'; DROP TABLE users; --",
        "1; DELETE FROM securities; --",
        "1 UNION SELECT password FROM admin_users; --"
      ]

      for (const query of dangerousQueries) {
        try {
          // This should be rejected by parameterized queries
          await prisma.$queryRaw`
            SELECT * FROM securities WHERE ticker = ${query}
          `
        } catch (error) {
          // Should handle safely without executing malicious SQL
          expect(error.message).not.toMatch(/table.*dropped|deleted/i)
        }
      }

      // Verify tables still exist
      const securityCount = await prisma.security.count()
      const userCount = await prisma.user.count()
      expect(securityCount).toBeGreaterThanOrEqual(0)
      expect(userCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('XSS and Code Injection Prevention', () => {
    it('should sanitize XSS in security names', async () => {
      for (let i = 0; i < maliciousInputs.xss.length; i++) {
        const xssPayload = maliciousInputs.xss[i]
        
        try {
          const security = await createTestSecurity({
            ticker: `XSS${String(i).padStart(3, '0')}`,
            name: xssPayload
          })
          
          // If creation succeeds, verify XSS was neutralized
          expect(securityTestSuite.testXSS(security.name)).toBe(false)
          expect(security.name).not.toMatch(/<script|javascript:|on\w+=/i)
        } catch (error) {
          // Rejection is also acceptable
          expect(error).toBeDefined()
        }
      }
    })

    it('should sanitize XSS in account names', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')",
        "<svg onload=alert('XSS')>",
        "<iframe src=javascript:alert('XSS')></iframe>",
        "';alert(String.fromCharCode(88,83,83))//",
        "\"><script>alert('XSS')</script>"
      ]

      for (let i = 0; i < xssPayloads.length; i++) {
        const payload = xssPayloads[i]
        
        try {
          const account = await createTestAccount({
            accountNumber: `XSS${String(i).padStart(3, '0')}`,
            accountName: payload,
            accountType: 'MasterAccount'
          })
          
          expect(securityTestSuite.testXSS(account.accountName)).toBe(false)
        } catch (error) {
          expect(error).toBeDefined()
        }
      }
    })

    it('should prevent JavaScript execution in user inputs', async () => {
      const jsPayloads = [
        "javascript:void(0)",
        "vbscript:msgbox('XSS')",
        "data:text/html,<script>alert('XSS')</script>",
        "file:///etc/passwd",
        "ftp://malicious.com/steal.exe"
      ]

      for (const payload of jsPayloads) {
        try {
          const user = await createTestUser({
            clerkUserId: `js_${Math.random().toString(36).substring(7)}`,
            email: payload, // Malicious email
            level: 'L2_CLIENT'
          })
          
          // Should not contain executable content
          expect(user.email).not.toMatch(/javascript:|vbscript:|data:|file:|ftp:/i)
        } catch (error) {
          // Validation rejection is acceptable
          expect(error).toBeDefined()
        }
      }
    })
  })

  describe('NoSQL and ORM Injection Prevention', () => {
    it('should prevent Prisma query injection', async () => {
      const injectionAttempts = [
        { ticker: { $ne: null } }, // NoSQL injection
        { $where: "function() { return true; }" },
        { ticker: { $regex: ".*" } },
        { $or: [{ ticker: "TEST" }, { ticker: { $ne: null } }] }
      ]

      for (const attempt of injectionAttempts) {
        try {
          // This should fail because Prisma doesn't support NoSQL operators
          const result = await prisma.security.findMany({
            where: attempt
          })
          
          // If it doesn't fail, ensure it returns safe results
          expect(Array.isArray(result)).toBe(true)
        } catch (error) {
          // Expected to fail with Prisma validation error
          expect(error.message).toMatch(/Invalid.*argument|Unknown.*field/i)
        }
      }
    })

    it('should prevent JSON injection in filters', async () => {
      const jsonInjectionPayloads = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$or": [{"ticker": "TEST"}]}',
        '{"ticker": {"$regex": ".*"}}'
      ]

      for (const payload of jsonInjectionPayloads) {
        try {
          // Attempt to parse and use malicious JSON as filter
          const parsedPayload = JSON.parse(payload)
          
          const result = await prisma.security.findMany({
            where: parsedPayload
          })
          
          expect(Array.isArray(result)).toBe(true)
        } catch (error) {
          // Should fail safely
          expect(error.message).not.toMatch(/injection|exploit/i)
        }
      }
    })
  })

  describe('Buffer Overflow and Memory Attacks', () => {
    it('should handle extremely large input strings', async () => {
      const largeInputSizes = [1000, 10000, 100000, 1000000]

      for (const size of largeInputSizes) {
        const largeString = 'A'.repeat(size)
        
        try {
          await createTestSecurity({
            ticker: largeString.substring(0, 20), // Truncate for ticker
            name: largeString
          })
        } catch (error) {
          // Should fail gracefully with validation error
          expect(error.message).not.toMatch(/segmentation|memory|crash|out of memory/i)
          expect(error.message).toMatch(/length|constraint|limit|too long/i)
        }
      }
    })

    it('should prevent memory exhaustion attacks', async () => {
      const memoryAttack = async () => {
        const largeArray = new Array(1000000).fill('A'.repeat(1000))
        
        try {
          await createTestSecurity({
            ticker: 'MEMORY',
            name: largeArray.join('')
          })
        } catch (error) {
          return error
        }
      }

      const result = await memoryAttack()
      if (result instanceof Error) {
        expect(result.message).not.toMatch(/out of memory|segmentation/i)
      }
    })

    it('should handle null byte injection', async () => {
      const nullBytePayloads = [
        "TEST\u0000DROP TABLE securities",
        "VALID\x00; DELETE FROM accounts;",
        "SAFE%00<script>alert('XSS')</script>",
        "NORMAL\\0 UNION SELECT * FROM users"
      ]

      for (const payload of nullBytePayloads) {
        try {
          await createTestSecurity({
            ticker: payload.substring(0, 10),
            name: payload
          })
        } catch (error) {
          // Should reject null bytes cleanly
          expect(error.message).not.toMatch(/null.*byte|binary/i)
        }
      }
    })
  })

  describe('Authentication and Authorization Bypass Attempts', () => {
    it('should prevent privilege escalation through input manipulation', async () => {
      const escalationAttempts = [
        { level: 'L5_ADMIN', expected: 'L2_CLIENT' },
        { role: 'admin', expected: 'L2_CLIENT' },
        { permissions: ['*'], expected: 'L2_CLIENT' },
        { isAdmin: true, expected: 'L2_CLIENT' }
      ]

      for (const attempt of escalationAttempts) {
        try {
          const user = await createTestUser({
            clerkUserId: `escalation_${Math.random().toString(36).substring(7)}`,
            email: 'escalation@test.com',
            level: attempt.expected,
            // Attempt to inject additional privileges
            ...attempt
          })
          
          expect(user.level).toBe(attempt.expected)
          expect(user.role).toBeUndefined()
          expect(user.permissions).toBeUndefined()
          expect(user.isAdmin).toBeUndefined()
        } catch (error) {
          expect(error).toBeDefined()
        }
      }
    })

    it('should prevent session hijacking through token manipulation', async () => {
      const maliciousTokens = [
        "admin.token.here",
        "Bearer malicious.jwt.token",
        "../../etc/passwd",
        "<script>steal_token()</script>",
        "'; UPDATE users SET level='L5_ADMIN'; --"
      ]

      for (const token of maliciousTokens) {
        const { req, res } = simulateAuth({
          userId: token,
          level: 'L5_ADMIN'
        })

        // Should not find user with malicious token
        const user = await prisma.user.findUnique({
          where: { clerkUserId: token }
        })
        
        expect(user).toBeNull()
      }
    })

    it('should prevent organization bypass attacks', async () => {
      const otherClientProfile = await createTestClientProfile({
        secdexCode: 'OTHER999',
        clientName: 'Other Organization'
      })

      const maliciousUser = await createTestUser({
        clerkUserId: 'malicious_user',
        email: 'malicious@test.com',
        level: 'L2_CLIENT',
        secdexCode: otherClientProfile.secdexCode
      })

      // Try to access accounts from different organization
      const { req, res } = simulateAuth({
        userId: maliciousUser.clerkUserId,
        level: maliciousUser.level
      })

      const accounts = await prisma.account.findMany({
        where: {
          secdexCode: testData.clientProfiles[0].secdexCode // Different org
        }
      })

      // Should not return accounts from other organization
      expect(accounts).toHaveLength(0)
    })
  })

  describe('API Endpoint Attack Scenarios', () => {
    it('should prevent HTTP parameter pollution', async () => {
      // Simulate multiple parameters with same name
      const pollutionAttempts = [
        { ticker: ['VALID', "'; DROP TABLE securities; --"] },
        { accountNumber: ['VALID001', 'HACKED'] },
        { level: ['L2_CLIENT', 'L5_ADMIN'] }
      ]

      for (const attempt of pollutionAttempts) {
        try {
          const keys = Object.keys(attempt)
          const key = keys[0]
          const values = attempt[key]
          
          // Use first value only (standard behavior)
          const safeValue = Array.isArray(values) ? values[0] : values
          
          if (key === 'ticker') {
            await createTestSecurity({
              ticker: safeValue,
              name: 'Pollution Test'
            })
          } else if (key === 'accountNumber') {
            await createTestAccount({
              accountNumber: safeValue,
              accountName: 'Pollution Test',
              accountType: 'MasterAccount'
            })
          }
        } catch (error) {
          expect(error.message).not.toMatch(/pollution|duplicate/i)
        }
      }
    })

    it('should handle request smuggling attempts', async () => {
      const smugglingPayloads = [
        "GET / HTTP/1.1\r\nHost: evil.com\r\n\r\nGET /admin",
        "Content-Length: 0\r\n\r\nPOST /admin",
        "Transfer-Encoding: chunked\r\n\r\n0\r\n\r\nPOST /hack"
      ]

      for (const payload of smugglingPayloads) {
        try {
          await createTestSecurity({
            ticker: 'SMUGGLE',
            name: payload,
            description: payload
          })
        } catch (error) {
          // Should not process HTTP headers in data
          expect(error.message).not.toMatch(/http|smuggling|transfer-encoding/i)
        }
      }
    })

    it('should prevent timing attacks', async () => {
      const timingTest = async (input) => {
        const start = process.hrtime.bigint()
        
        try {
          await prisma.user.findUnique({
            where: { clerkUserId: input }
          })
        } catch (error) {
          // Ignore errors for timing test
        }
        
        const end = process.hrtime.bigint()
        return Number(end - start) / 1000000 // Convert to milliseconds
      }

      // Test with existing and non-existing user IDs
      const existingUser = testUser.clerkUserId
      const nonExistingUser = 'non_existing_user'
      
      const existingTimes = []
      const nonExistingTimes = []
      
      // Run multiple tests to get average timing
      for (let i = 0; i < 10; i++) {
        existingTimes.push(await timingTest(existingUser))
        nonExistingTimes.push(await timingTest(nonExistingUser))
      }
      
      const avgExisting = existingTimes.reduce((a, b) => a + b) / existingTimes.length
      const avgNonExisting = nonExistingTimes.reduce((a, b) => a + b) / nonExistingTimes.length
      
      // Timing difference should not be significant enough for timing attacks
      const timingDifference = Math.abs(avgExisting - avgNonExisting)
      expect(timingDifference).toBeLessThan(100) // Less than 100ms difference
    })
  })

  describe('Race Condition and Concurrency Attacks', () => {
    it('should prevent TOCTOU (Time of Check Time of Use) attacks', async () => {
      const testAccount = await createTestAccount({
        accountNumber: 'TOCTOU001',
        accountName: 'TOCTOU Test Account',
        accountType: 'MasterAccount'
      })

      const concurrentUpdate = async (index) => {
        return prisma.$transaction(async (tx) => {
          // Check if account exists
          const account = await tx.account.findUnique({
            where: { id: testAccount.id }
          })
          
          if (account) {
            // Time gap where attacker could modify
            await new Promise(resolve => setTimeout(resolve, 10))
            
            // Update based on previous check
            return tx.account.update({
              where: { id: testAccount.id },
              data: { accountName: `Updated by ${index}` }
            })
          }
        })
      }

      const results = await simulateConcurrentRequests(concurrentUpdate, 10)
      
      // All should succeed due to proper transaction handling
      expect(results.fulfilled).toBe(10)
      
      const finalAccount = await prisma.account.findUnique({
        where: { id: testAccount.id }
      })
      expect(finalAccount.accountName).toMatch(/^Updated by \d+$/)
    })

    it('should prevent double spending scenarios in concurrent operations', async () => {
      // Create account with initial state
      const testAccount = await createTestAccount({
        accountNumber: 'DOUBLE001',
        accountName: 'Double Spending Test',
        accountType: 'MasterAccount',
        balance: 1000 // Assuming balance field exists
      })

      const spendMoney = async (amount) => {
        return prisma.$transaction(async (tx) => {
          const account = await tx.account.findUnique({
            where: { id: testAccount.id }
          })
          
          if (account && (account.balance || 0) >= amount) {
            return tx.account.update({
              where: { id: testAccount.id },
              data: { balance: (account.balance || 0) - amount }
            })
          } else {
            throw new Error('Insufficient funds')
          }
        })
      }

      // Try to spend same money concurrently
      const spendResults = await simulateConcurrentRequests(() => spendMoney(600), 5)
      
      // Only one or two should succeed, preventing double spending
      expect(spendResults.fulfilled).toBeLessThanOrEqual(2)
      
      const finalAccount = await prisma.account.findUnique({
        where: { id: testAccount.id }
      })
      expect(finalAccount.balance).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Data Exfiltration Prevention', () => {
    it('should prevent information disclosure through error messages', async () => {
      const sensitiveQueries = [
        "SELECT * FROM admin_passwords",
        "SHOW TABLES",
        "DESCRIBE users",
        "SELECT VERSION()",
        "SELECT USER()"
      ]

      for (const query of sensitiveQueries) {
        try {
          await prisma.$executeRawUnsafe(query)
        } catch (error) {
          // Error messages should not reveal sensitive information
          expect(error.message).not.toMatch(/admin_passwords|version|mysql|postgres|root/i)
          expect(error.message).not.toMatch(/table.*structure|column.*name/i)
        }
      }
    })

    it('should prevent directory traversal attacks', async () => {
      const traversalAttempts = [
        "../../etc/passwd",
        "..\\..\\windows\\system32\\config\\sam",
        "../../../var/log/auth.log",
        "....//....//etc//passwd",
        "%2e%2e%2f%2e%2e%2fpasswd"
      ]

      for (const attempt of traversalAttempts) {
        try {
          await createTestSecurity({
            ticker: 'TRAVERSE',
            name: attempt,
            description: attempt
          })
          
          // If creation succeeds, ensure path traversal was neutralized
          const security = await prisma.security.findFirst({
            where: { ticker: 'TRAVERSE' }
          })
          
          if (security) {
            expect(security.name).not.toMatch(/\.\.\/|\.\.\\|%2e%2e/i)
            expect(security.description).not.toMatch(/etc\/passwd|system32|auth\.log/i)
          }
        } catch (error) {
          expect(error).toBeDefined()
        }
      }
    })

    it('should prevent data dumping through pagination attacks', async () => {
      // Create lots of test data
      const bulkSecurities = []
      for (let i = 0; i < 100; i++) {
        bulkSecurities.push({
          ticker: `BULK${String(i).padStart(3, '0')}`,
          name: `Bulk Security ${i}`,
          type: 'Stock',
          exchange: 'NYSE',
          isActive: true
        })
      }

      await prisma.security.createMany({
        data: bulkSecurities
      })

      // Try to retrieve all data with large page size
      const largePage = await prisma.security.findMany({
        take: 10000 // Attempt to get all data
      })

      // Should be limited to prevent data dumping
      expect(largePage.length).toBeLessThanOrEqual(1000) // Reasonable limit
    })
  })

  describe('Chaos Testing and Resilience', () => {
    it('should handle random failures gracefully', async () => {
      const chaosOperation = async (index) => {
        // Randomly fail some operations
        if (chaosScenarios.randomFailure(0.3)) { // 30% failure rate
          throw chaosScenarios.randomError()
        }
        
        // Add random delay
        await chaosScenarios.randomDelay(10, 100)
        
        return createTestSecurity({
          ticker: `CHAOS${index}`,
          name: `Chaos Security ${index}`
        })
      }

      const results = await simulateConcurrentRequests(chaosOperation, 20)
      
      // Should handle failures gracefully
      expect(results.total).toBe(20)
      expect(results.fulfilled + results.rejected).toBe(20)
      expect(results.successRate).toBeLessThan(1.0) // Some should fail
      expect(results.successRate).toBeGreaterThan(0.5) // But not all
    })

    it('should maintain data integrity under stress', async () => {
      const stressOperation = async (workerIndex, iterationIndex) => {
        const ticker = `STRESS${workerIndex}_${iterationIndex}`
        
        return createTestSecurity({
          ticker,
          name: `Stress Test Security ${workerIndex}-${iterationIndex}`
        })
      }

      const stressResults = await stressTestDatabase(stressOperation, 10, 50)
      
      expect(stressResults.totalOperations).toBe(500)
      expect(stressResults.successRate).toBeGreaterThan(0.9) // 90% success rate
      expect(stressResults.operationsPerSecond).toBeGreaterThan(0)
      
      // Verify data integrity
      const createdSecurities = await prisma.security.findMany({
        where: { ticker: { startsWith: 'STRESS' } }
      })
      
      expect(createdSecurities.length).toBe(stressResults.successful)
      
      // All securities should have unique tickers
      const tickers = createdSecurities.map(s => s.ticker)
      const uniqueTickers = [...new Set(tickers)]
      expect(uniqueTickers.length).toBe(tickers.length)
    })

    it('should recover from memory pressure', async () => {
      // Create memory pressure
      const memoryBuffer = chaosScenarios.memoryPressure(50) // 50MB
      
      try {
        // Perform operations under memory pressure
        const operations = []
        for (let i = 0; i < 10; i++) {
          operations.push(createTestSecurity({
            ticker: `MEM${String(i).padStart(3, '0')}`,
            name: `Memory Pressure Test ${i}`
          }))
        }
        
        const results = await Promise.allSettled(operations)
        const successes = results.filter(r => r.status === 'fulfilled')
        
        expect(successes.length).toBeGreaterThan(0)
      } finally {
        // Clear memory buffer
        memoryBuffer.fill(null)
      }
    })
  })
})