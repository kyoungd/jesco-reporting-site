'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO, isValid } from 'date-fns'
import { 
  ChevronLeftIcon,
  SaveIcon,
  PlusIcon,
  TrashIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  UploadIcon
} from 'lucide-react'

const INITIAL_ROW = {
  date: new Date().toISOString().split('T')[0],
  ticker: '',
  close: '',
  errors: []
}

export default function PriceImportPage() {
  const router = useRouter()
  const [securities, setSecurities] = useState([])
  const [rows, setRows] = useState([
    { ...INITIAL_ROW, id: 1 },
    { ...INITIAL_ROW, id: 2 },
    { ...INITIAL_ROW, id: 3 }
  ])
  const [nextId, setNextId] = useState(4)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [validationResults, setValidationResults] = useState(null)
  const [showValidation, setShowValidation] = useState(false)

  useEffect(() => {
    fetchSecurities()
    
    // Block paste events on the entire page
    const handlePaste = (e) => {
      e.preventDefault()
      e.stopPropagation()
      setError('Paste functionality is disabled. Please enter data manually to ensure accuracy.')
      setTimeout(() => setError(''), 5000)
    }
    
    document.addEventListener('paste', handlePaste, true)
    
    return () => {
      document.removeEventListener('paste', handlePaste, true)
    }
  }, [])

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

  const validateRow = (row) => {
    const errors = []
    
    // Date validation
    if (!row.date) {
      errors.push('Date is required')
    } else if (!isValid(parseISO(row.date))) {
      errors.push('Invalid date format')
    } else {
      const date = parseISO(row.date)
      const today = new Date()
      if (date > today) {
        errors.push('Date cannot be in the future')
      }
    }
    
    // Ticker validation
    if (!row.ticker) {
      errors.push('Ticker is required')
    } else {
      const security = securities.find(s => s.symbol.toLowerCase() === row.ticker.toLowerCase())
      if (!security) {
        errors.push(`Unknown ticker: ${row.ticker}`)
      }
    }
    
    // Price validation
    if (!row.close) {
      errors.push('Close price is required')
    } else {
      const price = parseFloat(row.close)
      if (isNaN(price) || price <= 0) {
        errors.push('Close price must be a positive number')
      }
    }
    
    return errors
  }

  const validateAllRows = () => {
    const validatedRows = rows.map(row => ({
      ...row,
      errors: validateRow(row)
    }))
    
    setRows(validatedRows)
    
    const validRows = validatedRows.filter(row => 
      row.date && row.ticker && row.close && row.errors.length === 0
    )
    
    const totalErrors = validatedRows.reduce((sum, row) => sum + row.errors.length, 0)
    
    setValidationResults({
      total: validatedRows.length,
      valid: validRows.length,
      errors: totalErrors,
      validRows
    })
    
    setShowValidation(true)
    return validRows
  }

  const handleCellChange = (id, field, value) => {
    setRows(prev => prev.map(row => 
      row.id === id 
        ? { ...row, [field]: value, errors: [] }
        : row
    ))
    setShowValidation(false)
  }

  const addRow = () => {
    setRows(prev => [...prev, { ...INITIAL_ROW, id: nextId }])
    setNextId(prev => prev + 1)
  }

  const deleteRow = (id) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(row => row.id !== id))
    }
  }

  const clearAllRows = () => {
    setRows([{ ...INITIAL_ROW, id: nextId }])
    setNextId(prev => prev + 1)
    setShowValidation(false)
    setValidationResults(null)
  }

  const savePrices = async () => {
    const validRows = validateAllRows()
    
    if (validRows.length === 0) {
      setError('No valid rows to save')
      return
    }
    
    setSaving(true)
    setError('')
    
    try {
      // Convert rows to price objects
      const priceUpdates = validRows.map(row => {
        const security = securities.find(s => s.symbol.toLowerCase() === row.ticker.toLowerCase())
        return {
          securityId: security.id,
          date: row.date,
          close: parseFloat(row.close)
        }
      })
      
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
        const result = await response.json()
        // Clear the form after successful save
        clearAllRows()
        setError('')
        // Show success message
        setError(`Successfully saved ${result.saved || validRows.length} price entries.`)
        setTimeout(() => setError(''), 5000)
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

  const getRowStatus = (row) => {
    if (row.errors && row.errors.length > 0) return 'error'
    if (row.date && row.ticker && row.close) return 'complete'
    return 'incomplete'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <h1 className="text-3xl font-bold text-gray-900">
                  Bulk Price Import
                </h1>
                <p className="text-gray-600 mt-2">
                  Enter multiple price entries manually in a grid format
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={validateAllRows}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Validate
              </button>
              
              <button
                onClick={savePrices}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <SaveIcon className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Prices'}
              </button>
            </div>
          </div>
        </div>

        {/* Paste Blocked Warning */}
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangleIcon className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Paste functionality is disabled</strong> to ensure data accuracy. 
                Please enter all data manually using the form fields below.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className={`mb-6 border rounded-md p-4 ${
            error.includes('Successfully') 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex">
              {error.includes('Successfully') ? (
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-400" />
              )}
              <div className="ml-3">
                <p className={`text-sm ${
                  error.includes('Successfully') ? 'text-green-800' : 'text-red-800'
                }`}>
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Validation Results */}
        {showValidation && validationResults && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-blue-400" />
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>Validation Results:</strong> {validationResults.valid} of {validationResults.total} rows are valid.
                  {validationResults.errors > 0 && (
                    <span className="text-red-600"> {validationResults.errors} errors found.</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Import Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Price Data Grid
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Enter Date, Ticker Symbol, and Close Price for each entry
              </p>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={addRow}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Row
              </button>
              
              <button
                onClick={clearAllRows}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear All
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date *
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticker *
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Close Price *
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Errors
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, index) => {
                  const status = getRowStatus(row)
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {status === 'complete' && (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        )}
                        {status === 'error' && (
                          <XCircleIcon className="h-5 w-5 text-red-500" />
                        )}
                        {status === 'incomplete' && (
                          <div className="h-5 w-5 rounded-full bg-gray-300"></div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => handleCellChange(row.id, 'date', e.target.value)}
                          className={`border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            row.errors?.some(e => e.includes('Date')) 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-300'
                          }`}
                        />
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={row.ticker}
                          onChange={(e) => handleCellChange(row.id, 'ticker', e.target.value.toUpperCase())}
                          placeholder="AAPL"
                          className={`w-20 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            row.errors?.some(e => e.includes('Ticker') || e.includes('Unknown')) 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-300'
                          }`}
                        />
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.close}
                          onChange={(e) => handleCellChange(row.id, 'close', e.target.value)}
                          placeholder="0.00"
                          className={`w-24 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            row.errors?.some(e => e.includes('Close')) 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-300'
                          }`}
                        />
                      </td>
                      
                      <td className="px-6 py-4">
                        {row.errors && row.errors.length > 0 && (
                          <div className="text-xs text-red-600">
                            {row.errors.map((error, i) => (
                              <div key={i}>{error}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        {rows.length > 1 && (
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete row"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
            <p>
              * Required fields. Make sure all tickers exist in the securities database.
              Paste functionality is disabled for data integrity.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}