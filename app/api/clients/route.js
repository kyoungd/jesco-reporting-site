import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getViewableClients } from '@/lib/permissions'
import { clientProfileSchema, validateSchema } from '@/lib/validation'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get client IDs that this user can view
    const viewableClientIds = await getViewableClients(user)
    
    // Fetch the full client profiles
    const clients = await db.clientProfile.findMany({
      where: {
        id: { in: viewableClientIds }
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        parentClient: {
          select: {
            id: true,
            companyName: true,
            secdexCode: true
          }
        },
        subClients: {
          select: {
            id: true,
            companyName: true,
            secdexCode: true
          }
        }
      },
      orderBy: [
        { companyName: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate the request body
    const validation = validateSchema(clientProfileSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const data = validation.data

    // Auto-generate secdexCode if empty
    if (!data.secdexCode) {
      const timestamp = Date.now().toString().slice(-6)
      const random = Math.random().toString(36).substring(2, 5).toUpperCase()
      data.secdexCode = `CL${timestamp}${random}`
    }

    // For L2_CLIENT users, auto-set parent to self (if they have clientProfile)
    if (user.clientProfile?.level === 'L2_CLIENT' && !data.parentClientId) {
      data.parentClientId = user.clientProfile.id
    }

    // Create the client profile
    const newClient = await db.clientProfile.create({
      data,
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        parentClient: {
          select: {
            id: true,
            companyName: true,
            secdexCode: true
          }
        }
      }
    })

    // TODO: Log creation to audit
    console.log(`Client created: ${newClient.id} by user: ${user.id}`)

    return NextResponse.json(newClient, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}