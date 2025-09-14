'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AccountHeader } from '@/components/account/account-header'
import { useAccount } from '@/lib/account-context'

export function InputPageLayout({ title, description, children }) {
  const router = useRouter()
  const { selectedAccount } = useAccount()

  const handleBackClick = () => {
    // Navigate back to clients page which shows the navigation menu
    router.push('/clients')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AccountHeader />

      {/* Page Header with Back Button */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackClick}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back to Menu</span>
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                {description && (
                  <p className="text-sm text-gray-600 mt-1">{description}</p>
                )}
              </div>
            </div>

            {/* Selected Account Info */}
            {selectedAccount && (
              <div className="text-sm text-gray-500">
                Working with: <span className="font-medium text-gray-900">
                  {selectedAccount.companyName || selectedAccount.secdexCode}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  )
}