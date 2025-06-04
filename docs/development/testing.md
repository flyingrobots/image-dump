# Testing Guide

## Overview

This project follows Test-Driven Development (TDD) principles with comprehensive test coverage across unit, integration, and end-to-end tests.

## Test Structure

```
tests/
├── lib/                    # Unit tests
│   ├── git-lfs-detector.test.js
│   ├── git-lfs-puller.test.js
│   ├── file-timestamp-checker.test.js
│   ├── image-processor.test.js
│   ├── output-path-generator.test.js
│   └── image-optimizer.test.js
├── integration/           # Integration tests
│   └── pipeline.test.js
└── e2e/                  # End-to-end tests
    └── cli.test.js
```

## Running Tests

### Using Docker (Recommended)

```bash
# Run all tests
make test

# Run tests with coverage
make test-coverage

# Run tests in watch mode
make test-watch
```

### Using Node.js

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm run test:watch
```

## Writing Tests

### Unit Tests

Unit tests focus on individual components in isolation using test doubles.

```javascript
const GitLfsDetector = require('../../scripts/lib/git-lfs-detector');

describe('GitLfsDetector', () => {
  let detector;
  let mockFileReader;

  beforeEach(() => {
    mockFileReader = {
      readFile: jest.fn()
    };
    detector = new GitLfsDetector(mockFileReader);
  });

  it('should detect LFS pointer files', async () => {
    mockFileReader.readFile.mockResolvedValue('version https://git-lfs.github.com/spec/v1');
    const result = await detector.isGitLfsPointer('/path/to/file');
    expect(result).toBe(true);
  });
});
```

### Key Principles

1. **Single Responsibility**: Each test should verify one behavior
2. **Test Doubles**: Use mocks/stubs for dependencies
3. **No Spies**: Prefer dependency injection over spying
4. **Clear Names**: Test names should describe the behavior being tested

### Integration Tests

Integration tests verify that components work together correctly.

```javascript
describe('Image Optimization Pipeline', () => {
  it('should process image through full pipeline', async () => {
    // Test with real components but mock external services
  });
});
```

### E2E Tests

End-to-end tests verify complete user workflows.

```javascript
describe('CLI Operations', () => {
  it('should optimize all images in directory', async () => {
    // Test actual CLI commands
  });
});
```

## Test Coverage

### Current Goals
- Unit Tests: 90% coverage
- Integration Tests: 80% coverage
- E2E Tests: Core user journeys

### Viewing Coverage

```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

## Best Practices

### 1. Arrange-Act-Assert

```javascript
it('should process image', async () => {
  // Arrange
  const inputPath = '/test/image.png';
  const processor = new ImageProcessor(mockSharp);
  
  // Act
  const result = await processor.processImage(inputPath, configs);
  
  // Assert
  expect(result[0].success).toBe(true);
});
```

### 2. Descriptive Test Names

```javascript
// ❌ Bad
it('should work', () => {});

// ✅ Good
it('should return false when file cannot be read as text', () => {});
```

### 3. Test Data Builders

```javascript
const createTestImage = (overrides = {}) => ({
  path: '/test/image.png',
  format: 'png',
  width: 1000,
  height: 1000,
  ...overrides
});
```

### 4. Avoid Test Interdependence

Each test should be able to run independently in any order.

## Debugging Tests

### Run Single Test File

```bash
npm test -- git-lfs-detector.test.js
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="should detect LFS"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Continuous Integration

Tests run automatically on:
- Every push to feature branches
- Pull requests
- Main branch commits

See [.github/workflows/test.yml](../../.github/workflows/test.yml) for CI configuration.

## Common Issues

### Sharp Installation

If Sharp fails to install in tests:

```bash
# Clear npm cache
npm cache clean --force

# Rebuild
npm rebuild sharp
```

### Memory Issues

For large test suites:

```bash
# Increase Node memory
NODE_OPTIONS=--max_old_space_size=4096 npm test
```

### Timeout Issues

Increase Jest timeout for slow tests:

```javascript
jest.setTimeout(10000); // 10 seconds
```

## Future Improvements

- [ ] Visual regression tests for image output
- [ ] Performance benchmarks in tests
- [ ] Mutation testing for test quality
- [ ] Parallel test execution
- [ ] Test data fixtures repository