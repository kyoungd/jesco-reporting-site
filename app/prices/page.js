'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  TrendingUpIcon
} from 'lucide-react'
import { InputPageLayout } from '@/components/layout/input-page-layout'

export default function PricesPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [securities, setSecurities] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changes, setChanges] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSecurities()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      fetchPricesForDate(selectedDate)
    }
  }, [selectedDate])

  const fetchSecurities = async () => {
    try {
      const response = await fetch('/api/securities')
      if (response.ok) {
        const data = await response.json()
        setSecurities(data.securities || [])
      }
    } catch (err) {
      setError('Failed to fetch securities')
    }
  }

  const fetchPricesForDate = async (date) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/prices?date=${date}`)
      if (response.ok) {
        const data = await response.json()
        const priceMap = {}
        data.prices?.forEach(price => {
          priceMap[price.securityId] = price
        })
        setPrices(priceMap)
      }
    } catch (err) {
      setError('Failed to fetch prices')
    } finally {
      setLoading(false)
    }
  }

  const handlePriceChange = (securityId, field, value) => {
    const numValue = parseFloat(value) || 0
    
    setChanges(prev => ({
      ...prev,
      [securityId]: {
        ...prev[securityId],
        [field]: numValue,
        securityId,
        date: selectedDate
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
        await fetchPricesForDate(selectedDate)
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

  const hasChanges = Object.keys(changes).length > 0

  const getPriceStatus = (securityId) => {
    const hasExistingPrice = prices[securityId]?.close > 0
    const hasChanges = changes[securityId]?.close > 0
    
    if (hasChanges || hasExistingPrice) {
      return 'complete'
    }
    return 'missing'
  }

  const getDisplayPrice = (securityId, field) => {
    if (changes[securityId]?.[field] !== undefined) {
      return changes[securityId][field]
    }
    return prices[securityId]?.[field] || ''
  }

  return (
    <InputPageLayout
      title="Prices"
      description="View and manage security prices"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Price Entry
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Enter and manage security prices by date
            </p>
          </div>
          <div className="flex space-x-3">
            <Link
              href="/prices/series"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <TrendingUpIcon className="h-4 w-4 mr-2" />
              Price Series
            </Link>
          </div>
        </div>
      </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <XCircleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Date Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                <label className="text-sm font-medium text-gray-700">
                  Price Date:
                </label>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-sm text-gray-500">
                {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            
            {hasChanges && (
              <button
                onClick={savePrices}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {/* Price Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Securities Price Grid
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Enter prices for all securities on {format(new Date(selectedDate + 'T00:00:00'), 'MMMM d, yyyy')}
            </p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading securities...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Security Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Open
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      High
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Low
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Close *
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Volume
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {securities.map((security) => {
                    const status = getPriceStatus(security.id)
                    return (
                      <tr key={security.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {status === 'complete' ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {security.symbol}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {security.name}
                          </span>
                          <div className="text-xs text-gray-500">
                            {security.assetClass}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={getDisplayPrice(security.id, 'open')}
                            onChange={(e) => handlePriceChange(security.id, 'open', e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={getDisplayPrice(security.id, 'high')}
                            onChange={(e) => handlePriceChange(security.id, 'high', e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={getDisplayPrice(security.id, 'low')}
                            onChange={(e) => handlePriceChange(security.id, 'low', e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={getDisplayPrice(security.id, 'close')}
                            onChange={(e) => handlePriceChange(security.id, 'close', e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-yellow-50"
                            placeholder="0.00"
                            required
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={getDisplayPrice(security.id, 'volume')}
                            onChange={(e) => handlePriceChange(security.id, 'volume', e.target.value)}
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {securities.length === 0 && !loading && (
          <div className="text-center py-12">
            <PlusIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No securities found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Add securities to the system to enter price data.
            </p>
          </div>
        )}
    </InputPageLayout>
  )
}