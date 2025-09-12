import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db as prisma } from '@/lib/db'

export async function POST(request) {
  try {
    const { userId: clerkUserId } = auth()
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { inviteToken } = body

    if (!inviteToken) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    // Find the client profile with this invite token
    const clientProfile = await prisma.clientProfile.findUnique({
      where: {
        inviteToken: inviteToken
      },
      include: {
        user: true
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
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    // Update user and client profile to activate
    const updatedUser = await prisma.user.update({
      where: {
        id: clientProfile.userId
      },
      data: {
        clerkUserId: clerkUserId,
        isActive: true,
        clientProfile: {
          update: {
            status: 'ACTIVE',
            clerkUserId: clerkUserId,
            activatedAt: now,
            inviteToken: null, // Clear the token after use
            inviteExpiry: null
          }
        }
      },
      include: {
        clientProfile: true
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        level: updatedUser.level,
        profile: {
          id: updatedUser.clientProfile.id,
          companyName: updatedUser.clientProfile.companyName,
          contactName: updatedUser.clientProfile.contactName,
          level: updatedUser.clientProfile.level,
          status: updatedUser.clientProfile.status
        }
      }
    })

  } catch (error) {
    console.error('Error activating invitation:', error)
    
    // Handle unique constraint violations (user already exists with this clerkUserId)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This account has already been activated' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}