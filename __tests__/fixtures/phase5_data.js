import { PrismaClient } from '@prisma/client'

export const mockAUM = {
  summary: {
    startingAUM: 1000000,
    endingAUM: 1100000,
    totalChange: 100000,
    netFlows: 50000,
    marketPnL: 50000
  },
  dailyValues: [
    {
      date: '2024-01-01',
      marketValue: 1000000,
      netFlows: 0,
      aum: 1000000,
      changeFromPrevious: 0
    },
    {
      date: '2024-01-02',
      marketValue: 1025000,
      netFlows: 25000,
      aum: 1025000,
      changeFromPrevious: 25000
    },
    {
      date: '2024-01-03',
      marketValue: 1100000,
      netFlows: 25000,
      aum: 1100000,
      changeFromPrevious: 75000
    }
  ]
}

export const mockPerformance = {
  summary: {
    totalTWR: 0.0952,
    annualizedTWR: 0.0952,
    volatility: 0.1250,
    sharpeRatio: 0.7616,
    bestDay: 0.0250,
    worstDay: -0.0150,
    totalDays: 252,
    positiveDays: 140,
    negativeDays: 112
  },
  dailyReturns: [
    {
      date: '2024-01-01',
      dailyReturn: 0.0000,
      cumulativeReturn: 0.0000,
      beginningValue: 1000000,
      endingValue: 1000000,
      netFlows: 0
    },
    {
      date: '2024-01-02',
      dailyReturn: 0.0200,
      cumulativeReturn: 0.0200,
      beginningValue: 1000000,
      endingValue: 1020000,
      netFlows: 0
    },
    {
      date: '2024-01-03',
      dailyReturn: 0.0098,
      cumulativeReturn: 0.0300,
      beginningValue: 1020000,
      endingValue: 1050000,
      netFlows: 0
    }
  ]
}

export const mockHoldings = {
  summary: {
    totalMarketValue: 1000000,
    totalPositions: 3,
    totalUnrealizedPnL: 50000,
    cashBalance: 100000,
    asOfDate: '2024-01-15T00:00:00.000Z',
    assetClassBreakdown: {
      'EQUITY': { count: 2, marketValue: 750000, allocationPercent: 0.75 },
      'FIXED_INCOME': { count: 1, marketValue: 250000, allocationPercent: 0.25 }
    }
  },
  holdings: [
    {
      securityId: 'sec1',
      symbol: 'AAPL',
      securityName: 'Apple Inc',
      assetClass: 'EQUITY',
      shares: 1000,
      price: 150.00,
      marketValue: 150000,
      allocationPercent: 0.15,
      costBasis: 140000,
      unrealizedPnL: 10000
    },
    {
      securityId: 'sec2',
      symbol: 'MSFT',
      securityName: 'Microsoft Corp',
      assetClass: 'EQUITY',
      shares: 1500,
      price: 400.00,
      marketValue: 600000,
      allocationPercent: 0.60,
      costBasis: 570000,
      unrealizedPnL: 30000
    },
    {
      securityId: 'sec3',
      symbol: 'TLT',
      securityName: 'iShares 20+ Year Treasury ETF',
      assetClass: 'FIXED_INCOME',
      shares: 2500,
      price: 100.00,
      marketValue: 250000,
      allocationPercent: 0.25,
      costBasis: 240000,
      unrealizedPnL: 10000
    }
  ]
}

export const mockTransactions = {
  summary: {
    totalCount: 5,
    totalInflows: 550000,
    totalOutflows: 100000,
    netCashFlow: 450000,
    finalBalance: 450000,
    transactionTypeBreakdown: {
      'TRANSFER_IN': { count: 2, totalAmount: 500000 },
      'BUY': { count: 2, totalAmount: -100000 },
      'DIVIDEND': { count: 1, totalAmount: 50000 }
    }
  },
  transactions: [
    {
      id: 'txn1',
      transactionDate: '2024-01-01T00:00:00.000Z',
      transactionType: 'TRANSFER_IN',
      securityId: null,
      security: null,
      shares: null,
      price: null,
      amount: 500000,
      runningBalance: 500000,
      description: 'Initial deposit',
      entryStatus: 'POSTED'
    },
    {
      id: 'txn2',
      transactionDate: '2024-01-02T00:00:00.000Z',
      transactionType: 'BUY',
      securityId: 'sec1',
      security: {
        symbol: 'AAPL',
        securityName: 'Apple Inc',
        assetClass: 'EQUITY'
      },
      shares: 1000,
      price: 150.00,
      amount: -150000,
      runningBalance: 350000,
      description: 'Buy AAPL',
      entryStatus: 'POSTED'
    },
    {
      id: 'txn3',
      transactionDate: '2024-01-03T00:00:00.000Z',
      transactionType: 'DIVIDEND',
      securityId: 'sec1',
      security: {
        symbol: 'AAPL',
        securityName: 'Apple Inc',
        assetClass: 'EQUITY'
      },
      shares: null,
      price: null,
      amount: 50000,
      runningBalance: 400000,
      description: 'AAPL Dividend',
      entryStatus: 'POSTED'
    }
  ]
}

