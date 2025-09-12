import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { canCreateReports } from '@/lib/permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BarChart, TrendingUp, PieChart, Receipt, FileText } from 'lucide-react'

export default async function ReportsPage() {
  const { userId } = auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      clientProfile: {
        include: {
          organization: true,
          parentClient: true,
          subClients: true
        }
      }
    }
  })

  if (!user || !canCreateReports(user)) {
    redirect('/dashboard')
  }

  const reportTypes = [
    {
      id: 'aum',
      title: 'Assets Under Management',
      description: 'View AUM calculations and historical trends',
      icon: BarChart,
      href: '/reports/aum',
      color: 'bg-blue-500'
    },
    {
      id: 'performance',
      title: 'Performance Reports',
      description: 'Time-weighted returns and performance analytics',
      icon: TrendingUp,
      href: '/reports/performance',
      color: 'bg-green-500'
    },
    {
      id: 'holdings',
      title: 'Holdings Reports',
      description: 'Current positions and asset allocation',
      icon: PieChart,
      href: '/reports/holdings',
      color: 'bg-purple-500'
    },
    {
      id: 'transactions',
      title: 'Transaction Reports',
      description: 'Transaction history and cash flow analysis',
      icon: Receipt,
      href: '/reports/transactions',
      color: 'bg-orange-500'
    }
  ]

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Reports Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          Generate and export various financial reports for your accounts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {reportTypes.map((report) => {
          const IconComponent = report.icon
          
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${report.color} text-white`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{report.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {report.description}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={report.href}>
                  <Button className="w-full">
                    Generate {report.title}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Report Access Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Your Access Level:</strong> {user.clientProfile.level}</p>
            <div>
              <strong>Available Reports:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All report types are available to your access level</li>
                <li>You can view data for accounts you have permissions to access</li>
                <li>Export functionality is available for all reports</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}