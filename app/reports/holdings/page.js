'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import ReportFilters from '@/components/reports/report-filters'
import CSVExportButton from '@/components/reports/csv-export-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArrowLeft, PieChart, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function HoldingsReportPage() {
  const { userId, isLoaded } = useAuth()
  const [user, setUser] = useState(null)
  const [holdingsData, setHoldingsData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({})
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])

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
    
    if (newFilters.accountId) {
      await generateHoldingsReport(newFilters)
    } else {
      setHoldingsData(null)
    }
  }

  const generateHoldingsReport = async (filterParams) => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        accountId: filterParams.accountId,
        asOfDate: asOfDate
      })
      
      const response = await fetch(`/api/reports/holdings?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setHoldingsData(data)
      } else {
        setError(data.error || 'Failed to generate holdings report')
      }
    } catch (error) {
      console.error('Error generating holdings report:', error)
      setError('Failed to generate holdings report')
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

  const formatPercentage = (value) => {
    if (value == null) return 'N/A'
    return `${(value * 100).toFixed(2)}%`
  }

  const formatShares = (value) => {
    if (value == null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6
    }).format(value)
  }

  const prepareCSVData = () => {
    if (!holdingsData?.holdings) return []
    
    return holdingsData.holdings.map(item => ({
      'Security': item.symbol || item.securityName,
      'Security Name': item.securityName,
      'Asset Class': item.assetClass,
      'Shares': item.shares,
      'Price': item.price,
      'Market Value': item.marketValue,
      'Allocation': item.allocationPercent,
      'Cost Basis': item.costBasis || 0,
      'Unrealized Gain/Loss': item.unrealizedPnL || 0
    }))
  }

  const groupByAssetClass = (holdings) => {
    const grouped = {}
    holdings.forEach(holding => {
      const assetClass = holding.assetClass || 'Other'
      if (!grouped[assetClass]) {
        grouped[assetClass] = []
      }
      grouped[assetClass].push(holding)
    })
    return grouped
  }

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
          <PieChart className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold">Holdings Report</h1>
        </div>
        <p className="text-muted-foreground mt-2">
          Current positions and asset allocation for selected accounts
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  As Of Date
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <ReportFilters
          user={user}
          onFiltersChange={handleFiltersChange}
          showAccountFilter={true}
          showDateRange={false}
          showClientFilter={true}
        />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p>Generating holdings report...</p>
            </CardContent>
          </Card>
        )}

        {holdingsData && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Portfolio Summary</CardTitle>
                <CSVExportButton 
                  data={prepareCSVData()} 
                  filename={`holdings_report_${filters.accountId}_${asOfDate}`}
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-800">Total Market Value</h3>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(holdingsData.summary?.totalMarketValue)}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-800">Total Positions</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {holdingsData.summary?.totalPositions || holdingsData.holdings?.length || 0}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-800">Cash Balance</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(holdingsData.summary?.cashBalance || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {holdingsData.holdings && holdingsData.holdings.length > 0 && (
              <>
                {Object.entries(groupByAssetClass(holdingsData.holdings)).map(([assetClass, holdings]) => (
                  <Card key={assetClass}>
                    <CardHeader>
                      <CardTitle>{assetClass} Holdings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-gray-300 px-4 py-2 text-left">Security</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                              <th className="border border-gray-300 px-4 py-2 text-right">Shares</th>
                              <th className="border border-gray-300 px-4 py-2 text-right">Price</th>
                              <th className="border border-gray-300 px-4 py-2 text-right">Market Value</th>
                              <th className="border border-gray-300 px-4 py-2 text-right">Allocation %</th>
                              <th className="border border-gray-300 px-4 py-2 text-right">Unrealized P&L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {holdings.map((holding, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-4 py-2 font-medium">
                                  {holding.symbol || holding.securityId}
                                </td>
                                <td className="border border-gray-300 px-4 py-2">
                                  {holding.securityName || 'N/A'}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right">
                                  {formatShares(holding.shares)}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right">
                                  {formatCurrency(holding.price)}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                  {formatCurrency(holding.marketValue)}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right">
                                  {formatPercentage(holding.allocationPercent)}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right">
                                  <span className={holding.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {formatCurrency(holding.unrealizedPnL || 0)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}

        {!holdingsData && !loading && !error && (
          <Card>
            <CardContent className="p-8 text-center">
              <PieChart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Report Generated</h3>
              <p className="text-gray-500">
                Select an account to generate a holdings report
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}