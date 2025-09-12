import { jest } from '@jest/globals'
import { logInfo, logError, logMetric } from '@/lib/logging'

// Mock console methods
const mockConsole = {
  info: jest.fn(),
  error: jest.fn()
}
global.console = mockConsole

describe('lib/logging - Better Stack Wrapper', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('logInfo', () => {
    test('logs info message with context', () => {
      const message = 'User login successful'
      const context = { userId: 'user-123', component: 'auth' }

      logInfo(message, context)

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[DEV LOG]',
        message,
        context
      )
    })

    test('logs info message without context', () => {
      const message = 'System started'

      logInfo(message)

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[DEV LOG]',
        message,
        {}
      )
    })

    test('uses Better Stack format in production', () => {
      process.env.NODE_ENV = 'production'
      const message = 'Production message'
      const context = { feature: 'reporting' }

      logInfo(message, context)

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[Better Stack]',
        expect.stringContaining('"level":"info"')
      )
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[Better Stack]',
        expect.stringContaining('"message":"Production message"')
      )
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[Better Stack]',
        expect.stringContaining('"service":"jesco-investment-reporting"')
      )
    })

    test('handles logging errors gracefully', () => {
      // Mock console.info to throw error
      mockConsole.info.mockImplementationOnce(() => {
        throw new Error('Console error')
      })

      // Should not throw, should log error instead
      expect(() => logInfo('test message')).not.toThrow()
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to log to Better Stack:',
        expect.any(Error)
      )
    })

    test('includes timestamp in log entry', () => {
      process.env.NODE_ENV = 'production'
      const beforeTime = new Date().toISOString()
      
      logInfo('timestamp test')
      
      const afterTime = new Date().toISOString()
      const logCall = mockConsole.info.mock.calls[0][1]
      const logEntry = JSON.parse(logCall)
      
      expect(logEntry.timestamp).toBeDefined()
      expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(logEntry.timestamp >= beforeTime).toBe(true)
      expect(logEntry.timestamp <= afterTime).toBe(true)
    })
  })

  describe('logError', () => {
    test('logs Error object with stack trace', () => {
      const error = new Error('Database connection failed')
      const context = { component: 'database', action: 'connect' }

      logError(error, context)

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[DEV ERROR]',
        'Database connection failed',
        context
      )
    })

    test('logs string error', () => {
      const errorString = 'Configuration missing'
      const context = { component: 'config' }

      logError(errorString, context)

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[DEV ERROR]',
        undefined, // String has no .message property
        context
      )
    })

    test('includes stack trace in production format', () => {
      process.env.NODE_ENV = 'production'
      const error = new Error('Test error')
      
      logError(error)

      const logCall = mockConsole.error.mock.calls[0][1]
      const logEntry = JSON.parse(logCall)
      
      expect(logEntry.level).toBe('error')
      expect(logEntry.message).toBe('Test error')
      expect(logEntry.stack).toBeDefined()
      expect(logEntry.stack).toContain('Error: Test error')
    })

    test('handles non-Error objects', () => {
      const nonError = { code: 500, message: 'Server error' }
      
      logError(nonError)

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[DEV ERROR]',
        'Server error', // Object with .message property
        {}
      )
    })

    test('handles logging errors gracefully', () => {
      mockConsole.error.mockImplementationOnce(() => {
        throw new Error('Console error')
      })

      expect(() => logError(new Error('test'))).not.toThrow()
      // Second call should be the fallback error logging
      expect(mockConsole.error).toHaveBeenCalledTimes(2)
    })
  })

  describe('logMetric', () => {
    test('logs numeric metric with context', () => {
      const metric = 'response_time'
      const value = 245.5
      const context = { endpoint: '/api/clients' }

      logMetric(metric, value, context)

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[DEV METRIC]',
        'response_time:',
        245.5,
        context
      )
    })

    test('logs metric without context', () => {
      const metric = 'active_users'
      const value = 42

      logMetric(metric, value)

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[DEV METRIC]',
        'active_users:',
        42,
        {}
      )
    })

    test('uses Better Stack format in production', () => {
      process.env.NODE_ENV = 'production'
      const metric = 'cpu_usage'
      const value = 85.2
      const context = { server: 'web-01' }

      logMetric(metric, value, context)

      const logCall = mockConsole.info.mock.calls[0][1]
      const logEntry = JSON.parse(logCall)
      
      expect(logEntry.level).toBe('metric')
      expect(logEntry.metric).toBe('cpu_usage')
      expect(logEntry.value).toBe(85.2)
      expect(logEntry.context).toEqual({ server: 'web-01' })
      expect(logEntry.service).toBe('jesco-investment-reporting')
    })

    test('handles zero and negative values', () => {
      logMetric('zero_metric', 0)
      logMetric('negative_metric', -15.5)

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[DEV METRIC]',
        'zero_metric:',
        0,
        {}
      )
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[DEV METRIC]',
        'negative_metric:',
        -15.5,
        {}
      )
    })

    test('handles logging errors gracefully', () => {
      mockConsole.info.mockImplementationOnce(() => {
        throw new Error('Console error')
      })

      expect(() => logMetric('test_metric', 100)).not.toThrow()
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to log metric to Better Stack:',
        expect.any(Error)
      )
    })
  })

  describe('integration with Better Stack', () => {
    test('all functions use consistent service identifier', () => {
      process.env.NODE_ENV = 'production'
      
      logInfo('info test')
      logError(new Error('error test'))
      logMetric('metric test', 123)

      const infoCalls = mockConsole.info.mock.calls
      const errorCalls = mockConsole.error.mock.calls

      // Check all production logs have same service identifier
      const infoEntry = JSON.parse(infoCalls[0][1])
      const errorEntry = JSON.parse(errorCalls[0][1])
      const metricEntry = JSON.parse(infoCalls[1][1])

      expect(infoEntry.service).toBe('jesco-investment-reporting')
      expect(errorEntry.service).toBe('jesco-investment-reporting')
      expect(metricEntry.service).toBe('jesco-investment-reporting')
    })

    test('timestamps are consistent format across all functions', () => {
      process.env.NODE_ENV = 'production'
      
      logInfo('info test')
      logError(new Error('error test'))
      logMetric('metric test', 123)

      const infoCalls = mockConsole.info.mock.calls
      const errorCalls = mockConsole.error.mock.calls

      const infoEntry = JSON.parse(infoCalls[0][1])
      const errorEntry = JSON.parse(errorCalls[0][1])
      const metricEntry = JSON.parse(infoCalls[1][1])

      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      
      expect(infoEntry.timestamp).toMatch(timestampRegex)
      expect(errorEntry.timestamp).toMatch(timestampRegex)
      expect(metricEntry.timestamp).toMatch(timestampRegex)
    })

    test('context objects are preserved in production format', () => {
      process.env.NODE_ENV = 'production'
      const context = { 
        userId: 'user-123', 
        component: 'auth',
        nested: { data: 'value' }
      }
      
      logInfo('context test', context)

      const logCall = mockConsole.info.mock.calls[0][1]
      const logEntry = JSON.parse(logCall)
      
      expect(logEntry.context).toEqual(context)
      expect(logEntry.context.nested.data).toBe('value')
    })
  })
})