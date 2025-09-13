#!/usr/bin/env node

/**
 * Script to update admin user with default organization
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAdminOrganization() {
  try {
    console.log('🔧 Updating admin user with default organization...');

    // Find JESCO organization
    const jescoOrg = await prisma.organization.findFirst({
      where: { name: 'JESCO' }
    });

    if (!jescoOrg) {
      console.error('❌ JESCO organization not found');
      process.exit(1);
    }

    console.log(`✅ Found JESCO organization: ${jescoOrg.id}`);

    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { 
        level: 'L5_ADMIN',
        email: 'kyoungd@gmail.com'
      },
      include: { clientProfile: true }
    });

    if (!adminUser || !adminUser.clientProfile) {
      console.error('❌ Admin user or profile not found');
      process.exit(1);
    }

    console.log(`✅ Found admin user: ${adminUser.email}`);

    // Update client profile with organization
    const updatedProfile = await prisma.clientProfile.update({
      where: { id: adminUser.clientProfile.id },
      data: { organizationId: jescoOrg.id },
      include: { organization: true }
    });

    console.log(`🎉 Admin user updated with organization: ${updatedProfile.organization.name}`);

  } catch (error) {
    console.error('❌ Error updating admin organization:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminOrganization();