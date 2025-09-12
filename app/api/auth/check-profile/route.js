import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db as prisma } from '@/lib/db'

export async function GET() {
  try {
    const { userId: clerkUserId } = auth()

    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find user profile by Clerk user ID
    const user = await prisma.user.findUnique({
      where: {
        clerkUserId: clerkUserId
      },
      include: {
        clientProfile: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    if (!user.clientProfile) {
      return NextResponse.json(
        { error: 'Client profile not found' },
        { status: 404 }
      )
    }

    // Check profile status
    if (user.clientProfile.status === 'PENDING_ACTIVATION') {
      return NextResponse.json(
        { 
          error: 'Profile pending activation',
          status: 'PENDING_ACTIVATION',
          companyName: user.clientProfile.companyName,
          contactName: user.clientProfile.contactName
        },
        { status: 403 }
      )
    }

    if (user.clientProfile.status === 'SUSPENDED') {
      return NextResponse.json(
        { 
          error: 'Profile suspended',
          status: 'SUSPENDED',
          companyName: user.clientProfile.companyName,
          contactName: user.clientProfile.contactName
        },
        { status: 403 }
      )
    }

    // Profile is active
    return NextResponse.json({
      success: true,
      status: 'ACTIVE',
      user: {
        id: user.id,
        email: user.email,
        level: user.level,
        profile: {
          id: user.clientProfile.id,
          companyName: user.clientProfile.companyName,
          contactName: user.clientProfile.contactName,
          level: user.clientProfile.level,
          status: user.clientProfile.status,
          activatedAt: user.clientProfile.activatedAt
        }
      }
    })

  } catch (error) {
    console.error('Error checking profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}