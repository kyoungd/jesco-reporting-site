import { jest } from '@jest/globals'

// Bulk data generation utilities
export function generateBulkSecurities(count = 1000) {
  const securities = []
  const companies = [
    'Corp', 'Inc', 'Ltd', 'LLC', 'Holdings', 'Group', 'Technologies', 
    'Systems', 'Solutions', 'Industries', 'Partners', 'Ventures'
  ]
  const sectors = [
    'Tech', 'Finance', 'Health', 'Energy', 'Materials', 'Consumer', 
    'Industrial', 'Utilities', 'Telecom', 'RealEstate'
  ]
  const exchanges = ['NYSE', 'NASDAQ', 'AMEX', 'OTC']
  const types = ['Stock', 'Bond', 'ETF', 'Option', 'Future']

  for (let i = 1; i <= count; i++) {
    const sector = sectors[i % sectors.length]
    const company = companies[i % companies.length]
    const ticker = `${sector.substring(0, 3).toUpperCase()}${i.toString().padStart(3, '0')}`
    
    securities.push({
      ticker,
      name: `${sector} ${company} ${i}`,
      type: types[i % types.length],
      exchange: exchanges[i % exchanges.length],
      isActive: Math.random() > 0.1 // 90% active
    })
  }

  return securities
}

export function generateBulkAccounts(count = 1000, baseClientProfiles = []) {
  const accounts = []
  const accountTypes = ['ClientAccount', 'MasterAccount']
  const benchmarks = [
    'S&P 500', 'Russell 2000', 'NASDAQ 100', 'Dow Jones', 'FTSE 100',
    'Nikkei 225', 'DAX', 'CAC 40', 'Custom Benchmark'
  ]

  for (let i = 1; i <= count; i++) {
    const isClientAccount = i % 3 !== 0 // 2/3 are client accounts
    const accountType = isClientAccount ? 'ClientAccount' : 'MasterAccount'
    
    accounts.push({
      accountType,
      accountNumber: `BULK${i.toString().padStart(6, '0')}`,
      accountName: `Bulk Test Account ${i}`,
      benchmark: benchmarks[i % benchmarks.length],
      secdexCode: isClientAccount && baseClientProfiles.length > 0 
        ? baseClientProfiles[i % baseClientProfiles.length].secdexCode 
        : null,
      isActive: Math.random() > 0.05 // 95% active
    })
  }

  return accounts
}

export function generateMaliciousInputs() {
  return {
    sqlInjection: [
      "'; DROP TABLE securities; --",
      "' UNION SELECT * FROM users; --",
      "'; DELETE FROM accounts WHERE 1=1; --",
      "' OR '1'='1",
      "'; INSERT INTO securities (ticker) VALUES ('HACK'); --",
      "1'; UPDATE securities SET ticker='HACKED' WHERE 1=1; --"
    ],
    xss: [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<svg onload=alert('XSS')>",
      "';alert(String.fromCharCode(88,83,83))//';alert(String.fromCharCode(88,83,83))//",
      "\"><script>alert('XSS')</script>",
      "<iframe src=javascript:alert('XSS')></iframe>"
    ],
    overflowAttacks: [
      'A'.repeat(1000),
      'A'.repeat(10000),
      'A'.repeat(100000),
      '0'.repeat(1000),
      '1'.repeat(1000)
    ],
    specialCharacters: [
      '!@#$%^&*()_+-=[]{}|;:\\"\\\'.,<>?/~`',
      '¡™£¢∞§¶•ªº–≠œ∑´®†¥¨ˆøπ\\"\\\'åß∂ƒ©˙∆˚¬…æΩ≈ç√∫˜µ≤≥÷',
      '中文测试',
      'العربية',
      'русский',
      '🚀🎯💯🔥⚡️',
      '\u0000\u0001\u0002\u0003', // null bytes and control characters
      '\n\r\t', // newlines and tabs
      '\\\\\\///"""\'\'\'',
      '%00%0A%0D%22%27%3C%3E%5C' // URL encoded
    ],
    edgeCases: [
      '',
      ' ',
      '  ',
      '\t\n\r',
      null,
      undefined,
      'true',
      'false',
      '0',
      '-1',
      'Infinity',
      'NaN'
    ]
  }
}

