import {
  clientProfileSchema,
  transactionSchema,
  priceSchema,
  accountSchema,
  securitySchema,
  validateSchema
} from '../../../lib/validation.js'
import { USER_LEVELS, TRANSACTION_TYPES, ASSET_CLASSES, ACCOUNT_TYPES } from '../../../lib/constants.js'

describe('Validation Library (Unit Tests)', () => {
  describe('clientProfileSchema', () => {
    const validClientProfile = {
      userId: 'clkqj2l4k0000qt3m1234567',
      level: USER_LEVELS.L2_CLIENT,
      companyName: 'Test Company',
      contactName: 'John Doe',
      phone: '+1-555-123-4567',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US'
    }

    it('should validate a correct client profile', () => {
      const result = validateSchema(clientProfileSchema, validClientProfile)
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject(validClientProfile)
    })

    it('should require userId', () => {
      const invalid = { ...validClientProfile }
      delete invalid.userId
      
      const result = validateSchema(clientProfileSchema, invalid)
      expect(result.success).toBe(false)
      expect(result.errors[0].path).toContain('userId')
    })

    it('should validate phone number format', () => {
      const invalidPhone = { ...validClientProfile, phone: 'invalid-phone' }
      const result = validateSchema(clientProfileSchema, invalidPhone)
      expect(result.success).toBe(false)
    })

    it('should validate country code length', () => {
      const invalidCountry = { ...validClientProfile, country: 'USA' }
      const result = validateSchema(clientProfileSchema, invalidCountry)
      expect(result.success).toBe(false)
    })

    it('should set default values', () => {
      const minimal = { userId: 'clkqj2l4k0000qt3m1234567' }
      const result = validateSchema(clientProfileSchema, minimal)
      expect(result.success).toBe(true)
      expect(result.data.level).toBe(USER_LEVELS.L2_CLIENT)
      expect(result.data.country).toBe('US')
      expect(result.data.isActive).toBe(true)
    })
  })

  describe('transactionSchema', () => {
    const validTransaction = {
      transactionDate: new Date('2024-01-15'),
      transactionType: TRANSACTION_TYPES.BUY,
      securityId: 'clkqj2l4k0000qt3m1234567',
      quantity: 100.0,
      price: 25.50,
      amount: 2550.00,
      fee: 9.99,
      clientProfileId: 'clkqj2l4k0000qt3m1234567'
    }

    it('should validate a correct buy transaction', () => {
      const result = validateSchema(transactionSchema, validTransaction)
      expect(result.success).toBe(true)
    })

    it('should require security, quantity, and price for buy/sell transactions', () => {
      const buyWithoutSecurity = {
        ...validTransaction,
        securityId: null
      }
      
      const result = validateSchema(transactionSchema, buyWithoutSecurity)
      expect(result.success).toBe(false)
    })

    it('should allow dividend transactions without quantity/price', () => {
      const dividend = {
        transactionDate: new Date('2024-01-15'),
        transactionType: TRANSACTION_TYPES.DIVIDEND,
        amount: 100.00,
        clientProfileId: 'clkqj2l4k0000qt3m1234567'
      }
      
      const result = validateSchema(transactionSchema, dividend)
      expect(result.success).toBe(true)
    })

    it('should validate amount precision (2 decimal places)', () => {
      const invalidAmount = { ...validTransaction, amount: 25.505 }
      const result = validateSchema(transactionSchema, invalidAmount)
      expect(result.success).toBe(false)
    })

    it('should validate negative fees are not allowed', () => {
      const negativeFee = { ...validTransaction, fee: -5.00 }
      const result = validateSchema(transactionSchema, negativeFee)
      expect(result.success).toBe(false)
    })

    it('should set default entry status to DRAFT', () => {
      const result = validateSchema(transactionSchema, validTransaction)
      expect(result.success).toBe(true)
      expect(result.data.entryStatus).toBe('DRAFT')
    })
  })

  describe('priceSchema', () => {
    const validPrice = {
      securityId: 'clkqj2l4k0000qt3m1234567',
      date: new Date('2024-01-15'),
      open: 25.00,
      high: 26.50,
      low: 24.75,
      close: 26.25,
      volume: BigInt(1000000)
    }

    it('should validate a correct price record', () => {
      const result = validateSchema(priceSchema, validPrice)
      expect(result.success).toBe(true)
    })

    it('should require close price', () => {
      const invalid = { ...validPrice }
      delete invalid.close
      
      const result = validateSchema(priceSchema, invalid)
      expect(result.success).toBe(false)
    })

    it('should validate high >= low constraint', () => {
      const invalid = { ...validPrice, high: 20.00, low: 25.00 }
      const result = validateSchema(priceSchema, invalid)
      expect(result.success).toBe(false)
    })

    it('should validate open is between low and high', () => {
      const invalid = { ...validPrice, open: 30.00, high: 26.50, low: 24.75 }
      const result = validateSchema(priceSchema, invalid)
      expect(result.success).toBe(false)
    })

    it('should validate close is between low and high', () => {
      const invalid = { ...validPrice, close: 30.00, high: 26.50, low: 24.75 }
      const result = validateSchema(priceSchema, invalid)
      expect(result.success).toBe(false)
    })

    it('should allow null optional fields', () => {
      const minimal = {
        securityId: 'clkqj2l4k0000qt3m1234567',
        date: new Date('2024-01-15'),
        close: 25.00
      }
      
      const result = validateSchema(priceSchema, minimal)
      expect(result.success).toBe(true)
    })
  })

  describe('accountSchema', () => {
    const validAccount = {
      accountNumber: 'ACC-123456',
      accountName: 'Test Investment Account',
      accountType: ACCOUNT_TYPES.INVESTMENT,
      clientProfileId: 'clkqj2l4k0000qt3m1234567',
      custodian: 'Test Custodian'
    }

    it('should validate a correct account', () => {
      const result = validateSchema(accountSchema, validAccount)
      expect(result.success).toBe(true)
    })

    it('should require account number and name', () => {
      const invalid = { ...validAccount }
      delete invalid.accountNumber
      delete invalid.accountName
      
      const result = validateSchema(accountSchema, invalid)
      expect(result.success).toBe(false)
      expect(result.errors.length).toBe(2)
    })

    it('should set default account type to INVESTMENT', () => {
      const withoutType = { ...validAccount }
      delete withoutType.accountType
      
      const result = validateSchema(accountSchema, withoutType)
      expect(result.success).toBe(true)
      expect(result.data.accountType).toBe(ACCOUNT_TYPES.INVESTMENT)
    })

    it('should set default isActive to true', () => {
      const result = validateSchema(accountSchema, validAccount)
      expect(result.success).toBe(true)
      expect(result.data.isActive).toBe(true)
    })
  })

  describe('securitySchema', () => {
    const validSecurity = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      assetClass: ASSET_CLASSES.EQUITY,
      exchange: 'NASDAQ',
      currency: 'USD',
      country: 'US',
      sector: 'Technology',
      industry: 'Consumer Electronics'
    }

    it('should validate a correct security', () => {
      const result = validateSchema(securitySchema, validSecurity)
      expect(result.success).toBe(true)
    })

    it('should convert symbol to uppercase', () => {
      const lowercase = { ...validSecurity, symbol: 'aapl' }
      const result = validateSchema(securitySchema, lowercase)
      expect(result.success).toBe(true)
      expect(result.data.symbol).toBe('AAPL')
    })

    it('should require symbol, name, and assetClass', () => {
      const invalid = {
        exchange: 'NASDAQ',
        currency: 'USD'
      }
      
      const result = validateSchema(securitySchema, invalid)
      expect(result.success).toBe(false)
      expect(result.errors.length).toBe(3)
    })

    it('should set default values', () => {
      const minimal = {
        symbol: 'TEST',
        name: 'Test Security',
        assetClass: ASSET_CLASSES.EQUITY
      }
      
      const result = validateSchema(securitySchema, minimal)
      expect(result.success).toBe(true)
      expect(result.data.currency).toBe('USD')
      expect(result.data.country).toBe('US')
      expect(result.data.isActive).toBe(true)
    })

    it('should validate country code length', () => {
      const invalid = { ...validSecurity, country: 'USA' }
      const result = validateSchema(securitySchema, invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('validateSchema helper', () => {
    const simpleSchema = clientProfileSchema.pick({ userId: true, level: true })

    it('should return success=true for valid data', () => {
      const validData = {
        userId: 'clkqj2l4k0000qt3m1234567',
        level: USER_LEVELS.L2_CLIENT
      }
      
      const result = validateSchema(simpleSchema, validData)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(validData)
      expect(result.errors).toBeNull()
    })

    it('should return success=false for invalid data', () => {
      const invalidData = {
        userId: '', // invalid - too short
        level: 'INVALID_LEVEL'
      }
      
      const result = validateSchema(simpleSchema, invalidData)
      expect(result.success).toBe(false)
      expect(result.data).toBeNull()
      expect(result.errors).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('should handle parsing errors gracefully', () => {
      const result = validateSchema(simpleSchema, null)
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })
})