'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import ReportFilters from '@/components/reports/report-filters'
import CSVExportButton from '@/components/reports/csv-export-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BarChart, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function AUMReportPage() {
  const { userId, isLoaded } = useAuth()
  const [user, setUser] = useState(null)
  const [aumData, setAumData] = useState(null)
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
      await generateAUMReport(newFilters)
    } else {
      setAumData(null)
    }
  }

  const generateAUMReport = async (filterParams) => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        accountId: filterParams.accountId,
        startDate: filterParams.startDate.toISOString(),
        endDate: filterParams.endDate.toISOString()
      })
      
      const response = await fetch(`/api/reports/aum?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setAumData(data)
      } else {
        setError(data.error || 'Failed to generate AUM report')
      }
    } catch (error) {
      console.error('Error generating AUM report:', error)
      setError('Failed to generate AUM report')
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

  const prepareCSVData = () => {
    if (!aumData) return []
    
    return aumData.dailyValues?.map(item => ({
      Date: formatDate(item.date),
      'Market Value': item.marketValue,
      'Net Flows': item.netFlows,
      'AUM': item.aum,
      'Change from Previous': item.changeFromPrevious || 0
    })) || []
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
          <BarChart className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Assets Under Management Report</h1>
        </div>
        <p className="text-muted-foreground mt-2">
          Calculate and analyze AUM for selected accounts over time
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

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Generating AUM report...</p>
            </CardContent>
          </Card>
        )}

        {aumData && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>AUM Summary</CardTitle>
                <CSVExportButton 
                  data={prepareCSVData()} 
                  filename={`aum_report_${filters.accountId}`}
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-800">Starting AUM</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(aumData.summary?.startingAUM)}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-800">Ending AUM</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(aumData.summary?.endingAUM)}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-800">Total Change</h3>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(aumData.summary?.totalChange)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {aumData.dailyValues && aumData.dailyValues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Daily AUM Values</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Market Value</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Net Flows</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">AUM</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Daily Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aumData.dailyValues.map((row, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              {formatDate(row.date)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(row.marketValue)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(row.netFlows)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                              {formatCurrency(row.aum)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              <span className={row.changeFromPrevious >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(row.changeFromPrevious || 0)}
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

        {!aumData && !loading && !error && (
          <Card>
            <CardContent className="p-8 text-center">
              <BarChart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Report Generated</h3>
              <p className="text-gray-500">
                Select an account and date range to generate an AUM report
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}