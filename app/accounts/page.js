'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Search, Plus, Eye, Filter, Building2, CreditCard, TrendingUp, DollarSign } from 'lucide-react'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_NAMES, USER_LEVELS } from '@/lib/constants'
import { InputPageLayout } from '@/components/layout/input-page-layout'

export default function AccountsPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Search and filter state
  const [search, setSearch] = useState('')
  const [accountTypeFilter, setAccountTypeFilter] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [breakdown, setBreakdown] = useState({ masterAccounts: 0, clientAccounts: 0 })
  const limit = 20

  useEffect(() => {
    if (isLoaded) {
      fetchAccounts()
    }
  }, [isLoaded, search, accountTypeFilter, includeInactive, page])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      
      if (search) params.append('search', search)
      if (accountTypeFilter) params.append('accountType', accountTypeFilter)
      if (includeInactive) params.append('includeInactive', 'true')

      const response = await fetch(`/api/accounts?${params}`)
      const data = await response.json()

      if (data.success) {
        setAccounts(data.data)
        setTotal(data.total)
        setPages(data.pages)
        setBreakdown(data.breakdown || { masterAccounts: 0, clientAccounts: 0 })
      } else {
        setError(data.error || 'Failed to fetch accounts')
      }
    } catch (err) {
      setError('Error loading accounts')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const clearMessages = () => {
    setError('')
  }

  const canCreateAccounts = user?.publicMetadata?.level === USER_LEVELS.L5_ADMIN || 
                           user?.publicMetadata?.level === USER_LEVELS.L4_AGENT

  if (!isLoaded) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <InputPageLayout
      title="Accounts"
      description="Manage client accounts and account setup"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Account Management</h2>
          <p className="text-sm text-gray-600 mt-1">Manage master accounts and client accounts</p>
        </div>
        {canCreateAccounts && (
          <button
            onClick={() => router.push('/accounts/new')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Account
          </button>
        )}
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="text-red-700">{error}</p>
            <button onClick={clearMessages} className="text-red-500 hover:text-red-700">×</button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Master Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{breakdown.masterAccounts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Client Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{breakdown.clientAccounts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Active Accounts</p>
              <p className="text-2xl font-bold text-gray-900">
                {accounts.filter(acc => acc.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts, clients..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Account Type Filter */}
          <select
            value={accountTypeFilter}
            onChange={(e) => {
              setAccountTypeFilter(e.target.value)
              setPage(1)
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Account Types</option>
            {Object.entries(ACCOUNT_TYPE_NAMES).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>

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

          <div></div> {/* Empty space for grid alignment */}
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No accounts found. {search && 'Try adjusting your search criteria.'}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-200 font-medium text-gray-700 text-sm">
              <div className="col-span-2">Account Number</div>
              <div className="col-span-2">Account Name</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1">Category</div>
              <div className="col-span-2">Client</div>
              <div className="col-span-2">Organization</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* Table Body */}
            {accounts.map((account) => (
              <div key={account.id} className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 items-center hover:bg-gray-50">
                <div className="col-span-2">
                  <span className="font-mono text-sm">{account.accountNumber}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-medium">{account.accountName}</span>
                </div>
                <div className="col-span-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {ACCOUNT_TYPE_NAMES[account.accountType]}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    account.accountCategory === 'master' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {account.accountCategory === 'master' ? 'Master' : 'Client'}
                  </span>
                </div>
                <div className="col-span-2">
                  <div className="text-sm">
                    <div className="font-medium">{account.clientProfile.companyName || '-'}</div>
                    <div className="text-gray-500">{account.clientProfile.secdexCode}</div>
                  </div>
                </div>
                <div className="col-span-2 text-sm">
                  {account.accountCategory === 'master' 
                    ? account.organization?.name || account.clientProfile.organization?.name || '-'
                    : account.masterAccount?.clientProfile?.companyName || '-'
                  }
                </div>
                <div className="col-span-1">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                    account.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="col-span-1">
                  <button
                    onClick={() => router.push(`/accounts/${account.id}`)}
                    className="text-blue-600 hover:text-blue-700 flex items-center"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} accounts
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
    </InputPageLayout>
  )
}