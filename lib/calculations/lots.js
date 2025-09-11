import Decimal from 'decimal.js'

/**
 * Track tax lots for securities based on transaction history
 * @param {Array} transactions - Array of transaction records
 * @param {string} method - Lot tracking method ('FIFO', 'LIFO', 'SpecificID', 'AverageCost')
 * @returns {Map} Map of securityId to array of lots
 */
export function trackLots(transactions, method = 'FIFO') {
  const lots = new Map() // securityId -> array of lots
  
  // Sort transactions by date, then by time if available
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.date || a.transactionDate)
    const dateB = new Date(b.date || b.transactionDate)
    return dateA - dateB
  })
  
  sortedTransactions.forEach(transaction => {
    const securityId = transaction.securityId
    const quantity = new Decimal(transaction.quantity || 0)
    const price = new Decimal(transaction.price || 0)
    const transactionType = transaction.type || transaction.transactionType
    const transactionDate = new Date(transaction.date || transaction.transactionDate)
    
    if (!lots.has(securityId)) {
      lots.set(securityId, [])
    }
    
    const securityLots = lots.get(securityId)
    
    if (transactionType === 'BUY' || transactionType === 'PURCHASE') {
      // Add new lot
      securityLots.push({
        id: `${securityId}-${transactionDate.getTime()}-${Math.random()}`,
        securityId,
        purchaseDate: transactionDate,
        originalQuantity: quantity.toNumber(),
        remainingQuantity: quantity.toNumber(),
        purchasePrice: price.toNumber(),
        totalCost: quantity.times(price).toNumber(),
        averageCost: price.toNumber(),
        method
      })
    } else if (transactionType === 'SELL' || transactionType === 'SALE') {
      // Process sale using specified method
      processSale(securityLots, quantity.abs(), transactionDate, method)
    }
  })
  
  return lots
}

/**
 * Process a sale transaction against existing lots
 * @param {Array} lots - Array of lots for the security
 * @param {Decimal} sellQuantity - Quantity to sell
 * @param {Date} saleDate - Date of sale
 * @param {string} method - Lot selection method
 * @returns {Array} Array of lot assignments for the sale
 */
function processSale(lots, sellQuantity, saleDate, method) {
  const assignments = []
  let remainingToSell = new Decimal(sellQuantity)
  
  // Filter to lots with remaining quantity and sort based on method
  const availableLots = lots
    .filter(lot => new Decimal(lot.remainingQuantity).greaterThan(0))
    .sort((a, b) => {
      switch (method) {
        case 'FIFO':
          return new Date(a.purchaseDate) - new Date(b.purchaseDate)
        case 'LIFO':
          return new Date(b.purchaseDate) - new Date(a.purchaseDate)
        case 'HighCost':
          return b.purchasePrice - a.purchasePrice
        case 'LowCost':
          return a.purchasePrice - b.purchasePrice
        default:
          return new Date(a.purchaseDate) - new Date(b.purchaseDate) // Default FIFO
      }
    })
  
  for (const lot of availableLots) {
    if (remainingToSell.lessThanOrEqualTo(0)) break
    
    const lotRemaining = new Decimal(lot.remainingQuantity)
    const quantityFromThisLot = Decimal.min(remainingToSell, lotRemaining)
    
    // Record the assignment
    assignments.push({
      lotId: lot.id,
      quantity: quantityFromThisLot.toNumber(),
      purchasePrice: lot.purchasePrice,
      purchaseDate: lot.purchaseDate,
      saleDate,
      holdingPeriod: calculateHoldingPeriod(lot.purchaseDate, saleDate)
    })
    
    // Update lot remaining quantity
    lot.remainingQuantity = lotRemaining.minus(quantityFromThisLot).toNumber()
    
    // Update remaining to sell
    remainingToSell = remainingToSell.minus(quantityFromThisLot)
  }
  
  return assignments
}

/**
 * Calculate realized P&L from sales transactions
 * @param {Array} transactions - Array of transactions
 * @param {string} method - Lot matching method (FIFO, LIFO, etc.)
 * @returns {Object} Realized P&L calculation results
 */
