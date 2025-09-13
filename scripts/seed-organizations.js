#!/usr/bin/env node

/**
 * Script to seed default organizations
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedOrganizations() {
  try {
    console.log('🌱 Seeding organizations...');

    // Check existing organizations
    const existingOrgs = await prisma.organization.findMany();
    console.log('📊 Existing organizations:', existingOrgs.map(org => `${org.name} (${org.id})`));

    const organizations = [
      {
        name: 'JESCO',
        description: 'Jesco Investment Reporting',
        website: 'https://jesco.com',
        phone: '(555) 123-4567',
        address: '123 Investment Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        isActive: true
      },
      {
        name: 'SARACOTI',
        description: 'Saracoti Investment Management',
        website: 'https://saracoti.com', 
        phone: '(555) 987-6543',
        address: '456 Finance Avenue',
        city: 'Boston',
        state: 'MA',
        zipCode: '02101',
        country: 'US',
        isActive: true
      }
    ];

    for (const orgData of organizations) {
      const existing = await prisma.organization.findFirst({
        where: { name: orgData.name }
      });

      if (existing) {
        console.log(`✅ ${orgData.name} already exists`);
      } else {
        const org = await prisma.organization.create({
          data: orgData
        });
        console.log(`🆕 Created ${org.name} (${org.id})`);
      }
    }

    // Show final organizations
    const finalOrgs = await prisma.organization.findMany({
      orderBy: { name: 'asc' }
    });
    
    console.log('\n📋 Final organizations:');
    finalOrgs.forEach(org => {
      console.log(`  - ${org.name} (ID: ${org.id})`);
      console.log(`    ${org.description}`);
      console.log(`    ${org.city}, ${org.state} ${org.zipCode}`);
      console.log(`    Active: ${org.isActive}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error seeding organizations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedOrganizations();