'use client'

import { useRouter } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'

export default function VerifyEmailAddressPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900">
          Jesco Investment Reporting
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Verify your email address
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <SignUp
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            redirectUrl="/clients?welcome=true"
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
      </div>
    </div>
  )
}