// Phase 4 Calculation Libraries
// Pure calculation functions for investment reporting

// AUM Calculations
export {
  calculateAUM,
  calculateMultipleAUM,
  calculateAggregateAUM,
  calculateDailyAUM
} from './aum.js'

// Time-Weighted Returns
export {
  calculateDailyReturns,
  calculateTWR,
  calculateTWRWithFees,
  calculateRollingReturns,
  calculatePerformanceStatistics
} from './twr.js'

// Holdings and Weights
export {
  getHoldings,
  calculateWeights,
  calculateUnrealizedPnL,
  groupByAssetClass,
  calculateConcentrationRisk,
  calculatePerformanceAttribution
} from './holdings.js'

// Fee Calculations
export {
  accrueFees,
  calculatePerformanceFees,
  calculateTieredFees,
  calculateMultiAccountFees
} from './fees.js'

// Lot Tracking and Realized P&L
export {
  trackLots,
  calculateRealizedPnL,
  calculateUnrealizedPnL as calculateLotUnrealizedPnL,
  calculateWashSales,
  generateTaxReportingSummary
} from './lots.js'

// Quality Control and Validation
export {
  QC_STATUS,
  checkAUMIdentity,
  findMissingPrices,
  validateBenchmarkDates,
  validatePositionReconciliation,
  validateReturns,
  runComprehensiveQC
} from './qc.js'

/**
 * Helper function to validate calculation inputs
 * @param {Object} data - Input data to validate
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} Validation result
 */
export function validateCalculationInputs(data, requiredFields = []) {
  const missingFields = []
  const invalidFields = []
  
  requiredFields.forEach(field => {
    if (!(field in data)) {
      missingFields.push(field)
    } else if (data[field] === null || data[field] === undefined) {
      invalidFields.push(field)
    }
  })
  
  const isValid = missingFields.length === 0 && invalidFields.length === 0
  
  return {
    isValid,
    missingFields,
    invalidFields,
    message: isValid ? 
      'All required fields are present and valid' :
      `Validation failed: missing fields [${missingFields.join(', ')}], invalid fields [${invalidFields.join(', ')}]`
  }
}

/**
 * Common calculation utility functions
 */
export const CalculationUtils = {
  /**
   * Convert annual rate to daily rate
   * @param {number} annualRate - Annual rate (e.g., 0.01 for 1%)
   * @returns {number} Daily rate
   */
  annualToDaily: (annualRate) => annualRate / 365,
  
  /**
   * Convert daily rate to annual rate
   * @param {number} dailyRate - Daily rate
   * @returns {number} Annual rate
   */
  dailyToAnnual: (dailyRate) => dailyRate * 365,
  
  /**
   * Check if a date is a business day (Monday-Friday)
   * @param {Date} date - Date to check
   * @returns {boolean} True if business day
   */
  isBusinessDay: (date) => {
    const dayOfWeek = date.getDay()
    return dayOfWeek >= 1 && dayOfWeek <= 5
  },
  
  /**
   * Get business days between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {number} Number of business days
   */
  getBusinessDayCount: (startDate, endDate) => {
    let count = 0
    const currentDate = new Date(startDate)
    
    while (currentDate <= endDate) {
      if (CalculationUtils.isBusinessDay(currentDate)) {
        count++
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return count
  },
  
  /**
   * Format number as percentage
   * @param {number} value - Decimal value (e.g., 0.01 for 1%)
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted percentage
   */
  formatPercent: (value, decimals = 2) => {
    return `${(value * 100).toFixed(decimals)}%`
  },
  
  /**
   * Format number as currency
   * @param {number} value - Currency value
   * @param {string} currency - Currency code (default 'USD')
   * @returns {string} Formatted currency
   */
  formatCurrency: (value, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(value)
  },
  
  /**
   * Round to specified decimal places
   * @param {number} value - Value to round
   * @param {number} decimals - Number of decimal places
   * @returns {number} Rounded value
   */
  round: (value, decimals = 2) => {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
  }
}

/**
 * Calculation constants
 */
export const CalculationConstants = {
  TRADING_DAYS_PER_YEAR: 252,
  CALENDAR_DAYS_PER_YEAR: 365,
  BUSINESS_DAYS_PER_YEAR: 260, // Approximate
  QUARTERS_PER_YEAR: 4,
  MONTHS_PER_YEAR: 12,
  
  // Default tolerances
  DEFAULT_AUM_TOLERANCE: 0.01, // 1 cent
  DEFAULT_PRICE_TOLERANCE: 0.0001, // 1 basis point
  DEFAULT_QUANTITY_TOLERANCE: 0.001, // 0.001 shares
  
  // Return limits for validation
  MAX_DAILY_RETURN: 0.50, // 50%
  MIN_DAILY_RETURN: -0.50, // -50%
  
  // Asset classes
  ASSET_CLASSES: {
    EQUITY: 'EQUITY',
    FIXED_INCOME: 'FIXED_INCOME',
    CASH: 'CASH',
    ALTERNATIVES: 'ALTERNATIVES',
    COMMODITIES: 'COMMODITIES',
    REAL_ESTATE: 'REAL_ESTATE',
    FOREIGN_EXCHANGE: 'FOREIGN_EXCHANGE'
  }
}