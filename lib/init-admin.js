import { db } from './db'
import { clerkClient } from '@clerk/backend'

export async function initializeDefaultAdmin() {
  try {
    console.log('🔍 Checking for default admin user...')

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@jesco.com'
    
    // Check if any admin user already exists
    const existingAdmin = await db.user.findFirst({
      where: { 
        level: 'L5_ADMIN',
        email: adminEmail
      },
      include: { clientProfile: true }
    })

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email)
      return { 
        success: true, 
        existed: true, 
        user: existingAdmin,
        message: 'Admin user already exists'
      }
    }

    // Check if there's already a pending invitation for the admin
    const existingInvitation = await db.clientProfile.findFirst({
      where: {
        level: 'L5_ADMIN', 
        status: 'PENDING_ACTIVATION',
        inviteToken: { not: null }
      },
      include: { user: true }
    })

    if (existingInvitation) {
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${existingInvitation.inviteToken}`
      console.log('✅ Admin invitation already exists')
      console.log('📧 Invitation URL:', inviteUrl)
      
      return { 
        success: true, 
        existed: true, 
        invitation: existingInvitation,
        inviteUrl,
        message: 'Admin invitation already exists'
      }
    }

    // Create invitation for default admin
    console.log('📧 Creating admin invitation...')
    
    const inviteToken = generateInviteToken()
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 30) // 30 days to activate

    // Create the admin profile with invitation
    const adminProfile = await db.clientProfile.create({
      data: {
        level: 'L5_ADMIN',
        companyName: 'Jesco Investment Reporting',
        contactName: 'System Administrator',
        phone: process.env.ADMIN_PHONE || '(555) 123-4567',
        status: 'PENDING_ACTIVATION',
        inviteToken: inviteToken,
        inviteExpiry: expiryDate,
        invitedBy: 'System',
        user: {
          create: {
            clerkUserId: `pending_admin_${Date.now()}`,
            email: adminEmail,
            firstName: 'System',
            lastName: 'Administrator', 
            level: 'L5_ADMIN',
            isActive: false // Will be activated when they accept invitation
          }
        }
      },
      include: {
        user: true
      }
    })

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${inviteToken}`

    // Send the invitation email using the existing email system
    try {
      await sendInvitationEmail({
        email: adminEmail,
        contactName: 'System Administrator',
        companyName: 'Jesco Investment Reporting',
        inviteToken: inviteToken,
        invitedBy: 'System',
        expiryDate: expiryDate
      })
      
      console.log('✅ Default admin invitation created and email sent successfully!')
      console.log('📧 Invitation email sent to:', adminEmail)
      console.log('🔗 Invitation URL:', inviteUrl)
      console.log('⏰ Expires:', expiryDate.toLocaleDateString())

      return {
        success: true,
        existed: false,
        invitation: adminProfile,
        inviteUrl,
        emailSent: true,
        message: 'Admin invitation created and email sent successfully'
      }
    } catch (emailError) {
      console.error('❌ Error sending admin invitation email:', emailError)
      
      // Still return success since the invitation was created, just email failed
      console.log('⚠️ Admin invitation created but email failed to send')
      console.log('🔗 Manual invitation URL:', inviteUrl)
      
      return {
        success: true,
        existed: false,
        invitation: adminProfile,
        inviteUrl,
        emailSent: false,
        emailError: emailError.message,
        message: 'Admin invitation created but email failed to send'
      }
    }

  } catch (error) {
    console.error('❌ Error initializing admin:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export async function getAdminInvitationStatus() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@jesco.com'
    
    // Check for active admin
    const activeAdmin = await db.user.findFirst({
      where: { 
        level: 'L5_ADMIN',
        email: adminEmail,
        isActive: true
      },
      include: { clientProfile: true }
    })

    if (activeAdmin) {
      return {
        status: 'ACTIVE',
        user: activeAdmin,
        message: 'Admin user is active and ready'
      }
    }

    // Check for pending invitation
    const pendingInvitation = await db.clientProfile.findFirst({
      where: {
        level: 'L5_ADMIN',
        status: 'PENDING_ACTIVATION',
        inviteToken: { not: null }
      },
      include: { user: true }
    })

    if (pendingInvitation) {
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${pendingInvitation.inviteToken}`
      const isExpired = new Date() > pendingInvitation.inviteExpiry
      
      return {
        status: isExpired ? 'EXPIRED' : 'PENDING',
        invitation: pendingInvitation,
        inviteUrl,
        isExpired,
        expiryDate: pendingInvitation.inviteExpiry,
        message: isExpired ? 'Admin invitation has expired' : 'Admin invitation is pending activation'
      }
    }

    return {
      status: 'NOT_CREATED',
      message: 'No admin user or invitation exists'
    }

  } catch (error) {
    console.error('Error checking admin status:', error)
    return {
      status: 'ERROR',
      error: error.message
    }
  }
}