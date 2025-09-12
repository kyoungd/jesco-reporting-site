'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import ReportFilters from '@/components/reports/report-filters'
import CSVExportButton from '@/components/reports/csv-export-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArrowLeft, TrendingUp, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function PerformanceReportPage() {
  const { userId, isLoaded } = useAuth()
  const [user, setUser] = useState(null)
  const [performanceData, setPerformanceData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({})

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
      await generatePerformanceReport(newFilters)
    } else {
      setPerformanceData(null)
    }
  }

  const generatePerformanceReport = async (filterParams) => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        accountId: filterParams.accountId,
        startDate: filterParams.startDate.toISOString(),
        endDate: filterParams.endDate.toISOString()
      })
      
      const response = await fetch(`/api/reports/performance?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setPerformanceData(data)
      } else {
        setError(data.error || 'Failed to generate performance report')
      }
    } catch (error) {
      console.error('Error generating performance report:', error)
      setError('Failed to generate performance report')
    } finally {
      setLoading(false)
    }
  }

  const formatPercentage = (value) => {
    if (value == null) return 'N/A'
    return `${(value * 100).toFixed(4)}%`
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US')
  }

  const prepareCSVData = () => {
    if (!performanceData?.dailyReturns) return []
    
    return performanceData.dailyReturns.map(item => ({
      Date: formatDate(item.date),
      'Daily Return': item.dailyReturn,
      'Cumulative Return': item.cumulativeReturn,
      'Beginning Value': item.beginningValue,
      'Ending Value': item.endingValue,
      'Net Flows': item.netFlows
    }))
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
          <TrendingUp className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold">Performance Report</h1>
        </div>
        <p className="text-muted-foreground mt-2">
          Time-weighted returns and performance analytics for selected accounts
        </p>
      </div>

      <div className="space-y-6">
        <ReportFilters
          user={user}
          onFiltersChange={handleFiltersChange}
          showAccountFilter={true}
          showDateRange={true}
          showClientFilter={true}
          defaultStartDate={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
          defaultEndDate={new Date().toISOString().split('T')[0]}
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p>Generating performance report...</p>
            </CardContent>
          </Card>
        )}

        {performanceData && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Performance Summary</CardTitle>
                <CSVExportButton 
                  data={prepareCSVData()} 
                  filename={`performance_report_${filters.accountId}`}
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-800">Total TWR</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPercentage(performanceData.summary?.totalTWR)}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-800">Annualized TWR</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatPercentage(performanceData.summary?.annualizedTWR)}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-800">Best Day</h3>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatPercentage(performanceData.summary?.bestDay)}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-red-800">Worst Day</h3>
                    <p className="text-2xl font-bold text-red-600">
                      {formatPercentage(performanceData.summary?.worstDay)}
                    </p>
                  </div>
                </div>
                
                {performanceData.summary?.volatility && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-gray-700">Volatility (Annualized)</h4>
                        <p className="text-lg font-semibold">
                          {formatPercentage(performanceData.summary.volatility)}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-700">Sharpe Ratio</h4>
                        <p className="text-lg font-semibold">
                          {performanceData.summary.sharpeRatio?.toFixed(4) || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {performanceData.dailyReturns && performanceData.dailyReturns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Daily Returns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Daily Return</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Cumulative Return</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Beginning Value</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Ending Value</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Net Flows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performanceData.dailyReturns.map((row, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              {formatDate(row.date)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              <span className={row.dailyReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatPercentage(row.dailyReturn)}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                              <span className={row.cumulativeReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatPercentage(row.cumulativeReturn)}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              ${row.beginningValue?.toLocaleString() || 'N/A'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              ${row.endingValue?.toLocaleString() || 'N/A'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              ${row.netFlows?.toLocaleString() || '0'}
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

        {!performanceData && !loading && !error && (
          <Card>
            <CardContent className="p-8 text-center">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Report Generated</h3>
              <p className="text-gray-500">
                Select an account and date range to generate a performance report
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}