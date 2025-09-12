import { NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    // Find client profile with this invite token
    const clientProfile = await prisma.clientProfile.findUnique({
      where: {
        inviteToken: token
      }
    })

    if (!clientProfile) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      )
    }

    // Check if already activated
    if (clientProfile.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Invitation has already been used' },
        { status: 400 }
      )
    }

    // Check if expired
    const now = new Date()
    if (clientProfile.inviteExpiry && clientProfile.inviteExpiry < now) {
      return NextResponse.json(
        { 
          error: 'Invitation has expired',
          expired: true
        },
        { status: 400 }
      )
    }

    // Return invitation details
    return NextResponse.json({
      valid: true,
      expired: false,
      companyName: clientProfile.companyName,
      contactName: clientProfile.contactName,
      invitedBy: clientProfile.invitedBy,
      level: clientProfile.level
    })

  } catch (error) {
    console.error('Error validating invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}