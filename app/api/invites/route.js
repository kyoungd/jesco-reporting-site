import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db as prisma } from '@/lib/db'

export async function POST(request) {
  console.log('🔥 INVITES API - POST REQUEST RECEIVED')
  
  try {
    const { userId } = auth()
    console.log('👤 Clerk User ID:', userId)
    
    if (!userId) {
      console.error('❌ UNAUTHORIZED: No user ID from Clerk auth')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current user to check permissions
    const currentUser = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { clientProfile: true }
    })

    if (!currentUser || !currentUser.clientProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Only L5_ADMIN and L4_AGENT can send invitations
    if (!['L5_ADMIN', 'L4_AGENT'].includes(currentUser.level)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to send invitations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      companyName,
      contactName,
      email,
      level = 'L2_CLIENT',
      expiryDays = 7
    } = body

    // Validate required fields
    if (!companyName || !contactName || !email) {
      return NextResponse.json(
        { error: 'Company name, contact name, and email are required' },
        { status: 400 }
      )
    }

    // Check if email already exists in our database
    const existingUser = await prisma.user.findFirst({
      where: { email: email },
      include: { clientProfile: true }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Check if there's already a pending Clerk invitation for this email
    try {
      const existingInvitations = await clerkClient.invitations.getInvitationList({
        status: 'pending'
      })
      
      const duplicateInvitation = existingInvitations.find(
        inv => inv.emailAddress === email
      )
      
      if (duplicateInvitation) {
        return NextResponse.json(
          { error: 'An invitation has already been sent to this email address' },
          { status: 400 }
        )
      }
    } catch (clerkError) {
      console.warn('Could not check existing invitations:', clerkError)
    }

    // Create Clerk invitation with metadata
    console.log('🔥 Creating Clerk invitation with metadata...')
    
    const invitedByName = `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email
    
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/sign-up`,
      publicMetadata: {
        // User level and profile information
        userLevel: level,
        companyName: companyName,
        contactName: contactName,
        invitedBy: invitedByName,
        invitedById: currentUser.id,
        // This will be used by the webhook to create the proper profile
        profileData: {
          level: level,
          companyName: companyName,
          contactName: contactName,
          status: 'PENDING_ACTIVATION'
        }
      }
    })
    
    console.log('✅ Clerk invitation created successfully:', {
      invitationId: invitation.id,
      email: invitation.emailAddress,
      status: invitation.status
    })

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        companyName: companyName,
        contactName: contactName,
        email: email,
        level: level,
        status: invitation.status,
        createdAt: invitation.createdAt
      }
    })

  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current user to check permissions
    const currentUser = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { clientProfile: true }
    })

    if (!currentUser || !currentUser.clientProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Only L5_ADMIN and L4_AGENT can view invitations
    if (!['L5_ADMIN', 'L4_AGENT'].includes(currentUser.level)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view invitations' },
        { status: 403 }
      )
    }

    // Get all pending invitations from Clerk
    const clerkInvitations = await clerkClient.invitations.getInvitationList({
      status: 'pending',
      limit: 50
    })

    const invitations = clerkInvitations.map(invitation => {
      const metadata = invitation.publicMetadata || {}
      return {
        id: invitation.id,
        companyName: metadata.companyName || '',
        contactName: metadata.contactName || '',
        email: invitation.emailAddress,
        level: metadata.userLevel || 'L2_CLIENT',
        invitedBy: metadata.invitedBy || 'Unknown',
        createdAt: invitation.createdAt,
        expiryDate: new Date(invitation.createdAt + (30 * 24 * 60 * 60 * 1000)), // 30 days from creation
        expired: false, // Clerk handles expiration automatically
        status: invitation.status
      }
    })

    return NextResponse.json({ invitations })

  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}