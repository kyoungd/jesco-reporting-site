import { z } from 'zod'
import { 
  USER_LEVELS, 
  TRANSACTION_TYPES, 
  ACCOUNT_TYPES, 
  ASSET_CLASSES,
  ENTRY_STATUS,
  CURRENCIES 
} from './constants'

const userLevelEnum = z.enum([
  USER_LEVELS.L2_CLIENT,
  USER_LEVELS.L3_SUBCLIENT,
  USER_LEVELS.L4_AGENT,
  USER_LEVELS.L5_ADMIN
])

const transactionTypeEnum = z.enum([
  TRANSACTION_TYPES.BUY,
  TRANSACTION_TYPES.SELL,
  TRANSACTION_TYPES.DIVIDEND,
  TRANSACTION_TYPES.INTEREST,
  TRANSACTION_TYPES.FEE,
  TRANSACTION_TYPES.TAX,
  TRANSACTION_TYPES.TRANSFER_IN,
  TRANSACTION_TYPES.TRANSFER_OUT,
  TRANSACTION_TYPES.CORPORATE_ACTION,
  TRANSACTION_TYPES.SPLIT,
  TRANSACTION_TYPES.MERGER,
  TRANSACTION_TYPES.SPINOFF
])

const accountTypeEnum = z.enum([
  ACCOUNT_TYPES.INVESTMENT,
  ACCOUNT_TYPES.CASH,
  ACCOUNT_TYPES.MARGIN,
  ACCOUNT_TYPES.RETIREMENT,
  ACCOUNT_TYPES.TRUST,
  ACCOUNT_TYPES.CUSTODIAL
])

const assetClassEnum = z.enum([
  ASSET_CLASSES.EQUITY,
  ASSET_CLASSES.FIXED_INCOME,
  ASSET_CLASSES.CASH,
  ASSET_CLASSES.ALTERNATIVE,
  ASSET_CLASSES.COMMODITY,
  ASSET_CLASSES.REAL_ESTATE,
  ASSET_CLASSES.DERIVATIVE
])

const entryStatusEnum = z.enum([
  ENTRY_STATUS.DRAFT,
  ENTRY_STATUS.POSTED
])

const currencyEnum = z.enum([
  CURRENCIES.USD,
  CURRENCIES.EUR,
  CURRENCIES.GBP,
  CURRENCIES.JPY,
  CURRENCIES.CAD,
  CURRENCIES.AUD,
  CURRENCIES.CHF
])

