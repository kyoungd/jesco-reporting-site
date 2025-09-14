'use client'

import { useEffect, useState } from 'react'
import { Edit, BarChart3 } from 'lucide-react'
import { useAccount } from '@/lib/account-context'
import { useUser } from '@clerk/nextjs'

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useAccount()
  const { user } = useUser()
  const [userLevel, setUserLevel] = useState(null)

  // Fetch user level to determine permissions
  useEffect(() => {
    const fetchUserLevel = async () => {
      try {
        const response = await fetch('/api/user/profile')
        if (response.ok) {
          const data = await response.json()
          setUserLevel(data.user.level)
        }
      } catch (error) {
        console.error('Failed to fetch user level:', error)
      }
    }

    if (user) {
      fetchUserLevel()
    }
  }, [user])

  // Don't show toggle if user level not loaded or user is sub-client (only has reports)
  if (!userLevel || userLevel === 'L3_SUBCLIENT') {
    return null
  }

  // Only show Input mode for Agents and Admins
  const canViewInput = ['L5_ADMIN', 'L4_AGENT'].includes(userLevel)

  if (!canViewInput) {
    return null
  }

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setViewMode('input')}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'input'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Edit className="h-4 w-4" />
        <span>Input</span>
      </button>
      <button
        onClick={() => setViewMode('reports')}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'reports'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <BarChart3 className="h-4 w-4" />
        <span>Reports</span>
      </button>
    </div>
  )
}