/**
 * PDF Generator - Creates quarterly investment reports
 * 
 * CONSTRAINTS:
 * - DO NOT reimplement calculations
 * - CALL existing functions and format results
 * - USE EXISTING functions from /lib/calculations/*
 */

import jsPDF from 'jspdf'
import { PrismaClient } from '@prisma/client'

// USE EXISTING calculation functions - DO NOT RECREATE
import { calculateAUM } from '../calculations/aum'
import { calculateDailyReturns, calculateTWR } from '../calculations/twr'
import { getHoldings } from '../calculations/holdings'

// Use formatting functions
import {
  formatCurrency,
  formatPercentage,
  formatDate,
  formatAUMTable,
  formatPerformanceTable,
  formatHoldingsTable,
  formatAssetClassBreakdown,
  formatTransactionSummary,
  createPDFHeader,
  createPDFFooter,
  createExecutiveSummary
} from './formatters'

const prisma = new PrismaClient()

/**
 * Create quarterly investment report PDF
 * @param {string} clientId - Client profile ID
 * @param {number} quarter - Quarter number (1-4)
 * @param {number} year - Year
 * @returns {Buffer} PDF buffer
 */
export async function createQuarterlyPack(clientId, quarter, year) {
  try {
    // Calculate quarter date range
    const { startDate, endDate } = getQuarterDateRange(quarter, year)
    
    // Fetch client info
    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      include: { clientAccounts: true }
    })
    
    if (!client || client.clientAccounts.length === 0) {
      throw new Error('Client or accounts not found')
    }
    
    // Use first account for now - could be expanded to handle multiple accounts
    const accountId = client.clientAccounts[0].id
    
    // Fetch data for calculations
    const data = await fetchCalculationData(accountId, startDate, endDate)
    
    // CALL existing calculation functions - DO NOT RECREATE
    // Handle both sync and async functions (for testing with mocks)
    const aumData = await Promise.resolve(calculateAUM(accountId, startDate, endDate, data))
    const dailyReturns = calculateDailyReturns(accountId, startDate, endDate, data)
    const performanceData = calculateTWR(dailyReturns)
    const holdingsData = getHoldings(accountId, endDate, data)
    
    // Create PDF using the calculation RESULTS
    const doc = new jsPDF()
    
    // Generate report sections
    addCoverPage(doc, client.companyName || client.contactName, quarter, year)
    addExecutiveSummary(doc, aumData, { summary: performanceData }, holdingsData)
    addAUMSection(doc, aumData)
    addPerformanceSection(doc, { summary: performanceData })
    addHoldingsSection(doc, holdingsData)
    
    // Return PDF as buffer
    return doc.output('arraybuffer')
    
  } catch (error) {
    console.error('PDF generation error:', error)
    throw new Error(`Failed to generate PDF: ${error.message}`)
  }
}

/**
 * Calculate quarter date range
 */
function getQuarterDateRange(quarter, year) {
  const quarters = {
    1: { start: { month: 0, day: 1 }, end: { month: 2, day: 31 } },
    2: { start: { month: 3, day: 1 }, end: { month: 5, day: 30 } },
    3: { start: { month: 6, day: 1 }, end: { month: 8, day: 30 } },
    4: { start: { month: 9, day: 1 }, end: { month: 11, day: 31 } }
  }
  
  const q = quarters[quarter]
  const startDate = new Date(year, q.start.month, q.start.day)
  const endDate = new Date(year, q.end.month, q.end.day)
  
  return { startDate, endDate }
}

/**
 * Fetch data needed for calculations
 * Returns data in format expected by calculation functions
 */
async function fetchCalculationData(accountId, startDate, endDate) {
  const [positions, transactions, prices, securities] = await Promise.all([
    // Fetch positions
    prisma.position.findMany({
      where: {
        clientAccountId: accountId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    }),
    
    // Fetch transactions
    prisma.transaction.findMany({
      where: {
        clientAccountId: accountId,
        transactionDate: {
          gte: startDate,
          lte: endDate
        },
        entryStatus: 'POSTED'
      },
      orderBy: { transactionDate: 'asc' }
    }),
    
    // Fetch prices
    prisma.price.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    }),
    
    // Fetch securities
    prisma.security.findMany({
      where: { isActive: true }
    })
  ])
  
  // Transform data to match calculation function expectations
  return {
    positions: positions.map(p => ({
      accountId: p.clientAccountId,
      date: p.date,
      marketValue: parseFloat(p.marketValue || 0),
      shares: parseFloat(p.quantity || 0),
      securityId: p.securityId
    })),
    transactions: transactions.map(t => ({
      accountId: t.clientAccountId,
      date: t.transactionDate,
      amount: parseFloat(t.amount || 0),
      type: t.transactionType
    })),
    prices: prices.map(p => ({
      securityId: p.securityId,
      date: p.date,
      close: parseFloat(p.close || 0)
    })),
    securities: securities.map(s => ({
      id: s.id,
      symbol: s.symbol,
      name: s.name,
      assetClass: s.assetClass
    }))
  }
}

/**
 * Add cover page to PDF
 */
function addCoverPage(doc, clientName, quarter, year) {
  const header = createPDFHeader(clientName, 'Quarterly Investment Report', quarter, year)
  
  // Title
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(header.title, 105, 80, { align: 'center' })
  
  // Subtitle
  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  doc.text(header.subtitle, 105, 100, { align: 'center' })
  
  // Generated date
  doc.setFontSize(12)
  doc.text(header.generatedDate, 105, 120, { align: 'center' })
  
  // Logo/branding area (placeholder)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('JESCO INVESTMENT MANAGEMENT', 105, 200, { align: 'center' })
  
  // Footer
  doc.setFontSize(10)
  doc.text(createPDFFooter(1, 'X'), 105, 280, { align: 'center' })
}