// Concurrent request simulation
export async function simulateConcurrentRequests(requestFunction, count = 10, delay = 0) {
  const requests = []
  
  for (let i = 0; i < count; i++) {
    if (delay > 0) {
      requests.push(
        new Promise(resolve => 
          setTimeout(() => resolve(requestFunction(i)), delay * i)
        )
      )
    } else {
      requests.push(requestFunction(i))
    }
  }

  const results = await Promise.allSettled(requests)
  
  return {
    total: results.length,
    fulfilled: results.filter(r => r.status === 'fulfilled').length,
    rejected: results.filter(r => r.status === 'rejected').length,
    results: results,
    successRate: results.filter(r => r.status === 'fulfilled').length / results.length
  }
}

// Performance measurement utilities
export function createPerformanceTimer() {
  const start = performance.now()
  
  return {
    start,
    elapsed: () => performance.now() - start,
    stop: () => {
      const end = performance.now()
      return {
        start,
        end,
        duration: end - start
      }
    }
  }
}

export async function measureOperationPerformance(operation, iterations = 1) {
  const times = []
  
  for (let i = 0; i < iterations; i++) {
    const timer = createPerformanceTimer()
    try {
      await operation(i)
      times.push(timer.elapsed())
    } catch (error) {
      times.push(null) // Failed operation
    }
  }

  const validTimes = times.filter(t => t !== null)
  
  return {
    total: times.length,
    successful: validTimes.length,
    failed: times.length - validTimes.length,
    average: validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : 0,
    min: validTimes.length > 0 ? Math.min(...validTimes) : 0,
    max: validTimes.length > 0 ? Math.max(...validTimes) : 0,
    times: validTimes
  }
}

// Memory usage tracking
export function measureMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage()
    return {
      rss: usage.rss, // Resident Set Size
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0
    }
  }
  
  // Browser environment fallback
  if (typeof performance !== 'undefined' && performance.memory) {
    return {
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      usedJSHeapSize: performance.memory.usedJSHeapSize
    }
  }

  return null
}

// Rate limiting simulation
export class RateLimitSimulator {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.requests = new Map() // IP -> array of timestamps
  }

  isAllowed(clientId = 'default') {
    const now = Date.now()
    const clientRequests = this.requests.get(clientId) || []
    
    // Remove old requests outside the window
    const validRequests = clientRequests.filter(timestamp => 
      now - timestamp < this.windowMs
    )
    
    if (validRequests.length >= this.maxRequests) {
      return false
    }

    validRequests.push(now)
    this.requests.set(clientId, validRequests)
    return true
  }

  reset() {
    this.requests.clear()
  }

  getStatus(clientId = 'default') {
    const clientRequests = this.requests.get(clientId) || []
    const now = Date.now()
    const validRequests = clientRequests.filter(timestamp => 
      now - timestamp < this.windowMs
    )
    
    return {
      requests: validRequests.length,
      maxRequests: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - validRequests.length),
      resetTime: validRequests.length > 0 
        ? Math.min(...validRequests) + this.windowMs 
        : now
    }
  }
}

// Database stress testing
export async function stressTestDatabase(operation, concurrent = 10, iterations = 100) {
  const results = {
    totalOperations: concurrent * iterations,
    successful: 0,
    failed: 0,
    errors: [],
    timing: {
      start: Date.now(),
      end: null,
      duration: null
    }
  }

  const promises = []
  
  for (let i = 0; i < concurrent; i++) {
    promises.push(
      (async () => {
        for (let j = 0; j < iterations; j++) {
          try {
            await operation(i, j)
            results.successful++
          } catch (error) {
            results.failed++
            results.errors.push({
              worker: i,
              iteration: j,
              error: error.message,
              timestamp: Date.now()
            })
          }
        }
      })()
    )
  }

  await Promise.all(promises)
  
  results.timing.end = Date.now()
  results.timing.duration = results.timing.end - results.timing.start
  results.successRate = results.successful / results.totalOperations
  results.operationsPerSecond = results.totalOperations / (results.timing.duration / 1000)

  return results
}

