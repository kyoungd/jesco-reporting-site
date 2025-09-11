import Decimal from 'decimal.js'

/**
 * Calculate daily returns for an account, excluding external flows
 * @param {string} accountId - Account identifier
 * @param {Date} startDate - Start date for calculation period
 * @param {Date} endDate - End date for calculation period
 * @param {Object} data - Input data object containing:
 *   - positions: Array of position records with date, accountId, marketValue
 *   - transactions: Array of transaction records with date, accountId, amount, type
 * @returns {Array} Array of daily return objects
 */
export function calculateDailyReturns(accountId, startDate, endDate, data) {
  const { positions = [], transactions = [] } = data
  
  // Filter and sort positions by date
  const accountPositions = positions
    .filter(p => 
      p.accountId === accountId &&
      new Date(p.date) >= startDate &&
      new Date(p.date) <= endDate
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  
  // Filter transactions
  const accountTransactions = transactions.filter(t =>
    t.accountId === accountId &&
    new Date(t.date) >= startDate &&
    new Date(t.date) <= endDate
  )
  
  const dailyReturns = []
  const currentDate = new Date(startDate)
  
  // Get starting value
  let previousValue = new Decimal(0)
  const startingPosition = positions.find(p =>
    p.accountId === accountId &&
    new Date(p.date) <= startDate
  )
  if (startingPosition) {
    previousValue = new Decimal(startingPosition.marketValue || 0)
  }
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    
    // Get market value at end of day
    const endOfDayPosition = accountPositions.find(p => 
      p.date === dateStr || new Date(p.date).toDateString() === currentDate.toDateString()
    )
    
    const currentValue = new Decimal(endOfDayPosition?.marketValue || previousValue.toNumber())
    
    // Get flows for this day
    const dayTransactions = accountTransactions.filter(t => 
      t.date === dateStr || new Date(t.date).toDateString() === currentDate.toDateString()
    )
    
    let dayFlows = new Decimal(0)
    dayTransactions.forEach(transaction => {
      const amount = new Decimal(transaction.amount || 0)
      
      if (transaction.type === 'CONTRIBUTION' || transaction.type === 'DEPOSIT') {
        dayFlows = dayFlows.plus(amount)
      } else if (transaction.type === 'WITHDRAWAL' || transaction.type === 'DISTRIBUTION') {
        dayFlows = dayFlows.minus(amount.abs())
      }
    })
    
    // Calculate return excluding flows
    // Formula: (End Value - Flows) / Beginning Value - 1
    let dailyReturn = new Decimal(0)
    if (previousValue.greaterThan(0)) {
      const adjustedEndValue = currentValue.minus(dayFlows)
      dailyReturn = adjustedEndValue.dividedBy(previousValue).minus(1)
    }
    
    dailyReturns.push({
      date: dateStr,
      beginValue: previousValue.toNumber(),
      endValue: currentValue.toNumber(),
      flows: dayFlows.toNumber(),
      adjustedEndValue: currentValue.minus(dayFlows).toNumber(),
      dailyReturn: dailyReturn.toNumber(),
      dailyReturnPercent: dailyReturn.times(100).toNumber()
    })
    
    // Update for next iteration
    previousValue = currentValue
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return dailyReturns
}

/**
 * Calculate Time-Weighted Return from daily returns
 * @param {Array} dailyReturns - Array of daily return objects
 * @param {Object} options - Calculation options
 * @returns {Object} TWR calculation results
 */
export function calculateTWR(dailyReturns, options = {}) {
  const { annualize = true, compoundingPeriod = 365 } = options
  
  if (!dailyReturns || dailyReturns.length === 0) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      periods: 0,
      startDate: null,
      endDate: null
    }
  }
  
  // Calculate cumulative return by chaining daily returns
  // TWR = (1 + r1) × (1 + r2) × ... × (1 + rn) - 1
  let cumulativeReturn = new Decimal(1)
  
  dailyReturns.forEach(dayReturn => {
    const dailyReturnDecimal = new Decimal(dayReturn.dailyReturn || 0)
    cumulativeReturn = cumulativeReturn.times(dailyReturnDecimal.plus(1))
  })
  
  const totalReturn = cumulativeReturn.minus(1)
  
  // Calculate annualized return if requested
  let annualizedReturn = totalReturn
  if (annualize && dailyReturns.length > 1) {
    const periods = dailyReturns.length
    const periodsPerYear = compoundingPeriod / 1 // Assuming daily returns
    
    if (periods > 0) {
      // Annualized Return = (1 + Total Return)^(365/days) - 1
      annualizedReturn = cumulativeReturn.pow(periodsPerYear / periods).minus(1)
    }
  }
  
  return {
    totalReturn: totalReturn.toNumber(),
    totalReturnPercent: totalReturn.times(100).toNumber(),
    annualizedReturn: annualizedReturn.toNumber(),
    annualizedReturnPercent: annualizedReturn.times(100).toNumber(),
    periods: dailyReturns.length,
    startDate: dailyReturns[0]?.date,
    endDate: dailyReturns[dailyReturns.length - 1]?.date,
    compoundingFactor: cumulativeReturn.toNumber()
  }
}

