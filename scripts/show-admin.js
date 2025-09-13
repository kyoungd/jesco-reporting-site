#!/usr/bin/env node

/**
 * Script to show administrator information from database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function showAdminInfo() {
  try {
    console.log('👨‍💼 Administrator Information:\n');

    // Find admin user(s)
    const adminUsers = await prisma.user.findMany({
      where: { 
        level: 'L5_ADMIN'
      },
      include: {
        clientProfile: {
          include: {
            organization: true,
            parentClient: true,
            subClients: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (adminUsers.length === 0) {
      console.log('❌ No administrator users found in database');
      return;
    }

    adminUsers.forEach((user, index) => {
      console.log(`=== ADMIN USER ${index + 1} ===`);
      console.log(`📧 Email: ${user.email}`);
      console.log(`🆔 User ID: ${user.id}`);
      console.log(`🔑 Clerk User ID: ${user.clerkUserId}`);
      console.log(`📛 Name: ${user.firstName} ${user.lastName}`);
      console.log(`🎭 Level: ${user.level}`);
      console.log(`✅ Active: ${user.isActive}`);
      console.log(`📅 Created: ${user.createdAt.toISOString()}`);
      console.log(`🔄 Updated: ${user.updatedAt.toISOString()}`);
      
      if (user.clientProfile) {
        console.log('\n--- CLIENT PROFILE ---');
        console.log(`🆔 Profile ID: ${user.clientProfile.id}`);
        console.log(`🏢 Company: ${user.clientProfile.companyName || 'N/A'}`);
        console.log(`👤 Contact: ${user.clientProfile.contactName || 'N/A'}`);
        console.log(`📞 Phone: ${user.clientProfile.phone || 'N/A'}`);
        console.log(`🏛️ SECDEX Code: ${user.clientProfile.secdexCode || 'N/A'}`);
        console.log(`📍 Location: ${[user.clientProfile.city, user.clientProfile.state, user.clientProfile.country].filter(Boolean).join(', ') || 'N/A'}`);
        console.log(`🔄 Status: ${user.clientProfile.status}`);
        console.log(`🎯 Level: ${user.clientProfile.level}`);
        console.log(`⚡ Active: ${user.clientProfile.isActive}`);
        
        if (user.clientProfile.organization) {
          console.log('\n--- ORGANIZATION ---');
          console.log(`🆔 Org ID: ${user.clientProfile.organization.id}`);
          console.log(`🏢 Name: ${user.clientProfile.organization.name}`);
          console.log(`📝 Description: ${user.clientProfile.organization.description}`);
          console.log(`🌐 Website: ${user.clientProfile.organization.website || 'N/A'}`);
          console.log(`📞 Phone: ${user.clientProfile.organization.phone || 'N/A'}`);
          console.log(`📍 Location: ${[user.clientProfile.organization.city, user.clientProfile.organization.state, user.clientProfile.organization.country].filter(Boolean).join(', ')}`);
        } else {
          console.log('\n--- ORGANIZATION ---');
          console.log('❌ No organization assigned');
        }

        if (user.clientProfile.parentClient) {
          console.log('\n--- PARENT CLIENT ---');
          console.log(`🆔 Parent ID: ${user.clientProfile.parentClient.id}`);
          console.log(`🏢 Parent Company: ${user.clientProfile.parentClient.companyName}`);
        }

        if (user.clientProfile.subClients && user.clientProfile.subClients.length > 0) {
          console.log('\n--- SUB-CLIENTS ---');
          user.clientProfile.subClients.forEach((sub, i) => {
            console.log(`${i + 1}. ${sub.companyName || sub.secdexCode} (${sub.id})`);
          });
        }
      } else {
        console.log('\n❌ No client profile found');
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    });

    // Show database table locations
    console.log('📊 DATABASE TABLE LOCATIONS:');
    console.log('├── users                 - Main user records');
    console.log('├── client_profiles       - Extended client information');  
    console.log('├── organizations         - Company organizations');
    console.log('├── master_accounts       - Investment accounts');
    console.log('├── client_accounts       - Sub-accounts');
    console.log('├── transactions          - Financial transactions');
    console.log('├── positions             - Investment positions');
    console.log('├── securities            - Securities master data');
    console.log('├── prices                - Security price data');
    console.log('├── fee_schedules         - Fee structures');
    console.log('└── audit_logs            - System audit trail');

  } catch (error) {
    console.error('❌ Error fetching admin info:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

showAdminInfo();