// Input validation utilities
export function injectMaliciousInput(field, payload) {
  const maliciousInputs = generateMaliciousInputs()
  
  if (payload === 'random') {
    const categories = Object.keys(maliciousInputs)
    const category = categories[Math.floor(Math.random() * categories.length)]
    const inputs = maliciousInputs[category]
    return inputs[Math.floor(Math.random() * inputs.length)]
  }

  if (maliciousInputs[payload]) {
    const inputs = maliciousInputs[payload]
    return inputs[Math.floor(Math.random() * inputs.length)]
  }

  return payload
}

// Security test helpers
export function createSecurityTestSuite() {
  return {
    testSQLInjection: (input) => {
      const sqlPatterns = [
        /('|(\\'))((\s|\+)*(or|and)(\s|\+)+('|(\\')|1)|[\w\s]+('|(\\')))(\s|\+)*\w+/i,
        /((\s)*union(\s)+select)/i,
        /((\s)*drop(\s)+table(\s)+\w+)/i,
        /((\s)*delete(\s)+from(\s)+\w+)/i,
        /((\s)*insert(\s)+into(\s)+\w+)/i,
        /((\s)*update(\s)+\w+(\s)+set)/i
      ]
      
      return sqlPatterns.some(pattern => pattern.test(input))
    },

    testXSS: (input) => {
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<\s*\w+.*?on\w+\s*=/gi
      ]
      
      return xssPatterns.some(pattern => pattern.test(input))
    },

    testBufferOverflow: (input, maxLength = 255) => {
      return typeof input === 'string' && input.length > maxLength
    },

    testNullInjection: (input) => {
      return typeof input === 'string' && (
        input.includes('\u0000') || 
        input.includes('%00') ||
        input.includes('\\0')
      )
    }
  }
}

// Chaos testing utilities
export function createChaosTestScenarios() {
  return {
    randomFailure: (failureRate = 0.1) => {
      return Math.random() < failureRate
    },

    randomDelay: (minMs = 100, maxMs = 1000) => {
      const delay = Math.random() * (maxMs - minMs) + minMs
      return new Promise(resolve => setTimeout(resolve, delay))
    },

    randomError: () => {
      const errors = [
        new Error('Network timeout'),
        new Error('Database connection lost'),
        new Error('Service unavailable'),
        new Error('Resource temporarily unavailable'),
        new Error('Rate limit exceeded')
      ]
      return errors[Math.floor(Math.random() * errors.length)]
    },

    memoryPressure: (sizeMB = 100) => {
      // Create memory pressure for testing
      const buffer = new Array(sizeMB * 1024 * 1024 / 8) // Approximate MB in array elements
      buffer.fill(Math.random())
      return buffer
    }
  }
}

// Test data corruption scenarios
export function createCorruptionScenarios() {
  return {
    corruptTicker: (ticker) => {
      const corruptions = [
        ticker.replace(/[A-Z]/g, ''),
        ticker.toLowerCase(),
        ticker + '\u0000',
        ticker.split('').reverse().join(''),
        ticker.repeat(10),
        ticker.replace(/./g, '?')
      ]
      return corruptions[Math.floor(Math.random() * corruptions.length)]
    },

    corruptJSON: (obj) => {
      let json = JSON.stringify(obj)
      const corruptions = [
        json.slice(0, -1), // Remove last character
        json.replace(/"/g, "'"), // Replace quotes
        json.replace(/,/g, ";"), // Replace commas
        json + "extra", // Add extra content
        json.replace(/:/g, "=") // Replace colons
      ]
      return corruptions[Math.floor(Math.random() * corruptions.length)]
    },

    corruptNumber: (num) => {
      const corruptions = [
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Infinity,
        -Infinity,
        NaN,
        Number.EPSILON
      ]
      return corruptions[Math.floor(Math.random() * corruptions.length)]
    }
  }
}

export default {
  generateBulkSecurities,
  generateBulkAccounts,
  generateMaliciousInputs,
  simulateConcurrentRequests,
  createPerformanceTimer,
  measureOperationPerformance,
  measureMemoryUsage,
  RateLimitSimulator,
  stressTestDatabase,
  injectMaliciousInput,
  createSecurityTestSuite,
  createChaosTestScenarios,
  createCorruptionScenarios
}