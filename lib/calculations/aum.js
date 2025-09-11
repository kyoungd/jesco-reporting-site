import Decimal from 'decimal.js'

/**
 * Calculate Assets Under Management (AUM) for a given account over a date range
 * @param {string} accountId - Account identifier
 * @param {Date} startDate - Start date for calculation period
 * @param {Date} endDate - End date for calculation period
 * @param {Object} data - Input data object containing:
 *   - positions: Array of position records with date, accountId, marketValue
 *   - transactions: Array of transaction records with date, accountId, amount, type
 * @returns {Object} AUM calculation results
 */
export function calculateAUM(accountId, startDate, endDate, data) {
  const { positions = [], transactions = [] } = data
  
  // Filter data for the specific account and date range
  const accountPositions = positions.filter(p => 
    p.accountId === accountId &&
    new Date(p.date) >= startDate &&
    new Date(p.date) <= endDate
  )
  
  const accountTransactions = transactions.filter(t =>
    t.accountId === accountId &&
    new Date(t.date) >= startDate &&
    new Date(t.date) <= endDate
  )
  
  // Calculate Beginning of Period (BOP) value
  const bopPosition = positions.find(p =>
    p.accountId === accountId &&
    new Date(p.date) <= startDate
  )
  const bop = new Decimal(bopPosition?.marketValue || 0)
  
  // Calculate End of Period (EOP) value
  const eopPosition = accountPositions
    .filter(p => new Date(p.date) <= endDate)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
  const eop = new Decimal(eopPosition?.marketValue || 0)
  
  // Calculate contributions and withdrawals
  let contributions = new Decimal(0)
  let withdrawals = new Decimal(0)
  
  accountTransactions.forEach(transaction => {
    const amount = new Decimal(transaction.amount || 0)
    
    if (transaction.type === 'CONTRIBUTION' || transaction.type === 'DEPOSIT') {
      contributions = contributions.plus(amount)
    } else if (transaction.type === 'WITHDRAWAL' || transaction.type === 'DISTRIBUTION') {
      withdrawals = withdrawals.plus(amount.abs()) // Ensure withdrawals are positive
    }
  })
  
  // Calculate net flows
  const netFlows = contributions.minus(withdrawals)
  
  // Calculate market PnL using identity: EOP - BOP = NetFlows + MarketPnL
  // Therefore: MarketPnL = EOP - BOP - NetFlows
  const marketPnL = eop.minus(bop).minus(netFlows)
  
  // Perform identity check
  const identityCheck = eop.minus(bop).equals(netFlows.plus(marketPnL))
  const identityDifference = eop.minus(bop).minus(netFlows.plus(marketPnL))
  
  return {
    accountId,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    bop: bop.toNumber(),
    eop: eop.toNumber(),
    contributions: contributions.toNumber(),
    withdrawals: withdrawals.toNumber(),
    netFlows: netFlows.toNumber(),
    marketPnL: marketPnL.toNumber(),
    identityCheck,
    identityDifference: identityDifference.toNumber(),
    // Additional metrics
    totalReturn: bop.equals(0) ? 0 : marketPnL.dividedBy(bop).times(100).toNumber(),
    netReturn: bop.equals(0) ? 0 : eop.minus(bop).dividedBy(bop).times(100).toNumber()
  }
}

/**
 * Calculate AUM for multiple accounts
 * @param {Array} accountIds - Array of account identifiers
 * @param {Date} startDate - Start date for calculation period
 * @param {Date} endDate - End date for calculation period
 * @param {Object} data - Input data object
 * @returns {Array} Array of AUM calculation results
 */
export function calculateMultipleAUM(accountIds, startDate, endDate, data) {
  return accountIds.map(accountId => 
    calculateAUM(accountId, startDate, endDate, data)
  )
}

/**
 * Calculate aggregate AUM across multiple accounts
 * @param {Array} accountIds - Array of account identifiers
 * @param {Date} startDate - Start date for calculation period
 * @param {Date} endDate - End date for calculation period
 * @param {Object} data - Input data object
 * @returns {Object} Aggregated AUM calculation results
 */
export function calculateAggregateAUM(accountIds, startDate, endDate, data) {
  const individualResults = calculateMultipleAUM(accountIds, startDate, endDate, data)
  
  const aggregate = individualResults.reduce((acc, result) => {
    return {
      bop: acc.bop.plus(result.bop),
      eop: acc.eop.plus(result.eop),
      contributions: acc.contributions.plus(result.contributions),
      withdrawals: acc.withdrawals.plus(result.withdrawals),
      netFlows: acc.netFlows.plus(result.netFlows),
      marketPnL: acc.marketPnL.plus(result.marketPnL)
    }
  }, {
    bop: new Decimal(0),
    eop: new Decimal(0),
    contributions: new Decimal(0),
    withdrawals: new Decimal(0),
    netFlows: new Decimal(0),
    marketPnL: new Decimal(0)
  })
  
  // Perform identity check on aggregate
  const identityCheck = aggregate.eop.minus(aggregate.bop)
    .equals(aggregate.netFlows.plus(aggregate.marketPnL))
  const identityDifference = aggregate.eop.minus(aggregate.bop)
    .minus(aggregate.netFlows.plus(aggregate.marketPnL))
  
  return {
    accountIds,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    bop: aggregate.bop.toNumber(),
    eop: aggregate.eop.toNumber(),
    contributions: aggregate.contributions.toNumber(),
    withdrawals: aggregate.withdrawals.toNumber(),
    netFlows: aggregate.netFlows.toNumber(),
    marketPnL: aggregate.marketPnL.toNumber(),
    identityCheck,
    identityDifference: identityDifference.toNumber(),
    totalReturn: aggregate.bop.equals(0) ? 0 : 
      aggregate.marketPnL.dividedBy(aggregate.bop).times(100).toNumber(),
    netReturn: aggregate.bop.equals(0) ? 0 : 
      aggregate.eop.minus(aggregate.bop).dividedBy(aggregate.bop).times(100).toNumber(),
    numberOfAccounts: accountIds.length
  }
}

/**
 * Calculate daily AUM values over a date range
 * @param {string} accountId - Account identifier
 * @param {Date} startDate - Start date for calculation period
 * @param {Date} endDate - End date for calculation period
 * @param {Object} data - Input data object
 * @returns {Array} Array of daily AUM values
 */
export function calculateDailyAUM(accountId, startDate, endDate, data) {
  const dailyValues = []
  const currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    const dayEnd = new Date(currentDate)
    dayEnd.setHours(23, 59, 59, 999)
    
    const aumData = calculateAUM(accountId, startDate, dayEnd, data)
    
    dailyValues.push({
      date: currentDate.toISOString().split('T')[0],
      aum: aumData.eop,
      marketValue: aumData.eop
    })
    
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return dailyValues
}