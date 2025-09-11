# Phase 4 Investment Calculation Libraries

This directory contains pure calculation functions for investment reporting and analysis. All functions are designed to be stateless - they take data as input and return calculated results without performing database operations.

## Libraries Overview

### 1. AUM Calculations (`aum.js`)
Assets Under Management calculations with identity validation.

**Key Functions:**
- `calculateAUM()` - Calculate BOP, EOP, net flows, and market P&L
- `calculateMultipleAUM()` - Calculate AUM for multiple accounts
- `calculateAggregateAUM()` - Aggregate AUM across accounts
- `calculateDailyAUM()` - Daily AUM values over time

**Identity Check:** EOP - BOP = NetFlows + MarketPnL

### 2. Time-Weighted Returns (`twr.js`)
Time-weighted return calculations excluding external cash flows.

**Key Functions:**
- `calculateDailyReturns()` - Daily returns excluding flows
- `calculateTWR()` - Time-weighted return from daily returns
- `calculateTWRWithFees()` - Gross and net returns after fees
- `calculateRollingReturns()` - Rolling period returns
- `calculatePerformanceStatistics()` - Volatility, Sharpe ratio, drawdown

### 3. Holdings Analysis (`holdings.js`)
Portfolio holdings, weights, and concentration analysis.

**Key Functions:**
- `getHoldings()` - Get current holdings as of date
- `calculateWeights()` - Portfolio and asset class weights
- `calculateUnrealizedPnL()` - Unrealized P&L summary
- `groupByAssetClass()` - Holdings grouped by asset class
- `calculateConcentrationRisk()` - Concentration metrics
- `calculatePerformanceAttribution()` - Performance attribution

### 4. Fee Calculations (`fees.js`)
Management and performance fee calculations with daily accrual.

**Key Functions:**
- `accrueFees()` - Daily management fee accrual
- `calculatePerformanceFees()` - Performance fees with high water mark
- `calculateTieredFees()` - Tiered fee structure calculations
- `calculateMultiAccountFees()` - Multi-account fee aggregation

**Accrual Formula:** Daily Fee = AUM × (Annual Rate / 365)

### 5. Lot Tracking (`lots.js`)
Tax lot tracking and realized P&L calculations with multiple methods.

**Key Functions:**
- `trackLots()` - Track tax lots (FIFO, LIFO, Specific ID)
- `calculateRealizedPnL()` - Realized gains/losses from sales
- `calculateUnrealizedPnL()` - Unrealized P&L by lot
- `calculateWashSales()` - Wash sale rule adjustments
- `generateTaxReportingSummary()` - Tax reporting summary

**Methods:** FIFO, LIFO, HighCost, LowCost, SpecificID
**Tax Treatment:** Short-term (<365 days) vs Long-term (≥365 days)

### 6. Quality Control (`qc.js`)
Data validation and quality control checks.

**Key Functions:**
- `checkAUMIdentity()` - Validate AUM calculation identity
- `findMissingPrices()` - Identify missing price data
- `validateBenchmarkDates()` - Benchmark data alignment
- `validatePositionReconciliation()` - Position vs transaction reconciliation
- `validateReturns()` - Return data validation
- `runComprehensiveQC()` - Complete quality control suite

**Status Levels:** PASS, WARN, FAIL

## Usage Examples

### Basic AUM Calculation
```javascript
import { calculateAUM } from './lib/calculations/aum.js'

const aumResult = calculateAUM(
  'account-123',
  new Date('2024-01-01'),
  new Date('2024-12-31'),
  {
    positions: [...],
    transactions: [...]
  }
)

console.log(`Market P&L: ${aumResult.marketPnL}`)
console.log(`Identity Check: ${aumResult.identityCheck}`)
```

### Time-Weighted Returns
```javascript
import { calculateDailyReturns, calculateTWR } from './lib/calculations/twr.js'

const dailyReturns = calculateDailyReturns('account-123', startDate, endDate, data)
const twr = calculateTWR(dailyReturns, { annualize: true })

console.log(`Annualized Return: ${(twr.annualizedReturn * 100).toFixed(2)}%`)
```

### Holdings Analysis
```javascript
import { getHoldings, calculateWeights } from './lib/calculations/holdings.js'

const holdings = getHoldings('account-123', new Date(), data)
const analysis = calculateWeights(holdings)

console.log(`Total AUM: ${analysis.totalMarketValue}`)
console.log(`Asset Class Weights:`, analysis.assetClassWeights)
```

### Quality Control
```javascript
import { runComprehensiveQC } from './lib/calculations/qc.js'

const qcResults = runComprehensiveQC({
  accountId: 'account-123',
  aumData: {...},
  returns: [...],
  positions: [...],
  transactions: [...],
  dateRange: { start: '2024-01-01', end: '2024-12-31' }
})

console.log(`Overall Status: ${qcResults.overallStatus}`)
qcResults.checks.forEach(check => {
  console.log(`${check.check}: ${check.status}`)
})
```

## Key Features

- **Pure Functions**: No database calls, pass data in and get results out
- **Decimal Precision**: Uses decimal.js for financial calculations
- **Error Handling**: Comprehensive validation and error checking
- **Multiple Methods**: Support for different calculation methods (FIFO/LIFO, etc.)
- **Quality Control**: Built-in data validation and reconciliation
- **Performance**: Optimized for large datasets
- **Tax Compliance**: Proper short-term/long-term capital gains treatment
- **Industry Standards**: Follows investment industry calculation standards

## Dependencies

- `decimal.js` - High precision decimal arithmetic

## Notes

- All monetary amounts are returned as numbers (not Decimal objects)
- Dates should be provided as Date objects or ISO strings
- Functions are designed to handle edge cases gracefully
- Quality control functions provide detailed diagnostic information
- All calculations follow industry standard methodologies