'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import { 
  ArrowLeft, Edit2, Building2, CreditCard, User, MapPin, 
  Calendar, DollarSign, TrendingUp, Activity, Eye, EyeOff 
} from 'lucide-react'
import { ACCOUNT_TYPE_NAMES, ASSET_CLASS_NAMES, USER_LEVELS } from '@/lib/constants'

export default function AccountDetailPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const params = useParams()
  const { id } = params

  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isLoaded && id) {
      fetchAccount()
    }
  }, [isLoaded, id])

  const fetchAccount = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/accounts/${id}`)
      const data = await response.json()

      if (data.success) {
        setAccount(data.data)
      } else {
        setError(data.error || 'Failed to fetch account')
      }
    } catch (err) {
      setError('Error loading account')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const canEdit = () => {
    const userLevel = user?.publicMetadata?.level
    return userLevel === USER_LEVELS.L5_ADMIN || userLevel === USER_LEVELS.L4_AGENT
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (!isLoaded) {
    return <div className="p-8">Loading...</div>
  }

  if (loading) {
    return <div className="p-8">Loading account details...</div>
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">Account not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => router.back()}
            className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                {account.accountCategory === 'master' ? (
                  <Building2 className="h-6 w-6 text-blue-600" />
                ) : (
                  <CreditCard className="h-6 w-6 text-purple-600" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{account.accountName}</h1>
                <div className="flex items-center space-x-4 mt-1">
                  <span className="font-mono text-gray-600">{account.accountNumber}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    account.accountCategory === 'master' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {account.accountCategory === 'master' ? 'Master Account' : 'Client Account'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                    account.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {account.isActive ? (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {canEdit() && (
          <button
            onClick={() => router.push(`/accounts/${id}/edit`)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Account
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Account Information */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
            </div>
            <div className="px-6 py-4">
              <dl className="space-y-0">
                <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <dt className="text-sm font-medium text-gray-500">Account Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {ACCOUNT_TYPE_NAMES[account.accountType]}
                      </span>
                    </dd>
                  </div>
                </div>

                {account.accountCategory === 'master' && account.custodian && (
                  <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <dt className="text-sm font-medium text-gray-500">Custodian</dt>
                      <dd className="mt-1 text-sm text-gray-900">{account.custodian}</dd>
                    </div>
                  </div>
                )}

                {account.accountCategory === 'client' && account.masterAccount && (
                  <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <dt className="text-sm font-medium text-gray-500">Master Account</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <button
                          onClick={() => router.push(`/accounts/${account.masterAccount.id}`)}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {account.masterAccount.accountNumber} - {account.masterAccount.accountName}
                        </button>
                      </dd>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(account.createdAt)}</dd>
                  </div>
                </div>

                <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <dt className="text-sm font-medium text-gray-500">Last Modified</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(account.updatedAt)}</dd>
                  </div>
                </div>
              </dl>
            </div>
          </div>

          {/* Client Information */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Client Information</h3>
            </div>
            <div className="px-6 py-4">
              <dl className="space-y-0">
                <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                  <Building2 className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <dt className="text-sm font-medium text-gray-500">Company</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <button
                        onClick={() => router.push(`/clients/${account.clientProfile.id}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {account.clientProfile.companyName}
                      </button>
                    </dd>
                  </div>
                </div>

                <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <dt className="text-sm font-medium text-gray-500">SECDEX Code</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono">{account.clientProfile.secdexCode}</dd>
                  </div>
                </div>

                <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                  <User className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <dt className="text-sm font-medium text-gray-500">Primary Contact</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {account.clientProfile.user?.firstName} {account.clientProfile.user?.lastName}
                      <div className="text-gray-500">{account.clientProfile.user?.email}</div>
                    </dd>
                  </div>
                </div>

                {account.clientProfile.organization && (
                  <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <dt className="text-sm font-medium text-gray-500">Organization</dt>
                      <dd className="mt-1 text-sm text-gray-900">{account.clientProfile.organization.name}</dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Recent Transactions */}
          {account.transactions && account.transactions.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {account.transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {transaction.security?.symbol} - {transaction.transactionType}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(transaction.transactionDate)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {formatCurrency(transaction.amount)}
                        </div>
                        {transaction.quantity && (
                          <div className="text-sm text-gray-500">
                            {transaction.quantity} shares
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Statistics */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Account Statistics</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Transactions</div>
                  <div className="font-medium text-gray-900">{account._count?.transactions || 0}</div>
                </div>
              </div>

              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Active Positions</div>
                  <div className="font-medium text-gray-900">{account._count?.positions || 0}</div>
                </div>
              </div>

              {account.accountCategory === 'master' && (
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg mr-3">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Client Accounts</div>
                    <div className="font-medium text-gray-900">{account._count?.clientAccounts || 0}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Current Positions */}
          {account.positions && account.positions.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Current Positions</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {account.positions.slice(0, 5).map((position) => (
                  <div key={position.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{position.security?.symbol}</div>
                        <div className="text-sm text-gray-500">
                          {ASSET_CLASS_NAMES[position.security?.assetClass]}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {parseFloat(position.quantity).toLocaleString()} shares
                        </div>
                        <div className="text-sm text-gray-500">
                          Avg: {formatCurrency(position.averageCost)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-Accounts (for master accounts) */}
          {account.accountCategory === 'master' && account.clientAccounts && account.clientAccounts.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Client Accounts</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {account.clientAccounts.map((clientAccount) => (
                  <div key={clientAccount.id} className="px-6 py-4">
                    <button
                      onClick={() => router.push(`/accounts/${clientAccount.id}`)}
                      className="w-full text-left hover:bg-gray-50 -mx-6 -my-4 px-6 py-4"
                    >
                      <div className="font-medium text-gray-900">{clientAccount.accountName}</div>
                      <div className="text-sm text-gray-500 font-mono">{clientAccount.accountNumber}</div>
                      <div className="text-xs text-gray-400">
                        {clientAccount._count?.transactions || 0} transactions
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}