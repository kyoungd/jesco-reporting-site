import Decimal from 'decimal.js'

/**
 * Accrue management fees for an account over a date range
 * @param {string} accountId - Account identifier
 * @param {Date} startDate - Start date for fee calculation
 * @param {Date} endDate - End date for fee calculation
 * @param {Object} data - Input data object containing:
 *   - positions: Array of position records with marketValue
 *   - feeSchedule: Fee schedule configuration
 *   - manualAdjustments: Array of manual fee adjustments
 * @returns {Object} Fee calculation results
 */
export function accrueFees(accountId, startDate, endDate, data) {
  const { positions = [], feeSchedule = {}, manualAdjustments = [] } = data
  
  const {
    managementFeeRate = 0.01, // Default 1% annual
    performanceFeeRate = 0.20, // Default 20% performance fee
    highWaterMark = true,
    feeFrequency = 'daily', // daily, monthly, quarterly, annual
    minimumFee = 0,
    feeCalculationMethod = 'average' // average, beginning, ending
  } = feeSchedule
  
  // Filter positions for the account
  const accountPositions = positions.filter(p => p.accountId === accountId)
  
  const dailyFees = []
  const currentDate = new Date(startDate)
  
  // Daily fee rate calculation
  const dailyManagementRate = new Decimal(managementFeeRate).dividedBy(365)
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    
    // Get AUM for the day based on calculation method
    let aumForFee = new Decimal(0)
    
    if (feeCalculationMethod === 'average') {
      // Use average of beginning and ending values for the day
      const dayStart = new Date(currentDate)
      const dayEnd = new Date(currentDate)
      dayEnd.setHours(23, 59, 59, 999)
      
      const startPosition = accountPositions.find(p => 
        new Date(p.date) <= dayStart
      )
      const endPosition = accountPositions.find(p => 
        new Date(p.date) <= dayEnd &&
        p.date === dateStr
      ) || startPosition
      
      const startValue = new Decimal(startPosition?.marketValue || 0)
      const endValue = new Decimal(endPosition?.marketValue || 0)
      aumForFee = startValue.plus(endValue).dividedBy(2)
      
    } else if (feeCalculationMethod === 'beginning') {
      const position = accountPositions.find(p => 
        new Date(p.date) <= currentDate
      )
      aumForFee = new Decimal(position?.marketValue || 0)
      
    } else if (feeCalculationMethod === 'ending') {
      const position = accountPositions.find(p => 
        p.date === dateStr || 
        (new Date(p.date) <= currentDate)
      )
      aumForFee = new Decimal(position?.marketValue || 0)
    }
    
    // Calculate daily management fee
    const dailyManagementFee = aumForFee.times(dailyManagementRate)
    
    // Check for manual adjustments
    const adjustment = manualAdjustments.find(adj => 
      adj.accountId === accountId && 
      adj.date === dateStr
    )
    const manualAdjustment = new Decimal(adjustment?.amount || 0)
    
    const totalDailyFee = dailyManagementFee.plus(manualAdjustment)
    
    dailyFees.push({
      date: dateStr,
      accountId,
      aumForFee: aumForFee.toNumber(),
      managementFeeRate: dailyManagementRate.toNumber(),
      managementFee: dailyManagementFee.toNumber(),
      manualAdjustment: manualAdjustment.toNumber(),
      totalFee: totalDailyFee.toNumber(),
      cumulativeFee: 0 // Will be calculated below
    })
    
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // Calculate cumulative fees
  let cumulative = new Decimal(0)
  dailyFees.forEach(dayFee => {
    cumulative = cumulative.plus(dayFee.totalFee)
    dayFee.cumulativeFee = cumulative.toNumber()
  })
  
  // Calculate summary
  const totalManagementFees = dailyFees.reduce((sum, fee) => 
    sum.plus(fee.managementFee), new Decimal(0)
  )
  
  const totalManualAdjustments = dailyFees.reduce((sum, fee) => 
    sum.plus(fee.manualAdjustment), new Decimal(0)
  )
  
  const totalFees = totalManagementFees.plus(totalManualAdjustments)
  const averageAUM = dailyFees.length > 0 ?
    dailyFees.reduce((sum, fee) => sum + fee.aumForFee, 0) / dailyFees.length : 0
  
  const effectiveAnnualRate = averageAUM > 0 ?
    totalFees.dividedBy(averageAUM).times(365 / dailyFees.length).toNumber() : 0
  
  return {
    accountId,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    totalDays: dailyFees.length,
    totalManagementFees: totalManagementFees.toNumber(),
    totalManualAdjustments: totalManualAdjustments.toNumber(),
    totalFees: totalFees.toNumber(),
    averageAUM,
    effectiveAnnualRate,
    nominalAnnualRate: managementFeeRate,
    dailyFees
  }
}

