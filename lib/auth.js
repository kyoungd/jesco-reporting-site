import { currentUser } from '@clerk/nextjs'
import { db } from './db'
import { USER_LEVELS } from './constants'
import { canEditClient, canViewClient } from './permissions'

export async function getCurrentUser() {
  try {
    const clerkUser = await currentUser()
    if (!clerkUser) return null

    const user = await db.user.findUnique({
      where: { clerkUserId: clerkUser.id },
      include: {
        clientProfile: {
          include: {
            organization: true,
            parentClient: true,
            subClients: true,
            masterAccounts: true,
            clientAccounts: true
          }
        }
      }
    })

    if (!user) {
      // User should be created via webhook when they sign up
      // If no user found, they may not have completed the invitation process
      console.log('No user found for Clerk ID:', clerkUser.id)
      return null
    }

    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

export async function checkPermission(user, action, targetClientId = null) {
  if (!user || !user.clientProfile) return false

  const userLevel = user.clientProfile.level
  const userId = user.clientProfile.id

  switch (action) {
    case 'VIEW_CLIENT':
      return targetClientId ? canViewClient(user, targetClientId) : true
    
    case 'EDIT_CLIENT':
      return targetClientId ? canEditClient(user, targetClientId) : false
    
    case 'CREATE_CLIENT':
      return [USER_LEVELS.L5_ADMIN, USER_LEVELS.L4_AGENT].includes(userLevel)
    
    case 'DELETE_CLIENT':
      return userLevel === USER_LEVELS.L5_ADMIN
    
    case 'VIEW_TRANSACTIONS':
      return targetClientId ? canViewClient(user, targetClientId) : true
    
    case 'EDIT_TRANSACTIONS':
      return targetClientId ? canEditClient(user, targetClientId) : false
    
    case 'POST_TRANSACTIONS':
      return [USER_LEVELS.L5_ADMIN, USER_LEVELS.L4_AGENT].includes(userLevel)
    
    case 'VIEW_REPORTS':
      return targetClientId ? canViewClient(user, targetClientId) : true
    
    case 'EXPORT_DATA':
      return [USER_LEVELS.L5_ADMIN, USER_LEVELS.L4_AGENT, USER_LEVELS.L2_CLIENT].includes(userLevel)
    
    case 'MANAGE_USERS':
      return userLevel === USER_LEVELS.L5_ADMIN
    
    case 'MANAGE_ORGANIZATION':
      return userLevel === USER_LEVELS.L5_ADMIN
    
    case 'VIEW_AUDIT_LOGS':
      return userLevel === USER_LEVELS.L5_ADMIN
    
    default:
      return false
  }
}

export function requireRole(minLevel) {
  const levelHierarchy = {
    [USER_LEVELS.L2_CLIENT]: 2,
    [USER_LEVELS.L3_SUBCLIENT]: 3,
    [USER_LEVELS.L4_AGENT]: 4,
    [USER_LEVELS.L5_ADMIN]: 5
  }

  return async function(req, res, next) {
    try {
      const user = await getCurrentUser()
      
      if (!user || !user.clientProfile) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const userLevel = levelHierarchy[user.clientProfile.level] || 0
      const requiredLevel = levelHierarchy[minLevel] || 0

      if (userLevel < requiredLevel) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      req.user = user
      if (next) next()
      return user
    } catch (error) {
      console.error('Role check error:', error)
      return res?.status(500).json({ error: 'Internal server error' }) || null
    }
  }
}

export async function createUserProfile(clerkUserId, profileData) {
  try {
    const user = await db.user.findUnique({
      where: { clerkUserId }
    })

    if (!user) {
      throw new Error('User not found')
    }

    const clientProfile = await db.clientProfile.create({
      data: {
        userId: user.id,
        ...profileData
      },
      include: {
        organization: true,
        parentClient: true,
        subClients: true,
        masterAccounts: true,
        clientAccounts: true
      }
    })

    return clientProfile
  } catch (error) {
    console.error('Error creating user profile:', error)
    throw error
  }
}

export async function updateUserProfile(userId, profileData) {
  try {
    const clientProfile = await db.clientProfile.update({
      where: { userId },
      data: profileData,
      include: {
        organization: true,
        parentClient: true,
        subClients: true,
        masterAccounts: true,
        clientAccounts: true
      }
    })

    return clientProfile
  } catch (error) {
    console.error('Error updating user profile:', error)
    throw error
  }
}