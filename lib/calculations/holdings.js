import Decimal from 'decimal.js'

/**
 * Get holdings for an account as of a specific date
 * @param {string} accountId - Account identifier
 * @param {Date} asOfDate - Date to get holdings as of
 * @param {Object} data - Input data object containing:
 *   - positions: Array of position records
 *   - prices: Array of price records
 *   - securities: Array of security records
 * @returns {Array} Array of holding objects
 */
export function getHoldings(accountId, asOfDate, data) {
  const { positions = [], prices = [], securities = [] } = data
  
  // Filter positions for the account and date
  const accountPositions = positions.filter(p =>
    p.accountId === accountId &&
    new Date(p.date) <= asOfDate
  )
  
  // Group by security and get the most recent position for each
  const latestPositions = new Map()
  accountPositions.forEach(position => {
    const key = position.securityId
    if (!latestPositions.has(key) || 
        new Date(position.date) > new Date(latestPositions.get(key).date)) {
      latestPositions.set(key, position)
    }
  })
  
  // Build holdings with current prices and security details
  const holdings = []
  
  for (const [securityId, position] of latestPositions) {
    if (new Decimal(position.quantity || 0).equals(0)) continue // Skip zero positions
    
    // Get security details
    const security = securities.find(s => s.id === securityId)
    
    // Get latest price as of the date
    const securityPrices = prices
      .filter(p => p.securityId === securityId && new Date(p.date) <= asOfDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    
    const latestPrice = securityPrices[0]
    
    const quantity = new Decimal(position.quantity || 0)
    const price = new Decimal(latestPrice?.close || 0)
    const averageCost = new Decimal(position.averageCost || 0)
    
    const marketValue = quantity.times(price)
    const bookValue = quantity.times(averageCost)
    const unrealizedPnL = marketValue.minus(bookValue)
    
    holdings.push({
      securityId,
      symbol: security?.symbol || 'Unknown',
      name: security?.name || 'Unknown Security',
      assetClass: security?.assetClass || 'Unknown',
      exchange: security?.exchange,
      currency: security?.currency || 'USD',
      quantity: quantity.toNumber(),
      price: price.toNumber(),
      averageCost: averageCost.toNumber(),
      marketValue: marketValue.toNumber(),
      bookValue: bookValue.toNumber(),
      unrealizedPnL: unrealizedPnL.toNumber(),
      unrealizedPnLPercent: bookValue.equals(0) ? 0 : 
        unrealizedPnL.dividedBy(bookValue).times(100).toNumber(),
      priceDate: latestPrice?.date,
      positionDate: position.date
    })
  }
  
  return holdings.sort((a, b) => b.marketValue - a.marketValue) // Sort by market value desc
}

/**
 * Calculate portfolio weights from holdings
 * @param {Array} holdings - Array of holding objects
 * @returns {Object} Holdings with weights and portfolio summary
 */
export function calculateWeights(holdings) {
  const totalMarketValue = holdings.reduce((sum, holding) => 
    sum.plus(holding.marketValue || 0), new Decimal(0)
  )
  
  const holdingsWithWeights = holdings.map(holding => {
    const marketValue = new Decimal(holding.marketValue || 0)
    const weight = totalMarketValue.equals(0) ? 
      new Decimal(0) : 
      marketValue.dividedBy(totalMarketValue)
    
    return {
      ...holding,
      weight: weight.toNumber(),
      weightPercent: weight.times(100).toNumber()
    }
  })
  
  // Calculate asset class weights
  const assetClassWeights = new Map()
  holdingsWithWeights.forEach(holding => {
    const assetClass = holding.assetClass
    const weight = new Decimal(holding.weight || 0)
    
    if (assetClassWeights.has(assetClass)) {
      assetClassWeights.set(assetClass, assetClassWeights.get(assetClass).plus(weight))
    } else {
      assetClassWeights.set(assetClass, weight)
    }
  })
  
  const assetClassSummary = Array.from(assetClassWeights.entries()).map(([assetClass, weight]) => ({
    assetClass,
    weight: weight.toNumber(),
    weightPercent: weight.times(100).toNumber(),
    marketValue: weight.times(totalMarketValue).toNumber()
  }))
  
  return {
    holdings: holdingsWithWeights,
    totalMarketValue: totalMarketValue.toNumber(),
    assetClassWeights: assetClassSummary,
    numberOfHoldings: holdings.length,
    asOfDate: holdings[0]?.positionDate
  }
}

/**
 * Calculate unrealized P&L for holdings
 * @param {Array} holdings - Array of holding objects
 * @returns {Object} Unrealized P&L summary
 */
export function calculateUnrealizedPnL(holdings) {
  const summary = holdings.reduce((acc, holding) => {
    const unrealizedPnL = new Decimal(holding.unrealizedPnL || 0)
    const marketValue = new Decimal(holding.marketValue || 0)
    const bookValue = new Decimal(holding.bookValue || 0)
    
    return {
      totalUnrealizedPnL: acc.totalUnrealizedPnL.plus(unrealizedPnL),
      totalMarketValue: acc.totalMarketValue.plus(marketValue),
      totalBookValue: acc.totalBookValue.plus(bookValue),
      gains: unrealizedPnL.greaterThan(0) ? 
        acc.gains.plus(unrealizedPnL) : acc.gains,
      losses: unrealizedPnL.lessThan(0) ? 
        acc.losses.plus(unrealizedPnL.abs()) : acc.losses,
      gainsCount: unrealizedPnL.greaterThan(0) ? acc.gainsCount + 1 : acc.gainsCount,
      lossesCount: unrealizedPnL.lessThan(0) ? acc.lossesCount + 1 : acc.lossesCount
    }
  }, {
    totalUnrealizedPnL: new Decimal(0),
    totalMarketValue: new Decimal(0),
    totalBookValue: new Decimal(0),
    gains: new Decimal(0),
    losses: new Decimal(0),
    gainsCount: 0,
    lossesCount: 0
  })
  
  const totalUnrealizedPnLPercent = summary.totalBookValue.equals(0) ? 
    new Decimal(0) : 
    summary.totalUnrealizedPnL.dividedBy(summary.totalBookValue).times(100)
  
  return {
    totalUnrealizedPnL: summary.totalUnrealizedPnL.toNumber(),
    totalUnrealizedPnLPercent: totalUnrealizedPnLPercent.toNumber(),
    totalMarketValue: summary.totalMarketValue.toNumber(),
    totalBookValue: summary.totalBookValue.toNumber(),
    totalGains: summary.gains.toNumber(),
    totalLosses: summary.losses.toNumber(),
    gainsCount: summary.gainsCount,
    lossesCount: summary.lossesCount,
    totalPositions: holdings.length,
    averageGain: summary.gainsCount > 0 ? 
      summary.gains.dividedBy(summary.gainsCount).toNumber() : 0,
    averageLoss: summary.lossesCount > 0 ? 
      summary.losses.dividedBy(summary.lossesCount).toNumber() : 0
  }
}

/**
 * Group holdings by asset class with summaries
 * @param {Array} holdings - Array of holding objects
 * @returns {Object} Holdings grouped by asset class
 */
export function groupByAssetClass(holdings) {
  const groups = new Map()
  
  holdings.forEach(holding => {
    const assetClass = holding.assetClass || 'Unknown'
    
    if (!groups.has(assetClass)) {
      groups.set(assetClass, {
        assetClass,
        holdings: [],
        totalMarketValue: new Decimal(0),
        totalBookValue: new Decimal(0),
        totalUnrealizedPnL: new Decimal(0),
        count: 0
      })
    }
    
    const group = groups.get(assetClass)
    group.holdings.push(holding)
    group.totalMarketValue = group.totalMarketValue.plus(holding.marketValue || 0)
    group.totalBookValue = group.totalBookValue.plus(holding.bookValue || 0)
    group.totalUnrealizedPnL = group.totalUnrealizedPnL.plus(holding.unrealizedPnL || 0)
    group.count++
  })
  
  // Convert to array and add calculated fields
  const groupedHoldings = Array.from(groups.values()).map(group => ({
    ...group,
    totalMarketValue: group.totalMarketValue.toNumber(),
    totalBookValue: group.totalBookValue.toNumber(),
    totalUnrealizedPnL: group.totalUnrealizedPnL.toNumber(),
    unrealizedPnLPercent: group.totalBookValue.equals(0) ? 0 :
      group.totalUnrealizedPnL.dividedBy(group.totalBookValue).times(100).toNumber(),
    averageHoldingSize: group.count > 0 ? 
      group.totalMarketValue.dividedBy(group.count).toNumber() : 0
  }))
  
  return groupedHoldings.sort((a, b) => b.totalMarketValue - a.totalMarketValue)
}

/**
 * Calculate concentration risk metrics
 * @param {Array} holdings - Array of holding objects with weights
 * @returns {Object} Concentration risk metrics
 */
export function calculateConcentrationRisk(holdings) {
  if (!holdings || holdings.length === 0) {
    return {
      top5Concentration: 0,
      top10Concentration: 0,
      herfindahlIndex: 0,
      effectiveNumberOfHoldings: 0,
      largestHolding: 0
    }
  }
  
  // Sort by weight descending
  const sortedHoldings = [...holdings].sort((a, b) => (b.weight || 0) - (a.weight || 0))
  
  // Calculate top 5 and top 10 concentration
  const top5Concentration = sortedHoldings
    .slice(0, 5)
    .reduce((sum, holding) => sum + (holding.weight || 0), 0)
  
  const top10Concentration = sortedHoldings
    .slice(0, 10)
    .reduce((sum, holding) => sum + (holding.weight || 0), 0)
  
  // Calculate Herfindahl Index (sum of squared weights)
  const herfindahlIndex = holdings.reduce((sum, holding) => {
    const weight = new Decimal(holding.weight || 0)
    return sum + weight.pow(2).toNumber()
  }, 0)
  
  // Effective number of holdings (1 / Herfindahl Index)
  const effectiveNumberOfHoldings = herfindahlIndex > 0 ? 1 / herfindahlIndex : 0
  
  const largestHolding = sortedHoldings[0]?.weight || 0
  
  return {
    top5Concentration: top5Concentration * 100, // Convert to percentage
    top10Concentration: top10Concentration * 100,
    herfindahlIndex,
    effectiveNumberOfHoldings,
    largestHoldingWeight: largestHolding * 100,
    largestHoldingSymbol: sortedHoldings[0]?.symbol,
    totalHoldings: holdings.length
  }
}

/**
 * Calculate portfolio performance attribution by holding
 * @param {Array} currentHoldings - Current holdings array
 * @param {Array} previousHoldings - Previous period holdings array
 * @returns {Array} Performance attribution by holding
 */
export function calculatePerformanceAttribution(currentHoldings, previousHoldings) {
  const attribution = []
  
  // Create maps for easier lookup
  const currentMap = new Map(currentHoldings.map(h => [h.securityId, h]))
  const previousMap = new Map(previousHoldings.map(h => [h.securityId, h]))
  
  // Get all unique security IDs
  const allSecurityIds = new Set([
    ...currentHoldings.map(h => h.securityId),
    ...previousHoldings.map(h => h.securityId)
  ])
  
  for (const securityId of allSecurityIds) {
    const current = currentMap.get(securityId)
    const previous = previousMap.get(securityId)
    
    if (!current && !previous) continue
    
    const currentPrice = new Decimal(current?.price || 0)
    const previousPrice = new Decimal(previous?.price || 0)
    const currentWeight = new Decimal(current?.weight || 0)
    const previousWeight = new Decimal(previous?.weight || 0)
    
    // Calculate price return
    const priceReturn = previousPrice.equals(0) ? 
      new Decimal(0) : 
      currentPrice.dividedBy(previousPrice).minus(1)
    
    // Calculate weight change
    const weightChange = currentWeight.minus(previousWeight)
    
    // Calculate contribution to return
    const contribution = previousWeight.times(priceReturn)
    
    attribution.push({
      securityId,
      symbol: current?.symbol || previous?.symbol,
      name: current?.name || previous?.name,
      previousWeight: previousWeight.times(100).toNumber(),
      currentWeight: currentWeight.times(100).toNumber(),
      weightChange: weightChange.times(100).toNumber(),
      previousPrice: previousPrice.toNumber(),
      currentPrice: currentPrice.toNumber(),
      priceReturn: priceReturn.times(100).toNumber(),
      contribution: contribution.times(100).toNumber()
    })
  }
  
  return attribution.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
}