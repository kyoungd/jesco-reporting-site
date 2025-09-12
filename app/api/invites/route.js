import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db as prisma } from '@/lib/db'
import { generateInviteToken, sendInvitationEmail } from '@/lib/email'

export async function POST(request) {
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

    // Check if email already exists
    const existingProfile = await prisma.clientProfile.findFirst({
      where: {
        OR: [
          { contactName: contactName, companyName: companyName },
          { 
            user: {
              email: email
            }
          }
        ]
      },
      include: { user: true }
    })

    if (existingProfile) {
      return NextResponse.json(
        { error: 'A profile with this email or company contact already exists' },
        { status: 400 }
      )
    }

    // Generate unique invite token
    const inviteToken = generateInviteToken()
    const inviteExpiry = new Date()
    inviteExpiry.setDate(inviteExpiry.getDate() + expiryDays)

    // Create user record
    const newUser = await prisma.user.create({
      data: {
        email: email,
        level: level,
        isActive: false,
        clientProfile: {
          create: {
            companyName: companyName,
            contactName: contactName,
            level: level,
            status: 'PENDING_ACTIVATION',
            inviteToken: inviteToken,
            inviteExpiry: inviteExpiry,
            invitedBy: `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email,
            isActive: false
          }
        }
      },
      include: {
        clientProfile: true
      }
    })

    // Send invitation email
    try {
      await sendInvitationEmail({
        email: email,
        contactName: contactName,
        companyName: companyName,
        inviteToken: inviteToken,
        invitedBy: `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email,
        expiryDate: inviteExpiry
      })
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError)
      
      // Clean up created user if email fails
      await prisma.user.delete({
        where: { id: newUser.id }
      })
      
      return NextResponse.json(
        { error: 'Failed to send invitation email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: newUser.clientProfile.id,
        companyName: companyName,
        contactName: contactName,
        email: email,
        level: level,
        inviteToken: inviteToken,
        expiryDate: inviteExpiry.toISOString()
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

    // Get all pending invitations
    const pendingInvitations = await prisma.clientProfile.findMany({
      where: {
        status: 'PENDING_ACTIVATION',
        inviteToken: {
          not: null
        }
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const invitations = pendingInvitations.map(profile => ({
      id: profile.id,
      companyName: profile.companyName,
      contactName: profile.contactName,
      email: profile.user?.email,
      level: profile.level,
      invitedBy: profile.invitedBy,
      createdAt: profile.createdAt,
      expiryDate: profile.inviteExpiry,
      expired: profile.inviteExpiry ? new Date() > profile.inviteExpiry : false
    }))

    return NextResponse.json({ invitations })

  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}