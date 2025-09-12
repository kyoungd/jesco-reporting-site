/**
 * Better Stack logging wrapper
 * 
 * CONSTRAINTS:
 * - Better Stack wrapper ONLY
 * - DO NOT import or modify other lib files
 * - Keep it minimal
 */

/**
 * Log informational messages to Better Stack
 */
export function logInfo(message, context = {}) {
  try {
    // Send to Better Stack logging service
    const logEntry = {
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString(),
      service: 'jesco-investment-reporting'
    }
    
    // In production, this would send to Better Stack API
    if (process.env.NODE_ENV === 'production') {
      // Better Stack logging implementation would go here
      console.info('[Better Stack]', JSON.stringify(logEntry))
    } else {
      // Development logging
      console.info('[DEV LOG]', message, context)
    }
  } catch (error) {
    console.error('Failed to log to Better Stack:', error)
  }
}

/**
 * Log errors to Better Stack
 */
export function logError(error, context = {}) {
  try {
    const logEntry = {
      level: 'error',
      message: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      service: 'jesco-investment-reporting'
    }
    
    // In production, this would send to Better Stack API
    if (process.env.NODE_ENV === 'production') {
      // Better Stack error logging implementation would go here
      console.error('[Better Stack]', JSON.stringify(logEntry))
    } else {
      // Development logging
      console.error('[DEV ERROR]', error.message, context)
    }
  } catch (logError) {
    console.error('Failed to log error to Better Stack:', logError)
  }
}

/**
 * Log metrics to Better Stack
 */
export function logMetric(metric, value, context = {}) {
  try {
    const logEntry = {
      level: 'metric',
      metric,
      value,
      context,
      timestamp: new Date().toISOString(),
      service: 'jesco-investment-reporting'
    }
    
    // In production, this would send to Better Stack API
    if (process.env.NODE_ENV === 'production') {
      // Better Stack metrics implementation would go here
      console.info('[Better Stack Metric]', JSON.stringify(logEntry))
    } else {
      // Development logging
      console.info('[DEV METRIC]', `${metric}:`, value, context)
    }
  } catch (error) {
    console.error('Failed to log metric to Better Stack:', error)
  }
}