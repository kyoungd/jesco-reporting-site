'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  getTransactionTypeInfo,
  getEntryStatusInfo
} from '@/lib/transactions'
import { InputPageLayout } from '@/components/layout/input-page-layout'

export default function TransactionsPage() {
  const { user, isLoaded } = useUser()
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [securities, setSecurities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filters
  const [filters, setFilters] = useState({
    accountId: '',
    startDate: '',
    endDate: '',
    transactionType: '',
    entryStatus: '',
    securityId: ''
  })

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })

  // Selection
  const [selectedTransactions, setSelectedTransactions] = useState(new Set())
  const [focusedRowIndex, setFocusedRowIndex] = useState(0)

  // Transaction types for filter dropdown
  const transactionTypes = [
    'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'TAX',
    'TRANSFER_IN', 'TRANSFER_OUT', 'CORPORATE_ACTION', 'SPLIT', 'MERGER', 'SPINOFF'
  ]

  // Fetch accounts for filter dropdown
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }, [])

  // Fetch securities for filter dropdown
  const fetchSecurities = useCallback(async () => {
    try {
      const response = await fetch('/api/securities?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setSecurities(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching securities:', error)
    }
  }, [])

  // Fetch transactions
  const fetchTransactions = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([key, value]) => value !== '')
        )
      })

      const response = await fetch(`/api/transactions?${queryParams}`)
      
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
        setPagination(data.pagination || pagination)
        setError(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to fetch transactions')
      }
    } catch (error) {
      setError('Network error occurred')
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.limit])

  // Initialize data
  useEffect(() => {
    if (isLoaded && user) {
      fetchAccounts()
      fetchSecurities()
      
      // Set default date range (last 30 days)
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]
      
      setFilters(prev => ({
        ...prev,
        startDate,
        endDate
      }))
    }
  }, [isLoaded, user, fetchAccounts, fetchSecurities])

  // Fetch transactions when filters change
  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      fetchTransactions(1)
    }
  }, [filters, fetchTransactions])

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  // Handle pagination
  const handlePageChange = (newPage) => {
    fetchTransactions(newPage)
  }

  // Handle row selection
  const handleRowSelect = (transactionId, isSelected) => {
    const newSelection = new Set(selectedTransactions)
    if (isSelected) {
      newSelection.add(transactionId)
    } else {
      newSelection.delete(transactionId)
    }
    setSelectedTransactions(newSelection)
  }

  // Handle select all
  const handleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set())
    } else {
      setSelectedTransactions(new Set(transactions.map(t => t.id)))
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!transactions.length) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedRowIndex(prev => 
            Math.min(prev + 1, transactions.length - 1)
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedRowIndex(prev => Math.max(prev - 1, 0))
          break
        case ' ':
          e.preventDefault()
          const currentTransaction = transactions[focusedRowIndex]
          if (currentTransaction) {
            handleRowSelect(
              currentTransaction.id, 
              !selectedTransactions.has(currentTransaction.id)
            )
          }
          break
        case 'Enter':
          e.preventDefault()
          // Navigate to transaction entry with focused transaction
          const focusedTransaction = transactions[focusedRowIndex]
          if (focusedTransaction) {
            window.open(`/transactions/entry?edit=${focusedTransaction.id}`, '_blank')
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [transactions, focusedRowIndex, selectedTransactions])

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US')
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <InputPageLayout
      title="Transactions"
      description="View and manage transaction history"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Transaction List</h2>
          <p className="text-sm text-gray-600 mt-1">
            Browse and filter transactions for the selected account
          </p>
        </div>
        <Link
          href="/transactions/entry"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          New Entry
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account
            </label>
            <select
              value={filters.accountId}
              onChange={(e) => handleFilterChange('accountId', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option 
                  key={account.id} 
                  value={`${account.accountType === 'Master' ? 'master' : 'client'}_${account.id}`}
                >
                  {account.accountNumber} - {account.accountName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.transactionType}
              onChange={(e) => handleFilterChange('transactionType', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {transactionTypes.map(type => {
                const typeInfo = getTransactionTypeInfo(type)
                return (
                  <option key={type} value={type}>
                    {typeInfo.label}
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.entryStatus}
              onChange={(e) => handleFilterChange('entryStatus', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Security
            </label>
            <select
              value={filters.securityId}
              onChange={(e) => handleFilterChange('securityId', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Securities</option>
              <option value="CASH">Cash</option>
              {securities.map(security => (
                <option key={security.id} value={security.id}>
                  {security.symbol} - {security.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selection Actions */}
      {selectedTransactions.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
          <div className="flex justify-between items-center">
            <span className="text-blue-700">
              {selectedTransactions.size} transaction{selectedTransactions.size !== 1 ? 's' : ''} selected
            </span>
            <div className="space-x-2">
              <button
                onClick={() => {
                  // Handle bulk post
                  console.log('Post selected transactions')
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
              >
                Post Selected
              </button>
              <button
                onClick={() => setSelectedTransactions(new Set())}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedTransactions.size === transactions.length && transactions.length > 0}
                    onChange={handleSelectAll}
                    className="rounded focus:ring-2 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Security
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction, index) => {
                const typeInfo = getTransactionTypeInfo(transaction.transactionType)
                const statusInfo = getEntryStatusInfo(transaction.entryStatus)
                const isFocused = index === focusedRowIndex
                const isSelected = selectedTransactions.has(transaction.id)

                return (
                  <tr 
                    key={transaction.id}
                    className={`
                      ${isFocused ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}
                      ${isSelected ? 'bg-blue-100' : ''}
                      cursor-pointer
                    `}
                    onClick={() => setFocusedRowIndex(index)}
                    onDoubleClick={() => window.open(`/transactions/entry?edit=${transaction.id}`, '_blank')}
                  >
                    <td className="px-2 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleRowSelect(transaction.id, e.target.checked)}
                        className="rounded focus:ring-2 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transactionDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.security ? 
                        `${transaction.security.symbol} - ${transaction.security.name}` : 
                        'Cash'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {transaction.quantity ? 
                        new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(transaction.quantity) : 
                        '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {transaction.price ? formatCurrency(transaction.price) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.accountInfo ? 
                        `${transaction.accountInfo.accountNumber} (${transaction.accountType})` : 
                        'N/A'
                      }
                    </td>
                  </tr>
                )
              })}
              {transactions.length === 0 && !loading && (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                    No transactions found for the selected criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} transactions
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 py-2 border border-gray-300 rounded-md text-sm ${
                  pageNum === pagination.page 
                    ? 'bg-blue-500 text-white border-blue-500' 
                    : 'hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts info */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Keyboard Shortcuts:</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">↑/↓</kbd> Navigate rows</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">Space</kbd> Select/deselect row</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">Enter</kbd> Edit transaction</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">Tab</kbd> Move between filters</div>
        </div>
      </div>
    </InputPageLayout>
  )
}