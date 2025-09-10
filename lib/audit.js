import { db } from './db'
import { AUDIT_ACTIONS, ENTITY_TYPES } from './constants'

const AXIOM_DATASET = process.env.AXIOM_DATASET
const AXIOM_TOKEN = process.env.AXIOM_TOKEN
const BETTER_STACK_TOKEN = process.env.BETTER_STACK_SOURCE_TOKEN

export async function logToAxiom(event, userId, metadata = {}) {
  if (!AXIOM_DATASET || !AXIOM_TOKEN) {
    console.warn('Axiom logging not configured')
    return false
  }

  try {
    const logData = {
      timestamp: new Date().toISOString(),
      event,
      userId,
      ...metadata,
      _time: Date.now()
    }

    const response = await fetch(`https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AXIOM_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([logData])
    })

    if (!response.ok) {
      throw new Error(`Axiom API error: ${response.status}`)
    }

    return true
  } catch (error) {
    console.error('Error logging to Axiom:', error)
    return false
  }
}

export async function logToBetterStack(event, userId, metadata = {}) {
  if (!BETTER_STACK_TOKEN) {
    console.warn('Better Stack logging not configured')
    return false
  }

  try {
    const logData = {
      dt: new Date().toISOString(),
      level: metadata.level || 'info',
      message: `User ${userId} performed ${event}`,
      event,
      userId,
      ...metadata
    }

    const response = await fetch('https://in.logs.betterstack.com/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BETTER_STACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData)
    })

    if (!response.ok) {
      throw new Error(`Better Stack API error: ${response.status}`)
    }

    return true
  } catch (error) {
    console.error('Error logging to Better Stack:', error)
    return false
  }
}

export async function logToDatabase(event, userId, metadata = {}) {
  try {
    const auditLog = await db.auditLog.create({
      data: {
        userId,
        action: event,
        entityType: metadata.entityType || 'UNKNOWN',
        entityId: metadata.entityId || null,
        oldValues: metadata.oldValues || null,
        newValues: metadata.newValues || null,
        ipAddress: metadata.ipAddress || null,
        userAgent: metadata.userAgent || null,
        timestamp: new Date()
      }
    })

    return auditLog
  } catch (error) {
    console.error('Error logging to database:', error)
    return null
  }
}

export async function auditLog(event, userId, metadata = {}) {
  const results = {
    database: false,
    axiom: false,
    betterStack: false
  }

  try {
    const [dbResult, axiomResult, betterStackResult] = await Promise.allSettled([
      logToDatabase(event, userId, metadata),
      logToAxiom(event, userId, metadata),
      logToBetterStack(event, userId, metadata)
    ])

    results.database = dbResult.status === 'fulfilled' && dbResult.value !== null
    results.axiom = axiomResult.status === 'fulfilled' && axiomResult.value === true
    results.betterStack = betterStackResult.status === 'fulfilled' && betterStackResult.value === true

    if (dbResult.status === 'rejected') {
      console.error('Database audit log failed:', dbResult.reason)
    }
    if (axiomResult.status === 'rejected') {
      console.error('Axiom audit log failed:', axiomResult.reason)
    }
    if (betterStackResult.status === 'rejected') {
      console.error('Better Stack audit log failed:', betterStackResult.reason)
    }

    return results
  } catch (error) {
    console.error('Error in audit logging:', error)
    return results
  }
}

export async function auditUserAction(userId, action, metadata = {}, req = null) {
  const auditMetadata = {
    ...metadata,
    ipAddress: req?.ip || req?.connection?.remoteAddress || metadata.ipAddress,
    userAgent: req?.get('user-agent') || metadata.userAgent,
    timestamp: new Date()
  }

  return auditLog(action, userId, auditMetadata)
}

export async function auditEntityChange(userId, action, entityType, entityId, oldValues = null, newValues = null, req = null) {
  const metadata = {
    entityType,
    entityId,
    oldValues,
    newValues,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('user-agent')
  }

  return auditLog(action, userId, metadata)
}

export function createAuditMiddleware() {
  return async (req, res, next) => {
    const originalSend = res.send
    const originalJson = res.json
    
    req.auditLog = (event, metadata = {}) => {
      if (req.user?.id) {
        return auditUserAction(req.user.id, event, metadata, req)
      }
      return Promise.resolve({ database: false, axiom: false, betterStack: false })
    }

    req.auditEntityChange = (action, entityType, entityId, oldValues = null, newValues = null) => {
      if (req.user?.id) {
        return auditEntityChange(req.user.id, action, entityType, entityId, oldValues, newValues, req)
      }
      return Promise.resolve({ database: false, axiom: false, betterStack: false })
    }

    res.send = function(data) {
      if (res.statusCode >= 400 && req.user?.id) {
        auditUserAction(req.user.id, 'ERROR', {
          statusCode: res.statusCode,
          path: req.path,
          method: req.method,
          level: 'error'
        }, req)
      }
      return originalSend.call(this, data)
    }

    res.json = function(data) {
      if (res.statusCode >= 400 && req.user?.id) {
        auditUserAction(req.user.id, 'ERROR', {
          statusCode: res.statusCode,
          path: req.path,
          method: req.method,
          level: 'error'
        }, req)
      }
      return originalJson.call(this, data)
    }

    next()
  }
}

export const auditActions = {
  login: (userId, req) => auditUserAction(userId, AUDIT_ACTIONS.LOGIN, { level: 'info' }, req),
  logout: (userId, req) => auditUserAction(userId, AUDIT_ACTIONS.LOGOUT, { level: 'info' }, req),
  
  viewClient: (userId, clientId, req) => auditUserAction(userId, AUDIT_ACTIONS.VIEW, {
    entityType: ENTITY_TYPES.CLIENT_PROFILE,
    entityId: clientId
  }, req),
  
  createClient: (userId, clientId, clientData, req) => auditEntityChange(
    userId, AUDIT_ACTIONS.CREATE, ENTITY_TYPES.CLIENT_PROFILE, clientId, null, clientData, req
  ),
  
  updateClient: (userId, clientId, oldData, newData, req) => auditEntityChange(
    userId, AUDIT_ACTIONS.UPDATE, ENTITY_TYPES.CLIENT_PROFILE, clientId, oldData, newData, req
  ),
  
  deleteClient: (userId, clientId, clientData, req) => auditEntityChange(
    userId, AUDIT_ACTIONS.DELETE, ENTITY_TYPES.CLIENT_PROFILE, clientId, clientData, null, req
  ),
  
  createTransaction: (userId, transactionId, transactionData, req) => auditEntityChange(
    userId, AUDIT_ACTIONS.CREATE, ENTITY_TYPES.TRANSACTION, transactionId, null, transactionData, req
  ),
  
  updateTransaction: (userId, transactionId, oldData, newData, req) => auditEntityChange(
    userId, AUDIT_ACTIONS.UPDATE, ENTITY_TYPES.TRANSACTION, transactionId, oldData, newData, req
  ),
  
  deleteTransaction: (userId, transactionId, transactionData, req) => auditEntityChange(
    userId, AUDIT_ACTIONS.DELETE, ENTITY_TYPES.TRANSACTION, transactionId, transactionData, null, req
  ),
  
  exportData: (userId, exportType, filters, req) => auditUserAction(userId, AUDIT_ACTIONS.EXPORT, {
    entityType: ENTITY_TYPES.REPORT,
    exportType,
    filters
  }, req),
  
  importData: (userId, importType, recordCount, req) => auditUserAction(userId, AUDIT_ACTIONS.IMPORT, {
    importType,
    recordCount
  }, req)
}