'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { InputPageLayout } from '@/components/layout/input-page-layout'
import {
  getTransactionTypeInfo,
  getEntryStatusInfo,
  calculateTransactionFields,
  validateTransaction
} from '@/lib/transactions'

export default function TransactionEntryPage() {
  const { user, isLoaded } = useUser()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  
  const [accounts, setAccounts] = useState([])
  const [securities, setSecurities] = useState([])
  const [clientProfiles, setClientProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [duplicateWarning, setDuplicateWarning] = useState(null)

  // Grid data and state
  const [rows, setRows] = useState([])
  const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 })
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [editingCell, setEditingCell] = useState(null)

  // Input refs for cell editing
  const inputRefs = useRef({})

  // Column definitions
  const columns = [
    { key: 'transactionDate', header: 'Date', width: '120px', type: 'date' },
    { key: 'transactionType', header: 'Type', width: '100px', type: 'select' },
    { key: 'securitySymbol', header: 'Security', width: '120px', type: 'autocomplete' },
    { key: 'quantity', header: 'Quantity', width: '100px', type: 'number' },
    { key: 'price', header: 'Price', width: '100px', type: 'number' },
    { key: 'amount', header: 'Amount', width: '120px', type: 'number' },
    { key: 'accountId', header: 'Account', width: '200px', type: 'select' },
    { key: 'description', header: 'Description', width: '200px', type: 'text' },
    { key: 'entryStatus', header: 'Status', width: '80px', type: 'select' }
  ]

  // Transaction types for quick entry
  const transactionTypes = [
    'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'TAX',
    'TRANSFER_IN', 'TRANSFER_OUT', 'CORPORATE_ACTION', 'SPLIT', 'MERGER', 'SPINOFF'
  ]

  // Initialize with empty rows
  const createEmptyRow = () => ({
    id: `temp_${Date.now()}_${Math.random()}`,
    transactionDate: new Date().toISOString().split('T')[0],
    transactionType: '',
    securityId: '',
    securitySymbol: '',
    quantity: '',
    price: '',
    amount: '',
    accountId: '',
    description: '',
    entryStatus: 'DRAFT',
    isNew: true,
    errors: []
  })

  // Fetch reference data
  const fetchReferenceData = useCallback(async () => {
    try {
      const [accountsRes, securitiesRes, clientProfilesRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/securities?limit=1000'),
        fetch('/api/client-profiles')
      ])

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json()
        setAccounts(accountsData.accounts || [])
      }

      if (securitiesRes.ok) {
        const securitiesData = await securitiesRes.json()
        setSecurities(securitiesData.securities || [])
      }

      if (clientProfilesRes.ok) {
        const clientProfilesData = await clientProfilesRes.json()
        setClientProfiles(clientProfilesData.clientProfiles || [])
      }
    } catch (error) {
      console.error('Error fetching reference data:', error)
      setError('Failed to load reference data')
    }
  }, [])

  // Fetch transaction for editing
  const fetchTransactionForEdit = useCallback(async (transactionId) => {
    try {
      const response = await fetch(`/api/transactions?id=${transactionId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.transactions && data.transactions.length > 0) {
          const transaction = data.transactions[0]
          const editRow = {
            id: transaction.id,
            transactionDate: transaction.transactionDate.split('T')[0],
            transactionType: transaction.transactionType,
            securityId: transaction.securityId || '',
            securitySymbol: transaction.security?.symbol || 'CASH',
            quantity: transaction.quantity || '',
            price: transaction.price || '',
            amount: transaction.amount,
            accountId: transaction.masterAccountId ? 
              `master_${transaction.masterAccountId}` : 
              `client_${transaction.clientAccountId}`,
            description: transaction.description || '',
            entryStatus: transaction.entryStatus,
            isNew: false,
            errors: []
          }
          setRows([editRow, createEmptyRow()])
        }
      }
    } catch (error) {
      console.error('Error fetching transaction:', error)
      setError('Failed to load transaction for editing')
    }
  }, [])

  // Initialize
  useEffect(() => {
    if (isLoaded && user) {
      fetchReferenceData()
      
      if (editId) {
        fetchTransactionForEdit(editId)
      } else {
        // Start with 10 empty rows
        setRows(Array.from({ length: 10 }, createEmptyRow))
      }
      
      setLoading(false)
    }
  }, [isLoaded, user, editId, fetchReferenceData, fetchTransactionForEdit])

  // Auto-calculate amount when quantity or price changes
  const autoCalculateAmount = (row) => {
    if (['BUY', 'SELL'].includes(row.transactionType)) {
      const quantity = parseFloat(row.quantity) || 0
      const price = parseFloat(row.price) || 0
      if (quantity && price) {
        return (quantity * price).toFixed(2)
      }
    }
    return row.amount
  }

  // Update row data
  const updateRow = (rowIndex, field, value) => {
    setRows(prev => {
      const newRows = [...prev]
      const row = { ...newRows[rowIndex] }
      
      // Update the field
      row[field] = value
      
      // Handle security selection
      if (field === 'securitySymbol') {
        const security = securities.find(s => s.symbol === value)
        row.securityId = security?.id || (value === 'CASH' ? '' : '')
      }

      // Auto-calculate amount
      row.amount = autoCalculateAmount(row)
      
      // Clear validation errors for this field
      row.errors = row.errors.filter(error => !error.includes(field))
      
      newRows[rowIndex] = row
      
      // Add new empty row if we're at the last row and it has data
      if (rowIndex === newRows.length - 1 && hasRowData(row)) {
        newRows.push(createEmptyRow())
      }
      
      return newRows
    })
  }

  // Check if row has data
  const hasRowData = (row) => {
    return row.transactionType || row.securitySymbol || row.amount || row.description
  }

  // Keyboard navigation
  const handleKeyDown = (e, rowIndex, colIndex) => {
    const totalRows = rows.length
    const totalCols = columns.length

    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          // Previous cell
          if (colIndex > 0) {
            setFocusedCell({ row: rowIndex, col: colIndex - 1 })
          } else if (rowIndex > 0) {
            setFocusedCell({ row: rowIndex - 1, col: totalCols - 1 })
          }
        } else {
          // Next cell
          if (colIndex < totalCols - 1) {
            setFocusedCell({ row: rowIndex, col: colIndex + 1 })
          } else if (rowIndex < totalRows - 1) {
            setFocusedCell({ row: rowIndex + 1, col: 0 })
          }
        }
        break
        
      case 'Enter':
        e.preventDefault()
        if (editingCell) {
          setEditingCell(null)
        } else {
          // Move to next row, same column
          if (rowIndex < totalRows - 1) {
            setFocusedCell({ row: rowIndex + 1, col: colIndex })
          }
        }
        break
        
      case 'ArrowUp':
        e.preventDefault()
        if (rowIndex > 0) {
          setFocusedCell({ row: rowIndex - 1, col: colIndex })
        }
        break
        
      case 'ArrowDown':
        e.preventDefault()
        if (rowIndex < totalRows - 1) {
          setFocusedCell({ row: rowIndex + 1, col: colIndex })
        }
        break
        
      case 'ArrowLeft':
        if (!editingCell) {
          e.preventDefault()
          if (colIndex > 0) {
            setFocusedCell({ row: rowIndex, col: colIndex - 1 })
          }
        }
        break
        
      case 'ArrowRight':
        if (!editingCell) {
          e.preventDefault()
          if (colIndex < totalCols - 1) {
            setFocusedCell({ row: rowIndex, col: colIndex + 1 })
          }
        }
        break
        
      case 'F2':
        e.preventDefault()
        setEditingCell({ row: rowIndex, col: colIndex })
        break
        
      case 'Delete':
        if (!editingCell) {
          e.preventDefault()
          updateRow(rowIndex, columns[colIndex].key, '')
        }
        break

      // Quick type selection
      case 'b':
      case 'B':
        if (!editingCell && columns[colIndex].key === 'transactionType') {
          e.preventDefault()
          updateRow(rowIndex, 'transactionType', 'BUY')
        }
        break
      case 's':
      case 'S':
        if (!editingCell && columns[colIndex].key === 'transactionType') {
          e.preventDefault()
          updateRow(rowIndex, 'transactionType', 'SELL')
        }
        break
      case 'd':
      case 'D':
        if (!editingCell && columns[colIndex].key === 'transactionType') {
          e.preventDefault()
          updateRow(rowIndex, 'transactionType', 'DIVIDEND')
        }
        break
    }
  }

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case 's':
            e.preventDefault()
            handleSave()
            break
          case 'p':
            e.preventDefault()
            handlePostSelected()
            break
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  })

  // Handle save
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setDuplicateWarning(null)

    try {
      // Filter rows with data
      const rowsToSave = rows.filter(row => hasRowData(row) && !row.errors?.length)
      
      if (rowsToSave.length === 0) {
        setError('No valid transactions to save')
        return
      }

      // Prepare transaction data
      const transactionsData = rowsToSave.map(row => {
        const accountId = row.accountId
        let masterAccountId = null
        let clientAccountId = null
        
        if (accountId.startsWith('master_')) {
          masterAccountId = accountId.replace('master_', '')
        } else if (accountId.startsWith('client_')) {
          clientAccountId = accountId.replace('client_', '')
        }

        return {
          id: row.isNew ? undefined : row.id,
          transactionDate: row.transactionDate,
          transactionType: row.transactionType,
          securityId: row.securityId || null,
          quantity: row.quantity ? parseFloat(row.quantity) : null,
          price: row.price ? parseFloat(row.price) : null,
          amount: parseFloat(row.amount),
          masterAccountId,
          clientAccountId,
          clientProfileId: clientProfiles.find(cp => 
            accounts.some(acc => 
              (acc.masterAccountId === masterAccountId || acc.clientAccountId === clientAccountId) && 
              acc.clientProfileId === cp.id
            )
          )?.id,
          description: row.description,
          entryStatus: row.entryStatus,
          checkDuplicates: true
        }
      })

      let response
      
      if (transactionsData.length === 1 && !transactionsData[0].id) {
        // Single new transaction
        response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transactionsData[0])
        })
      } else if (transactionsData.length === 1 && transactionsData[0].id) {
        // Single update
        response = await fetch('/api/transactions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transactionsData[0])
        })
      } else {
        // Bulk operation
        response = await fetch('/api/transactions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'create',
            transactions: transactionsData
          })
        })
      }

      if (response.ok) {
        const result = await response.json()
        
        // Check for duplicate warnings
        if (result.duplicate?.isDuplicate) {
          setDuplicateWarning(result.duplicate.message)
        }

        // Show success message
        setError(null)
        
        // Reset form if all successful
        if (!editId) {
          setRows(Array.from({ length: 10 }, createEmptyRow))
          setFocusedCell({ row: 0, col: 0 })
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save transactions')
      }

    } catch (error) {
      console.error('Error saving transactions:', error)
      setError('Network error occurred')
    } finally {
      setSaving(false)
    }
  }

  // Handle post selected
  const handlePostSelected = async () => {
    const selectedTransactionIds = Array.from(selectedRows)
      .map(rowIndex => rows[rowIndex])
      .filter(row => !row.isNew && row.id)
      .map(row => row.id)

    if (selectedTransactionIds.length === 0) {
      setError('No saved transactions selected to post')
      return
    }

    try {
      const response = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'update_status',
          transactionIds: selectedTransactionIds,
          newStatus: 'POSTED'
        })
      })

      if (response.ok) {
        // Update local state
        setRows(prev => prev.map(row => 
          selectedTransactionIds.includes(row.id) 
            ? { ...row, entryStatus: 'POSTED' }
            : row
        ))
        setSelectedRows(new Set())
        setError(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to post transactions')
      }
    } catch (error) {
      console.error('Error posting transactions:', error)
      setError('Network error occurred')
    }
  }

  // Handle delete drafts
  const handleDeleteDrafts = async () => {
    try {
      const response = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'delete_drafts',
          filters: {} // Delete all user's draft transactions
        })
      })

      if (response.ok) {
        // Remove draft rows from local state
        setRows(prev => prev.filter(row => 
          row.isNew || row.entryStatus !== 'DRAFT'
        ))
        setSelectedRows(new Set())
        setError(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to delete draft transactions')
      }
    } catch (error) {
      console.error('Error deleting drafts:', error)
      setError('Network error occurred')
    }
  }

  // Render cell content
  const renderCell = (row, column, rowIndex, colIndex) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex
    const isFocused = focusedCell.row === rowIndex && focusedCell.col === colIndex
    const value = row[column.key] || ''

    const cellClass = `
      px-2 py-1 border-r border-gray-200 
      ${isFocused ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
      ${row.errors?.some(e => e.includes(column.key)) ? 'bg-red-50 border-red-300' : ''}
      cursor-cell
    `

    if (isEditing) {
      switch (column.type) {
        case 'select':
          let options = []
          if (column.key === 'transactionType') {
            options = transactionTypes.map(type => ({ value: type, label: getTransactionTypeInfo(type).label }))
          } else if (column.key === 'accountId') {
            options = accounts.map(acc => ({
              value: `${acc.accountType === 'Master' ? 'master' : 'client'}_${acc.id}`,
              label: `${acc.accountNumber} - ${acc.accountName}`
            }))
          } else if (column.key === 'entryStatus') {
            options = [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'POSTED', label: 'Posted' }
            ]
          }

          return (
            <td key={column.key} className={cellClass} style={{ width: column.width }}>
              <select
                ref={el => inputRefs.current[`${rowIndex}-${colIndex}`] = el}
                value={value}
                onChange={(e) => updateRow(rowIndex, column.key, e.target.value)}
                onBlur={() => setEditingCell(null)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                className="w-full bg-transparent border-0 outline-none text-sm"
                autoFocus
              >
                <option value="">Select...</option>
                {options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </td>
          )

        case 'autocomplete':
          if (column.key === 'securitySymbol') {
            return (
              <td key={column.key} className={cellClass} style={{ width: column.width }}>
                <input
                  ref={el => inputRefs.current[`${rowIndex}-${colIndex}`] = el}
                  type="text"
                  value={value}
                  onChange={(e) => updateRow(rowIndex, column.key, e.target.value)}
                  onBlur={() => setEditingCell(null)}
                  onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                  className="w-full bg-transparent border-0 outline-none text-sm"
                  placeholder="Symbol or CASH"
                  list={`securities-${rowIndex}-${colIndex}`}
                  autoFocus
                />
                <datalist id={`securities-${rowIndex}-${colIndex}`}>
                  <option value="CASH">Cash</option>
                  {securities.map(security => (
                    <option key={security.id} value={security.symbol}>
                      {security.symbol} - {security.name}
                    </option>
                  ))}
                </datalist>
              </td>
            )
          }
          break

        default:
          return (
            <td key={column.key} className={cellClass} style={{ width: column.width }}>
              <input
                ref={el => inputRefs.current[`${rowIndex}-${colIndex}`] = el}
                type={column.type}
                value={value}
                onChange={(e) => updateRow(rowIndex, column.key, e.target.value)}
                onBlur={() => setEditingCell(null)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                className="w-full bg-transparent border-0 outline-none text-sm"
                autoFocus
              />
            </td>
          )
      }
    }

    // Display mode
    let displayValue = value
    if (column.key === 'transactionType') {
      const typeInfo = getTransactionTypeInfo(value)
      displayValue = (
        <span className={typeInfo.color}>{typeInfo.label}</span>
      )
    } else if (column.key === 'entryStatus') {
      const statusInfo = getEntryStatusInfo(value)
      displayValue = (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      )
    } else if (column.key === 'accountId' && value) {
      const account = accounts.find(acc => 
        value === `${acc.accountType === 'Master' ? 'master' : 'client'}_${acc.id}`
      )
      displayValue = account ? `${account.accountNumber} - ${account.accountName}` : value
    } else if (['amount', 'price'].includes(column.key) && value) {
      displayValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value)
    } else if (column.key === 'quantity' && value) {
      displayValue = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 6
      }).format(value)
    }

    return (
      <td 
        key={column.key} 
        className={cellClass} 
        style={{ width: column.width }}
        onClick={() => {
          setFocusedCell({ row: rowIndex, col: colIndex })
          setEditingCell({ row: rowIndex, col: colIndex })
        }}
        onDoubleClick={() => setEditingCell({ row: rowIndex, col: colIndex })}
      >
        <div className="truncate text-sm">
          {displayValue || <span className="text-gray-400">-</span>}
        </div>
      </td>
    )
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
      title={editId ? 'Edit Transaction' : 'Transaction Entry'}
      description="Enter and manage investment transactions for the selected account"
    >
      <div className="space-y-6">
        {/* Action Buttons */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save (Ctrl+S)'}
          </button>
          <button
            onClick={handlePostSelected}
            disabled={selectedRows.size === 0}
            className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Post Selected (Ctrl+P)
          </button>
          <button
            onClick={handleDeleteDrafts}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Delete All Drafts
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {duplicateWarning && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <strong>Duplicate Warning:</strong> {duplicateWarning}
        </div>
      )}

      {/* Transaction Entry Grid */}
      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <input
                  type="checkbox"
                  checked={selectedRows.size === rows.length}
                  onChange={() => {
                    if (selectedRows.size === rows.length) {
                      setSelectedRows(new Set())
                    } else {
                      setSelectedRows(new Set(Array.from({ length: rows.length }, (_, i) => i)))
                    }
                  }}
                />
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8">
                #
              </th>
              {columns.map(column => (
                <th
                  key={column.key}
                  className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r border-gray-200"
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((row, rowIndex) => (
              <tr 
                key={row.id}
                className={`
                  border-b border-gray-200 hover:bg-gray-50
                  ${selectedRows.has(rowIndex) ? 'bg-blue-50' : ''}
                `}
              >
                <td className="px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(rowIndex)}
                    onChange={(e) => {
                      const newSelection = new Set(selectedRows)
                      if (e.target.checked) {
                        newSelection.add(rowIndex)
                      } else {
                        newSelection.delete(rowIndex)
                      }
                      setSelectedRows(newSelection)
                    }}
                  />
                </td>
                <td className="px-2 py-1 text-xs text-gray-500 w-8">
                  {rowIndex + 1}
                </td>
                {columns.map((column, colIndex) => 
                  renderCell(row, column, rowIndex, colIndex)
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Keyboard Shortcuts:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">Tab</kbd> Next cell</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">Shift+Tab</kbd> Previous cell</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">Enter</kbd> Next row</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">F2</kbd> Edit cell</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl+S</kbd> Save</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl+P</kbd> Post selected</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">B/S/D</kbd> Buy/Sell/Dividend</div>
          <div><kbd className="bg-gray-200 px-2 py-1 rounded">Del</kbd> Clear cell</div>
        </div>
      </div>
    </InputPageLayout>
  )
}