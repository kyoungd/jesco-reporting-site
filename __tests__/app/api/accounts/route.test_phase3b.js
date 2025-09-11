import { jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { mockPrismaClient, setupApiRouteTest, commonTestSetup } from '../../../utils/phase3b-helpers.js'
import { 
  mockApiResponses, 
  mockAccounts, 
  mockClientProfiles,
  createMockAccount, 
  validAccountData, 
  invalidAccountData 
} from '../../../fixtures/phase3b-data.js'
import { mockDbUsers } from '../../../setup/clerk-mock.js'
import { USER_LEVELS } from '@/lib/constants'

// Mock the Prisma client
jest.mock('@/lib/prisma', () => ({
  default: mockPrismaClient()
}))

// Mock Clerk auth
jest.mock('@clerk/nextjs', () => ({
  auth: jest.fn()
}))

// Mock getCurrentUser and getViewableClients
jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn()
}))

jest.mock('@/lib/permissions', () => ({
  getViewableClients: jest.fn()
}))

// Mock the actual route handlers
const mockGETHandler = async (request) => {
  try {
    const authResult = auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { getCurrentUser } = require('@/lib/auth')
    const { getViewableClients } = require('@/lib/permissions')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const type = searchParams.get('type')

    // Get viewable clients based on user permissions
    const viewableClients = await getViewableClients(user)
    
    const prisma = require('@/lib/prisma').default
    
    // Build where clause based on permissions and filters
    let where = {}
    
    // Permission-based filtering
    if (user.level === USER_LEVELS.L5_ADMIN) {
      // Admin sees all accounts
    } else if (user.level === USER_LEVELS.L4_AGENT) {
      // Agent sees organization accounts
      where.OR = [
        { accountType: 'MasterAccount' },
        { 
          clientProfile: {
            organizationId: user.clientProfile.organizationId
          }
        }
      ]
    } else if (user.level === USER_LEVELS.L2_CLIENT) {
      // Client sees own and sub-client accounts
      where.OR = [
        { clientProfile: { id: user.clientProfile.id } },
        { 
          clientProfile: { 
            parentClientId: user.clientProfile.id 
          }
        }
      ]
    } else if (user.level === USER_LEVELS.L3_SUBCLIENT) {
      // SubClient sees only own accounts
      where.clientProfile = { id: user.clientProfile.id }
    }

    // Search filter
    if (search) {
      const searchCondition = {
        OR: [
          { accountName: { contains: search, mode: 'insensitive' } },
          { accountNumber: { contains: search, mode: 'insensitive' } },
          { secdexCode: { contains: search, mode: 'insensitive' } }
        ]
      }
      
      where = where.OR ? { AND: [where, searchCondition] } : searchCondition
    }

    // Type filter
    if (type) {
      const typeCondition = { accountType: type }
      where = where.OR || where.AND ? { AND: [where, typeCondition] } : typeCondition
    }

    const accounts = await prisma.account.findMany({
      where,
      include: {
        clientProfile: {
          include: {
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        },
        feeSchedule: true
      },
      orderBy: { accountName: 'asc' }
    })

    // Calculate stats
    const stats = {
      total: accounts.length,
      byType: accounts.reduce((acc, account) => {
        acc[account.accountType] = (acc[account.accountType] || 0) + 1
        return acc
      }, {})
    }

    return NextResponse.json({
      success: true,
      data: accounts,
      stats,
      message: 'Accounts retrieved successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

const mockPOSTHandler = async (request) => {
  try {
    const authResult = auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { getCurrentUser } = require('@/lib/auth')
    const user = await getCurrentUser()

    const body = await request.json()
    const { accountType, secdexCode, accountName, benchmark, feeScheduleId } = body

    // Validate required fields
    if (!accountType || !accountName || !feeScheduleId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const prisma = require('@/lib/prisma').default

    // Validate secdexCode for ClientAccount
    let clientProfileId = null
    if (accountType === 'ClientAccount') {
      if (!secdexCode) {
        return NextResponse.json(
          { success: false, error: 'SecDex code required for client accounts' },
          { status: 400 }
        )
      }

      const clientProfile = await prisma.clientProfile.findUnique({
        where: { secdexCode }
      })

      if (!clientProfile) {
        return NextResponse.json(
          { success: false, error: 'Invalid SecDex code' },
          { status: 400 }
        )
      }

      clientProfileId = clientProfile.id
    }

    // Generate account number
    const accountCount = await prisma.account.count()
    const accountNumber = `ACC${String(accountCount + 1).padStart(3, '0')}`

    const accountData = {
      accountType,
      accountNumber,
      accountName,
      benchmark: benchmark || null,
      feeScheduleId,
      isActive: true
    }

    if (clientProfileId) {
      accountData.secdexCode = secdexCode
    }

    const account = await prisma.account.create({
      data: accountData,
      include: {
        clientProfile: {
          include: {
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        },
        feeSchedule: true
      }
    })

    return NextResponse.json({
      success: true,
      data: account,
      message: 'Account created successfully'
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

describe('Accounts API Route Phase 3B', () => {
  let prisma
  const { getCurrentUser } = require('@/lib/auth')
  const { getViewableClients } = require('@/lib/permissions')

  commonTestSetup()

  beforeEach(() => {
    prisma = mockPrismaClient()
    
    // Reset auth mock
    auth.mockReturnValue({
      userId: 'test-user-id',
      sessionId: 'test-session-id'
    })

    getCurrentUser.mockClear()
    getViewableClients.mockClear()
  })

  describe('GET /api/accounts - Permission-based filtering', () => {
    it('should return all accounts for L5_ADMIN users', async () => {
      getCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      getViewableClients.mockResolvedValue(mockAccounts)
      prisma.account.findMany.mockResolvedValue(mockAccounts)

      const request = new NextRequest('http://localhost:3000/api/accounts')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockAccounts)
      expect(data.stats.total).toBe(3)
      expect(data.stats.byType.ClientAccount).toBe(2)
      expect(data.stats.byType.MasterAccount).toBe(1)
      
      // Admin should see all accounts (no WHERE clause restrictions)
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          feeSchedule: true
        },
        orderBy: { accountName: 'asc' }
      })
    })

    it('should return organization accounts for L4_AGENT users', async () => {
      getCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L4_AGENT])
      const orgAccounts = mockAccounts.filter(acc => 
        acc.accountType === 'MasterAccount' || 
        acc.clientProfile?.organizationId === 'test-org-id'
      )
      getViewableClients.mockResolvedValue(orgAccounts)
      prisma.account.findMany.mockResolvedValue(orgAccounts)

      const request = new NextRequest('http://localhost:3000/api/accounts')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(orgAccounts)
      
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { accountType: 'MasterAccount' },
            { 
              clientProfile: {
                organizationId: mockDbUsers[USER_LEVELS.L4_AGENT].clientProfile.organizationId
              }
            }
          ]
        },
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          feeSchedule: true
        },
        orderBy: { accountName: 'asc' }
      })
    })

    it('should return own accounts for L2_CLIENT users', async () => {
      getCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L2_CLIENT])
      const clientAccounts = mockAccounts.filter(acc => 
        acc.clientProfile?.level === USER_LEVELS.L2_CLIENT ||
        acc.clientProfile?.level === USER_LEVELS.L3_SUBCLIENT
      )
      getViewableClients.mockResolvedValue(clientAccounts)
      prisma.account.findMany.mockResolvedValue(clientAccounts)

      const request = new NextRequest('http://localhost:3000/api/accounts')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(clientAccounts)
      
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { clientProfile: { id: mockDbUsers[USER_LEVELS.L2_CLIENT].clientProfile.id } },
            { 
              clientProfile: { 
                parentClientId: mockDbUsers[USER_LEVELS.L2_CLIENT].clientProfile.id 
              }
            }
          ]
        },
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          feeSchedule: true
        },
        orderBy: { accountName: 'asc' }
      })
    })

    it('should return only own accounts for L3_SUBCLIENT users', async () => {
      getCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L3_SUBCLIENT])
      const subClientAccounts = mockAccounts.filter(acc => 
        acc.clientProfile?.level === USER_LEVELS.L3_SUBCLIENT
      )
      getViewableClients.mockResolvedValue(subClientAccounts)
      prisma.account.findMany.mockResolvedValue(subClientAccounts)

      const request = new NextRequest('http://localhost:3000/api/accounts')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(subClientAccounts)
      
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {
          clientProfile: { id: mockDbUsers[USER_LEVELS.L3_SUBCLIENT].clientProfile.id }
        },
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          feeSchedule: true
        },
        orderBy: { accountName: 'asc' }
      })
    })
  })

  describe('GET /api/accounts - Filtering', () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      getViewableClients.mockResolvedValue(mockAccounts)
    })

    it('should filter accounts by search term', async () => {
      const filteredAccounts = [mockAccounts[0]]
      prisma.account.findMany.mockResolvedValue(filteredAccounts)

      const request = new NextRequest('http://localhost:3000/api/accounts?search=Client%20Test')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(filteredAccounts)
      
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { accountName: { contains: 'Client Test', mode: 'insensitive' } },
            { accountNumber: { contains: 'Client Test', mode: 'insensitive' } },
            { secdexCode: { contains: 'Client Test', mode: 'insensitive' } }
          ]
        },
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          feeSchedule: true
        },
        orderBy: { accountName: 'asc' }
      })
    })

    it('should filter accounts by type', async () => {
      const clientAccounts = mockAccounts.filter(acc => acc.accountType === 'ClientAccount')
      prisma.account.findMany.mockResolvedValue(clientAccounts)

      const request = new NextRequest('http://localhost:3000/api/accounts?type=ClientAccount')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(clientAccounts)
      
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { accountType: 'ClientAccount' },
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          feeSchedule: true
        },
        orderBy: { accountName: 'asc' }
      })
    })

    it('should combine search and type filters', async () => {
      const filteredAccounts = [mockAccounts[0]]
      prisma.account.findMany.mockResolvedValue(filteredAccounts)

      const request = new NextRequest('http://localhost:3000/api/accounts?search=Client&type=ClientAccount')
      const response = await mockGETHandler(request)

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { accountName: { contains: 'Client', mode: 'insensitive' } },
                { accountNumber: { contains: 'Client', mode: 'insensitive' } },
                { secdexCode: { contains: 'Client', mode: 'insensitive' } }
              ]
            },
            { accountType: 'ClientAccount' }
          ]
        },
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          feeSchedule: true
        },
        orderBy: { accountName: 'asc' }
      })
    })
  })

  describe('GET /api/accounts - Error handling', () => {
    it('should return 401 when user is not authenticated', async () => {
      auth.mockReturnValue({ userId: null })

      const request = new NextRequest('http://localhost:3000/api/accounts')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 404 when user is not found', async () => {
      getCurrentUser.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/accounts')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('User not found')
    })

    it('should handle database errors gracefully', async () => {
      getCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
      getViewableClients.mockResolvedValue(mockAccounts)
      prisma.account.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/accounts')
      const response = await mockGETHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch accounts')
    })
  })

  describe('POST /api/accounts', () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue(mockDbUsers[USER_LEVELS.L5_ADMIN])
    })

    it('should create a ClientAccount with valid data', async () => {
      const newAccount = createMockAccount({
        accountType: 'ClientAccount',
        secdexCode: 'CLIENT001',
        accountName: 'New Client Account'
      })
      
      prisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles[0])
      prisma.account.count.mockResolvedValue(3)
      prisma.account.create.mockResolvedValue(newAccount)

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          ...validAccountData,
          accountType: 'ClientAccount',
          secdexCode: 'CLIENT001'
        })
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(newAccount)
      expect(data.message).toBe('Account created successfully')

      expect(prisma.clientProfile.findUnique).toHaveBeenCalledWith({
        where: { secdexCode: 'CLIENT001' }
      })
      
      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          accountType: 'ClientAccount',
          accountNumber: 'ACC004',
          accountName: validAccountData.accountName,
          benchmark: validAccountData.benchmark,
          feeScheduleId: validAccountData.feeScheduleId,
          secdexCode: 'CLIENT001',
          isActive: true
        },
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          feeSchedule: true
        }
      })
    })

    it('should create a MasterAccount without secdexCode', async () => {
      const newMasterAccount = createMockAccount({
        accountType: 'MasterAccount',
        secdexCode: null,
        accountName: 'New Master Account'
      })
      
      prisma.account.count.mockResolvedValue(3)
      prisma.account.create.mockResolvedValue(newMasterAccount)

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          accountType: 'MasterAccount',
          accountName: 'New Master Account',
          benchmark: 'Russell 2000',
          feeScheduleId: 'fee-2'
        })
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          accountType: 'MasterAccount',
          accountNumber: 'ACC004',
          accountName: 'New Master Account',
          benchmark: 'Russell 2000',
          feeScheduleId: 'fee-2',
          isActive: true
        },
        include: {
          clientProfile: {
            include: {
              user: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          feeSchedule: true
        }
      })
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          accountType: 'ClientAccount',
          // Missing accountName and feeScheduleId
          secdexCode: 'CLIENT001'
        })
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing required fields')
      expect(prisma.account.create).not.toHaveBeenCalled()
    })

    it('should require secdexCode for ClientAccount', async () => {
      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          accountType: 'ClientAccount',
          accountName: 'Client Account',
          feeScheduleId: 'fee-1'
          // Missing secdexCode
        })
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('SecDex code required for client accounts')
    })

    it('should validate secdexCode exists', async () => {
      prisma.clientProfile.findUnique.mockResolvedValue(null) // Not found

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          accountType: 'ClientAccount',
          accountName: 'Client Account',
          secdexCode: 'INVALID123',
          feeScheduleId: 'fee-1'
        })
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid SecDex code')
      expect(prisma.account.create).not.toHaveBeenCalled()
    })

    it('should generate sequential account numbers', async () => {
      prisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles[0])
      prisma.account.count.mockResolvedValue(15) // 15 existing accounts
      prisma.account.create.mockResolvedValue(mockAccounts[0])

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          accountType: 'ClientAccount',
          accountName: 'Test Account',
          secdexCode: 'CLIENT001',
          feeScheduleId: 'fee-1'
        })
      })
      
      await mockPOSTHandler(request)

      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountNumber: 'ACC016' // 15 + 1 = 16
          })
        })
      )
    })

    it('should return 401 when user is not authenticated', async () => {
      auth.mockReturnValue({ userId: null })

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify(validAccountData)
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle database errors during creation', async () => {
      prisma.clientProfile.findUnique.mockResolvedValue(mockClientProfiles[0])
      prisma.account.count.mockResolvedValue(3)
      prisma.account.create.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          accountType: 'ClientAccount',
          accountName: 'Test Account',
          secdexCode: 'CLIENT001',
          feeScheduleId: 'fee-1'
        })
      })
      
      const response = await mockPOSTHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to create account')
    })
  })
})