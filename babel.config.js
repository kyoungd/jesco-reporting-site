module.exports = (api) => {
  // Only apply Babel configuration during testing
  if (api.env('test')) {
    return {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }
  }
  
  // Return empty config for non-test environments (let Next.js handle compilation)
  return {}
}