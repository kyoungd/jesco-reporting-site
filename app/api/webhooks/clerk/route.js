import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req) {
  // Get the headers
  const headerPayload = headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    )
  }

  // Get the body
  const payload = await req.text()
  const body = JSON.parse(payload)

  // Get the Webhook secret
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    })
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Handle the webhook
  const { id } = evt.data
  const eventType = evt.type

  console.log(`📧 Clerk Webhook: ${eventType}`, { userId: id })

  try {
    if (eventType === 'user.created') {
      await handleUserCreated(evt.data)
    } else if (eventType === 'user.updated') {
      await handleUserUpdated(evt.data)
    } else if (eventType === 'user.deleted') {
      await handleUserDeleted(evt.data)
    } else {
      console.log(`Unhandled webhook event type: ${eventType}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error processing webhook ${eventType}:`, error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleUserCreated(userData) {
  const { 
    id: clerkUserId, 
    email_addresses, 
    first_name, 
    last_name,
    public_metadata,
    created_via_invitation 
  } = userData
  
  console.log('🆕 Processing user.created webhook', {
    clerkUserId,
    email: email_addresses?.[0]?.email_address,
    name: `${first_name} ${last_name}`.trim(),
    createdViaInvitation: created_via_invitation,
    hasMetadata: !!public_metadata
  })

  try {
    // Check if user already exists in our database
    const existingUser = await db.user.findUnique({
      where: { clerkUserId },
      include: { clientProfile: true }
    })

    if (existingUser) {
      console.log('✅ User already exists in database:', existingUser.email)
      return
    }

    const primaryEmail = email_addresses?.[0]?.email_address
    if (!primaryEmail) {
      console.error('❌ No primary email found for user')
      return
    }

    // If user was created via invitation, use the metadata from the invitation
    if (created_via_invitation && public_metadata?.profileData) {
      const profileData = public_metadata.profileData
      const userLevel = public_metadata.userLevel || 'L2_CLIENT'
      
      console.log('📧 Creating user from invitation metadata:', {
        email: primaryEmail,
        level: userLevel,
        companyName: profileData.companyName,
        contactName: profileData.contactName
      })

      const newUser = await db.user.create({
        data: {
          clerkUserId,
          email: primaryEmail,
          firstName: first_name || '',
          lastName: last_name || '',
          level: userLevel,
          isActive: true,
          clientProfile: {
            create: {
              level: userLevel,
              companyName: profileData.companyName || null,
              contactName: profileData.contactName || `${first_name} ${last_name}`.trim() || primaryEmail,
              status: 'ACTIVE',
              activatedAt: new Date(),
              clerkUserId
            }
          }
        },
        include: { clientProfile: true }
      })

      console.log('✅ Created user from invitation:', {
        id: newUser.id,
        email: newUser.email,
        level: newUser.level,
        companyName: newUser.clientProfile?.companyName,
        status: newUser.clientProfile?.status
      })
    } else {
      // Check for existing pending user (legacy support for old system)
      const pendingUser = await db.user.findFirst({
        where: {
          email: primaryEmail,
          isActive: false
        },
        include: { clientProfile: true }
      })

      if (pendingUser) {
        // Update the existing pending user with Clerk ID and activate them
        const updatedUser = await db.user.update({
          where: { id: pendingUser.id },
          data: {
            clerkUserId,
            firstName: first_name || pendingUser.firstName,
            lastName: last_name || pendingUser.lastName,
            isActive: true,
            clientProfile: {
              update: {
                status: 'ACTIVE',
                activatedAt: new Date(),
                clerkUserId
              }
            }
          },
          include: { clientProfile: true }
        })

        console.log('✅ Activated existing pending user:', {
          id: updatedUser.id,
          email: updatedUser.email,
          level: updatedUser.level,
          status: updatedUser.clientProfile?.status
        })
      } else {
        // Create a new user with default settings (not invited)
        const newUser = await db.user.create({
          data: {
            clerkUserId,
            email: primaryEmail,
            firstName: first_name || '',
            lastName: last_name || '',
            level: 'L2_CLIENT', // Default level
            isActive: true,
            clientProfile: {
              create: {
                level: 'L2_CLIENT',
                contactName: `${first_name} ${last_name}`.trim() || primaryEmail,
                status: 'ACTIVE',
                activatedAt: new Date(),
                clerkUserId
              }
            }
          },
          include: { clientProfile: true }
        })

        console.log('✅ Created new default user:', {
          id: newUser.id,
          email: newUser.email,
          level: newUser.level,
          status: newUser.clientProfile?.status
        })
      }
    }
  } catch (error) {
    console.error('❌ Error handling user.created:', error)
    throw error
  }
}

async function handleUserUpdated(userData) {
  const { id: clerkUserId, email_addresses, first_name, last_name } = userData
  
  console.log('📝 Processing user.updated webhook', {
    clerkUserId,
    email: email_addresses?.[0]?.email_address
  })

  try {
    const user = await db.user.findUnique({
      where: { clerkUserId }
    })

    if (!user) {
      console.log('⚠️ User not found for update:', clerkUserId)
      return
    }

    // Update user information
    await db.user.update({
      where: { clerkUserId },
      data: {
        email: email_addresses?.[0]?.email_address || user.email,
        firstName: first_name || user.firstName,
        lastName: last_name || user.lastName,
      }
    })

    console.log('✅ Updated user:', clerkUserId)
  } catch (error) {
    console.error('❌ Error handling user.updated:', error)
    throw error
  }
}

async function handleUserDeleted(userData) {
  const { id: clerkUserId } = userData
  
  console.log('🗑️ Processing user.deleted webhook', { clerkUserId })

  try {
    const user = await db.user.findUnique({
      where: { clerkUserId }
    })

    if (!user) {
      console.log('⚠️ User not found for deletion:', clerkUserId)
      return
    }

    // Mark user as inactive instead of deleting to preserve data
    await db.user.update({
      where: { clerkUserId },
      data: {
        isActive: false,
        clientProfile: {
          update: {
            status: 'SUSPENDED'
          }
        }
      }
    })

    console.log('✅ Deactivated user:', clerkUserId)
  } catch (error) {
    console.error('❌ Error handling user.deleted:', error)
    throw error
  }
}