/**
 * Add executive summary section
 */
function addExecutiveSummary(doc, aumData, performanceData, holdingsData) {
  doc.addPage()
  
  // Section title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Executive Summary', 20, 30)
  
  // Summary paragraph
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const summary = createExecutiveSummary(aumData, performanceData, holdingsData)
  
  const lines = doc.splitTextToSize(summary, 170)
  doc.text(lines, 20, 50)
  
  // Key metrics table
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Key Metrics', 20, 100)
  
  if (aumData?.summary && performanceData?.summary) {
    const keyMetrics = [
      ['Ending Portfolio Value', formatCurrency(aumData.summary.endingAUM)],
      ['Total Return', formatPercentage(performanceData.summary.totalTWR || 0)],
      ['Net Cash Flow', formatCurrency(aumData.summary.netFlows)],
      ['Total Positions', holdingsData?.summary?.totalPositions?.toString() || '0']
    ]
    
    addSimpleTable(doc, keyMetrics, 20, 110, [80, 60])
  }
}

/**
 * Add AUM section to PDF
 */
function addAUMSection(doc, aumData) {
  doc.addPage()
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Assets Under Management', 20, 30)
  
  // AUM table using formatted data
  const aumTable = formatAUMTable(aumData)
  if (aumTable.length > 0) {
    addSimpleTable(doc, aumTable, 20, 50, [120, 60])
  }
  
  // Daily values chart (simplified text representation)
  if (aumData?.dailyValues && aumData.dailyValues.length > 0) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Period Performance', 20, 150)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Beginning Value: ${formatCurrency(aumData.summary?.startingAUM)}`, 20, 170)
    doc.text(`Ending Value: ${formatCurrency(aumData.summary?.endingAUM)}`, 20, 185)
    doc.text(`Net Change: ${formatCurrency(aumData.summary?.totalChange)}`, 20, 200)
  }
}

/**
 * Add performance section to PDF
 */
function addPerformanceSection(doc, performanceData) {
  doc.addPage()
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Performance Analysis', 20, 30)
  
  // Performance table using formatted data
  const perfTable = formatPerformanceTable(performanceData)
  if (perfTable.length > 0) {
    addSimpleTable(doc, perfTable, 20, 50, [120, 60])
  }
}

/**
 * Add holdings section to PDF
 */
function addHoldingsSection(doc, holdingsData) {
  doc.addPage()
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Portfolio Holdings', 20, 30)
  
  // Holdings table using formatted data
  const holdingsTable = formatHoldingsTable(holdingsData)
  if (holdingsTable.length > 0) {
    addAdvancedTable(doc, holdingsTable, 20, 50)
  }
  
  // Asset class breakdown
  if (holdingsData?.summary?.assetClassBreakdown) {
    doc.addPage()
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Asset Class Allocation', 20, 30)
    
    const assetTable = formatAssetClassBreakdown(holdingsData.summary)
    if (assetTable.length > 0) {
      const headers = [['Asset Class', 'Positions', 'Market Value', 'Allocation %']]
      addSimpleTable(doc, headers.concat(assetTable), 20, 50, [50, 30, 60, 40])
    }
  }
}

/**
 * Add a simple table to PDF
 */
function addSimpleTable(doc, data, x, y, columnWidths = [100, 80]) {
  let currentY = y
  const rowHeight = 15
  
  data.forEach((row, index) => {
    let currentX = x
    
    // Set font style for headers (first row)
    if (index === 0) {
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setFont('helvetica', 'normal')
    }
    
    row.forEach((cell, cellIndex) => {
      const width = columnWidths[cellIndex] || columnWidths[columnWidths.length - 1]
      doc.text(String(cell), currentX, currentY)
      currentX += width
    })
    
    currentY += rowHeight
  })
}

/**
 * Add an advanced table with borders
 */
function addAdvancedTable(doc, data, x, y) {
  const columnWidths = [30, 25, 25, 35, 25, 35]
  const rowHeight = 12
  let currentY = y
  
  data.forEach((row, index) => {
    let currentX = x
    
    if (index === 0 || index === data.length - 1) {
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setFont('helvetica', 'normal')
    }
    
    row.forEach((cell, cellIndex) => {
      const width = columnWidths[cellIndex]
      const text = String(cell)
      
      // Truncate long text to fit column
      const truncated = text.length > 12 ? text.substring(0, 9) + '...' : text
      doc.text(truncated, currentX + 2, currentY + 8)
      
      // Draw cell border
      doc.rect(currentX, currentY, width, rowHeight)
      currentX += width
    })
    
    currentY += rowHeight
  })
}

/**
 * Create a simple statement PDF for testing
 */
export async function createSimpleStatement(clientId) {
  try {
    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId }
    })
    
    if (!client) {
      throw new Error('Client not found')
    }
    
    const doc = new jsPDF()
    
    // Simple statement
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Investment Statement', 105, 50, { align: 'center' })
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text(`Client: ${client.companyName || client.contactName}`, 20, 80)
    doc.text(`Generated: ${formatDate(new Date())}`, 20, 100)
    
    return doc.output('arraybuffer')
  } catch (error) {
    throw new Error(`Failed to generate simple statement: ${error.message}`)
  }
}