/**
 * Calculate performance fees based on high water mark
 * @param {string} accountId - Account identifier
 * @param {Date} startDate - Start date for calculation
 * @param {Date} endDate - End date for calculation
 * @param {Object} data - Input data containing performance data and high water mark
 * @returns {Object} Performance fee calculation
 */
export function calculatePerformanceFees(accountId, startDate, endDate, data) {
  const { 
    performanceData = [], 
    highWaterMarkData = {},
    feeSchedule = {}
  } = data
  
  const {
    performanceFeeRate = 0.20,
    useHighWaterMark = true,
    crystallizationFrequency = 'annual' // annual, quarterly, monthly
  } = feeSchedule
  
  // Get current high water mark
  const currentHighWaterMark = new Decimal(
    highWaterMarkData[accountId] || 0
  )
  
  // Find performance data for the period
  const periodPerformance = performanceData.find(p => 
    p.accountId === accountId &&
    p.startDate <= startDate &&
    p.endDate >= endDate
  )
  
  if (!periodPerformance) {
    return {
      accountId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      performanceFee: 0,
      highWaterMark: currentHighWaterMark.toNumber(),
      newHighWaterMark: currentHighWaterMark.toNumber(),
      outperformance: 0,
      crystallized: false
    }
  }
  
  const endValue = new Decimal(periodPerformance.endValue || 0)
  const startValue = new Decimal(periodPerformance.startValue || 0)
  const netFlows = new Decimal(periodPerformance.netFlows || 0)
  
  // Calculate performance relative to high water mark
  const adjustedStartValue = useHighWaterMark ? 
    Decimal.max(startValue, currentHighWaterMark) : startValue
  
  const outperformance = endValue.minus(adjustedStartValue).minus(netFlows)
  
  // Calculate performance fee
  const performanceFee = outperformance.greaterThan(0) ?
    outperformance.times(performanceFeeRate) : new Decimal(0)
  
  // Update high water mark
  const newHighWaterMark = useHighWaterMark ?
    Decimal.max(currentHighWaterMark, endValue) : endValue
  
  // Determine if fees should be crystallized
  const shouldCrystallize = determineCrystallization(
    endDate, 
    crystallizationFrequency
  )
  
  return {
    accountId,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    performanceFeeRate,
    startValue: startValue.toNumber(),
    endValue: endValue.toNumber(),
    netFlows: netFlows.toNumber(),
    highWaterMark: currentHighWaterMark.toNumber(),
    newHighWaterMark: newHighWaterMark.toNumber(),
    outperformance: outperformance.toNumber(),
    performanceFee: performanceFee.toNumber(),
    crystallized: shouldCrystallize,
    useHighWaterMark
  }
}

/**
 * Calculate tiered management fees based on AUM breakpoints
 * @param {number} aum - Assets under management
 * @param {Array} feeSchedule - Array of fee tiers
 * @returns {Object} Tiered fee calculation
 */
