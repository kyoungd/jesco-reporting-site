import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { canViewClient, canEditClient } from '@/lib/permissions'
import { clientProfileSchema, validateSchema } from '@/lib/validation'
import { db } from '@/lib/db'

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // Check if user can view this client
    if (!canViewClient(user, id)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Fetch the client profile
    const client = await db.clientProfile.findUnique({
      where: { id },
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
            secdexCode: true,
            level: true
          }
        }
      }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // Check if user can edit this client
    if (!canEditClient(user, id)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate the request body
    const validation = validateSchema(clientProfileSchema.partial(), body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const data = validation.data

    // Get current client for audit logging
    const currentClient = await db.clientProfile.findUnique({
      where: { id },
      select: { 
        id: true, 
        companyName: true,
        updatedAt: true,
        updatedBy: true
      }
    })

    if (!currentClient) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Update the client profile
    const updatedClient = await db.clientProfile.update({
      where: { id },
      data: {
        ...data,
        updatedBy: user.id,
        updatedAt: new Date()
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
            secdexCode: true,
            level: true
          }
        }
      }
    })

    // TODO: Log changes to audit
    console.log(`Client updated: ${id} by user: ${user.id}`)

    return NextResponse.json(updatedClient)
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // Check if user can edit this client (same permission as edit for delete)
    if (!canEditClient(user, id)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Check if client exists
    const client = await db.clientProfile.findUnique({
      where: { id },
      include: {
        subClients: true
      }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Check if client has sub-clients (prevent deletion if so)
    if (client.subClients && client.subClients.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete client with sub-clients' },
        { status: 400 }
      )
    }

    // Delete the client profile
    await db.clientProfile.delete({
      where: { id }
    })

    // TODO: Log deletion to audit
    console.log(`Client deleted: ${id} by user: ${user.id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}