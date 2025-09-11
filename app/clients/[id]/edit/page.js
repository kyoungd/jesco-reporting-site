'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { FormWrapper, FormField } from '@/components/ui/form-wrapper'
import { clientProfileSchema } from '@/lib/validation'
import { USER_LEVELS, USER_LEVEL_NAMES } from '@/lib/constants'
import { ArrowLeftIcon, CalendarIcon, UserIcon } from 'lucide-react'

export default function EditClientPage() {
  const params = useParams()
  const router = useRouter()
  const [client, setClient] = useState(null)
  const [availableParents, setAvailableParents] = useState([])
  const [availableOrganizations, setAvailableOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (params.id) {
      fetchData()
    }
  }, [params.id])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch current client data
      const clientResponse = await fetch(`/api/clients/${params.id}`)
      if (!clientResponse.ok) {
        if (clientResponse.status === 404) {
          throw new Error('Client not found')
        } else if (clientResponse.status === 403) {
          throw new Error('You do not have permission to edit this client')
        } else {
          throw new Error('Failed to fetch client details')
        }
      }
      const clientData = await clientResponse.json()
      setClient(clientData)

      // Fetch available clients for parent selection
      const clientsResponse = await fetch('/api/clients')
      if (clientsResponse.ok) {
        const clients = await clientsResponse.json()
        // Filter for potential parents (L2_CLIENT level only, excluding self)
        const parentOptions = clients
          .filter(c => c.level === USER_LEVELS.L2_CLIENT && c.id !== params.id)
          .map(c => ({
            value: c.id,
            label: `${c.companyName || c.secdexCode} (${c.secdexCode})`
          }))
        setAvailableParents(parentOptions)
      }

      // TODO: Fetch organizations when that API is available
      setAvailableOrganizations([])
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data) => {
    const response = await fetch(`/api/clients/${params.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update client')
    }

    router.push(`/clients/${params.id}`)
  }

  const levelOptions = [
    { value: USER_LEVELS.L2_CLIENT, label: USER_LEVEL_NAMES[USER_LEVELS.L2_CLIENT] },
    { value: USER_LEVELS.L3_SUBCLIENT, label: USER_LEVEL_NAMES[USER_LEVELS.L3_SUBCLIENT] },
    { value: USER_LEVELS.L4_AGENT, label: USER_LEVEL_NAMES[USER_LEVELS.L4_AGENT] },
    { value: USER_LEVELS.L5_ADMIN, label: USER_LEVEL_NAMES[USER_LEVELS.L5_ADMIN] }
  ]

  const countryOptions = [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'AU', label: 'Australia' },
    { value: 'DE', label: 'Germany' },
    { value: 'FR', label: 'France' },
    { value: 'JP', label: 'Japan' }
  ]

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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href={`/clients/${client.id}`}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Client Details
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Client: {client.companyName || client.secdexCode}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Update client profile information
          </p>
        </div>

        {/* Last Modified Info */}
        {(client.updatedAt || client.updatedBy) && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <div className="flex items-start">
              <CalendarIcon className="h-5 w-5 text-blue-400 mt-0.5 mr-2" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Last Modified</p>
                {client.updatedAt && (
                  <p>Date: {new Date(client.updatedAt).toLocaleString()}</p>
                )}
                {client.updatedBy && (
                  <p>By: User ID {client.updatedBy}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white shadow rounded-lg p-6">
          <FormWrapper
            schema={clientProfileSchema.partial()}
            onSubmit={handleSubmit}
            submitText="Update Client"
            successMessage="Client updated successfully!"
            defaultValues={{
              userId: client.userId,
              organizationId: client.organizationId,
              parentClientId: client.parentClientId,
              level: client.level,
              secdexCode: client.secdexCode,
              companyName: client.companyName,
              contactName: client.contactName,
              phone: client.phone,
              address: client.address,
              city: client.city,
              state: client.state,
              zipCode: client.zipCode,
              country: client.country,
              isActive: client.isActive
            }}
          >
            {({ register, errors, watch, setValue }) => {
              const watchedLevel = watch('level')
              
              return (
                <>
                  {/* Basic Information */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          label="User ID"
                          name="userId"
                          placeholder="Enter Clerk user ID"
                          register={register}
                          error={errors.userId}
                          required
                          description="The Clerk user ID for this client profile"
                        />
                        
                        <FormField
                          label="Level"
                          name="level"
                          type="select"
                          options={levelOptions}
                          register={register}
                          error={errors.level}
                          required
                          description="User access level in the system"
                        />

                        <FormField
                          label="SECDEX Code"
                          name="secdexCode"
                          placeholder="Unique identifier"
                          register={register}
                          error={errors.secdexCode}
                          description="Unique identifier for this client"
                        />

                        <FormField
                          label="Active"
                          name="isActive"
                          type="checkbox"
                          register={register}
                          error={errors.isActive}
                        />
                      </div>
                    </div>

                    {/* Company Information */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Company Information
                      </h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <FormField
                            label="Company Name"
                            name="companyName"
                            placeholder="Enter company name"
                            register={register}
                            error={errors.companyName}
                          />
                        </div>

                        <FormField
                          label="Contact Name"
                          name="contactName"
                          placeholder="Enter primary contact name"
                          register={register}
                          error={errors.contactName}
                        />

                        <FormField
                          label="Phone"
                          name="phone"
                          type="tel"
                          placeholder="+1-555-123-4567"
                          register={register}
                          error={errors.phone}
                        />
                      </div>
                    </div>

                    {/* Address Information */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Address Information
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          label="Address"
                          name="address"
                          type="textarea"
                          placeholder="Enter street address"
                          register={register}
                          error={errors.address}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <FormField
                            label="City"
                            name="city"
                            placeholder="Enter city"
                            register={register}
                            error={errors.city}
                          />

                          <FormField
                            label="State/Province"
                            name="state"
                            placeholder="Enter state/province"
                            register={register}
                            error={errors.state}
                          />

                          <FormField
                            label="ZIP/Postal Code"
                            name="zipCode"
                            placeholder="Enter ZIP/postal code"
                            register={register}
                            error={errors.zipCode}
                          />
                        </div>

                        <div className="sm:w-1/3">
                          <FormField
                            label="Country"
                            name="country"
                            type="select"
                            options={countryOptions}
                            register={register}
                            error={errors.country}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hierarchy Information */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Hierarchy & Organization
                      </h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {(watchedLevel === USER_LEVELS.L3_SUBCLIENT || watchedLevel === USER_LEVELS.L2_CLIENT) && (
                          <FormField
                            label="Parent Client"
                            name="parentClientId"
                            type="select"
                            options={availableParents}
                            placeholder="Select parent client"
                            register={register}
                            error={errors.parentClientId}
                            description={
                              watchedLevel === USER_LEVELS.L3_SUBCLIENT 
                                ? "Required for sub-clients"
                                : "Optional for clients"
                            }
                          />
                        )}

                        {(watchedLevel === USER_LEVELS.L4_AGENT || watchedLevel === USER_LEVELS.L2_CLIENT) && (
                          <FormField
                            label="Organization"
                            name="organizationId"
                            type="select"
                            options={availableOrganizations}
                            placeholder="Select organization"
                            register={register}
                            error={errors.organizationId}
                            description="Organization this client belongs to"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )
            }}
          </FormWrapper>
        </div>
      </div>
    </div>
  )
}