import {
  generateMaliciousInputs,
  createSecurityTestSuite,
  createCorruptionScenarios,
  simulateConcurrentRequests,
  RateLimitSimulator
} from '../utils/stress-test-helpers.js'

describe('Edge Case Testing Infrastructure Phase 3B', () => {
  let maliciousInputs
  let securityTestSuite
  let corruptionScenarios
  let rateLimiter

  beforeAll(() => {
    maliciousInputs = generateMaliciousInputs()
    securityTestSuite = createSecurityTestSuite()
    corruptionScenarios = createCorruptionScenarios()
    rateLimiter = new RateLimitSimulator(10, 60000)
  })

  describe('Malicious Input Generation', () => {
    it('should generate SQL injection payloads', () => {
      expect(maliciousInputs.sqlInjection).toBeDefined()
      expect(Array.isArray(maliciousInputs.sqlInjection)).toBe(true)
      expect(maliciousInputs.sqlInjection.length).toBeGreaterThan(0)
      
      // Check for common SQL injection patterns
      const hasDropTable = maliciousInputs.sqlInjection.some(payload => 
        payload.toLowerCase().includes('drop table')
      )
      expect(hasDropTable).toBe(true)
    })

    it('should generate XSS payloads', () => {
      expect(maliciousInputs.xss).toBeDefined()
      expect(Array.isArray(maliciousInputs.xss)).toBe(true)
      expect(maliciousInputs.xss.length).toBeGreaterThan(0)
      
      // Check for script tags
      const hasScriptTag = maliciousInputs.xss.some(payload => 
        payload.includes('<script>')
      )
      expect(hasScriptTag).toBe(true)
    })

    it('should generate buffer overflow attacks', () => {
      expect(maliciousInputs.overflowAttacks).toBeDefined()
      expect(Array.isArray(maliciousInputs.overflowAttacks)).toBe(true)
      expect(maliciousInputs.overflowAttacks.length).toBeGreaterThan(0)
      
      // Check for large strings
      const hasLargeString = maliciousInputs.overflowAttacks.some(payload => 
        payload.length > 1000
      )
      expect(hasLargeString).toBe(true)
    })

    it('should generate special characters', () => {
      expect(maliciousInputs.specialCharacters).toBeDefined()
      expect(Array.isArray(maliciousInputs.specialCharacters)).toBe(true)
      expect(maliciousInputs.specialCharacters.length).toBeGreaterThan(0)
    })

    it('should generate edge case values', () => {
      expect(maliciousInputs.edgeCases).toBeDefined()
      expect(Array.isArray(maliciousInputs.edgeCases)).toBe(true)
      expect(maliciousInputs.edgeCases.length).toBeGreaterThan(0)
      
      // Should include null, undefined, empty strings
      expect(maliciousInputs.edgeCases).toContain('')
      expect(maliciousInputs.edgeCases).toContain(null)
      expect(maliciousInputs.edgeCases).toContain(undefined)
    })
  })

  describe('Security Test Suite', () => {
    it('should detect SQL injection patterns', () => {
      const sqlInjection = "'; DROP TABLE users; --"
      expect(securityTestSuite.testSQLInjection(sqlInjection)).toBe(true)
      
      const safeInput = "normal input"
      expect(securityTestSuite.testSQLInjection(safeInput)).toBe(false)
    })

    it('should detect XSS patterns', () => {
      const xssPayload = "<script>alert('XSS')</script>"
      expect(securityTestSuite.testXSS(xssPayload)).toBe(true)
      
      const safeInput = "normal input"
      expect(securityTestSuite.testXSS(safeInput)).toBe(false)
    })

    it('should detect buffer overflow attempts', () => {
      const longString = 'A'.repeat(1000)
      expect(securityTestSuite.testBufferOverflow(longString, 255)).toBe(true)
      
      const shortString = 'normal input'
      expect(securityTestSuite.testBufferOverflow(shortString, 255)).toBe(false)
    })

    it('should detect null injection attempts', () => {
      const nullInjection = "test\u0000injection"
      expect(securityTestSuite.testNullInjection(nullInjection)).toBe(true)
      
      const safeInput = "normal input"
      expect(securityTestSuite.testNullInjection(safeInput)).toBe(false)
    })
  })

  describe('Data Corruption Scenarios', () => {
    it('should corrupt ticker data', () => {
      const originalTicker = 'AAPL'
      const corruptedTicker = corruptionScenarios.corruptTicker(originalTicker)
      
      expect(corruptedTicker).toBeDefined()
      expect(typeof corruptedTicker).toBe('string')
      // Should be different from original
      expect(corruptedTicker).not.toBe(originalTicker)
    })

    it('should corrupt JSON data', () => {
      const originalData = { name: 'Test', value: 123 }
      const corruptedJSON = corruptionScenarios.corruptJSON(originalData)
      
      expect(corruptedJSON).toBeDefined()
      expect(typeof corruptedJSON).toBe('string')
      
      // Should be invalid JSON
      expect(() => JSON.parse(corruptedJSON)).toThrow()
    })

    it('should corrupt numeric data', () => {
      const originalNumber = 100
      const corruptedNumber = corruptionScenarios.corruptNumber(originalNumber)
      
      expect(corruptedNumber).toBeDefined()
      expect(typeof corruptedNumber).toBe('number')
      expect(corruptedNumber).not.toBe(originalNumber)
    })
  })

  describe('Concurrent Request Simulation', () => {
    it('should simulate successful concurrent requests', async () => {
      const mockOperation = async (index) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { success: true, index }
      }

      const results = await simulateConcurrentRequests(mockOperation, 5)
      
      expect(results.total).toBe(5)
      expect(results.fulfilled).toBe(5)
      expect(results.rejected).toBe(0)
      expect(results.successRate).toBe(1.0)
      expect(results.results).toHaveLength(5)
    })

    it('should simulate mixed success/failure requests', async () => {
      const mockOperation = async (index) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        if (index % 2 === 0) {
          throw new Error(`Failed operation ${index}`)
        }
        return { success: true, index }
      }

      const results = await simulateConcurrentRequests(mockOperation, 4)
      
      expect(results.total).toBe(4)
      expect(results.fulfilled).toBe(2) // indexes 1 and 3
      expect(results.rejected).toBe(2)  // indexes 0 and 2
      expect(results.successRate).toBe(0.5)
    })

    it('should handle concurrent requests with delay', async () => {
      const mockOperation = async (index) => {
        return { index, timestamp: Date.now() }
      }

      const startTime = Date.now()
      const results = await simulateConcurrentRequests(mockOperation, 3, 50)
      const endTime = Date.now()
      
      expect(results.total).toBe(3)
      expect(results.fulfilled).toBe(3)
      expect(endTime - startTime).toBeGreaterThanOrEqual(100) // 3 * 50ms delay for last request
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      rateLimiter.reset()
    })

    it('should allow requests under limit', () => {
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.isAllowed('test-client')).toBe(true)
      }
    })

    it('should block requests over limit', () => {
      // Use up the limit (10 requests)
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.isAllowed('test-client')).toBe(true)
      }
      
      // Next request should be blocked
      expect(rateLimiter.isAllowed('test-client')).toBe(false)
    })

    it('should track different clients separately', () => {
      // Client 1 uses up their limit
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.isAllowed('client-1')).toBe(true)
      }
      expect(rateLimiter.isAllowed('client-1')).toBe(false)
      
      // Client 2 should still be allowed
      expect(rateLimiter.isAllowed('client-2')).toBe(true)
    })

    it('should provide rate limit status', () => {
      // Make some requests
      for (let i = 0; i < 3; i++) {
        rateLimiter.isAllowed('test-client')
      }
      
      const status = rateLimiter.getStatus('test-client')
      expect(status.requests).toBe(3)
      expect(status.maxRequests).toBe(10)
      expect(status.remaining).toBe(7)
      expect(status.resetTime).toBeGreaterThan(Date.now())
    })
  })

  describe('Stress Testing Utilities', () => {
    it('should generate bulk securities data', () => {
      const { generateBulkSecurities } = require('../utils/stress-test-helpers.js')
      
      const securities = generateBulkSecurities(100)
      expect(securities).toHaveLength(100)
      
      securities.forEach((security, index) => {
        expect(security.ticker).toBeDefined()
        expect(security.name).toBeDefined()
        expect(security.type).toBeDefined()
        expect(security.exchange).toBeDefined()
        expect(typeof security.isActive).toBe('boolean')
      })
      
      // Should have unique tickers
      const tickers = securities.map(s => s.ticker)
      const uniqueTickers = [...new Set(tickers)]
      expect(uniqueTickers).toHaveLength(100)
    })

    it('should generate bulk accounts data', () => {
      const { generateBulkAccounts } = require('../utils/stress-test-helpers.js')
      
      const accounts = generateBulkAccounts(50)
      expect(accounts).toHaveLength(50)
      
      accounts.forEach(account => {
        expect(account.accountType).toBeDefined()
        expect(account.accountNumber).toBeDefined()
        expect(account.accountName).toBeDefined()
        expect(account.benchmark).toBeDefined()
        expect(typeof account.isActive).toBe('boolean')
      })
      
      // Should have unique account numbers
      const accountNumbers = accounts.map(a => a.accountNumber)
      const uniqueAccountNumbers = [...new Set(accountNumbers)]
      expect(uniqueAccountNumbers).toHaveLength(50)
    })
  })

  describe('Performance Measurement', () => {
    it('should measure operation performance', async () => {
      const { measureOperationPerformance } = require('../utils/stress-test-helpers.js')
      
      const testOperation = async (index) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return `result-${index}`
      }
      
      const performance = await measureOperationPerformance(testOperation, 5)
      
      expect(performance.total).toBe(5)
      expect(performance.successful).toBe(5)
      expect(performance.failed).toBe(0)
      expect(performance.average).toBeGreaterThan(5) // Should take at least 10ms each
      expect(performance.min).toBeGreaterThan(0)
      expect(performance.max).toBeGreaterThan(0)
      expect(performance.times).toHaveLength(5)
    })

    it('should create performance timer', () => {
      const { createPerformanceTimer } = require('../utils/stress-test-helpers.js')
      
      const timer = createPerformanceTimer()
      expect(timer.start).toBeGreaterThan(0)
      expect(typeof timer.elapsed).toBe('function')
      expect(typeof timer.stop).toBe('function')
      
      const elapsed = timer.elapsed()
      expect(elapsed).toBeGreaterThanOrEqual(0)
      
      const stopped = timer.stop()
      expect(stopped.start).toBe(timer.start)
      expect(stopped.end).toBeGreaterThan(stopped.start)
      expect(stopped.duration).toBe(stopped.end - stopped.start)
    })
  })
})