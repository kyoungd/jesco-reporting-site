'use client'

import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900">
          Jesco Investment Reporting
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign in to your account
        </p>
      </div>
      
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Invitation Required
              </h3>
              <div className="mt-1 text-sm text-blue-700">
                <p>
                  Access to Jesco Investment Reporting is by invitation only. 
                  If you have received an invitation email, please use the link provided to create your account first.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <SignIn 
            path="/sign-in" 
            routing="path" 
            signUpUrl="/sign-up"
            redirectUrl="/clients"
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
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Don't have an invitation?{' '}
            <a href="/" className="text-blue-600 hover:text-blue-500">
              Contact us for access
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}