export function calculateRealizedPnL(transactions, method = 'FIFO') {
  // Build lots from only buy transactions to avoid double-processing sales
  const buyTransactions = transactions.filter(t => 
    t.type === 'BUY' || t.type === 'PURCHASE'
  )
  const lots = trackLots(buyTransactions, method)
  const realizedPnL = []
  
  // Sort sales transactions by date
  const salesTransactions = transactions
    .filter(t => t.type === 'SELL' || t.type === 'SALE')
    .sort((a, b) => new Date(a.date || a.transactionDate) - new Date(b.date || b.transactionDate))
  
  salesTransactions.forEach(sale => {
    const securityId = sale.securityId
    const saleQuantity = new Decimal(Math.abs(sale.quantity || 0))
    const salePrice = new Decimal(sale.price || 0)
    const saleDate = new Date(sale.date || sale.transactionDate)
    
    const securityLots = lots.get(securityId) || []
    
    // Get lot assignments for this sale
    const assignments = processSale(securityLots, saleQuantity, saleDate, method)
    
    assignments.forEach(assignment => {
      const quantity = new Decimal(assignment.quantity)
      const purchasePrice = new Decimal(assignment.purchasePrice)
      const proceeds = quantity.times(salePrice)
      const cost = quantity.times(purchasePrice)
      const gainLoss = proceeds.minus(cost)
      
      // Determine if short-term or long-term
      const isLongTerm = assignment.holdingPeriod >= 365
      
      realizedPnL.push({
        securityId,
        saleDate: saleDate.toISOString().split('T')[0],
        purchaseDate: assignment.purchaseDate.toISOString().split('T')[0],
        quantity: quantity.toNumber(),
        purchasePrice: purchasePrice.toNumber(),
        salePrice: salePrice.toNumber(),
        cost: cost.toNumber(),
        proceeds: proceeds.toNumber(),
        gainLoss: gainLoss.toNumber(),
        holdingPeriod: assignment.holdingPeriod,
        isLongTerm,
        isShortTerm: !isLongTerm,
        method,
        lotId: assignment.lotId
      })
    })
  })
  
  // Calculate summary statistics
  const summary = calculateRealizedPnLSummary(realizedPnL)
  
  return {
    transactions: realizedPnL,
    summary,
    method,
    totalTransactions: realizedPnL.length
  }
}

/**
 * Calculate summary statistics for realized P&L
 * @param {Array} realizedPnL - Array of realized P&L transactions
 * @returns {Object} Summary statistics
 */
