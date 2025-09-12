'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SignUp, useAuth } from '@clerk/nextjs'

export default function SignUpPage() {
  const [inviteStatus, setInviteStatus] = useState('checking')
  const [inviteData, setInviteData] = useState(null)
  const [error, setError] = useState(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isSignedIn } = useAuth()
  
  const inviteToken = searchParams.get('invite_token')

  useEffect(() => {
    // If user is already signed in, redirect to clients
    if (isSignedIn) {
      router.push('/clients')
      return
    }

    // If no invite token, show error
    if (!inviteToken) {
      setInviteStatus('no_token')
      return
    }

    validateInviteToken()
  }, [inviteToken, isSignedIn, router])

  const validateInviteToken = async () => {
    try {
      const response = await fetch(`/api/invites/validate?token=${inviteToken}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid invitation token')
      }

      if (data.expired) {
        setInviteStatus('expired')
        return
      }

      setInviteData(data)
      setInviteStatus('valid')

    } catch (err) {
      setInviteStatus('invalid')
      setError(err.message)
    }
  }

  const getContent = () => {
    switch (inviteStatus) {
      case 'checking':
        return (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Validating invitation...</p>
          </div>
        )

      case 'no_token':
        return (
          <div className="text-center py-8">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Invitation Required
            </h2>
            <p className="text-gray-600 mb-4">
              Sign-up is by invitation only. Please use the invitation link from your email.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Return to Home
            </button>
          </div>
        )

      case 'expired':
        return (
          <div className="text-center py-8">
            <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Invitation Expired
            </h2>
            <p className="text-gray-600 mb-4">
              This invitation has expired. Please contact your administrator for a new invitation.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Return to Home
            </button>
          </div>
        )

      case 'invalid':
        return (
          <div className="text-center py-8">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Invalid Invitation
            </h2>
            <p className="text-gray-600 mb-4">
              {error || 'This invitation link is invalid or has been used already.'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Return to Home
            </button>
          </div>
        )

      case 'valid':
        return (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Valid Invitation
                  </h3>
                  <div className="mt-1 text-sm text-green-700">
                    {inviteData && (
                      <div>
                        <p><strong>Company:</strong> {inviteData.companyName}</p>
                        <p><strong>Contact:</strong> {inviteData.contactName}</p>
                        <p>You're invited to create your Jesco Investment Reporting account.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white">
              <SignUp 
                path="/sign-up" 
                routing="path" 
                signInUrl="/sign-in"
                redirectUrl="/clients?welcome=true"
                initialValues={{
                  emailAddress: inviteData?.email || ''
                }}
                appearance={{
                  elements: {
                    formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-sm normal-case',
                    card: 'shadow-none',
                    headerTitle: 'text-lg font-semibold text-gray-900',
                    headerSubtitle: 'text-sm text-gray-600',
                    socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
                    dividerLine: 'bg-gray-300',
                    dividerText: 'text-gray-500',
                    formFieldLabel: 'text-gray-700 text-sm font-medium',
                    formFieldInput: 'border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500',
                    footerActionText: 'text-gray-600',
                    footerActionLink: 'text-blue-600 hover:text-blue-500'
                  }
                }}
              />
            </div>
          </>
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
          Create your account
        </p>
      </div>
      
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {getContent()}
        </div>
      </div>
    </div>
  )
}