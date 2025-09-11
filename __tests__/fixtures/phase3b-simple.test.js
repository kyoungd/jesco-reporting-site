import { jest } from '@jest/globals'
import { mockSecurities, mockApiResponses, createMockSecurity } from './phase3b-data.js'

describe('Phase 3B Data Fixtures', () => {
  describe('Mock Securities', () => {
    it('should have mock securities data', () => {
      expect(mockSecurities).toBeDefined()
      expect(Array.isArray(mockSecurities)).toBe(true)
      expect(mockSecurities.length).toBeGreaterThan(0)
    })

    it('should have required security fields', () => {
      const security = mockSecurities[0]
      expect(security).toHaveProperty('id')
      expect(security).toHaveProperty('ticker')
      expect(security).toHaveProperty('name')
      expect(security).toHaveProperty('type')
      expect(security).toHaveProperty('exchange')
      expect(security).toHaveProperty('isActive')
    })

    it('should create mock security with factory function', () => {
      const customSecurity = createMockSecurity({
        ticker: 'TEST',
        name: 'Test Security'
      })
      
      expect(customSecurity.ticker).toBe('TEST')
      expect(customSecurity.name).toBe('Test Security')
      expect(customSecurity.type).toBe('Stock') // default
      expect(customSecurity.isActive).toBe(true) // default
    })
  })

  describe('Mock API Responses', () => {
    it('should have securities list response', () => {
      expect(mockApiResponses.securitiesList).toBeDefined()
      expect(mockApiResponses.securitiesList.success).toBe(true)
      expect(mockApiResponses.securitiesList.data).toEqual(mockSecurities)
    })

    it('should have empty securities response', () => {
      expect(mockApiResponses.securitiesListEmpty).toBeDefined()
      expect(mockApiResponses.securitiesListEmpty.success).toBe(true)
      expect(mockApiResponses.securitiesListEmpty.data).toEqual([])
    })
  })
})