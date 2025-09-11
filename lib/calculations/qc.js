import Decimal from 'decimal.js'

/**
 * Quality control validation statuses
 */
export const QC_STATUS = {
  PASS: 'PASS',
  WARN: 'WARN', 
  FAIL: 'FAIL'
}

/**
 * Check AUM identity: EOP - BOP = NetFlows + MarketPnL
 * @param {Object} aumData - AUM calculation data
 * @param {number} tolerance - Tolerance threshold (default 0.01 = 1 cent)
 * @returns {Object} Quality control result
 */
export function checkAUMIdentity(aumData, tolerance = 0.01) {
  const bop = new Decimal(aumData.bop || 0)
  const eop = new Decimal(aumData.eop || 0)
  const netFlows = new Decimal(aumData.netFlows || 0)
  const marketPnL = new Decimal(aumData.marketPnL || 0)
  
  // Calculate identity: EOP - BOP should equal NetFlows + MarketPnL
  const leftSide = eop.minus(bop)
  const rightSide = netFlows.plus(marketPnL)
  const difference = leftSide.minus(rightSide).abs()
  
  const toleranceDecimal = new Decimal(tolerance)
  const isWithinTolerance = difference.lessThanOrEqualTo(toleranceDecimal)
  
  let status = QC_STATUS.PASS
  let messages = []
  
  if (!isWithinTolerance) {
    // For very small tolerances (< 1), use a warning tier, otherwise fail directly
    if (toleranceDecimal.lessThan(1)) {
      // Use 3-tier system for sub-dollar tolerances
      if (difference.greaterThan(toleranceDecimal.times(1000))) {
        status = QC_STATUS.FAIL
        messages.push(`AUM identity check failed: difference of ${difference.toFixed(2)} exceeds maximum tolerance`)
      } else {
        status = QC_STATUS.WARN
        messages.push(`AUM identity check warning: difference of ${difference.toFixed(2)} exceeds preferred tolerance`)
      }
    } else {
      // For dollar-level tolerances, fail directly
      status = QC_STATUS.FAIL
      messages.push(`AUM identity check failed: difference of ${difference.toFixed(2)} exceeds tolerance of ${toleranceDecimal.toFixed(2)}`)
    }
  } else {
    messages.push('AUM identity check passed')
  }
  
  return {
    status,
    messages,
    check: 'AUM_IDENTITY',
    data: {
      bop: bop.toNumber(),
      eop: eop.toNumber(),
      netFlows: netFlows.toNumber(),
      marketPnL: marketPnL.toNumber(),
      leftSide: leftSide.toNumber(),
      rightSide: rightSide.toNumber(),
      difference: difference.toNumber(),
      tolerance: tolerance,
      isWithinTolerance
    }
  }
}

/**
 * Find missing prices for securities within a date range
 * @param {string} accountId - Account identifier
 * @param {Object} dateRange - Date range {start, end}
 * @param {Object} data - Input data containing positions, transactions, prices
 * @returns {Object} Quality control result for missing prices
 */