export const clientProfileSchema = z.object({
  id: z.string().cuid().optional(),
  userId: z.string().cuid(),
  organizationId: z.string().cuid().nullable().optional(),
  parentClientId: z.string().cuid().nullable().optional(),
  level: userLevelEnum.default(USER_LEVELS.L2_CLIENT),
  secdexCode: z.string().min(1).max(20).nullable().optional(),
  companyName: z.string().min(1).max(255).nullable().optional(),
  contactName: z.string().min(1).max(255).nullable().optional(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zipCode: z.string().max(20).nullable().optional(),
  country: z.string().length(2).default('US'),
  timeZone: z.string().default('America/New_York'),
  isActive: z.boolean().default(true)
})

export const transactionSchema = z.object({
  id: z.string().cuid().optional(),
  transactionDate: z.date(),
  tradeDate: z.date().nullable().optional(),
  settlementDate: z.date().nullable().optional(),
  transactionType: transactionTypeEnum,
  securityId: z.string().cuid().nullable().optional(),
  quantity: z.number().multipleOf(0.000001).nullable().optional(),
  price: z.number().positive().multipleOf(0.000001).nullable().optional(),
  amount: z.number().multipleOf(0.01),
  fee: z.number().nonnegative().multipleOf(0.01).nullable().optional(),
  tax: z.number().nonnegative().multipleOf(0.01).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  reference: z.string().max(100).nullable().optional(),
  entryStatus: entryStatusEnum.default(ENTRY_STATUS.DRAFT),
  masterAccountId: z.string().cuid().nullable().optional(),
  clientAccountId: z.string().cuid().nullable().optional(),
  clientProfileId: z.string().cuid()
}).refine(
  (data) => {
    const requiresQuantityAndPrice = [
      TRANSACTION_TYPES.BUY,
      TRANSACTION_TYPES.SELL
    ].includes(data.transactionType)
    
    if (requiresQuantityAndPrice) {
      return data.quantity !== null && data.price !== null && data.securityId !== null
    }
    return true
  },
  {
    message: "Buy/Sell transactions require quantity, price, and security",
    path: ["quantity"]
  }
)

export const priceSchema = z.object({
  id: z.string().cuid().optional(),
  securityId: z.string().cuid(),
  date: z.date(),
  open: z.number().positive().multipleOf(0.000001).nullable().optional(),
  high: z.number().positive().multipleOf(0.000001).nullable().optional(),
  low: z.number().positive().multipleOf(0.000001).nullable().optional(),
  close: z.number().positive().multipleOf(0.000001),
  volume: z.bigint().nonnegative().nullable().optional(),
  adjustedClose: z.number().positive().multipleOf(0.000001).nullable().optional()
}).refine(
  (data) => {
    if (data.high && data.low) {
      return data.high >= data.low
    }
    return true
  },
  {
    message: "High price must be greater than or equal to low price",
    path: ["high"]
  }
).refine(
  (data) => {
    if (data.open && data.high && data.low) {
      return data.open >= data.low && data.open <= data.high
    }
    return true
  },
  {
    message: "Open price must be between low and high prices",
    path: ["open"]
  }
).refine(
  (data) => {
    if (data.close && data.high && data.low) {
      return data.close >= data.low && data.close <= data.high
    }
    return true
  },
  {
    message: "Close price must be between low and high prices", 
    path: ["close"]
  }
)

export const accountSchema = z.object({
  id: z.string().cuid().optional(),
  accountNumber: z.string().min(1).max(50),
  accountName: z.string().min(1).max(255),
  accountType: accountTypeEnum.default(ACCOUNT_TYPES.INVESTMENT),
  clientProfileId: z.string().cuid(),
  custodian: z.string().max(100).nullable().optional(),
  isActive: z.boolean().default(true)
})

export const masterAccountSchema = accountSchema.extend({
  organizationId: z.string().cuid().nullable().optional()
})

export const clientAccountSchema = accountSchema.extend({
  masterAccountId: z.string().cuid()
})

export const securitySchema = z.object({
  id: z.string().cuid().optional(),
  symbol: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(1).max(255),
  assetClass: assetClassEnum,
  exchange: z.string().max(50).nullable().optional(),
  currency: currencyEnum.default(CURRENCIES.USD),
  country: z.string().length(2).default('US'),
  sector: z.string().max(100).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  isActive: z.boolean().default(true)
})

export const positionSchema = z.object({
  id: z.string().cuid().optional(),
  date: z.date(),
  securityId: z.string().cuid(),
  quantity: z.number().multipleOf(0.000001),
  averageCost: z.number().positive().multipleOf(0.000001).nullable().optional(),
  marketValue: z.number().multipleOf(0.01).nullable().optional(),
  unrealizedGainLoss: z.number().multipleOf(0.01).nullable().optional(),
  masterAccountId: z.string().cuid().nullable().optional(),
  clientAccountId: z.string().cuid().nullable().optional(),
  clientProfileId: z.string().cuid()
})

export const organizationSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(500).nullable().optional(),
  website: z.string().url().nullable().optional(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zipCode: z.string().max(20).nullable().optional(),
  country: z.string().length(2).default('US').optional(),
  isActive: z.boolean().default(true)
})

export const benchmarkSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(255),
  symbol: z.string().min(1).max(20).toUpperCase(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  isActive: z.boolean().default(true)
})

export const feeScheduleSchema = z.object({
  id: z.string().cuid().optional(),
  clientProfileId: z.string().cuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(500).nullable().optional(),
  feeType: z.string().min(1).max(50),
  feeRate: z.number().nonnegative().max(1),
  minimumFee: z.number().nonnegative().multipleOf(0.01).nullable().optional(),
  maximumFee: z.number().nonnegative().multipleOf(0.01).nullable().optional(),
  assetClass: assetClassEnum.nullable().optional(),
  effectiveDate: z.date(),
  expirationDate: z.date().nullable().optional(),
  isActive: z.boolean().default(true)
}).refine(
  (data) => {
    if (data.minimumFee && data.maximumFee) {
      return data.maximumFee >= data.minimumFee
    }
    return true
  },
  {
    message: "Maximum fee must be greater than or equal to minimum fee",
    path: ["maximumFee"]
  }
).refine(
  (data) => {
    if (data.expirationDate) {
      return data.expirationDate > data.effectiveDate
    }
    return true
  },
  {
    message: "Expiration date must be after effective date",
    path: ["expirationDate"]
  }
)

export const auditLogSchema = z.object({
  id: z.string().cuid().optional(),
  userId: z.string().cuid(),
  action: z.string().min(1).max(100),
  entityType: z.string().min(1).max(100),
  entityId: z.string().cuid().nullable().optional(),
  oldValues: z.record(z.any()).nullable().optional(),
  newValues: z.record(z.any()).nullable().optional(),
  ipAddress: z.string().ip().nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
  timestamp: z.date().default(() => new Date())
})

export const userSchema = z.object({
  id: z.string().cuid().optional(),
  clerkUserId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  level: userLevelEnum.default(USER_LEVELS.L2_CLIENT),
  isActive: z.boolean().default(true)
})

export const queryParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  status: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
})

export function validateSchema(schema, data) {
  try {
    return {
      success: true,
      data: schema.parse(data),
      errors: null
    }
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.errors
    }
  }
}