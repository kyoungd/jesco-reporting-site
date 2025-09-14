'use client'

import { useUser, UserButton } from '@clerk/nextjs'
import { AccountSelector } from './account-selector'
import { ViewModeToggle } from './view-mode-toggle'

export function AccountHeader() {
  const { isLoaded, user } = useUser()

  if (!isLoaded) {
    return (
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                Jesco Investment Reporting
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-32 h-8 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </header>
    )
  }

  if (!user) {
    return null
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">
              Jesco Investment Reporting
            </h1>
          </div>

          {/* Account Context Controls */}
          <div className="flex items-center space-x-4">
            <AccountSelector />
            <ViewModeToggle />
            <div className="border-l border-gray-200 pl-4">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}