export function calculateTieredFees(aum, feeSchedule = []) {
  if (feeSchedule.length === 0) {
    return {
      totalFee: 0,
      effectiveRate: 0,
      tiers: []
    }
  }
  
  const aumDecimal = new Decimal(aum)
  let remainingAUM = aumDecimal
  let totalFee = new Decimal(0)
  const tierDetails = []
  
  // Sort fee schedule by minimum amount
  const sortedSchedule = [...feeSchedule].sort((a, b) => a.minimum - b.minimum)
  
  for (let i = 0; i < sortedSchedule.length; i++) {
    const tier = sortedSchedule[i]
    const nextTier = sortedSchedule[i + 1]
    
    const tierMin = new Decimal(tier.minimum)
    const tierMax = nextTier ? new Decimal(nextTier.minimum) : null
    const tierRate = new Decimal(tier.rate)
    
    if (aumDecimal.lessThan(tierMin)) {
      break // AUM doesn't reach this tier
    }
    
    // Calculate AUM subject to this tier's rate
    let tierAUM = new Decimal(0)
    
    if (tierMax && aumDecimal.greaterThan(tierMax)) {
      // AUM exceeds this tier, use full tier range
      tierAUM = tierMax.minus(tierMin)
    } else {
      // AUM is within this tier
      tierAUM = aumDecimal.minus(tierMin)
    }
    
    const tierFee = tierAUM.times(tierRate)
    totalFee = totalFee.plus(tierFee)
    
    tierDetails.push({
      tierNumber: i + 1,
      minimum: tierMin.toNumber(),
      maximum: tierMax?.toNumber() || null,
      rate: tierRate.toNumber(),
      ratePercent: tierRate.times(100).toNumber(),
      applicableAUM: tierAUM.toNumber(),
      fee: tierFee.toNumber()
    })
    
    if (!tierMax || aumDecimal.lessThanOrEqualTo(tierMax)) {
      break // We've processed all relevant tiers
    }
  }
  
  const effectiveRate = aumDecimal.equals(0) ? 
    new Decimal(0) : 
    totalFee.dividedBy(aumDecimal)
  
  return {
    aum: aumDecimal.toNumber(),
    totalFee: totalFee.toNumber(),
    effectiveRate: effectiveRate.toNumber(),
    effectiveRatePercent: effectiveRate.times(100).toNumber(),
    tiers: tierDetails
  }
}

/**
 * Calculate fee schedule for multiple accounts
 * @param {Array} accountIds - Array of account identifiers
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} data - Input data
 * @returns {Object} Multi-account fee summary
 */
export function calculateMultiAccountFees(accountIds, startDate, endDate, data) {
  const accountFees = accountIds.map(accountId => 
    accrueFees(accountId, startDate, endDate, data)
  )
  
  const summary = accountFees.reduce((acc, fees) => ({
    totalManagementFees: acc.totalManagementFees.plus(fees.totalManagementFees),
    totalManualAdjustments: acc.totalManualAdjustments.plus(fees.totalManualAdjustments),
    totalFees: acc.totalFees.plus(fees.totalFees),
    totalAUM: acc.totalAUM.plus(fees.averageAUM)
  }), {
    totalManagementFees: new Decimal(0),
    totalManualAdjustments: new Decimal(0),
    totalFees: new Decimal(0),
    totalAUM: new Decimal(0)
  })
  
  const weightedAverageRate = summary.totalAUM.equals(0) ? 
    new Decimal(0) : 
    summary.totalFees.dividedBy(summary.totalAUM).times(365 / accountFees[0]?.totalDays || 1)
  
  return {
    accountFees,
    summary: {
      totalManagementFees: summary.totalManagementFees.toNumber(),
      totalManualAdjustments: summary.totalManualAdjustments.toNumber(),
      totalFees: summary.totalFees.toNumber(),
      totalAUM: summary.totalAUM.toNumber(),
      weightedAverageRate: weightedAverageRate.toNumber(),
      numberOfAccounts: accountIds.length
    },
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

/**
 * Helper function to determine if fees should be crystallized
 * @param {Date} date - Current date
 * @param {string} frequency - Crystallization frequency
 * @returns {boolean} Whether fees should be crystallized
 */
function determineCrystallization(date, frequency) {
  const month = date.getMonth()
  const day = date.getDate()
  
  switch (frequency) {
    case 'annual':
      return month === 11 && day === 31 // December 31st
    case 'quarterly':
      return (month === 2 && day === 31) || // March 31st
             (month === 5 && day === 30) || // June 30th
             (month === 8 && day === 30) || // September 30th
             (month === 11 && day === 31)   // December 31st
    case 'monthly':
      return day === getLastDayOfMonth(date)
    default:
      return false
  }
}

/**
 * Helper function to get last day of month
 * @param {Date} date - Date in the month
 * @returns {number} Last day of the month
 */
function getLastDayOfMonth(date) {
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return nextMonth.getDate()
}