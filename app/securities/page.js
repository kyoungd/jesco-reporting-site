'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Search, Plus, Edit2, Trash2, Filter, Eye, EyeOff } from 'lucide-react'
import { ASSET_CLASSES, ASSET_CLASS_NAMES, CURRENCIES, CURRENCY_SYMBOLS } from '@/lib/constants'

export default function SecuritiesPage() {
  const { user, isLoaded } = useUser()
  const [securities, setSecurities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Search and filter state
  const [search, setSearch] = useState('')
  const [assetClassFilter, setAssetClassFilter] = useState('')
  const [exchangeFilter, setExchangeFilter] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const limit = 50
  
  // Edit state
  const [editingSecurity, setEditingSecurity] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSecurity, setNewSecurity] = useState({
    symbol: '',
    name: '',
    assetClass: 'EQUITY',
    exchange: '',
    currency: 'USD',
    country: 'US',
    sector: '',
    industry: ''
  })

  useEffect(() => {
    if (isLoaded) {
      fetchSecurities()
    }
  }, [isLoaded, search, assetClassFilter, exchangeFilter, includeInactive, page])

  const fetchSecurities = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      
      if (search) params.append('search', search)
      if (assetClassFilter) params.append('assetClass', assetClassFilter)
      if (exchangeFilter) params.append('exchange', exchangeFilter)
      if (includeInactive) params.append('includeInactive', 'true')

      const response = await fetch(`/api/securities?${params}`)
      const data = await response.json()

      if (data.success) {
        setSecurities(data.data)
        setTotal(data.total)
        setPages(data.pages)
      } else {
        setError(data.error || 'Failed to fetch securities')
      }
    } catch (err) {
      setError('Error loading securities')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSecurity = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/securities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSecurity)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Security added successfully')
        setShowAddForm(false)
        setNewSecurity({
          symbol: '',
          name: '',
          assetClass: 'EQUITY',
          exchange: '',
          currency: 'USD',
          country: 'US',
          sector: '',
          industry: ''
        })
        fetchSecurities()
      } else {
        setError(data.error || 'Failed to add security')
      }
    } catch (err) {
      setError('Error adding security')
      console.error('Error:', err)
    }
  }

  const handleUpdateSecurity = async (id, updates) => {
    try {
      const response = await fetch(`/api/securities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Security updated successfully')
        setEditingSecurity(null)
        fetchSecurities()
      } else {
        setError(data.error || 'Failed to update security')
      }
    } catch (err) {
      setError('Error updating security')
      console.error('Error:', err)
    }
  }

  const handleDeleteSecurity = async (id) => {
    if (!confirm('Are you sure you want to delete this security?')) return

    try {
      const response = await fetch(`/api/securities/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Security deleted successfully')
        fetchSecurities()
      } else {
        setError(data.error || 'Failed to delete security')
      }
    } catch (err) {
      setError('Error deleting security')
      console.error('Error:', err)
    }
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  if (!isLoaded) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Securities Management</h1>
          <p className="text-gray-600 mt-1">Manage securities, tickers, and asset classes</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Security
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="text-red-700">{error}</p>
            <button onClick={clearMessages} className="text-red-500 hover:text-red-700">×</button>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="text-green-700">{success}</p>
            <button onClick={clearMessages} className="text-green-500 hover:text-green-700">×</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by symbol, name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Asset Class Filter */}
          <select
            value={assetClassFilter}
            onChange={(e) => {
              setAssetClassFilter(e.target.value)
              setPage(1)
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Asset Classes</option>
            {Object.entries(ASSET_CLASS_NAMES).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>

          {/* Exchange Filter */}
          <input
            type="text"
            placeholder="Exchange (e.g., NYSE, NASDAQ)"
            value={exchangeFilter}
            onChange={(e) => {
              setExchangeFilter(e.target.value)
              setPage(1)
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          {/* Include Inactive */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked)
                setPage(1)
              }}
              className="mr-2"
            />
            Show Inactive
          </label>
        </div>
      </div>

      {/* Add Security Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add New Security</h2>
            <form onSubmit={handleAddSecurity} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symbol*</label>
                <input
                  type="text"
                  required
                  value={newSecurity.symbol}
                  onChange={(e) => setNewSecurity({...newSecurity, symbol: e.target.value.toUpperCase()})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="AAPL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name*</label>
                <input
                  type="text"
                  required
                  value={newSecurity.name}
                  onChange={(e) => setNewSecurity({...newSecurity, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Apple Inc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Class*</label>
                <select
                  required
                  value={newSecurity.assetClass}
                  onChange={(e) => setNewSecurity({...newSecurity, assetClass: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(ASSET_CLASS_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exchange</label>
                <input
                  type="text"
                  value={newSecurity.exchange}
                  onChange={(e) => setNewSecurity({...newSecurity, exchange: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="NASDAQ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={newSecurity.currency}
                  onChange={(e) => setNewSecurity({...newSecurity, currency: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.keys(CURRENCIES).map(currency => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                <input
                  type="text"
                  value={newSecurity.sector}
                  onChange={(e) => setNewSecurity({...newSecurity, sector: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Technology"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <input
                  type="text"
                  value={newSecurity.industry}
                  onChange={(e) => setNewSecurity({...newSecurity, industry: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Consumer Electronics"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Security
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Securities Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">Loading securities...</div>
        ) : securities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No securities found. {search && 'Try adjusting your search criteria.'}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-200 font-medium text-gray-700 text-sm">
              <div className="col-span-2">Symbol</div>
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Asset Class</div>
              <div className="col-span-1">Exchange</div>
              <div className="col-span-1">Currency</div>
              <div className="col-span-1">Latest Price</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* Table Body */}
            {securities.map((security) => (
              <div key={security.id} className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 items-center hover:bg-gray-50">
                {editingSecurity?.id === security.id ? (
                  // Edit Row
                  <EditSecurityRow
                    security={security}
                    onSave={(updates) => handleUpdateSecurity(security.id, updates)}
                    onCancel={() => setEditingSecurity(null)}
                  />
                ) : (
                  // Display Row
                  <>
                    <div className="col-span-2 font-mono font-medium">{security.symbol}</div>
                    <div className="col-span-3 text-sm">{security.name}</div>
                    <div className="col-span-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {ASSET_CLASS_NAMES[security.assetClass]}
                      </span>
                    </div>
                    <div className="col-span-1 text-sm">{security.exchange || '-'}</div>
                    <div className="col-span-1 text-sm">{security.currency}</div>
                    <div className="col-span-1 text-sm">
                      {security.prices?.[0] ? (
                        <span>
                          {CURRENCY_SYMBOLS[security.currency] || security.currency}
                          {parseFloat(security.prices[0].close).toFixed(2)}
                        </span>
                      ) : '-'}
                    </div>
                    <div className="col-span-1">
                      {security.isActive ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          <Eye className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="col-span-1 flex space-x-2">
                      <button
                        onClick={() => setEditingSecurity(security)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSecurity(security.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                        disabled={security._count?.transactions > 0 || security._count?.positions > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} securities
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm bg-blue-50 border border-blue-200 rounded-lg">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === pages}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EditSecurityRow({ security, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    symbol: security.symbol,
    name: security.name,
    assetClass: security.assetClass,
    exchange: security.exchange || '',
    currency: security.currency,
    sector: security.sector || '',
    industry: security.industry || '',
    isActive: security.isActive
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="col-span-12 grid grid-cols-12 gap-2">
      <input
        type="text"
        value={formData.symbol}
        onChange={(e) => setFormData({...formData, symbol: e.target.value.toUpperCase()})}
        className="col-span-2 text-sm border border-gray-300 rounded px-2 py-1 font-mono"
        required
      />
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        className="col-span-3 text-sm border border-gray-300 rounded px-2 py-1"
        required
      />
      <select
        value={formData.assetClass}
        onChange={(e) => setFormData({...formData, assetClass: e.target.value})}
        className="col-span-2 text-sm border border-gray-300 rounded px-2 py-1"
      >
        {Object.entries(ASSET_CLASS_NAMES).map(([key, name]) => (
          <option key={key} value={key}>{name}</option>
        ))}
      </select>
      <input
        type="text"
        value={formData.exchange}
        onChange={(e) => setFormData({...formData, exchange: e.target.value})}
        className="col-span-1 text-sm border border-gray-300 rounded px-2 py-1"
      />
      <select
        value={formData.currency}
        onChange={(e) => setFormData({...formData, currency: e.target.value})}
        className="col-span-1 text-sm border border-gray-300 rounded px-2 py-1"
      >
        {Object.keys(CURRENCIES).map(currency => (
          <option key={currency} value={currency}>{currency}</option>
        ))}
      </select>
      <div className="col-span-1">-</div>
      <label className="col-span-1 flex items-center text-sm">
        <input
          type="checkbox"
          checked={formData.isActive}
          onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
          className="mr-1"
        />
        Active
      </label>
      <div className="col-span-1 flex space-x-1">
        <button
          type="submit"
          className="text-green-600 hover:text-green-700 text-sm px-2 py-1 border border-green-300 rounded"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-600 hover:text-gray-700 text-sm px-2 py-1 border border-gray-300 rounded"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}