function calculateRealizedPnLSummary(realizedPnL) {
  const totals = realizedPnL.reduce((acc, pnl) => {
    const gainLoss = new Decimal(pnl.gainLoss)
    const proceeds = new Decimal(pnl.proceeds)
    const cost = new Decimal(pnl.cost)
    
    const result = {
      totalGainLoss: acc.totalGainLoss.plus(gainLoss),
      totalProceeds: acc.totalProceeds.plus(proceeds),
      totalCost: acc.totalCost.plus(cost),
      shortTermGainLoss: pnl.isShortTerm ? acc.shortTermGainLoss.plus(gainLoss) : acc.shortTermGainLoss,
      longTermGainLoss: pnl.isLongTerm ? acc.longTermGainLoss.plus(gainLoss) : acc.longTermGainLoss,
      gains: gainLoss.greaterThan(0) ? acc.gains.plus(gainLoss) : acc.gains,
      losses: gainLoss.lessThan(0) ? acc.losses.plus(gainLoss.abs()) : acc.losses,
      gainsCount: gainLoss.greaterThan(0) ? acc.gainsCount + 1 : acc.gainsCount,
      lossesCount: gainLoss.lessThan(0) ? acc.lossesCount + 1 : acc.lossesCount
    }
    
    return result
  }, {
    totalGainLoss: new Decimal(0),
    totalProceeds: new Decimal(0),
    totalCost: new Decimal(0),
    shortTermGainLoss: new Decimal(0),
    longTermGainLoss: new Decimal(0),
    gains: new Decimal(0),
    losses: new Decimal(0),
    gainsCount: 0,
    lossesCount: 0
  })
  
  const winRate = (totals.gainsCount + totals.lossesCount) > 0 ?
    totals.gainsCount / (totals.gainsCount + totals.lossesCount) : 0
  
  const averageGain = totals.gainsCount > 0 ? 
    totals.gains.dividedBy(totals.gainsCount) : new Decimal(0)
  
  const averageLoss = totals.lossesCount > 0 ? 
    totals.losses.dividedBy(totals.lossesCount) : new Decimal(0)
  
  const profitFactor = totals.losses.equals(0) ? 
    (totals.gains.greaterThan(0) ? Infinity : 0) :
    totals.gains.dividedBy(totals.losses)
  
  return {
    totalGainLoss: totals.totalGainLoss.toNumber(),
    totalProceeds: totals.totalProceeds.toNumber(),
    totalCost: totals.totalCost.toNumber(),
    shortTermGainLoss: totals.shortTermGainLoss.toNumber(),
    longTermGainLoss: totals.longTermGainLoss.toNumber(),
    totalGains: totals.gains.toNumber(),
    totalLosses: totals.losses.toNumber(),
    gainsCount: totals.gainsCount,
    lossesCount: totals.lossesCount,
    winRate,
    winRatePercent: winRate * 100,
    averageGain: averageGain.toNumber(),
    averageLoss: averageLoss.toNumber(),
    profitFactor: profitFactor === Infinity ? 'Infinity' : (typeof profitFactor === 'number' ? profitFactor : profitFactor.toNumber()),
    returnOnInvestment: totals.totalCost.equals(0) ? 0 :
      totals.totalGainLoss.dividedBy(totals.totalCost).times(100).toNumber()
  }
}

/**
 * Calculate unrealized P&L for open positions
 * @param {Map} lots - Map of lots by security ID
 * @param {Object} currentPrices - Current prices by security ID
 * @returns {Array} Array of unrealized P&L by lot
 */
export function calculateUnrealizedPnL(lots, currentPrices = {}) {
  const unrealizedPnL = []
  
  for (const [securityId, securityLots] of lots) {
    const currentPrice = new Decimal(currentPrices[securityId] || 0)
    
    securityLots
      .filter(lot => new Decimal(lot.remainingQuantity).greaterThan(0))
      .forEach(lot => {
        const remainingQuantity = new Decimal(lot.remainingQuantity)
        const purchasePrice = new Decimal(lot.purchasePrice)
        const currentValue = remainingQuantity.times(currentPrice)
        const bookValue = remainingQuantity.times(purchasePrice)
        const unrealizedGainLoss = currentValue.minus(bookValue)
        
        const holdingPeriod = calculateHoldingPeriod(
          lot.purchaseDate, 
          new Date()
        )
        
        unrealizedPnL.push({
          lotId: lot.id,
          securityId,
          purchaseDate: lot.purchaseDate.toISOString().split('T')[0],
          quantity: remainingQuantity.toNumber(),
          purchasePrice: purchasePrice.toNumber(),
          currentPrice: currentPrice.toNumber(),
          bookValue: bookValue.toNumber(),
          currentValue: currentValue.toNumber(),
          unrealizedPnL: unrealizedGainLoss.toNumber(),
          unrealizedPnLPercent: bookValue.equals(0) ? 0 : 
            unrealizedGainLoss.dividedBy(bookValue).times(100).toNumber(),
          holdingPeriod,
          isLongTerm: holdingPeriod >= 365,
          isShortTerm: holdingPeriod < 365
        })
      })
  }
  
  return unrealizedPnL.sort((a, b) => b.unrealizedPnL - a.unrealizedPnL)
}

/**
 * Calculate wash sale adjustments
 * @param {Array} realizedPnL - Array of realized P&L transactions
 * @param {Array} transactions - All transactions for wash sale period detection
 * @returns {Object} Wash sale analysis
 */
