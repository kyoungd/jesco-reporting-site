/**
 * PDF Generation Page - NEW ROUTE at /reports/pdf
 * 
 * CONSTRAINTS:
 * - Import getViewableClients from '/lib/permissions' - USE EXISTING
 * - Import canViewClient from '/lib/permissions' - USE EXISTING  
 * - DO NOT recreate permission logic
 * - UI elements only: client dropdown, quarter selector, year input, generate button
 */

import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getUserWithProfile } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileDown, FileText, Calendar, Building } from 'lucide-react'
import PDFPreview from '@/components/reports/pdf-preview'

// USE EXISTING functions - DO NOT RECREATE
import { canViewClient } from '@/lib/permissions'

const prisma = new PrismaClient()

export default async function PDFPage() {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  // Get user with profile using EXISTING function
  const user = await getUserWithProfile(userId)
  
  if (!user) {
    redirect('/sign-in')
  }

  // Get all active clients
  const allClients = await prisma.clientProfile.findMany({
    where: { isActive: true },
    select: {
      id: true,
      companyName: true,
      contactName: true,
      level: true
    },
    orderBy: [
      { companyName: 'asc' },
      { contactName: 'asc' }
    ]
  })

  // Filter clients using EXISTING permission function - DO NOT RECREATE
  const viewableClients = allClients.filter(client => 
    canViewClient(user, client.id)
  )

  // Get current year for default
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">PDF Report Generation</h1>
          <p className="text-gray-600 mt-2">
            Generate quarterly investment reports and statements for your clients
          </p>
        </div>
        <FileDown className="h-8 w-8 text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PDF Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {viewableClients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No clients available for PDF generation</p>
                <p className="text-sm">Contact your administrator for access</p>
              </div>
            ) : (
              <PDFPreview 
                clients={viewableClients} 
                defaultQuarter={currentQuarter}
                defaultYear={currentYear}
              />
            )}
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Report Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Quarterly Reports Include:</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                  <span>Executive summary of portfolio performance</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                  <span>Assets Under Management (AUM) analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                  <span>Time-weighted return calculations</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                  <span>Detailed holdings breakdown</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                  <span>Asset class allocation analysis</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Available Report Types:</h3>
              <div className="space-y-3">
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm">Quarterly Report</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Comprehensive quarterly investment analysis with performance metrics, 
                    holdings details, and executive summary.
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm">Simple Statement</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Basic client statement with essential information and 
                    current portfolio overview.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Access Permissions</h4>
              <p className="text-sm text-blue-700">
                You can generate reports for {viewableClients.length} client{viewableClients.length !== 1 ? 's' : ''} 
                based on your current access level.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              disabled={viewableClients.length === 0}
            >
              <Calendar className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Current Quarter</div>
                <div className="text-sm text-gray-500">Q{currentQuarter} {currentYear}</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              disabled={viewableClients.length === 0}
            >
              <FileText className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Previous Quarter</div>
                <div className="text-sm text-gray-500">
                  Q{currentQuarter === 1 ? 4 : currentQuarter - 1} {currentQuarter === 1 ? currentYear - 1 : currentYear}
                </div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              disabled={viewableClients.length === 0}
            >
              <Building className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">All Clients</div>
                <div className="text-sm text-gray-500">Batch Generation</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}