'use client'

import { InputPageLayout } from '@/components/layout/input-page-layout'
import {
  CheckCircle,
  Building2,
  TrendingUp,
  DollarSign,
  ArrowRightLeft,
  AlertTriangle,
  BookOpen,
  Lightbulb
} from 'lucide-react'

export default function HelpPage() {

  return (
    <InputPageLayout
      title="System Help"
      description="Setup guides and workflow information for administrators and agents"
    >
      <div className="space-y-8">
        {/* Quick Start Guide */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Lightbulb className="h-6 w-6 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Quick Start Guide</h2>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Important: Data Setup Order
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>You must set up data in this specific order to ensure the system works correctly:</p>
                </div>
              </div>
            </div>
          </div>

          {/* Setup Order */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                  <span className="text-sm font-medium text-blue-600">1</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900">Securities</h3>
                </div>
                <p className="text-gray-600 mt-1">
                  Define what financial instruments can be traded (AAPL, MSFT, bonds, etc.).
                  These are the building blocks for all other data.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  <strong>Example:</strong> Add Apple Inc. (AAPL), Microsoft (MSFT), Treasury bonds
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                  <span className="text-sm font-medium text-blue-600">2</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-medium text-gray-900">Accounts</h3>
                </div>
                <p className="text-gray-600 mt-1">
                  Set up client investment accounts (IRAs, 401ks, taxable accounts, trusts).
                  These are the containers where transactions will occur.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  <strong>Example:</strong> "John Doe IRA", "Smith Family Trust", "Jane Doe Taxable"
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                  <span className="text-sm font-medium text-green-600">3</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                  <h3 className="text-lg font-medium text-gray-900">Prices (Optional)</h3>
                </div>
                <p className="text-gray-600 mt-1">
                  Enter market prices for securities. This provides reference data for valuations
                  and helps with transaction entry validation.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  <strong>Example:</strong> AAPL = $150.00, MSFT = $300.00
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                  <span className="text-sm font-medium text-green-600">4</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <ArrowRightLeft className="h-5 w-5 text-red-600" />
                  <h3 className="text-lg font-medium text-gray-900">Transactions</h3>
                </div>
                <p className="text-gray-600 mt-1">
                  Record actual trading activity. Each transaction must specify which account
                  and which security is involved.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  <strong>Example:</strong> "Buy 100 shares AAPL at $150 in John Doe IRA"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Real-World Workflow */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <BookOpen className="h-6 w-6 text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Real-World Workflow</h2>
          </div>

          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">1. Onboard New Client</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Create client profile in the system</li>
                <li>Set up their investment accounts (IRA, taxable, etc.)</li>
                <li>Configure account types and permissions</li>
              </ul>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">2. Set Up Securities Universe</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Add stocks, bonds, and other securities they can trade</li>
                <li>Include asset class, exchange, and basic information</li>
                <li>This creates the "menu" of available investments</li>
              </ul>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">3. Maintain Market Prices</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Enter current market prices for accurate valuations</li>
                <li>Use Price Series for historical data entry</li>
                <li>Helps validate transaction prices and calculate performance</li>
              </ul>
            </div>

            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">4. Process Client Activity</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Enter buy/sell orders as they occur</li>
                <li>Record dividends, interest, and fees</li>
                <li>Specify which account each transaction affects</li>
                <li>Post transactions to make them official</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Key Concepts */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Key Concepts</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Data Types</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-gray-900">Securities</h4>
                  <p className="text-sm text-gray-600">Master data defining what can be traded</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Prices</h4>
                  <p className="text-sm text-gray-600">Market reference data - same for everyone</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Accounts</h4>
                  <p className="text-sm text-gray-600">Client's investment containers (IRA, 401k, etc.)</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Transactions</h4>
                  <p className="text-sm text-gray-600">Actual buy/sell activity in specific accounts</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Why This Order Matters</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-gray-900">Dependencies</h4>
                  <p className="text-sm text-gray-600">Transactions need both securities and accounts to exist first</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Data Integrity</h4>
                  <p className="text-sm text-gray-600">Prevents orphaned records and maintains relationships</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">User Experience</h4>
                  <p className="text-sm text-gray-600">Dropdown menus populate correctly during transaction entry</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Compliance</h4>
                  <p className="text-sm text-gray-600">Ensures proper audit trails and regulatory reporting</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Common Issues</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">Empty Dropdowns in Transaction Entry</h3>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Problem:</strong> Security or Account dropdowns are empty<br/>
                <strong>Solution:</strong> Make sure you've created securities and accounts first
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Can't Enter Transactions</h3>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Problem:</strong> Transaction entry form won't accept data<br/>
                <strong>Solution:</strong> Check that both Security and Account fields are properly selected
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Missing Price Data</h3>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Problem:</strong> Portfolio valuations show zero or incorrect values<br/>
                <strong>Solution:</strong> Enter current market prices in the Prices section
              </p>
            </div>
          </div>
        </div>
      </div>
    </InputPageLayout>
  )
}