export function calculateWashSales(realizedPnL, transactions) {
  const washSales = []
  const washSalePeriod = 30 // 30 days before and after
  
  // Only look at loss transactions
  const lossTransactions = realizedPnL.filter(pnl => pnl.gainLoss < 0)
  
  lossTransactions.forEach(loss => {
    const saleDate = new Date(loss.saleDate)
    const washSaleStart = new Date(saleDate.getTime() - (washSalePeriod * 24 * 60 * 60 * 1000))
    const washSaleEnd = new Date(saleDate.getTime() + (washSalePeriod * 24 * 60 * 60 * 1000))
    
    // Look for purchases of the same security within wash sale period
    const washSalePurchases = transactions.filter(t => 
      t.securityId === loss.securityId &&
      (t.type === 'BUY' || t.type === 'PURCHASE') &&
      new Date(t.date || t.transactionDate) >= washSaleStart &&
      new Date(t.date || t.transactionDate) <= washSaleEnd &&
      new Date(t.date || t.transactionDate).getTime() !== new Date(loss.saleDate).getTime()
    )
    
    if (washSalePurchases.length > 0) {
      const totalPurchaseQuantity = washSalePurchases.reduce((sum, purchase) => 
        sum + Math.abs(purchase.quantity || 0), 0
      )
      
      const lossQuantity = Math.abs(loss.quantity)
      const washSaleQuantity = Math.min(lossQuantity, totalPurchaseQuantity)
      const washSaleRatio = washSaleQuantity / lossQuantity
      const disallowedLoss = loss.gainLoss * washSaleRatio
      const allowedLoss = loss.gainLoss - disallowedLoss
      
      washSales.push({
        originalLotId: loss.lotId,
        securityId: loss.securityId,
        saleDate: loss.saleDate,
        originalLoss: loss.gainLoss,
        washSaleQuantity,
        disallowedLoss,
        allowedLoss,
        washSalePurchases: washSalePurchases.map(p => ({
          date: p.date || p.transactionDate,
          quantity: Math.abs(p.quantity || 0),
          price: p.price || 0
        }))
      })
    }
  })
  
  const totalDisallowedLoss = washSales.reduce((sum, ws) => sum + ws.disallowedLoss, 0)
  
  return {
    washSales,
    totalDisallowedLoss,
    affectedTransactions: washSales.length,
    summary: {
      originalTotalLoss: lossTransactions.reduce((sum, loss) => sum + loss.gainLoss, 0),
      adjustedTotalLoss: lossTransactions.reduce((sum, loss) => sum + loss.gainLoss, 0) - totalDisallowedLoss,
      washSaleAdjustment: totalDisallowedLoss
    }
  }
}

/**
 * Calculate holding period in days
 * @param {Date} purchaseDate - Purchase date
 * @param {Date} saleDate - Sale date
 * @returns {number} Holding period in days
 */
function calculateHoldingPeriod(purchaseDate, saleDate) {
  const diffTime = Math.abs(saleDate - purchaseDate)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Generate tax reporting summary
 * @param {Object} realizedPnLResults - Results from calculateRealizedPnL
 * @param {Object} washSaleResults - Results from calculateWashSales
 * @returns {Object} Tax reporting summary
 */
export function generateTaxReportingSummary(realizedPnLResults, washSaleResults) {
  const { summary } = realizedPnLResults
  const adjustedShortTermGainLoss = summary.shortTermGainLoss - (washSaleResults?.totalDisallowedLoss || 0)
  
  return {
    shortTerm: {
      gainLoss: adjustedShortTermGainLoss,
      gains: Math.max(0, adjustedShortTermGainLoss),
      losses: Math.min(0, adjustedShortTermGainLoss)
    },
    longTerm: {
      gainLoss: summary.longTermGainLoss,
      gains: Math.max(0, summary.longTermGainLoss),
      losses: Math.min(0, summary.longTermGainLoss)
    },
    total: {
      gainLoss: adjustedShortTermGainLoss + summary.longTermGainLoss,
      proceeds: summary.totalProceeds,
      cost: summary.totalCost
    },
    washSales: {
      disallowedLoss: washSaleResults?.totalDisallowedLoss || 0,
      affectedTransactions: washSaleResults?.affectedTransactions || 0
    },
    method: realizedPnLResults.method
  }
}