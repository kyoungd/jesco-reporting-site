import { PrismaClient } from '@prisma/client'
import { generateInviteToken } from '../lib/email.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Check if any admin user already exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@jesco.com'
  const existingAdmin = await prisma.user.findFirst({
    where: { 
      level: 'L5_ADMIN',
      email: adminEmail
    },
    include: { clientProfile: true }
  })

  if (existingAdmin) {
    console.log('✅ Admin user already exists:', existingAdmin.email)
    console.log('   Status:', existingAdmin.clientProfile?.status || 'No profile')
    return
  }

  // Check if there's already a pending invitation for the admin
  const existingInvitation = await prisma.clientProfile.findFirst({
    where: {
      level: 'L5_ADMIN',
      status: 'PENDING_ACTIVATION',
      inviteToken: { not: null }
    }
  })

  if (existingInvitation) {
    console.log('✅ Admin invitation already exists')
    console.log('   Email: Check your email for the invitation link')
    console.log('   Token expires:', existingInvitation.inviteExpiry)
    return
  }

  // Create invitation for default admin
  console.log('📧 Creating admin invitation...')
  
  const inviteToken = generateInviteToken()
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + 30) // 30 days to activate

  // Create the admin profile with invitation
  const adminProfile = await prisma.clientProfile.create({
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

  console.log('✅ Default admin invitation created successfully!')
  console.log('')
  console.log('🔗 Admin Invitation Details:')
  console.log('   Email:', adminEmail)
  console.log('   Company: Jesco Investment Reporting')
  console.log('   Level: L5_ADMIN (System Administrator)')
  console.log('   Expires:', expiryDate.toLocaleDateString())
  console.log('')
  console.log('📋 Next Steps:')
  console.log('   1. Visit: http://localhost:3000/invite?token=' + inviteToken)
  console.log('   2. Complete the sign-up process through Clerk')
  console.log('   3. You will have full admin access once activated')
  console.log('')
  console.log('💡 Note: This invitation will expire in 30 days')
  
  console.log('🌱 Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })