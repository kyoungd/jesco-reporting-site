/**
 * PDF Generation API Route
 * 
 * CONSTRAINTS:
 * - USE EXISTING permission functions from /lib/permissions
 * - USE EXISTING audit functions from /lib/audit
 * - DO NOT recreate permission logic
 * - DO NOT modify existing functions
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'

// USE EXISTING functions - DO NOT RECREATE
import { canViewClient } from '@/lib/permissions'
import { logToAxiom } from '@/lib/audit'
import { getUserWithProfile } from '@/lib/auth'
import { createQuarterlyPack, createSimpleStatement } from '@/lib/pdf/generator'

const prisma = new PrismaClient()

/**
 * Generate PDF report
 */
export async function POST(request) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get request body
    const body = await request.json()
    const { clientId, quarter, year, reportType = 'quarterly' } = body

    // Validate required parameters
    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing required parameter: clientId' },
        { status: 400 }
      )
    }

    if (reportType === 'quarterly' && (!quarter || !year)) {
      return NextResponse.json(
        { error: 'Missing required parameters: quarter and year for quarterly report' },
        { status: 400 }
      )
    }

    // Get user with profile using EXISTING function
    const user = await getUserWithProfile(userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check permission using EXISTING function - DO NOT RECREATE
    if (!canViewClient(user, clientId)) {
      await logToAxiom('pdf_access_denied', userId, {
        clientId,
        reportType,
        quarter,
        year
      })
      
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify client exists
    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { id: true, companyName: true, contactName: true }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Generate PDF based on report type
    let pdfBuffer
    let filename
    
    if (reportType === 'quarterly') {
      pdfBuffer = await createQuarterlyPack(clientId, quarter, year)
      const clientName = client.companyName || client.contactName || 'Client'
      filename = `${clientName}-Q${quarter}-${year}-Report.pdf`
    } else if (reportType === 'simple') {
      pdfBuffer = await createSimpleStatement(clientId)
      const clientName = client.companyName || client.contactName || 'Client'
      filename = `${clientName}-Statement.pdf`
    } else {
      return NextResponse.json(
        { error: 'Invalid report type' },
        { status: 400 }
      )
    }

    // Log successful PDF generation using EXISTING function
    await logToAxiom('pdf_generated', userId, {
      clientId,
      reportType,
      quarter,
      year,
      clientName: client.companyName || client.contactName,
      fileSize: pdfBuffer.byteLength
    })

    // Return PDF as response
    const response = new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

    return response

  } catch (error) {
    console.error('PDF generation error:', error)
    
    // Log error
    try {
      const { userId } = await auth()
      if (userId) {
        await logToAxiom('pdf_generation_error', userId, {
          error: error.message,
          stack: error.stack
        })
      }
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

/**
 * Get available clients for PDF generation
 */
export async function GET(request) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user with profile using EXISTING function
    const user = await getUserWithProfile(userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get all clients
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

    return NextResponse.json({
      clients: viewableClients.map(client => ({
        id: client.id,
        name: client.companyName || client.contactName || 'Unnamed Client',
        level: client.level
      }))
    })

  } catch (error) {
    console.error('Error fetching clients for PDF:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint for PDF generation
 */
export async function HEAD(request) {
  try {
    // Simple health check - verify PDF library is available
    const jsPDF = await import('jspdf')
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-PDF-Status': 'available',
        'X-Service': 'pdf-generator'
      }
    })
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-PDF-Status': 'unavailable',
        'X-Error': error.message
      }
    })
  }
}