export const mockUserProfiles = {
  L5_ADMIN: {
    id: 'admin-user-1',
    email: 'admin@phase5-test.com',
    level: 'L5_ADMIN',
    isActive: true,
    clerkUserId: 'clerk-admin-1',
    clientProfile: {
      id: 'profile-admin-1',
      level: 'L5_ADMIN',
      companyName: 'Phase5 Admin Corp',
      contactName: 'Admin User',
      status: 'ACTIVE',
      organizationId: null,
      organization: null,
      parentClient: null,
      subClients: []
    }
  },
  L4_AGENT: {
    id: 'agent-user-1',
    email: 'agent@phase5-test.com',
    level: 'L4_AGENT',
    isActive: true,
    clerkUserId: 'clerk-agent-1',
    clientProfile: {
      id: 'profile-agent-1',
      level: 'L4_AGENT',
      companyName: 'Phase5 Agent Firm',
      contactName: 'Agent User',
      status: 'ACTIVE',
      organizationId: 'org-1',
      organization: { id: 'org-1', name: 'Test Organization' },
      parentClient: null,
      subClients: []
    }
  },
  L2_CLIENT: {
    id: 'client-user-1',
    email: 'client@phase5-test.com',
    level: 'L2_CLIENT',
    isActive: true,
    clerkUserId: 'clerk-client-1',
    clientProfile: {
      id: 'profile-client-1',
      level: 'L2_CLIENT',
      companyName: 'Phase5 Client Fund',
      contactName: 'Client User',
      status: 'ACTIVE',
      organizationId: 'org-1',
      organization: { id: 'org-1', name: 'Test Organization' },
      parentClient: null,
      subClients: [
        { id: 'profile-subclient-1', companyName: 'Sub Client 1' }
      ]
    }
  },
  L3_SUBCLIENT: {
    id: 'subclient-user-1',
    email: 'subclient@phase5-test.com',
    level: 'L3_SUBCLIENT',
    isActive: true,
    clerkUserId: 'clerk-subclient-1',
    clientProfile: {
      id: 'profile-subclient-1',
      level: 'L3_SUBCLIENT',
      companyName: 'Phase5 Sub Fund',
      contactName: 'Sub Client User',
      status: 'ACTIVE',
      organizationId: null,
      organization: null,
      parentClient: { id: 'profile-client-1', companyName: 'Phase5 Client Fund' },
      subClients: []
    }
  }
}

export const testAccounts = [
  {
    id: 'account-1',
    accountNumber: 'TEST001',
    accountName: 'Test Portfolio 1',
    accountType: 'INDIVIDUAL',
    clientProfileId: 'profile-client-1',
    isActive: true
  },
  {
    id: 'account-2',
    accountNumber: 'TEST002',
    accountName: 'Test Portfolio 2',
    accountType: 'CORPORATE',
    clientProfileId: 'profile-subclient-1',
    isActive: true
  }
]

export const testClients = [
  {
    id: 'profile-client-1',
    companyName: 'Phase5 Client Fund',
    contactName: 'Client User',
    level: 'L2_CLIENT',
    status: 'ACTIVE'
  },
  {
    id: 'profile-subclient-1',
    companyName: 'Phase5 Sub Fund',
    contactName: 'Sub Client User',
    level: 'L3_SUBCLIENT',
    status: 'ACTIVE'
  }
]

