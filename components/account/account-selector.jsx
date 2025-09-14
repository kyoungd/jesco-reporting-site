'use client'

import { useState } from 'react'
import { ChevronDown, Building2, Users } from 'lucide-react'
import { useAccount } from '@/lib/account-context'

export function AccountSelector() {
  const { selectedAccount, setSelectedAccount, availableAccounts, loading } = useAccount()
  const [isOpen, setIsOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-gray-300 rounded animate-pulse"></div>
        <div className="w-32 h-6 bg-gray-300 rounded animate-pulse"></div>
      </div>
    )
  }

  const getAccountIcon = (account) => {
    if (account.level === 'L2_CLIENT') {
      return <Building2 className="h-4 w-4 text-blue-600" />
    } else {
      return <Users className="h-4 w-4 text-purple-600" />
    }
  }

  const getAccountLabel = (account) => {
    return account.companyName || account.secdexCode || 'Unnamed Account'
  }

  const getAccountType = (account) => {
    return account.level === 'L2_CLIENT' ? 'Direct Account' : 'Sub-Client'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {selectedAccount ? (
          <>
            {getAccountIcon(selectedAccount)}
            <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
              {getAccountLabel(selectedAccount)}
            </span>
            <span className="text-xs text-gray-500 hidden sm:inline">
              ({getAccountType(selectedAccount)})
            </span>
          </>
        ) : (
          <span className="text-sm text-gray-500">Select Account</span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-20">
            <div className="max-h-60 overflow-auto">
              <div className="py-1">
                {availableAccounts.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No accounts available
                  </div>
                ) : (
                  availableAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => {
                        setSelectedAccount(account)
                        setIsOpen(false)
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors ${
                        selectedAccount?.id === account.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {getAccountIcon(account)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {getAccountLabel(account)}
                            </p>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                account.level === 'L2_CLIENT'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {getAccountType(account)}
                            </span>
                          </div>
                          {account.contactName && (
                            <p className="text-xs text-gray-500 truncate">
                              {account.contactName}
                            </p>
                          )}
                          {account.secdexCode && (
                            <p className="text-xs text-gray-400 truncate">
                              Code: {account.secdexCode}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}