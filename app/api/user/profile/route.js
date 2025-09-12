import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        level: user.level,
        isActive: user.isActive,
        clerkUserId: user.clerkUserId,
        clientProfile: user.clientProfile ? {
          id: user.clientProfile.id,
          level: user.clientProfile.level,
          companyName: user.clientProfile.companyName,
          contactName: user.clientProfile.contactName,
          status: user.clientProfile.status,
          organizationId: user.clientProfile.organizationId,
          organization: user.clientProfile.organization,
          parentClient: user.clientProfile.parentClient,
          subClients: user.clientProfile.subClients
        } : null
      }
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}