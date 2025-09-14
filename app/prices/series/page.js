'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format, subDays, parseISO, isValid } from 'date-fns'
import {
  ChevronLeftIcon,
  TrendingUpIcon,
  CalendarIcon,
  SaveIcon,
  LineChartIcon,
  PlusIcon
} from 'lucide-react'
import { InputPageLayout } from '@/components/layout/input-page-layout'

export default function PriceSeriesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const chartCanvasRef = useRef(null)
  
  const [securities, setSecurities] = useState([])
  const [selectedSecurity, setSelectedSecurity] = useState('')
  const [startDate, setStartDate] = useState(subDays(new Date(), 30).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [priceData, setPriceData] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changes, setChanges] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSecurities()
    
    // Check for security parameter from URL
    const securityParam = searchParams.get('security')
    if (securityParam) {
      setSelectedSecurity(securityParam)
    }
  }, [searchParams])

  useEffect(() => {
    if (selectedSecurity && startDate && endDate) {
      fetchPriceSeries()
    }
  }, [selectedSecurity, startDate, endDate])

  useEffect(() => {
    if (priceData.length > 0) {
      drawChart()
    }
  }, [priceData, changes])

  const fetchSecurities = async () => {
    try {
      const response = await fetch('/api/securities')
      if (response.ok) {
        const data = await response.json()
        setSecurities(data.data || [])
      }
    } catch (err) {
      setError('Failed to fetch securities')
    }
  }

  const fetchPriceSeries = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/prices?securityId=${selectedSecurity}&startDate=${startDate}&endDate=${endDate}`
      )
      if (response.ok) {
        const data = await response.json()
        
        // Create date range and merge with existing prices
        const dateRange = generateDateRange(startDate, endDate)
        const priceMap = {}
        
        data.prices?.forEach(price => {
          priceMap[price.date.split('T')[0]] = price
        })
        
        const seriesData = dateRange.map(date => ({
          date,
          existing: priceMap[date] || null,
          close: priceMap[date]?.close || '',
          open: priceMap[date]?.open || '',
          high: priceMap[date]?.high || '',
          low: priceMap[date]?.low || '',
          volume: priceMap[date]?.volume || ''
        }))
        
        setPriceData(seriesData)
      }
    } catch (err) {
      setError('Failed to fetch price series')
    } finally {
      setLoading(false)
    }
  }

  const generateDateRange = (start, end) => {
    const dates = []
    const startDate = parseISO(start)
    const endDate = parseISO(end)
    
    let currentDate = startDate
    while (currentDate <= endDate) {
      // Skip weekends
      const dayOfWeek = currentDate.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(format(currentDate, 'yyyy-MM-dd'))
      }
      currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1))
    }
    
    return dates.reverse() // Most recent first
  }

  const handlePriceChange = (date, field, value) => {
    const numValue = parseFloat(value) || 0
    
    setChanges(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [field]: numValue,
        date,
        securityId: selectedSecurity
      }
    }))
  }

  const savePrices = async () => {
    setSaving(true)
    setError('')
    
    try {
      const priceUpdates = Object.values(changes).filter(change => 
        change.close > 0 // Only save entries with valid close prices
      )
      
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prices: priceUpdates
        })
      })

      if (response.ok) {
        setChanges({})
        await fetchPriceSeries()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save prices')
      }
    } catch (err) {
      setError('Failed to save prices')
    } finally {
      setSaving(false)
    }
  }

  const getDisplayPrice = (date, field) => {
    if (changes[date]?.[field] !== undefined) {
      return changes[date][field]
    }
    const existing = priceData.find(p => p.date === date)?.existing
    return existing?.[field] || ''
  }

  const drawChart = () => {
    const canvas = chartCanvasRef.current
    if (!canvas || priceData.length === 0) return
    
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height)
    
    // Get price data for chart
    const chartData = priceData
      .filter(p => {
        const price = changes[p.date]?.close || p.existing?.close
        return price && price > 0
      })
      .map(p => ({
        date: p.date,
        price: parseFloat(changes[p.date]?.close || p.existing?.close || 0)
      }))
      .reverse() // Chronological order for chart
    
    if (chartData.length < 2) return
    
    const prices = chartData.map(d => d.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice
    
    const padding = 40
    const chartWidth = width - (padding * 2)
    const chartHeight = height - (padding * 2)
    
    // Draw axes
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, height - padding)
    ctx.lineTo(width - padding, height - padding)
    ctx.stroke()
    
    // Draw price line
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.beginPath()
    
    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth
      const y = height - padding - ((point.price - minPrice) / priceRange) * chartHeight
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    
    ctx.stroke()
    
    // Draw data points
    ctx.fillStyle = '#3b82f6'
    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth
      const y = height - padding - ((point.price - minPrice) / priceRange) * chartHeight
      
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    })
  }

  const selectedSecurityObj = securities.find(s => s.id === selectedSecurity)
  const hasChanges = Object.keys(changes).length > 0

  return (
    <InputPageLayout
      title="Price Series"
      description="Manage price series and historical data"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link
              href="/prices"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mr-4"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Back to Prices
            </Link>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Price Series Entry
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Enter prices across multiple dates for a single security
              </p>
            </div>
          </div>

          {hasChanges && (
            <button
              onClick={savePrices}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <SaveIcon className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Security
              </label>
              <select
                value={selectedSecurity}
                onChange={(e) => setSelectedSecurity(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select security...</option>
                {securities.map(security => (
                  <option key={security.id} value={security.id}>
                    {security.symbol} - {security.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                {priceData.length} trading days
              </div>
            </div>
          </div>
        </div>

        {selectedSecurityObj && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <LineChartIcon className="h-5 w-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedSecurityObj.symbol} Price Chart
                </h2>
              </div>
              <canvas
                ref={chartCanvasRef}
                width={400}
                height={250}
                className="w-full h-auto border border-gray-200 rounded"
              />
            </div>

            {/* Price Data Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Price Data Entry
                </h2>
              </div>
              
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading price data...</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Close *
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Open
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          High
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Low
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {priceData.map((row) => (
                        <tr key={row.date} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {format(parseISO(row.date), 'MMM d, yyyy')}
                            <div className="text-xs text-gray-500">
                              {format(parseISO(row.date), 'EEE')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={getDisplayPrice(row.date, 'close')}
                              onChange={(e) => handlePriceChange(row.date, 'close', e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={getDisplayPrice(row.date, 'open')}
                              onChange={(e) => handlePriceChange(row.date, 'open', e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={getDisplayPrice(row.date, 'high')}
                              onChange={(e) => handlePriceChange(row.date, 'high', e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={getDisplayPrice(row.date, 'low')}
                              onChange={(e) => handlePriceChange(row.date, 'low', e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedSecurity && (
          <div className="text-center py-12">
            <TrendingUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Select a security</h3>
            <p className="mt-1 text-sm text-gray-500">
              Choose a security to view and edit its price series.
            </p>
          </div>
        )}
      </div>
    </InputPageLayout>
  )
}