export function findMissingPrices(accountId, dateRange, data) {
  const { positions = [], transactions = [], prices = [] } = data
  const { start, end } = dateRange
  // Use local timezone parsing to avoid UTC midnight issues
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const [endYear, endMonth, endDay] = end.split('-').map(Number)
  const startDate = new Date(startYear, startMonth - 1, startDay)
  const endDate = new Date(endYear, endMonth - 1, endDay)
  
  // Get all securities that had positions or transactions in the period
  const relevantSecurities = new Set()
  
  positions
    .filter(p => {
      const [pYear, pMonth, pDay] = p.date.split('-').map(Number)
      const positionDate = new Date(pYear, pMonth - 1, pDay)
      return p.accountId === accountId &&
             positionDate >= startDate &&
             positionDate <= endDate
    })
    .forEach(p => relevantSecurities.add(p.securityId))
  
  transactions
    .filter(t => {
      const transDate = t.date || t.transactionDate
      const [tYear, tMonth, tDay] = transDate.split('-').map(Number)
      const transactionDate = new Date(tYear, tMonth - 1, tDay)
      return t.accountId === accountId &&
             transactionDate >= startDate &&
             transactionDate <= endDate
    })
    .forEach(t => relevantSecurities.add(t.securityId))
  
  // Check for missing prices
  const missingPrices = []
  const currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    // Skip weekends
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      const dateStr = currentDate.toISOString().split('T')[0]
      
      for (const securityId of relevantSecurities) {
        const priceExists = prices.some(p => 
          p.securityId === securityId && p.date === dateStr
        )
        
        if (!priceExists) {
          // Check if there was activity requiring a price
          const hasPosition = positions.some(p => {
            const [pYear, pMonth, pDay] = p.date.split('-').map(Number)
            const positionDate = new Date(pYear, pMonth - 1, pDay)
            return p.securityId === securityId &&
                   p.accountId === accountId &&
                   positionDate <= currentDate &&
                   new Decimal(p.quantity || 0).greaterThan(0)
          })
          
          const hasTransaction = transactions.some(t => {
            const transDate = t.date || t.transactionDate
            const [tYear, tMonth, tDay] = transDate.split('-').map(Number)
            const transactionDate = new Date(tYear, tMonth - 1, tDay)
            return t.securityId === securityId &&
                   t.accountId === accountId &&
                   transactionDate.toDateString() === currentDate.toDateString()
          })
          
          if (hasPosition || hasTransaction) {
            missingPrices.push({
              securityId,
              date: dateStr,
              hasPosition,
              hasTransaction,
              priority: hasTransaction ? 'HIGH' : (hasPosition ? 'MEDIUM' : 'LOW')
            })
          }
        }
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // Determine status
  let status = QC_STATUS.PASS
  let messages = []
  
  const highPriorityMissing = missingPrices.filter(p => p.priority === 'HIGH').length
  const mediumPriorityMissing = missingPrices.filter(p => p.priority === 'MEDIUM').length
  
  if (highPriorityMissing > 0) {
    status = QC_STATUS.FAIL
    messages.push(`${highPriorityMissing} high-priority missing prices found (transaction days)`)
  } else if (mediumPriorityMissing > 0) {
    status = QC_STATUS.WARN
    messages.push(`${mediumPriorityMissing} medium-priority missing prices found (position days)`)
  } else if (missingPrices.length === 0) {
    messages.push('No missing prices found')
  }
  
  return {
    status,
    messages,
    check: 'MISSING_PRICES',
    data: {
      accountId,
      dateRange,
      missingPrices,
      summary: {
        total: missingPrices.length,
        high: highPriorityMissing,
        medium: mediumPriorityMissing,
        low: missingPrices.filter(p => p.priority === 'LOW').length
      },
      relevantSecurities: Array.from(relevantSecurities)
    }
  }
}

/**
 * Validate benchmark data alignment with return dates
 * @param {Array} returns - Array of return data
 * @param {Array} benchmarkData - Array of benchmark return data
 * @returns {Object} Quality control result for benchmark validation
 */
export function validateBenchmarkDates(returns, benchmarkData) {
  const returnDates = new Set(returns.map(r => r.date))
  const benchmarkDates = new Set(benchmarkData.map(b => b.date))
  
  const missingInBenchmark = returns
    .filter(r => !benchmarkDates.has(r.date))
    .map(r => r.date)
  
  const extraInBenchmark = benchmarkData
    .filter(b => !returnDates.has(b.date))
    .map(b => b.date)
  
  let status = QC_STATUS.PASS
  let messages = []
  
  if (missingInBenchmark.length > 0) {
    if (missingInBenchmark.length / returns.length > 0.1) { // More than 10% missing
      status = QC_STATUS.FAIL
      messages.push(`${missingInBenchmark.length} return dates missing from benchmark data (${(missingInBenchmark.length / returns.length * 100).toFixed(1)}%)`)
    } else {
      status = QC_STATUS.WARN
      messages.push(`${missingInBenchmark.length} return dates missing from benchmark data`)
    }
  }
  
  if (extraInBenchmark.length > 0) {
    messages.push(`${extraInBenchmark.length} extra dates in benchmark data`)
  }
  
  if (status === QC_STATUS.PASS) {
    messages.push('Benchmark dates properly aligned with return data')
  }
  
  return {
    status,
    messages,
    check: 'BENCHMARK_DATES',
    data: {
      returnPeriods: returns.length,
      benchmarkPeriods: benchmarkData.length,
      missingInBenchmark: missingInBenchmark.sort(),
      extraInBenchmark: extraInBenchmark.sort(),
      alignmentRatio: returnDates.size > 0 ? 
        (returnDates.size - missingInBenchmark.length) / returnDates.size : 0
    }
  }
}

/**
 * Validate position reconciliation
 * @param {Array} positions - Position data
 * @param {Array} transactions - Transaction data
 * @param {string} accountId - Account identifier
 * @returns {Object} Quality control result for position reconciliation
 */
export function validatePositionReconciliation(positions, transactions, accountId) {
  const accountPositions = positions.filter(p => p.accountId === accountId)
  const accountTransactions = transactions.filter(t => t.accountId === accountId)
  
  // Group by security
  const positionsByDate = new Map() // date -> Map(securityId -> position)
  const securityIds = new Set()
  
  accountPositions.forEach(position => {
    securityIds.add(position.securityId)
    const date = position.date
    
    if (!positionsByDate.has(date)) {
      positionsByDate.set(date, new Map())
    }
    positionsByDate.get(date).set(position.securityId, position)
  })
  
  accountTransactions.forEach(t => securityIds.add(t.securityId))
  
  const reconciliationIssues = []
  
  // Check each security
  for (const securityId of securityIds) {
    const securityTransactions = accountTransactions
      .filter(t => t.securityId === securityId)
      .sort((a, b) => new Date(a.date || a.transactionDate) - new Date(b.date || b.transactionDate))
    
    if (securityTransactions.length === 0) continue
    
    // Calculate expected position based on transactions
    let expectedQuantity = new Decimal(0)
    let expectedCost = new Decimal(0)
    
    securityTransactions.forEach(transaction => {
      const quantity = new Decimal(transaction.quantity || 0)
      const price = new Decimal(transaction.price || 0)
      
      if (transaction.type === 'BUY' || transaction.type === 'PURCHASE') {
        expectedQuantity = expectedQuantity.plus(quantity)
        expectedCost = expectedCost.plus(quantity.times(price))
      } else if (transaction.type === 'SELL' || transaction.type === 'SALE') {
        const saleQuantity = quantity.abs()
        const proportionalCost = expectedQuantity.equals(0) ? 
          new Decimal(0) : 
          expectedCost.times(saleQuantity.dividedBy(expectedQuantity))
        
        expectedQuantity = expectedQuantity.minus(saleQuantity)
        expectedCost = expectedCost.minus(proportionalCost)
      }
    })
    
    const expectedAverageCost = expectedQuantity.equals(0) ? 
      new Decimal(0) : 
      expectedCost.dividedBy(expectedQuantity)
    
    // Compare with latest position
    const latestPositionDate = Array.from(positionsByDate.keys())
      .sort((a, b) => new Date(b) - new Date(a))[0]
    
    if (latestPositionDate) {
      const latestPosition = positionsByDate.get(latestPositionDate).get(securityId)
      
      if (latestPosition) {
        const actualQuantity = new Decimal(latestPosition.quantity || 0)
        const actualAverageCost = new Decimal(latestPosition.averageCost || 0)
        
        const quantityDiff = expectedQuantity.minus(actualQuantity).abs()
        const costDiff = expectedAverageCost.minus(actualAverageCost).abs()
        
        const quantityTolerance = new Decimal(0.001) // 0.001 shares
        const costTolerance = new Decimal(0.01) // 1 cent
        
        if (quantityDiff.greaterThan(quantityTolerance)) {
          reconciliationIssues.push({
            securityId,
            issue: 'QUANTITY_MISMATCH',
            expected: expectedQuantity.toNumber(),
            actual: actualQuantity.toNumber(),
            difference: expectedQuantity.minus(actualQuantity).toNumber(),
            severity: quantityDiff.greaterThan(1) ? 'HIGH' : 'LOW'
          })
        }
        
        if (costDiff.greaterThan(costTolerance) && !actualQuantity.equals(0)) {
          reconciliationIssues.push({
            securityId,
            issue: 'COST_BASIS_MISMATCH',
            expected: expectedAverageCost.toNumber(),
            actual: actualAverageCost.toNumber(),
            difference: expectedAverageCost.minus(actualAverageCost).toNumber(),
            severity: costDiff.greaterThan(10) ? 'HIGH' : 'MEDIUM'
          })
        }
      }
    }
  }
  
  // Determine status
  let status = QC_STATUS.PASS
  let messages = []
  
  const highSeverityIssues = reconciliationIssues.filter(i => i.severity === 'HIGH').length
  const mediumSeverityIssues = reconciliationIssues.filter(i => i.severity === 'MEDIUM').length
  
  if (highSeverityIssues > 0) {
    status = QC_STATUS.FAIL
    messages.push(`${highSeverityIssues} high-severity position reconciliation issues found`)
  } else if (mediumSeverityIssues > 0) {
    status = QC_STATUS.WARN
    messages.push(`${mediumSeverityIssues} medium-severity position reconciliation issues found`)
  } else if (reconciliationIssues.length === 0) {
    messages.push('Position reconciliation passed')
  }
  
  return {
    status,
    messages,
    check: 'POSITION_RECONCILIATION',
    data: {
      accountId,
      reconciliationIssues,
      summary: {
        total: reconciliationIssues.length,
        high: highSeverityIssues,
        medium: mediumSeverityIssues,
        low: reconciliationIssues.filter(i => i.severity === 'LOW').length
      },
      securitiesChecked: Array.from(securityIds)
    }
  }
}

/**
 * Validate return calculations
 * @param {Array} returns - Array of return data
 * @param {Object} options - Validation options
 * @returns {Object} Quality control result for returns validation
 */
export function validateReturns(returns, options = {}) {
  const { maxDailyReturn = 0.50, minDailyReturn = -0.50 } = options // 50% daily return limits
  
  const issues = []
  const maxReturnDecimal = new Decimal(maxDailyReturn)
  const minReturnDecimal = new Decimal(minDailyReturn)
  
  returns.forEach((returnData, index) => {
    let dailyReturn
    try {
      const rawValue = returnData.dailyReturn
      if (rawValue === null || rawValue === undefined || 
          (typeof rawValue === 'number' && isNaN(rawValue)) ||
          rawValue === '' || rawValue === 'invalid') {
        throw new Error(`Invalid return value: ${rawValue}`)
      }
      dailyReturn = new Decimal(rawValue)
    } catch (error) {
      issues.push({
        date: returnData.date,
        issue: 'INVALID_RETURN_VALUE',
        value: returnData.dailyReturn,
        error: error.message,
        severity: 'HIGH'
      })
      return // Skip further validation for this return
    }
    
    // Check for extreme returns
    if (dailyReturn.greaterThan(maxReturnDecimal)) {
      issues.push({
        date: returnData.date,
        issue: 'EXTREME_POSITIVE_RETURN',
        value: dailyReturn.toNumber(),
        threshold: maxDailyReturn,
        severity: dailyReturn.greaterThan(1) ? 'HIGH' : 'MEDIUM'
      })
    }
    
    if (dailyReturn.lessThan(minReturnDecimal)) {
      issues.push({
        date: returnData.date,
        issue: 'EXTREME_NEGATIVE_RETURN',
        value: dailyReturn.toNumber(),
        threshold: minDailyReturn,
        severity: dailyReturn.lessThan(-1) ? 'HIGH' : 'MEDIUM'
      })
    }
    
    // Check for missing or invalid data
    if (isNaN(dailyReturn.toNumber())) {
      issues.push({
        date: returnData.date,
        issue: 'INVALID_RETURN_VALUE',
        value: returnData.dailyReturn,
        severity: 'HIGH'
      })
    }
    
    // Check for date sequence
    if (index > 0) {
      const previousDate = new Date(returns[index - 1].date)
      const currentDate = new Date(returnData.date)
      
      if (currentDate <= previousDate) {
        issues.push({
          date: returnData.date,
          issue: 'DATE_SEQUENCE_ERROR',
          previousDate: returns[index - 1].date,
          currentDate: returnData.date,
          severity: 'HIGH'
        })
      }
    }
  })
  
  // Determine status
  let status = QC_STATUS.PASS
  let messages = []
  
  const highSeverityIssues = issues.filter(i => i.severity === 'HIGH').length
  const mediumSeverityIssues = issues.filter(i => i.severity === 'MEDIUM').length
  
  if (highSeverityIssues > 0) {
    status = QC_STATUS.FAIL
    messages.push(`${highSeverityIssues} high-severity return validation issues found`)
  } else if (mediumSeverityIssues > 0) {
    status = QC_STATUS.WARN
    messages.push(`${mediumSeverityIssues} medium-severity return validation issues found`)
  } else {
    messages.push('Return validation passed')
  }
  
  return {
    status,
    messages,
    check: 'RETURN_VALIDATION',
    data: {
      issues,
      summary: {
        total: issues.length,
        high: highSeverityIssues,
        medium: mediumSeverityIssues,
        low: issues.filter(i => i.severity === 'LOW').length
      },
      returnPeriods: returns.length
    }
  }
}

/**
 * Run comprehensive quality control checks
 * @param {Object} data - All data needed for QC checks
 * @param {Object} options - QC options and tolerances
 * @returns {Object} Comprehensive quality control report
 */
export function runComprehensiveQC(data, options = {}) {
  const {
    accountId,
    aumData,
    returns,
    benchmarkData,
    positions,
    transactions,
    dateRange,
    tolerances = {}
  } = data
  
  const checks = []
  
  // AUM Identity Check
  if (aumData) {
    checks.push(checkAUMIdentity(aumData, tolerances.aum))
  }
  
  // Missing Prices Check
  if (accountId && dateRange && positions && transactions) {
    checks.push(findMissingPrices(accountId, dateRange, data))
  }
  
  // Benchmark Validation
  if (returns && benchmarkData) {
    checks.push(validateBenchmarkDates(returns, benchmarkData))
  }
  
  // Position Reconciliation
  if (positions && transactions && accountId) {
    checks.push(validatePositionReconciliation(positions, transactions, accountId))
  }
  
  // Return Validation
  if (returns) {
    checks.push(validateReturns(returns, tolerances.returns))
  }
  
  // Determine overall status
  const failedChecks = checks.filter(c => c.status === QC_STATUS.FAIL).length
  const warningChecks = checks.filter(c => c.status === QC_STATUS.WARN).length
  
  let overallStatus = QC_STATUS.PASS
  if (failedChecks > 0) {
    overallStatus = QC_STATUS.FAIL
  } else if (warningChecks > 0) {
    overallStatus = QC_STATUS.WARN
  }
  
  return {
    overallStatus,
    summary: {
      totalChecks: checks.length,
      passed: checks.filter(c => c.status === QC_STATUS.PASS).length,
      warnings: warningChecks,
      failed: failedChecks
    },
    checks,
    timestamp: new Date().toISOString(),
    accountId
  }
}