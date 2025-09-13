'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { DataTable } from '@/components/ui/data-table'
import { Plus, Users, Building2, X } from 'lucide-react'

const ClientHierarchyBadge = ({ client }) => {
  if (client.level === 'L5_ADMIN') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
        <Building2 className="h-3 w-3 mr-1" />
        Admin
      </span>
    )
  }
  
  if (client.level === 'L4_AGENT') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
        <Users className="h-3 w-3 mr-1" />
        Agent
      </span>
    )
  }
  
  if (client.level === 'L2_CLIENT') {
    const subClientCount = client.subClients?.length || 0
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        <Users className="h-3 w-3 mr-1" />
        Client {subClientCount > 0 && `(${subClientCount} sub)`}
      </span>
    )
  }
  
  if (client.level === 'L3_SUBCLIENT') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
        Sub-Client
      </span>
    )
  }
  
  return null
}

const HierarchyColumn = ({ client }) => {
  return (
    <div className="space-y-1">
      <ClientHierarchyBadge client={client} />
      {client.parentClient && (
        <div className="text-xs text-gray-500">
          Parent: {client.parentClient.companyName || client.parentClient.secdexCode}
        </div>
      )}
      {client.organization && (
        <div className="text-xs text-gray-500">
          Org: {client.organization.name}
        </div>
      )}
    </div>
  )
}

export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    fetchClients()
    
    // Check if this is a welcome redirect
    if (searchParams.get('welcome') === 'true') {
      setShowWelcome(true)
    }
  }, [searchParams])

  const fetchClients = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/clients')
      if (!response.ok) {
        throw new Error('Failed to fetch clients')
      }
      const data = await response.json()
      setClients(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = (client) => {
    router.push(`/clients/${client.id}`)
  }

  const columns = [
    {
      key: 'secdexCode',
      label: 'SECDEX Code',
      sortable: true,
      render: (client) => (
        <Link 
          href={`/clients/${client.id}`}
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          {client.secdexCode || '-'}
        </Link>
      )
    },
    {
      key: 'companyName',
      label: 'Company Name',
      sortable: true,
      render: (client) => (
        <div>
          <div className="font-medium text-gray-900">
            {client.companyName || '-'}
          </div>
          {client.contactName && (
            <div className="text-sm text-gray-500">
              {client.contactName}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'user',
      label: 'User',
      sortable: false,
      render: (client) => (
        <div>
          {client.user ? (
            <>
              <div className="text-sm font-medium text-gray-900">
                {client.user.firstName} {client.user.lastName}
              </div>
              <div className="text-sm text-gray-500">
                {client.user.email}
              </div>
            </>
          ) : (
            <span className="text-gray-400">No user assigned</span>
          )}
        </div>
      )
    },
    {
      key: 'hierarchy',
      label: 'Hierarchy',
      sortable: false,
      render: (client) => <HierarchyColumn client={client} />
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
      render: (client) => client.phone || '-'
    },
    {
      key: 'city',
      label: 'Location',
      sortable: true,
      render: (client) => {
        const location = [client.city, client.state, client.country]
          .filter(Boolean)
          .join(', ')
        return location || '-'
      }
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (client) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          client.isActive 
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {client.isActive ? 'Active' : 'Inactive'}
        </span>
      )
    }
  ]

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Clients</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchClients}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        {showWelcome && (
          <div className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg rounded-lg">
            <div className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">
                      Welcome to Jesco Investment Reporting! 🎉
                    </h3>
                    <p className="mt-1 text-sm text-blue-100">
                      Your account has been successfully activated. You now have access to the full platform including 
                      client management, investment reporting, and portfolio analytics.
                    </p>
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-blue-100">
                        <strong>Next steps:</strong>
                      </p>
                      <ul className="text-xs text-blue-100 space-y-1">
                        <li>• Explore your client dashboard and available features</li>
                        <li>• Review your profile settings and contact information</li>
                        <li>• Contact support if you need any assistance getting started</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowWelcome(false)}
                  className="flex-shrink-0 text-blue-100 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage client profiles and view hierarchy relationships
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link
              href="/clients/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Client
            </Link>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Clients
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {clients.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Building2 className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Clients
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {clients.filter(c => c.isActive).length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        With Sub-Clients
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {clients.filter(c => c.subClients && c.subClients.length > 0).length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <DataTable
          data={clients}
          columns={columns}
          loading={loading}
          searchable={true}
          searchPlaceholder="Search by company name, SECDEX code, or contact..."
          filterable={true}
          filterOptions={[
            { value: 'L5_ADMIN', label: 'Admin', key: 'level' },
            { value: 'L4_AGENT', label: 'Agent', key: 'level' },
            { value: 'L2_CLIENT', label: 'Client', key: 'level' },
            { value: 'L3_SUBCLIENT', label: 'Sub-Client', key: 'level' },
            { value: true, label: 'Active', key: 'isActive' },
            { value: false, label: 'Inactive', key: 'isActive' }
          ]}
          filterPlaceholder="Filter by type..."
          onRowClick={handleRowClick}
          emptyMessage="No clients found"
          className="bg-white shadow"
        />
      </div>
    </div>
  )
}