#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import { generateInviteToken } from '../lib/email.js'

const db = new PrismaClient()

/**
 * Test Database Setup Script for Phase 4A
 * 
 * This script:
 * 1. Resets test database to clean state
 * 2. Seeds with base profiles for testing
 * 3. Generates test tokens
 * 4. Creates test organizations
 */

const TEST_DATA_PREFIX = 'Phase4A-Setup'

async function cleanupExistingTestData() {
  console.log('🧹 Cleaning up existing test data...')
  
  // Clean up in reverse dependency order
  await db.clientProfile.deleteMany({
    where: {
      OR: [
        { companyName: { contains: TEST_DATA_PREFIX } },
        { email: { contains: '@phase4a-setup.com' } }
      ]
    }
  })

  await db.user.deleteMany({
    where: {
      OR: [
        { email: { contains: '@phase4a-setup.com' } },
        { clerkUserId: { contains: 'phase4a-setup' } }
      ]
    }
  })

  await db.organization.deleteMany({
    where: {
      name: { contains: TEST_DATA_PREFIX }
    }
  })

  console.log('✅ Cleanup completed')
}

async function createTestOrganizations() {
  console.log('🏢 Creating test organizations...')
  
  const mainOrg = await db.organization.create({
    data: {
      name: `${TEST_DATA_PREFIX} Main Organization`,
      description: 'Primary test organization for Phase 4A',
      isActive: true
    }
  })

  const subOrg = await db.organization.create({
    data: {
      name: `${TEST_DATA_PREFIX} Sub Organization`,
      description: 'Secondary test organization for Phase 4A',
      isActive: true
    }
  })

  console.log(`✅ Created organizations: ${mainOrg.id}, ${subOrg.id}`)
  return { mainOrg, subOrg }
}

async function seedBaseProfiles({ mainOrg, subOrg }) {
  console.log('👥 Seeding base user profiles...')
  
  // Create L5 Admin
  const adminUser = await db.user.create({
    data: {
      email: 'admin@phase4a-setup.com',
      level: 'L5_ADMIN',
      isActive: true,
      clerkUserId: 'phase4a-setup-admin-123'
    }
  })

  const adminProfile = await db.clientProfile.create({
    data: {
      userId: adminUser.id,
      companyName: `${TEST_DATA_PREFIX} Admin Company`,
      contactName: 'Test Admin User',
      level: 'L5_ADMIN',
      status: 'ACTIVE',
      isActive: true,
      clerkUserId: 'phase4a-setup-admin-123',
      activatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 3 months ago
    }
  })

  // Create L4 Agent
  const agentUser = await db.user.create({
    data: {
      email: 'agent@phase4a-setup.com',
      level: 'L4_AGENT',
      isActive: true,
      clerkUserId: 'phase4a-setup-agent-456'
    }
  })

  const agentProfile = await db.clientProfile.create({
    data: {
      userId: agentUser.id,
      companyName: `${TEST_DATA_PREFIX} Agent Firm`,
      contactName: 'Test Agent User',
      level: 'L4_AGENT',
      status: 'ACTIVE',
      isActive: true,
      clerkUserId: 'phase4a-setup-agent-456',
      organizationId: mainOrg.id,
      activatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 2 months ago
      invitedBy: adminUser.email
    }
  })

  // Create L2 Client
  const clientUser = await db.user.create({
    data: {
      email: 'client@phase4a-setup.com',
      level: 'L2_CLIENT',
      isActive: true,
      clerkUserId: 'phase4a-setup-client-789'
    }
  })

  const clientProfile = await db.clientProfile.create({
    data: {
      userId: clientUser.id,
      companyName: `${TEST_DATA_PREFIX} Investment Partners`,
      contactName: 'Test Client User',
      level: 'L2_CLIENT',
      status: 'ACTIVE',
      isActive: true,
      clerkUserId: 'phase4a-setup-client-789',
      organizationId: mainOrg.id,
      activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 1 month ago
      invitedBy: agentUser.email
    }
  })

  // Create L3 Subclient
  const subClientUser = await db.user.create({
    data: {
      email: 'subclient@phase4a-setup.com',
      level: 'L3_SUBCLIENT',
      isActive: true,
      clerkUserId: 'phase4a-setup-subclient-101'
    }
  })

  const subClientProfile = await db.clientProfile.create({
    data: {
      userId: subClientUser.id,
      companyName: `${TEST_DATA_PREFIX} Sub Fund`,
      contactName: 'Test Sub-Client User',
      level: 'L3_SUBCLIENT',
      status: 'ACTIVE',
      isActive: true,
      clerkUserId: 'phase4a-setup-subclient-101',
      parentClientId: clientProfile.id,
      activatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      invitedBy: clientUser.email
    }
  })

  console.log('✅ Created base profiles for all user levels')
  return { adminProfile, agentProfile, clientProfile, subClientProfile }
}

