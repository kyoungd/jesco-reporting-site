'use client'

import { SignOutButton } from '@clerk/nextjs'

export default function PendingActivationPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900">
          Jesco Investment Reporting
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Account activation pending
        </p>
      </div>
      
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Account Pending Activation
            </h2>
            
            <p className="text-gray-600 mb-4">
              Your account has been created but is still pending activation. 
              A system administrator needs to approve your access before you can use the platform.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-800 mb-2">
                What happens next?
              </h3>
              <ul className="text-sm text-gray-600 space-y-1 text-left">
                <li>• Your invitation has been received and processed</li>
                <li>• An administrator will review your request</li>
                <li>• You'll receive an email when your account is activated</li>
                <li>• Once activated, you can access all platform features</li>
              </ul>
            </div>
            
            <div className="border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-500 mb-4">
                If you have questions about your account status, please contact support at{' '}
                <a href="mailto:support@jesco.com" className="text-blue-600 hover:text-blue-500">
                  support@jesco.com
                </a>
              </p>
              
              <SignOutButton>
                <button className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  Sign Out
                </button>
              </SignOutButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}