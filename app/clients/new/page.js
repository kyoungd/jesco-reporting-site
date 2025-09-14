'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FormWrapper, FormField } from '@/components/ui/form-wrapper'
import { clientProfileSchema, clientInvitationSchema } from '@/lib/validation'
import { USER_LEVELS, USER_LEVEL_NAMES } from '@/lib/constants'
import { ArrowLeftIcon } from 'lucide-react'

export default function NewClientPage() {
  const [availableParents, setAvailableParents] = useState([])
  const [availableOrganizations, setAvailableOrganizations] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inviteMode, setInviteMode] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchFormData()
  }, [])

  const fetchFormData = async () => {
    try {
      setLoading(true)
      
      // Fetch available clients for parent selection (filtered by permissions)
      const clientsResponse = await fetch('/api/clients')
      if (clientsResponse.ok) {
        const clients = await clientsResponse.json()
        // Filter for potential parents (L2_CLIENT level only)
        const parentOptions = clients
          .filter(client => client.level === USER_LEVELS.L2_CLIENT)
          .map(client => ({
            value: client.id,
            label: `${client.companyName || client.secdexCode} (${client.secdexCode})`
          }))
        setAvailableParents(parentOptions)
      }

      // Fetch available organizations
      const orgsResponse = await fetch('/api/organizations')
      if (orgsResponse.ok) {
        const organizations = await orgsResponse.json()
        const orgOptions = organizations.map(org => ({
          value: org.id,
          label: `${org.name} - ${org.description}`
        }))
        setAvailableOrganizations(orgOptions)
      } else {
        console.warn('Failed to fetch organizations')
        setAvailableOrganizations([])
      }
      
      // TODO: Fetch current user info for default values
      // For now, we'll handle this in the form logic
      
    } catch (error) {
      console.error('Error fetching form data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data) => {
    console.log('🚀 FORM SUBMIT STARTED')
    console.log('📊 Form data received:', data)
    console.log('📧 Invite mode:', inviteMode)
    
    try {
      // Use invitation mode state
      if (inviteMode) {
        console.log('📨 INVITATION MODE - Preparing invitation data')
        
        const invitationPayload = {
          companyName: data.companyName,
          contactName: data.contactName,
          email: data.email,
          level: data.level,
          expiryDays: 7
        }
        
        console.log('📦 Invitation payload:', invitationPayload)
        
        // Validate required fields before sending
        if (!invitationPayload.email) {
          console.error('❌ VALIDATION ERROR: Email is required for invitation')
          throw new Error('Email is required for sending invitation')
        }
        if (!invitationPayload.companyName) {
          console.error('❌ VALIDATION ERROR: Company name is required for invitation')
          throw new Error('Company name is required for sending invitation')
        }
        if (!invitationPayload.contactName) {
          console.error('❌ VALIDATION ERROR: Contact name is required for invitation')
          throw new Error('Contact name is required for sending invitation')
        }
        
        console.log('✅ All required fields validated, sending invitation...')
        
        // Send invitation instead of creating client directly
        const response = await fetch('/api/invites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invitationPayload),
        })

        console.log('📡 API Response status:', response.status)
        console.log('📡 API Response ok:', response.ok)

        if (!response.ok) {
          const error = await response.json()
          console.error('❌ API ERROR:', error)
          throw new Error(error.error || 'Failed to send invitation')
        }

        const responseData = await response.json()
        console.log('✅ SUCCESS: Invitation sent successfully:', responseData)

        // Redirect to invitations list or show success message
        console.log('🔄 Redirecting to clients page with invited=true')
        router.push('/clients?invited=true')
      } else {
        console.log('👤 DIRECT CREATION MODE - Creating client directly')
        console.log('📦 Client data payload:', data)
        
        // Create client directly (existing functionality)
        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        })

        console.log('📡 API Response status:', response.status)
        console.log('📡 API Response ok:', response.ok)

        if (!response.ok) {
          const error = await response.json()
          console.error('❌ API ERROR:', error)
          throw new Error(error.error || 'Failed to create client')
        }

        const newClient = await response.json()
        console.log('✅ SUCCESS: Client created successfully:', newClient)
        
        console.log('🔄 Redirecting to client page:', `/clients/${newClient.id}`)
        router.push(`/clients/${newClient.id}`)
      }
    } catch (error) {
      console.error('💥 FORM SUBMISSION ERROR:', error)
      console.error('💥 Error message:', error.message)
      console.error('💥 Error stack:', error.stack)
      // Re-throw to let the form wrapper handle it
      throw error
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href="/clients"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Clients
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {inviteMode ? 'Send Client Invitation' : 'Create New Client'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {inviteMode 
              ? 'Send an invitation to a new client to join the platform'
              : 'Add a new client profile to the system'
            }
          </p>
          
          {/* Mode Toggle */}
          <div className="mt-4">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => setInviteMode(false)}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  !inviteMode 
                    ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Direct Creation
              </button>
              <button
                type="button"
                onClick={() => setInviteMode(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  inviteMode 
                    ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Send Invitation
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {inviteMode 
                ? 'Client will receive an email invitation to create their account'
                : 'Create the client profile directly with existing user credentials'
              }
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white shadow rounded-lg p-6">
          <FormWrapper
            schema={inviteMode ? clientInvitationSchema : clientProfileSchema}
            onSubmit={handleSubmit}
            submitText={inviteMode ? "Send Invitation" : "Create Client"}
            successMessage={inviteMode ? "Invitation sent successfully!" : "Client created successfully!"}
            defaultValues={{
              level: USER_LEVELS.L2_CLIENT,
              country: 'US',
              isActive: true,
              organizationId: availableOrganizations.find(org => org.label.includes('JESCO'))?.value || ''
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
                        {!inviteMode && (
                          <FormField
                            label="User ID"
                            name="userId"
                            placeholder="Enter Clerk user ID"
                            register={register}
                            error={errors.userId}
                            required
                            description="The Clerk user ID for this client profile"
                          />
                        )}
                        
                        {inviteMode && (
                          <FormField
                            label="Email Address"
                            name="email"
                            type="email"
                            placeholder="Enter email address"
                            register={register}
                            error={errors.email}
                            required
                            description="Email address to send the invitation to"
                          />
                        )}
                        
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
                          placeholder="Auto-generated if empty"
                          register={register}
                          error={errors.secdexCode}
                          description="Unique identifier (auto-generated if not provided)"
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