async function createPendingInvitations({ adminUser, agentUser }) {
  console.log('📨 Creating pending invitations...')
  
  const invitations = []

  // Create pending L2 client invitation
  const pendingClientUser = await db.user.create({
    data: {
      email: 'pending-client@phase4a-setup.com',
      level: 'L2_CLIENT',
      isActive: false
    }
  })

  const pendingClientProfile = await db.clientProfile.create({
    data: {
      userId: pendingClientUser.id,
      companyName: `${TEST_DATA_PREFIX} Pending Client`,
      contactName: 'Pending Client User',
      level: 'L2_CLIENT',
      status: 'PENDING_ACTIVATION',
      isActive: false,
      inviteToken: generateInviteToken(),
      inviteExpiry: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      invitedBy: adminUser.email
    }
  })

  invitations.push({
    token: pendingClientProfile.inviteToken,
    email: pendingClientUser.email,
    level: 'L2_CLIENT',
    expiryDate: pendingClientProfile.inviteExpiry
  })

  // Create pending L3 subclient invitation  
  const pendingSubUser = await db.user.create({
    data: {
      email: 'pending-subclient@phase4a-setup.com',
      level: 'L3_SUBCLIENT',
      isActive: false
    }
  })

  const pendingSubProfile = await db.clientProfile.create({
    data: {
      userId: pendingSubUser.id,
      companyName: `${TEST_DATA_PREFIX} Pending Sub`,
      contactName: 'Pending Sub User',
      level: 'L3_SUBCLIENT',
      status: 'PENDING_ACTIVATION',
      isActive: false,
      inviteToken: generateInviteToken(),
      inviteExpiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      invitedBy: agentUser.email
    }
  })

  invitations.push({
    token: pendingSubProfile.inviteToken,
    email: pendingSubUser.email,
    level: 'L3_SUBCLIENT',
    expiryDate: pendingSubProfile.inviteExpiry
  })

  // Create expired invitation for testing
  const expiredUser = await db.user.create({
    data: {
      email: 'expired@phase4a-setup.com',
      level: 'L2_CLIENT',
      isActive: false
    }
  })

  const expiredProfile = await db.clientProfile.create({
    data: {
      userId: expiredUser.id,
      companyName: `${TEST_DATA_PREFIX} Expired Invitation`,
      contactName: 'Expired User',
      level: 'L2_CLIENT',
      status: 'PENDING_ACTIVATION',
      isActive: false,
      inviteToken: generateInviteToken(),
      inviteExpiry: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago (expired)
      invitedBy: adminUser.email
    }
  })

  invitations.push({
    token: expiredProfile.inviteToken,
    email: expiredUser.email,
    level: 'L2_CLIENT',
    expiryDate: expiredProfile.inviteExpiry,
    expired: true
  })

  console.log(`✅ Created ${invitations.length} test invitations`)
  return invitations
}

async function createSuspendedProfile() {
  console.log('⏸️  Creating suspended profile...')
  
  const suspendedUser = await db.user.create({
    data: {
      email: 'suspended@phase4a-setup.com',
      level: 'L2_CLIENT',
      isActive: false,
      clerkUserId: 'phase4a-setup-suspended-999'
    }
  })

  const suspendedProfile = await db.clientProfile.create({
    data: {
      userId: suspendedUser.id,
      companyName: `${TEST_DATA_PREFIX} Suspended Company`,
      contactName: 'Suspended User',
      level: 'L2_CLIENT',
      status: 'SUSPENDED',
      isActive: false,
      clerkUserId: 'phase4a-setup-suspended-999',
      activatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Was active 2 months ago
      invitedBy: 'admin@phase4a-setup.com'
    }
  })

  console.log('✅ Created suspended profile for testing')
  return suspendedProfile
}

async function printSetupSummary(invitations, orgs) {
  console.log('\n📊 PHASE 4A TEST SETUP SUMMARY')
  console.log('=====================================')
  
  const userCount = await db.user.count({
    where: { email: { contains: '@phase4a-setup.com' } }
  })
  
  const profileCount = await db.clientProfile.count({
    where: { companyName: { contains: TEST_DATA_PREFIX } }
  })

  const statusCounts = await db.clientProfile.groupBy({
    by: ['status'],
    where: { companyName: { contains: TEST_DATA_PREFIX } },
    _count: { status: true }
  })

  console.log(`👥 Total Users: ${userCount}`)
  console.log(`📋 Total Profiles: ${profileCount}`)
  console.log(`🏢 Organizations: ${orgs.mainOrg.name}, ${orgs.subOrg.name}`)
  
  console.log('\nProfile Status Distribution:')
  statusCounts.forEach(({ status, _count }) => {
    console.log(`  ${status}: ${_count.status}`)
  })

  console.log('\n📨 Test Invitations:')
  invitations.forEach((inv, i) => {
    const status = inv.expired ? '❌ EXPIRED' : '✅ ACTIVE'
    console.log(`  ${i + 1}. ${inv.email} (${inv.level}) - ${status}`)
    console.log(`     Token: ${inv.token.substring(0, 16)}...`)
    console.log(`     Expires: ${inv.expiryDate.toISOString()}`)
  })

  console.log('\n🧪 Ready for Phase 4A testing!')
  console.log('=====================================')
}

async function main() {
  try {
    console.log('🚀 Starting Phase 4A Test Setup...\n')
    
    // Connect to database
    await db.$connect()
    console.log('✅ Database connected')

    // Clean up existing test data
    await cleanupExistingTestData()

    // Create test organizations
    const orgs = await createTestOrganizations()

    // Seed base profiles
    const profiles = await seedBaseProfiles(orgs)

    // Create pending invitations
    const invitations = await createPendingInvitations({
      adminUser: { email: 'admin@phase4a-setup.com' },
      agentUser: { email: 'agent@phase4a-setup.com' }
    })

    // Create suspended profile
    await createSuspendedProfile()

    // Print summary
    await printSetupSummary(invitations, orgs)

  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

// Run setup if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main()
}

export { main as setupPhase4ATests }