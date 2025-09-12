/**
 * PDF Formatters - Pure formatting functions for PDF generation
 * 
 * CONSTRAINTS:
 * - ONLY formatting functions
 * - Receive data, return formatted strings
 * - NO calculations, NO database queries
 * - Use data from existing calculation functions
 */

import { format } from 'date-fns'

/**
 * Format currency values for PDF display
 */
export function formatCurrency(amount, decimals = 2) {
  if (amount === null || amount === undefined) return '$0.00'
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num)
}

/**
 * Format percentage values for PDF display
 */
export function formatPercentage(value, decimals = 2) {
  if (value === null || value === undefined) return '0.00%'
  
  const num = typeof value === 'string' ? parseFloat(value) : value
  return (num * 100).toFixed(decimals) + '%'
}

/**
 * Format dates for PDF display
 */
export function formatDate(date) {
  if (!date) return ''
  
  // Handle ISO date strings by creating local date to avoid timezone shifts
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number)
    return format(new Date(year, month - 1, day), 'MMM dd, yyyy')
  }
  
  // Handle Date objects that may have been created from ISO strings
  const dateObj = new Date(date)
  // If it's a UTC date at midnight, it was likely an ISO date, so use local interpretation
  if (dateObj.getUTCHours() === 0 && dateObj.getUTCMinutes() === 0 && dateObj.getUTCSeconds() === 0) {
    const isoString = dateObj.toISOString().split('T')[0]
    const [year, month, day] = isoString.split('-').map(Number)
    return format(new Date(year, month - 1, day), 'MMM dd, yyyy')
  }
  
  return format(dateObj, 'MMM dd, yyyy')
}

/**
 * Format quarter display
 */
export function formatQuarter(quarter, year) {
  return `Q${quarter} ${year}`
}

/**
 * Format AUM data for PDF table
 * Receives data from calculateAUM() - DO NOT MODIFY
 */
export function formatAUMTable(aumData) {
  if (!aumData || !aumData.summary) {
    return []
  }

  const { summary } = aumData
  
  return [
    ['Beginning Period Value', formatCurrency(summary.startingAUM)],
    ['Net Cash Flow', formatCurrency(summary.netFlows)],
    ['Market Gain/Loss', formatCurrency(summary.marketPnL)],
    ['Ending Period Value', formatCurrency(summary.endingAUM)],
    ['Total Change', formatCurrency(summary.totalChange)],
    ['Total Return %', formatPercentage(summary.totalReturn || 0)]
  ]
}

/**
 * Format performance data for PDF table
 * Receives data from calculateTWR() - DO NOT MODIFY
 */
export function formatPerformanceTable(performanceData) {
  if (!performanceData || !performanceData.summary) {
    return []
  }

  const { summary } = performanceData
  
  return [
    ['Total Time-Weighted Return', formatPercentage(summary.totalTWR)],
    ['Annualized Return', formatPercentage(summary.annualizedTWR)],
    ['Volatility', formatPercentage(summary.volatility)],
    ['Sharpe Ratio', summary.sharpeRatio?.toFixed(2) || '0.00'],
    ['Best Day', formatPercentage(summary.bestDay)],
    ['Worst Day', formatPercentage(summary.worstDay)],
    ['Total Days', summary.totalDays?.toString() || '0'],
    ['Positive Days', summary.positiveDays?.toString() || '0']
  ]
}

/**
 * Format holdings data for PDF table
 * Receives data from getHoldings() - DO NOT MODIFY
 */
export function formatHoldingsTable(holdingsData) {
  if (!holdingsData || !holdingsData.holdings || holdingsData.holdings.length === 0) {
    return []
  }

  const holdings = holdingsData.holdings
  const rows = []
  
  // Header row
  rows.push(['Security', 'Shares/Units', 'Price', 'Market Value', 'Allocation %', 'Unrealized P&L'])
  
  // Data rows
  holdings.forEach(holding => {
    rows.push([
      holding.symbol || 'N/A',
      holding.shares?.toLocaleString() || '0',
      formatCurrency(holding.price),
      formatCurrency(holding.marketValue),
      formatPercentage(holding.allocationPercent),
      formatCurrency(holding.unrealizedPnL)
    ])
  })
  
  // Total row
  if (holdingsData.summary) {
    rows.push([
      'TOTAL',
      '',
      '',
      formatCurrency(holdingsData.summary.totalMarketValue),
      '100.00%',
      formatCurrency(holdingsData.summary.totalUnrealizedPnL)
    ])
  }
  
  return rows
}

/**
 * Format asset class breakdown for PDF chart/table
 */
export function formatAssetClassBreakdown(summary) {
  if (!summary || !summary.assetClassBreakdown) {
    return []
  }

  const breakdown = summary.assetClassBreakdown
  const rows = []
  
  Object.entries(breakdown).forEach(([assetClass, data]) => {
    rows.push([
      assetClass.replace('_', ' '),
      data.count?.toString() || '0',
      formatCurrency(data.marketValue),
      formatPercentage(data.allocationPercent)
    ])
  })
  
  return rows
}

/**
 * Format transaction summary for PDF
 */
export function formatTransactionSummary(transactionData) {
  if (!transactionData || !transactionData.summary) {
    return []
  }

  const { summary } = transactionData
  
  return [
    ['Total Transactions', summary.totalCount?.toString() || '0'],
    ['Total Inflows', formatCurrency(summary.totalInflows)],
    ['Total Outflows', formatCurrency(summary.totalOutflows)],
    ['Net Cash Flow', formatCurrency(summary.netCashFlow)],
    ['Final Balance', formatCurrency(summary.finalBalance)]
  ]
}

/**
 * Create PDF header text
 */
export function createPDFHeader(clientName, reportTitle, quarter, year) {
  return {
    title: reportTitle,
    subtitle: `${clientName} - ${formatQuarter(quarter, year)}`,
    generatedDate: `Generated on ${formatDate(new Date())}`
  }
}

/**
 * Create footer text with page numbers
 */
export function createPDFFooter(pageNumber, totalPages) {
  return `Page ${pageNumber} of ${totalPages} | Generated by Jesco Investment Management`
}

/**
 * Format large numbers for display
 */
export function formatLargeNumber(value) {
  if (!value) return '0'
  
  const num = typeof value === 'string' ? parseFloat(value) : value
  
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B'
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  
  return num.toLocaleString()
}

/**
 * Create executive summary text
 */
export function createExecutiveSummary(aumData, performanceData, holdingsData) {
  if (!aumData?.summary || !performanceData?.summary || !holdingsData?.summary) {
    return 'Insufficient data to generate executive summary.'
  }

  const endingAUM = formatCurrency(aumData.summary.endingAUM)
  const totalReturn = formatPercentage(performanceData.summary.totalTWR || 0)
  const totalPositions = holdingsData.summary.totalPositions || 0
  const netFlows = formatCurrency(aumData.summary.netFlows)

  return `During this reporting period, the portfolio achieved a total return of ${totalReturn} with an ending value of ${endingAUM}. The portfolio held ${totalPositions} positions and experienced net cash flows of ${netFlows}.`
}