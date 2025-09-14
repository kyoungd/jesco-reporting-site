'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const AccountContext = createContext()

export function AccountProvider({ children }) {
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [viewMode, setViewMode] = useState('reports') // 'input' or 'reports'
  const [availableAccounts, setAvailableAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch available accounts based on user permissions
  useEffect(() => {
    const fetchAvailableAccounts = async () => {
      try {
        const response = await fetch('/api/clients')
        if (response.ok) {
          const accounts = await response.json()
          setAvailableAccounts(accounts)

          // Auto-select first account if none selected
          if (!selectedAccount && accounts.length > 0) {
            setSelectedAccount(accounts[0])
          }
        }
      } catch (error) {
        console.error('Failed to fetch available accounts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAvailableAccounts()
  }, [selectedAccount])

  const value = {
    selectedAccount,
    setSelectedAccount,
    viewMode,
    setViewMode,
    availableAccounts,
    loading
  }

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider')
  }
  return context
}

// Helper functions for filtering data by selected account
export function filterBySelectedAccount(data, selectedAccountId) {
  if (!selectedAccountId || !data) return data
  return data.filter(item =>
    item.clientProfileId === selectedAccountId ||
    item.clientId === selectedAccountId ||
    item.id === selectedAccountId
  )
}

export function isValidAccountSelection(selectedAccount, userPermissions) {
  if (!selectedAccount || !userPermissions) return false

  // Implementation would check if user has permission to view this account
  // For now, return true - will implement permissions check later
  return true
}