/**
 * Calculate Time-Weighted Return with fee adjustments
 * @param {string} accountId - Account identifier
 * @param {Date} startDate - Start date for calculation period
 * @param {Date} endDate - End date for calculation period
 * @param {Object} data - Input data object
 * @param {Object} feeData - Fee data object containing fee schedules
 * @returns {Object} Gross and net TWR results
 */
export function calculateTWRWithFees(accountId, startDate, endDate, data, feeData = {}) {
  const { feeRate = 0.01, feeFrequency = 'annual' } = feeData // Default 1% annual
  
  // Calculate gross returns (without fees)
  const dailyReturns = calculateDailyReturns(accountId, startDate, endDate, data)
  const grossTWR = calculateTWR(dailyReturns)
  
  // Calculate net returns (after fees)
  const dailyFeeRate = new Decimal(feeRate).dividedBy(365) // Convert to daily fee rate
  
  const netDailyReturns = dailyReturns.map(dayReturn => {
    const grossReturn = new Decimal(dayReturn.dailyReturn)
    const netReturn = grossReturn.minus(dailyFeeRate)
    
    return {
      ...dayReturn,
      grossDailyReturn: dayReturn.dailyReturn,
      netDailyReturn: netReturn.toNumber(),
      dailyFee: dailyFeeRate.toNumber(),
      dailyReturn: netReturn.toNumber() // Override with net return
    }
  })
  
  const netTWR = calculateTWR(netDailyReturns)
  
  return {
    gross: {
      ...grossTWR,
      type: 'gross'
    },
    net: {
      ...netTWR,
      type: 'net'
    },
    feeImpact: {
      totalReturnDifference: grossTWR.totalReturn - netTWR.totalReturn,
      annualizedReturnDifference: grossTWR.annualizedReturn - netTWR.annualizedReturn,
      totalFeeImpactPercent: ((grossTWR.totalReturn - netTWR.totalReturn) * 100),
      annualizedFeeRate: feeRate
    },
    dailyReturns: netDailyReturns
  }
}

/**
 * Calculate rolling returns over specified periods
 * @param {Array} dailyReturns - Array of daily return objects
 * @param {number} rollingPeriodDays - Number of days for rolling window
 * @returns {Array} Array of rolling return calculations
 */
export function calculateRollingReturns(dailyReturns, rollingPeriodDays = 30) {
  const rollingReturns = []
  
  if (dailyReturns.length < rollingPeriodDays) {
    return rollingReturns
  }
  
  for (let i = rollingPeriodDays - 1; i < dailyReturns.length; i++) {
    const periodReturns = dailyReturns.slice(i - rollingPeriodDays + 1, i + 1)
    const twr = calculateTWR(periodReturns, { annualize: true })
    
    rollingReturns.push({
      endDate: dailyReturns[i].date,
      startDate: dailyReturns[i - rollingPeriodDays + 1].date,
      periodDays: rollingPeriodDays,
      totalReturn: twr.totalReturn,
      annualizedReturn: twr.annualizedReturn
    })
  }
  
  return rollingReturns
}

/**
 * Calculate performance statistics from daily returns
 * @param {Array} dailyReturns - Array of daily return objects
 * @returns {Object} Performance statistics
 */
export function calculatePerformanceStatistics(dailyReturns) {
  if (!dailyReturns || dailyReturns.length === 0) {
    return {
      count: 0,
      mean: 0,
      standardDeviation: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 0
    }
  }
  
  const returns = dailyReturns.map(r => new Decimal(r.dailyReturn || 0))
  const count = returns.length
  
  // Calculate mean return
  const sum = returns.reduce((acc, ret) => acc.plus(ret), new Decimal(0))
  const mean = sum.dividedBy(count)
  
  // Calculate standard deviation
  const variance = returns
    .map(ret => ret.minus(mean).pow(2))
    .reduce((acc, val) => acc.plus(val), new Decimal(0))
    .dividedBy(count)
  
  const standardDeviation = variance.sqrt()
  const annualizedVolatility = standardDeviation.times(Math.sqrt(252)) // 252 trading days
  
  // Calculate Sharpe ratio (assuming 0% risk-free rate)
  const sharpeRatio = standardDeviation.equals(0) ? 
    new Decimal(0) : 
    mean.times(252).dividedBy(annualizedVolatility)
  
  // Calculate maximum drawdown
  let peak = new Decimal(1)
  let maxDrawdown = new Decimal(0)
  let cumulativeReturn = new Decimal(1)
  
  returns.forEach(ret => {
    cumulativeReturn = cumulativeReturn.times(ret.plus(1))
    peak = Decimal.max(peak, cumulativeReturn)
    const drawdown = peak.minus(cumulativeReturn).dividedBy(peak)
    maxDrawdown = Decimal.max(maxDrawdown, drawdown)
  })
  
  return {
    count,
    mean: mean.toNumber(),
    meanAnnualized: mean.times(252).toNumber(),
    standardDeviation: standardDeviation.toNumber(),
    volatility: annualizedVolatility.toNumber(),
    sharpeRatio: sharpeRatio.toNumber(),
    maxDrawdown: maxDrawdown.toNumber(),
    maxDrawdownPercent: maxDrawdown.times(100).toNumber()
  }
}