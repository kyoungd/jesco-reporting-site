'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Building2, CreditCard } from 'lucide-react'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_NAMES, USER_LEVELS } from '@/lib/constants'

export default function NewAccountPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Form state
  const [accountCategory, setAccountCategory] = useState('master')
  const [formData, setFormData] = useState({
    accountNumber: '',
    accountName: '',
    accountType: 'INVESTMENT',
    clientProfileId: '',
    masterAccountId: '',
    custodian: ''
  })
  
  // Client and master account search
  const [clientProfiles, setClientProfiles] = useState([])
  const [masterAccounts, setMasterAccounts] = useState([])
  const [clientSearch, setClientSearch] = useState('')
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingMasterAccounts, setLoadingMasterAccounts] = useState(false)

  useEffect(() => {
    if (isLoaded) {
      // Check permissions
      const userLevel = user?.publicMetadata?.level
      if (userLevel !== USER_LEVELS.L5_ADMIN && userLevel !== USER_LEVELS.L4_AGENT) {
        router.push('/accounts')
        return
      }
      
      fetchClientProfiles()
    }
  }, [isLoaded, user])

  useEffect(() => {
    if (accountCategory === 'client' && formData.clientProfileId) {
      fetchMasterAccounts()
    }
  }, [accountCategory, formData.clientProfileId])

  const fetchClientProfiles = async () => {
    try {
      setLoadingClients(true)
      const params = new URLSearchParams()
      if (clientSearch) params.append('search', clientSearch)
      
      const response = await fetch(`/api/clients?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setClientProfiles(data.data)
      }
    } catch (err) {
      console.error('Error fetching clients:', err)
    } finally {
      setLoadingClients(false)
    }
  }

  const fetchMasterAccounts = async () => {
    try {
      setLoadingMasterAccounts(true)
      const response = await fetch(`/api/accounts?limit=100`)
      const data = await response.json()
      
      if (data.success) {
        // Filter master accounts for the selected client
        const masterAccountsForClient = data.data.filter(
          account => account.accountCategory === 'master' && 
                    account.clientProfileId === formData.clientProfileId
        )
        setMasterAccounts(masterAccountsForClient)
      }
    } catch (err) {
      console.error('Error fetching master accounts:', err)
    } finally {
      setLoadingMasterAccounts(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const submitData = {
        ...formData,
        accountCategory
      }

      // Remove empty fields
      Object.keys(submitData).forEach(key => {
        if (!submitData[key]) delete submitData[key]
      })

      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Account created successfully')
        setTimeout(() => {
          router.push(`/accounts/${data.data.id}`)
        }, 1500)
      } else {
        setError(data.error || 'Failed to create account')
      }
    } catch (err) {
      setError('Error creating account')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClientSelect = (clientId) => {
    setFormData({ ...formData, clientProfileId: clientId, masterAccountId: '' })
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  if (!isLoaded) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.back()}
          className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Account</h1>
          <p className="text-gray-600 mt-1">Create a new master account or client account</p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="text-red-700">{error}</p>
            <button onClick={clearMessages} className="text-red-500 hover:text-red-700">×</button>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="text-green-700">{success}</p>
            <button onClick={clearMessages} className="text-green-500 hover:text-green-700">×</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Account Category Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Account Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label
              className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                accountCategory === 'master'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="accountCategory"
                value="master"
                checked={accountCategory === 'master'}
                onChange={(e) => setAccountCategory(e.target.value)}
                className="sr-only"
              />
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <div className="font-medium text-gray-900">Master Account</div>
                <div className="text-sm text-gray-600">Primary account for a client profile</div>
              </div>
            </label>

            <label
              className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                accountCategory === 'client'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="accountCategory"
                value="client"
                checked={accountCategory === 'client'}
                onChange={(e) => setAccountCategory(e.target.value)}
                className="sr-only"
              />
              <CreditCard className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <div className="font-medium text-gray-900">Client Account</div>
                <div className="text-sm text-gray-600">Sub-account linked to a master account</div>
              </div>
            </label>
          </div>
        </div>

        {/* Basic Account Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Number *
              </label>
              <input
                type="text"
                required
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter unique account number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Name *
              </label>
              <input
                type="text"
                required
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter account name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type *
              </label>
              <select
                required
                value={formData.accountType}
                onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(ACCOUNT_TYPE_NAMES).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>

            {accountCategory === 'master' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custodian
                </label>
                <input
                  type="text"
                  value={formData.custodian}
                  onChange={(e) => setFormData({ ...formData, custodian: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter custodian name"
                />
              </div>
            )}
          </div>
        </div>

        {/* Client Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Client Assignment</h2>
          
          {/* Client Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search and Select Client *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by company name or SECDEX code..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value)
                  fetchClientProfiles()
                }}
                className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Client Selection List */}
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            {loadingClients ? (
              <div className="p-4 text-center text-gray-500">Loading clients...</div>
            ) : clientProfiles.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No clients found</div>
            ) : (
              clientProfiles.map((client) => (
                <label
                  key={client.id}
                  className={`flex items-center p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    formData.clientProfileId === client.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="clientProfile"
                    value={client.id}
                    checked={formData.clientProfileId === client.id}
                    onChange={() => handleClientSelect(client.id)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{client.companyName}</div>
                    <div className="text-sm text-gray-600">{client.secdexCode}</div>
                    <div className="text-xs text-gray-500">
                      {client.user?.firstName} {client.user?.lastName} • {client.user?.email}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {client.organization?.name}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Master Account Selection (for client accounts) */}
        {accountCategory === 'client' && formData.clientProfileId && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Master Account</h2>
            
            {loadingMasterAccounts ? (
              <div className="p-4 text-center text-gray-500">Loading master accounts...</div>
            ) : masterAccounts.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No master accounts found for this client. Please create a master account first.
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Master Account *
                </label>
                <select
                  required
                  value={formData.masterAccountId}
                  onChange={(e) => setFormData({ ...formData, masterAccountId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a master account...</option>
                  {masterAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountNumber} - {account.accountName} ({ACCOUNT_TYPE_NAMES[account.accountType]})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.clientProfileId || (accountCategory === 'client' && !formData.masterAccountId)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  )
}