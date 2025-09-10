require('dotenv').config({ path: '.env.test' })

module.exports = async () => {
  console.log('🧪 Integration tests global setup started')
  
  // Verify test database URL is set
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must be set for integration tests')
  }
  
  console.log('✅ Integration tests global setup complete')
}