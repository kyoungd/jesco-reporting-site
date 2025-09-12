'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

export default function InvitePage() {
  const [status, setStatus] = useState('validating')
  const [error, setError] = useState(null)
  const [inviteData, setInviteData] = useState(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isSignedIn } = useAuth()
  
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('No invitation token provided')
      return
    }

    // If user is already signed in, redirect to dashboard
    if (isSignedIn) {
      router.push('/clients')
      return
    }

    validateInvite()
  }, [token, isSignedIn, router])

  const validateInvite = async () => {
    try {
      const response = await fetch(`/api/invites/validate?token=${token}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid invitation')
      }

      if (data.expired) {
        setStatus('expired')
        return
      }

      setInviteData(data)
      setStatus('valid')
      
      // Redirect to sign-up with token
      setTimeout(() => {
        router.push(`/sign-up?invite_token=${token}`)
      }, 2000)

    } catch (err) {
      setStatus('error')
      setError(err.message)
    }
  }

  const getStatusContent = () => {
    switch (status) {
      case 'validating':
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Validating Invitation
            </h2>
            <p className="text-gray-600">
              Please wait while we verify your invitation...
            </p>
          </div>
        )

      case 'valid':
        return (
          <div className="text-center">
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Valid Invitation
            </h2>
            <p className="text-gray-600 mb-4">
              Welcome! You've been invited to join Jesco Investment Reporting.
            </p>
            {inviteData && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700">
                  <strong>Company:</strong> {inviteData.companyName}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Contact:</strong> {inviteData.contactName}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Invited by:</strong> {inviteData.invitedBy}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500">
              Redirecting you to complete your account setup...
            </p>
          </div>
        )

      case 'expired':
        return (
          <div className="text-center">
            <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Invitation Expired
            </h2>
            <p className="text-gray-600 mb-4">
              This invitation link has expired. Please contact your administrator for a new invitation.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Return to Home
            </button>
          </div>
        )

      case 'error':
        return (
          <div className="text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Invalid Invitation
            </h2>
            <p className="text-gray-600 mb-4">
              {error}
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Return to Home
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900">
          Jesco Investment Reporting
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Processing your invitation
        </p>
      </div>
      
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {getStatusContent()}
        </div>
      </div>
    </div>
  )
}