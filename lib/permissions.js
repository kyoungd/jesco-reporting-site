import { db } from './db'
import { USER_LEVELS } from './constants'

export function canViewClient(user, clientId) {
  if (!user || !user.clientProfile) return false

  const userLevel = user.clientProfile.level
  const userClientId = user.clientProfile.id
  const userOrgId = user.clientProfile.organizationId

  switch (userLevel) {
    case USER_LEVELS.L5_ADMIN:
      return true

    case USER_LEVELS.L4_AGENT:
      return true

    case USER_LEVELS.L2_CLIENT:
      if (userClientId === clientId) return true
      const subClientIds = user.clientProfile.subClients?.map(sub => sub.id) || []
      return subClientIds.includes(clientId)

    case USER_LEVELS.L3_SUBCLIENT:
      return userClientId === clientId

    default:
      return false
  }
}

export function canEditClient(user, clientId) {
  if (!user || !user.clientProfile) return false

  const userLevel = user.clientProfile.level
  const userClientId = user.clientProfile.id

  switch (userLevel) {
    case USER_LEVELS.L5_ADMIN:
      return true

    case USER_LEVELS.L4_AGENT:
      return true

    case USER_LEVELS.L2_CLIENT:
      if (userClientId === clientId) return true
      const subClientIds = user.clientProfile.subClients?.map(sub => sub.id) || []
      return subClientIds.includes(clientId)

    case USER_LEVELS.L3_SUBCLIENT:
      return userClientId === clientId

    default:
      return false
  }
}

export async function getViewableClients(user) {
  if (!user || !user.clientProfile) return []

  const userLevel = user.clientProfile.level
  const userClientId = user.clientProfile.id
  const userOrgId = user.clientProfile.organizationId

  try {
    switch (userLevel) {
      case USER_LEVELS.L5_ADMIN: {
        const allClients = await db.clientProfile.findMany({
          select: { id: true }
        })
        return allClients.map(client => client.id)
      }

      case USER_LEVELS.L4_AGENT: {
        if (userOrgId) {
          const orgClients = await db.clientProfile.findMany({
            where: { organizationId: userOrgId },
            select: { id: true }
          })
          return orgClients.map(client => client.id)
        } else {
          const allClients = await db.clientProfile.findMany({
            select: { id: true }
          })
          return allClients.map(client => client.id)
        }
      }

      case USER_LEVELS.L2_CLIENT: {
        const clientWithChildren = await db.clientProfile.findUnique({
          where: { id: userClientId },
          include: {
            subClients: {
              select: { id: true }
            }
          }
        })
        
        const viewableIds = [userClientId]
        if (clientWithChildren?.subClients) {
          viewableIds.push(...clientWithChildren.subClients.map(sub => sub.id))
        }
        return viewableIds
      }

      case USER_LEVELS.L3_SUBCLIENT: {
        return [userClientId]
      }

      default:
        return []
    }
  } catch (error) {
    console.error('Error getting viewable clients:', error)
    return []
  }
}

export async function getEditableClients(user) {
  return getViewableClients(user)
}

export function canViewAccount(user, accountId, accountClientId) {
  return canViewClient(user, accountClientId)
}

export function canEditAccount(user, accountId, accountClientId) {
  return canEditClient(user, accountClientId)
}

export function canViewTransaction(user, transaction) {
  return canViewClient(user, transaction.clientProfileId)
}

export function canEditTransaction(user, transaction) {
  if (!canEditClient(user, transaction.clientProfileId)) return false
  
  const userLevel = user.clientProfile.level
  if (transaction.entryStatus === 'POSTED') {
    return [USER_LEVELS.L5_ADMIN, USER_LEVELS.L4_AGENT].includes(userLevel)
  }
  
  return true
}

export function canPostTransaction(user, transaction) {
  if (!canEditClient(user, transaction.clientProfileId)) return false
  
  const userLevel = user.clientProfile.level
  return [USER_LEVELS.L5_ADMIN, USER_LEVELS.L4_AGENT].includes(userLevel)
}

export function canDeleteTransaction(user, transaction) {
  if (!canEditClient(user, transaction.clientProfileId)) return false
  
  const userLevel = user.clientProfile.level
  if (transaction.entryStatus === 'POSTED') {
    return userLevel === USER_LEVELS.L5_ADMIN
  }
  
  return [USER_LEVELS.L5_ADMIN, USER_LEVELS.L4_AGENT].includes(userLevel)
}

export async function filterClientsByPermission(user, clients) {
  if (!user || !user.clientProfile) return []

  const viewableClientIds = await getViewableClients(user)
  return clients.filter(client => viewableClientIds.includes(client.id))
}

export async function filterTransactionsByPermission(user, transactions) {
  if (!user || !user.clientProfile) return []

  const viewableClientIds = await getViewableClients(user)
  return transactions.filter(transaction => 
    viewableClientIds.includes(transaction.clientProfileId)
  )
}

export async function filterAccountsByPermission(user, accounts) {
  if (!user || !user.clientProfile) return []

  const viewableClientIds = await getViewableClients(user)
  return accounts.filter(account => 
    viewableClientIds.includes(account.clientProfileId)
  )
}

export function hasSystemAdminAccess(user) {
  return user?.clientProfile?.level === USER_LEVELS.L5_ADMIN
}

export function hasAgentAccess(user) {
  const userLevel = user?.clientProfile?.level
  return [USER_LEVELS.L5_ADMIN, USER_LEVELS.L4_AGENT].includes(userLevel)
}

export function hasClientAccess(user) {
  const userLevel = user?.clientProfile?.level
  return [
    USER_LEVELS.L5_ADMIN, 
    USER_LEVELS.L4_AGENT, 
    USER_LEVELS.L2_CLIENT
  ].includes(userLevel)
}

export function canManageOrganization(user) {
  return user?.clientProfile?.level === USER_LEVELS.L5_ADMIN
}

export function canViewAuditLogs(user) {
  return user?.clientProfile?.level === USER_LEVELS.L5_ADMIN
}

export function canExportData(user) {
  const userLevel = user?.clientProfile?.level
  return [
    USER_LEVELS.L5_ADMIN, 
    USER_LEVELS.L4_AGENT, 
    USER_LEVELS.L2_CLIENT
  ].includes(userLevel)
}

export function canCreateReports(user) {
  return user?.clientProfile?.level !== USER_LEVELS.L3_SUBCLIENT
}

export async function getClientHierarchy(user, clientId) {
  if (!canViewClient(user, clientId)) return null

  try {
    const client = await db.clientProfile.findUnique({
      where: { id: clientId },
      include: {
        parentClient: {
          include: {
            parentClient: true,
            organization: true
          }
        },
        subClients: {
          include: {
            subClients: true
          }
        },
        organization: true
      }
    })

    return client
  } catch (error) {
    console.error('Error getting client hierarchy:', error)
    return null
  }
}