export async function seedTestDB(prisma) {
  // Clean up existing test data
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { clientProfileId: { in: ['profile-client-1', 'profile-subclient-1', 'profile-agent-1', 'profile-admin-1'] } } }),
    prisma.position.deleteMany({ where: { clientProfileId: { in: ['profile-client-1', 'profile-subclient-1', 'profile-agent-1', 'profile-admin-1'] } } }),
    prisma.price.deleteMany({ where: { securityId: { in: ['sec1', 'sec2', 'sec3'] } } }),
    prisma.clientAccount.deleteMany({ where: { id: { in: ['account-1', 'account-2'] } } }),
    prisma.masterAccount.deleteMany({ where: { id: { in: ['master-1', 'master-2'] } } }),
    prisma.security.deleteMany({ where: { id: { in: ['sec1', 'sec2', 'sec3'] } } }),
    prisma.clientProfile.deleteMany({ where: { id: { in: ['profile-client-1', 'profile-subclient-1', 'profile-agent-1', 'profile-admin-1'] } } }),
    prisma.user.deleteMany({ where: { clerkUserId: { in: ['clerk-admin-1', 'clerk-agent-1', 'clerk-client-1', 'clerk-subclient-1'] } } }),
    prisma.organization.deleteMany({ where: { id: 'org-1' } })
  ])

  // Create test organization
  await prisma.organization.create({
    data: {
      id: 'org-1',
      name: 'Test Organization',
      description: 'Organization for Phase 5 tests',
      isActive: true
    }
  })

  // Create test users and profiles
  const userData = [
    { ...mockUserProfiles.L5_ADMIN, clientProfile: undefined },
    { ...mockUserProfiles.L4_AGENT, clientProfile: undefined },
    { ...mockUserProfiles.L2_CLIENT, clientProfile: undefined },
    { ...mockUserProfiles.L3_SUBCLIENT, clientProfile: undefined }
  ]

  for (const user of userData) {
    await prisma.user.create({ data: user })
  }

  // Create client profiles
  const profileData = [
    mockUserProfiles.L5_ADMIN.clientProfile,
    mockUserProfiles.L4_AGENT.clientProfile,
    mockUserProfiles.L2_CLIENT.clientProfile,
    mockUserProfiles.L3_SUBCLIENT.clientProfile
  ]

  for (const profile of profileData) {
    const { organization, parentClient, subClients, ...profileDataToCreate } = profile
    await prisma.clientProfile.create({
      data: {
        ...profileDataToCreate,
        userId: userData.find(u => u.clerkUserId.includes(profile.level.toLowerCase().split('_')[1]))?.id
      }
    })
  }

  // Create securities
  await prisma.security.createMany({
    data: [
      {
        id: 'sec1',
        symbol: 'AAPL',
        name: 'Apple Inc',
        assetClass: 'EQUITY',
        isActive: true
      },
      {
        id: 'sec2',
        symbol: 'MSFT',
        name: 'Microsoft Corp',
        assetClass: 'EQUITY',
        isActive: true
      },
      {
        id: 'sec3',
        symbol: 'TLT',
        name: 'iShares 20+ Year Treasury ETF',
        assetClass: 'FIXED_INCOME',
        isActive: true
      }
    ]
  })

  // Create master accounts
  await prisma.masterAccount.createMany({
    data: [
      {
        id: 'master-1',
        accountNumber: 'MASTER001',
        accountName: 'Test Master Account 1',
        accountType: 'INVESTMENT',
        clientProfileId: 'profile-client-1',
        organizationId: 'org-1',
        isActive: true
      },
      {
        id: 'master-2',
        accountNumber: 'MASTER002',
        accountName: 'Test Master Account 2',
        accountType: 'INVESTMENT',
        clientProfileId: 'profile-subclient-1',
        organizationId: 'org-1',
        isActive: true
      }
    ]
  })

  // Create client accounts
  await prisma.clientAccount.createMany({
    data: [
      {
        id: 'account-1',
        accountNumber: 'TEST001',
        accountName: 'Test Portfolio 1',
        accountType: 'INVESTMENT',
        masterAccountId: 'master-1',
        clientProfileId: 'profile-client-1',
        isActive: true
      },
      {
        id: 'account-2',
        accountNumber: 'TEST002',
        accountName: 'Test Portfolio 2',
        accountType: 'INVESTMENT',
        masterAccountId: 'master-2',
        clientProfileId: 'profile-subclient-1',
        isActive: true
      }
    ]
  })

  // Create test transactions
  await prisma.transaction.createMany({
    data: mockTransactions.transactions.map(t => ({
      id: t.id,
      clientAccountId: 'account-1',
      clientProfileId: 'profile-client-1',
      transactionDate: new Date(t.transactionDate),
      transactionType: t.transactionType,
      securityId: t.securityId,
      quantity: t.shares,
      price: t.price,
      amount: t.amount,
      description: t.description,
      entryStatus: t.entryStatus
    }))
  })

  // Create test positions
  await prisma.position.createMany({
    data: mockHoldings.holdings.map(h => ({
      clientAccountId: 'account-1',
      clientProfileId: 'profile-client-1',
      securityId: h.securityId,
      date: new Date('2024-01-15'),
      quantity: h.shares,
      marketValue: h.marketValue,
      averageCost: h.costBasis / h.shares
    }))
  })

  // Create test prices
  await prisma.price.createMany({
    data: mockHoldings.holdings.map(h => ({
      securityId: h.securityId,
      date: new Date('2024-01-15'),
      close: h.price
    }))
  })
}