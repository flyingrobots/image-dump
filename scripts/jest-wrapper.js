#!/usr/bin/env node

console.error(`
❌ ERROR: Direct Jest execution is not supported!

All tests must run in Docker to ensure consistency with CI.

Please use one of these commands instead:
  • npm test          - Run all tests
  • make test         - Run all tests
  • npm run test:watch - Run tests in watch mode
  • make test-watch   - Run tests in watch mode

This ensures your tests run in the exact same environment as CI.
`);

process.exit(1);