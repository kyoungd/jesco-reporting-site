'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import ReportFilters from '@/components/reports/report-filters'
import CSVExportButton from '@/components/reports/csv-export-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Receipt, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function TransactionsReportPage() {
  const { userId, isLoaded } = useAuth()
  const [user, setUser] = useState(null)
  const [transactionData, setTransactionData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({})
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('')
  const [minAmountFilter, setMinAmountFilter] = useState('')
  const [maxAmountFilter, setMaxAmountFilter] = useState('')

  useEffect(() => {
    if (isLoaded && !userId) {
      redirect('/sign-in')
    }
    if (isLoaded && userId) {
      loadUser()
    }
  }, [isLoaded, userId])

  const loadUser = async () => {
    try {
      const response = await fetch('/api/user/profile')
      const userData = await response.json()
      setUser(userData.user)
    } catch (error) {
      console.error('Error loading user:', error)
      setError('Failed to load user data')
    }
  }

  const handleFiltersChange = async (newFilters) => {
    setFilters(newFilters)
    
    if (newFilters.accountId && newFilters.startDate && newFilters.endDate) {
      await generateTransactionReport({ 
        ...newFilters, 
        transactionType: transactionTypeFilter,
        minAmount: minAmountFilter ? parseFloat(minAmountFilter) : undefined,
        maxAmount: maxAmountFilter ? parseFloat(maxAmountFilter) : undefined
      })
    } else {
      setTransactionData(null)
    }
  }

  const handleAdditionalFiltersApply = async () => {
    if (filters.accountId && filters.startDate && filters.endDate) {
      await generateTransactionReport({ 
        ...filters, 
        transactionType: transactionTypeFilter,
        minAmount: minAmountFilter ? parseFloat(minAmountFilter) : undefined,
        maxAmount: maxAmountFilter ? parseFloat(maxAmountFilter) : undefined
      })
    }
  }

  const generateTransactionReport = async (filterParams) => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        accountId: filterParams.accountId,
        startDate: filterParams.startDate.toISOString(),
        endDate: filterParams.endDate.toISOString()
      })

      if (filterParams.transactionType) {
        params.append('transactionType', filterParams.transactionType)
      }
      if (filterParams.minAmount) {
        params.append('minAmount', filterParams.minAmount.toString())
      }
      if (filterParams.maxAmount) {
        params.append('maxAmount', filterParams.maxAmount.toString())
      }
      
      const response = await fetch(`/api/reports/transactions?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setTransactionData(data)
      } else {
        setError(data.error || 'Failed to generate transactions report')
      }
    } catch (error) {
      console.error('Error generating transactions report:', error)
      setError('Failed to generate transactions report')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value) => {
    if (value == null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US')
  }

  const formatShares = (value) => {
    if (value == null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6
    }).format(value)
  }

  const prepareCSVData = () => {
    if (!transactionData?.transactions) return []
    
    return transactionData.transactions.map(item => ({
      Date: formatDate(item.transactionDate),
      Type: item.transactionType,
      Security: item.security?.symbol || item.securityId || 'CASH',
      'Security Name': item.security?.securityName || 'Cash Transaction',
      Shares: item.shares || 0,
      Price: item.price || 0,
      Amount: item.amount,
      'Running Balance': item.runningBalance,
      Description: item.description || '',
      'Entry Status': item.entryStatus
    }))
  }

  const transactionTypes = [
    { value: '', label: 'All Types' },
    { value: 'BUY', label: 'Buy' },
    { value: 'SELL', label: 'Sell' },
    { value: 'DIVIDEND', label: 'Dividend' },
    { value: 'INTEREST', label: 'Interest' },
    { value: 'DEPOSIT', label: 'Deposit' },
    { value: 'WITHDRAWAL', label: 'Withdrawal' },
    { value: 'FEE', label: 'Fee' },
    { value: 'TRANSFER_IN', label: 'Transfer In' },
    { value: 'TRANSFER_OUT', label: 'Transfer Out' }
  ]

  if (!isLoaded || !user) {
    return <div className="container mx-auto p-6">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/reports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold">Transactions Report</h1>
        </div>
        <p className="text-muted-foreground mt-2">
          Transaction history and cash flow analysis for selected accounts
        </p>
      </div>

      <div className="space-y-6">
        <ReportFilters
          user={user}
          onFiltersChange={handleFiltersChange}
          showAccountFilter={true}
          showDateRange={true}
          showClientFilter={true}
          defaultStartDate={new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
          defaultEndDate={new Date().toISOString().split('T')[0]}
        />

        <Card>
          <CardHeader>
            <CardTitle>Additional Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Type
                </label>
                <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Amount
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={minAmountFilter}
                  onChange={(e) => setMinAmountFilter(e.target.value)}
                  placeholder="Min amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Amount
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={maxAmountFilter}
                  onChange={(e) => setMaxAmountFilter(e.target.value)}
                  placeholder="Max amount"
                />
              </div>
              <div>
                <Button onClick={handleAdditionalFiltersApply}>
                  Apply Additional Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p>Generating transactions report...</p>
            </CardContent>
          </Card>
        )}

        {transactionData && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Transaction Summary</CardTitle>
                <CSVExportButton 
                  data={prepareCSVData()} 
                  filename={`transactions_report_${filters.accountId}`}
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-orange-800">Total Transactions</h3>
                    <p className="text-2xl font-bold text-orange-600">
                      {transactionData.summary?.totalCount || 0}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-800">Total Inflows</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(transactionData.summary?.totalInflows)}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-red-800">Total Outflows</h3>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(transactionData.summary?.totalOutflows)}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-800">Net Cash Flow</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(transactionData.summary?.netCashFlow)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {transactionData.transactions && transactionData.transactions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Transaction Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Security</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Shares</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Price</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Amount</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Running Balance</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionData.transactions.map((transaction, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              {formatDate(transaction.transactionDate)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                                {transaction.transactionType}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <div>
                                <div className="font-medium">
                                  {transaction.security?.symbol || transaction.securityId || 'CASH'}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {transaction.security?.securityName || 'Cash Transaction'}
                                </div>
                              </div>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatShares(transaction.shares)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(transaction.price)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              <span className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(transaction.amount)}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                              {formatCurrency(transaction.runningBalance)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <span className={`px-2 py-1 text-xs rounded ${
                                transaction.entryStatus === 'POSTED' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {transaction.entryStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!transactionData && !loading && !error && (
          <Card>
            <CardContent className="p-8 text-center">
              <Receipt className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Report Generated</h3>
              <p className="text-gray-500">
                Select an account and date range to generate a transactions report
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}