module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'scripts/lib/**/*.js',
    '!scripts/lib/**/*.test.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  verbose: true
};