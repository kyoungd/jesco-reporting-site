'use client'

import { useAccount } from '@/lib/account-context'
import Link from 'next/link'
import {
  Edit,
  BarChart,
  TrendingUp,
  PieChart,
  Receipt,
  ArrowRightLeft,
  Building2,
  DollarSign,
  TrendingDown,
  Plus,
  Settings
} from 'lucide-react'

export function NavigationMenu() {
  const { viewMode, selectedAccount } = useAccount()

  if (!selectedAccount) {
    return (
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-gray-500 text-center">Please select an account to view navigation options</p>
        </div>
      </div>
    )
  }

  const inputMenuItems = [
    {
      name: 'Transaction Entry',
      href: '/transactions/entry',
      icon: ArrowRightLeft,
      description: 'Enter buy, sell, dividend, and other transactions'
    },
    {
      name: 'Transactions',
      href: '/transactions',
      icon: Receipt,
      description: 'View and manage transaction history'
    },
    {
      name: 'Accounts',
      href: '/accounts',
      icon: Building2,
      description: 'Manage client accounts and account setup'
    },
    {
      name: 'Securities',
      href: '/securities',
      icon: TrendingUp,
      description: 'Manage securities master data'
    },
    {
      name: 'Prices',
      href: '/prices',
      icon: DollarSign,
      description: 'View and manage security prices'
    },
    {
      name: 'Price Series',
      href: '/prices/series',
      icon: BarChart,
      description: 'Manage price series and historical data'
    }
  ]

  const reportsMenuItems = [
    {
      name: 'Reports Dashboard',
      href: '/reports',
      icon: Settings,
      description: 'Main reports overview and dashboard'
    },
    {
      name: 'Assets Under Management',
      href: '/reports/aum',
      icon: BarChart,
      description: 'View AUM calculations and historical trends'
    },
    {
      name: 'Performance Reports',
      href: '/reports/performance',
      icon: TrendingUp,
      description: 'Time-weighted returns and performance analytics'
    },
    {
      name: 'Holdings Reports',
      href: '/reports/holdings',
      icon: PieChart,
      description: 'Current positions and asset allocation'
    },
    {
      name: 'Transaction Reports',
      href: '/reports/transactions',
      icon: Receipt,
      description: 'Transaction history and cash flow analysis'
    },
    {
      name: 'PDF Reports',
      href: '/reports/pdf',
      icon: Edit,
      description: 'Generate and export PDF reports'
    }
  ]

  const menuItems = viewMode === 'input' ? inputMenuItems : reportsMenuItems
  const title = viewMode === 'input' ? 'Input & Data Management' : 'Reports & Analytics'
  const subtitle = viewMode === 'input'
    ? 'Enter and manage data for the selected account'
    : 'Generate reports and view analytics for the selected account'

  return (
    <div className="bg-white border-b border-gray-200 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
            </div>
            <div className="text-sm text-gray-500">
              Selected: <span className="font-medium text-gray-900">
                {selectedAccount.companyName || selectedAccount.secdexCode}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {menuItems.map((item) => {
            const IconComponent = item.icon

            return (
              <Link
                key={item.name}
                href={item.href}
                className="group p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <IconComponent className="h-5 w-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 group-hover:text-blue-700">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}