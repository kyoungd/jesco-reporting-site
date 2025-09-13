'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Edit, 
  Users, 
  Building2,
  Phone,
  MapPin,
  Mail,
  Calendar
} from 'lucide-react'
import { USER_LEVEL_NAMES } from '@/lib/constants'

const InfoRow = ({ label, value, icon: Icon }) => (
  <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
    {Icon && <Icon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />}
    <div className="flex-1 min-w-0">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 break-words">
        {value || '-'}
      </dd>
    </div>
  </div>
)

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
    active 
      ? 'bg-green-100 text-green-800 border border-green-200'
      : 'bg-red-100 text-red-800 border border-red-200'
  }`}>
    {active ? 'Active' : 'Inactive'}
  </span>
)

const LevelBadge = ({ level }) => {
  const configs = {
    'L5_ADMIN': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    'L4_AGENT': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    'L2_CLIENT': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    'L3_SUBCLIENT': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
  }
  
  const config = configs[level] || configs['L3_SUBCLIENT']
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ${config.border}`}>
      {USER_LEVEL_NAMES[level] || level}
    </span>
  )
}

export default function ClientDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (params.id) {
      fetchClient()
    }
  }, [params.id])

  const fetchClient = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/clients/${params.id}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Client not found')
        } else if (response.status === 403) {
          throw new Error('You do not have permission to view this client')
        } else {
          throw new Error('Failed to fetch client details')
        }
      }
      
      const data = await response.json()
      setClient(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            href="/clients"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Clients
          </Link>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Client Not Found</h2>
          <Link
            href="/clients"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Clients
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href="/clients"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Clients
            </Link>
          </div>
          
          <div className="sm:flex sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {client.companyName || 'Client Profile'}
              </h1>
              <div className="mt-2 flex items-center space-x-3">
                <LevelBadge level={client.level} />
                <StatusBadge active={client.isActive} />
                {client.secdexCode && (
                  <span className="text-sm text-gray-500">
                    Code: {client.secdexCode}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 sm:mt-0">
              <Link
                href={`/clients/${client.id}/edit`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Client
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-8">
            {/* Basic Information */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
              </div>
              <div className="px-6 py-4">
                <dl className="space-y-0">
                  <InfoRow 
                    label="Company Name" 
                    value={client.companyName}
                    icon={Building2}
                  />
                  <InfoRow 
                    label="Contact Name" 
                    value={client.contactName}
                    icon={Users}
                  />
                  <InfoRow 
                    label="SECDEX Code" 
                    value={client.secdexCode}
                  />
                  <InfoRow 
                    label="Level" 
                    value={USER_LEVEL_NAMES[client.level] || client.level}
                  />
                </dl>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>
              </div>
              <div className="px-6 py-4">
                <dl className="space-y-0">
                  <InfoRow 
                    label="Phone" 
                    value={client.phone}
                    icon={Phone}
                  />
                  {client.user && (
                    <InfoRow 
                      label="Email" 
                      value={client.user.email}
                      icon={Mail}
                    />
                  )}
                  <InfoRow 
                    label="Address" 
                    value={client.address}
                    icon={MapPin}
                  />
                  <InfoRow 
                    label="City" 
                    value={client.city}
                  />
                  <InfoRow 
                    label="State/Province" 
                    value={client.state}
                  />
                  <InfoRow 
                    label="ZIP/Postal Code" 
                    value={client.zipCode}
                  />
                  <InfoRow 
                    label="Country" 
                    value={client.country}
                  />
                </dl>
              </div>
            </div>

            {/* User Account */}
            {client.user && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">User Account</h3>
                </div>
                <div className="px-6 py-4">
                  <dl className="space-y-0">
                    <InfoRow 
                      label="Name" 
                      value={`${client.user.firstName} ${client.user.lastName}`}
                      icon={Users}
                    />
                    <InfoRow 
                      label="Email" 
                      value={client.user.email}
                      icon={Mail}
                    />
                  </dl>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Hierarchy */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Hierarchy</h3>
              </div>
              <div className="px-6 py-4">
                {client.organization && (
                  <div className="mb-4">
                    <dt className="text-sm font-medium text-gray-500">Organization</dt>
                    <dd className="mt-1">
                      <Link 
                        href={`/organizations/${client.organization.id}`}
                        className="text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        {client.organization.name}
                      </Link>
                    </dd>
                  </div>
                )}

                {client.parentClient && (
                  <div className="mb-4">
                    <dt className="text-sm font-medium text-gray-500">Parent Client</dt>
                    <dd className="mt-1">
                      <Link 
                        href={`/clients/${client.parentClient.id}`}
                        className="text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        {client.parentClient.companyName || client.parentClient.secdexCode}
                      </Link>
                    </dd>
                  </div>
                )}

                {client.subClients && client.subClients.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">
                      Sub-Clients ({client.subClients.length})
                    </dt>
                    <dd className="space-y-2">
                      {client.subClients.map((subClient) => (
                        <div key={subClient.id} className="flex items-center justify-between">
                          <Link 
                            href={`/clients/${subClient.id}`}
                            className="text-sm text-indigo-600 hover:text-indigo-500"
                          >
                            {subClient.companyName || subClient.secdexCode}
                          </Link>
                          <LevelBadge level={subClient.level} />
                        </div>
                      ))}
                    </dd>
                  </div>
                )}

                {!client.organization && !client.parentClient && (!client.subClients || client.subClients.length === 0) && (
                  <p className="text-sm text-gray-500 italic">No hierarchy relationships</p>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Metadata</h3>
              </div>
              <div className="px-6 py-4">
                <dl className="space-y-0">
                  <InfoRow 
                    label="Created" 
                    value={client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '-'}
                    icon={Calendar}
                  />
                  <InfoRow 
                    label="Last Updated" 
                    value={client.updatedAt ? new Date(client.updatedAt).toLocaleDateString() : '-'}
                    icon={Calendar}
                  />
                  <InfoRow 
                    label="Status" 
                    value={<StatusBadge active={client.isActive} />}
                  />
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}