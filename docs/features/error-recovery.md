# Feature: Error Recovery Mechanisms

**Status**: ✅ Completed  
**Priority**: 🔴 High  
**Milestone**: Phase 3 - Configuration & Customization  
**Issue**: #[TBD]

## Overview

Implement comprehensive error recovery mechanisms to ensure the image optimization system can gracefully handle failures, retry transient errors, and resume interrupted batch operations. This feature is critical for reliability in production environments.

## User Stories

### Story 1: Developer - Resilient Batch Processing
**As a** developer processing large batches of images  
**I want** the system to continue processing after individual failures  
**So that** one bad image doesn't stop the entire batch

**Acceptance Criteria:**
- [ ] Processing continues after individual file failures
- [ ] Failed files are logged with detailed error information
- [ ] Summary report shows successful vs failed files
- [ ] Exit code indicates partial success

### Story 2: CI/CD Pipeline - Transient Error Handling
**As a** CI/CD pipeline  
**I want** automatic retry of transient failures  
**So that** temporary issues don't fail the build

**Acceptance Criteria:**
- [ ] Network errors are retried automatically
- [ ] File system errors are retried with backoff
- [ ] Configurable retry count and delays
- [ ] Clear logging of retry attempts

### Story 3: User - Resume Interrupted Processing
**As a** user with interrupted batch processing  
**I want** to resume from where it stopped  
**So that** I don't reprocess completed files

**Acceptance Criteria:**
- [ ] State is saved during batch processing
- [ ] Can resume using saved state file
- [ ] Skips already processed files
- [ ] Handles state file corruption gracefully

## Technical Specification

### Architecture

```
┌─────────────────┐
│  Batch Process  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ Error Handler   │────▶│ Retry Logic  │
└────────┬────────┘     └──────────────┘
         │
         ├─────────────────┐
         ▼                 ▼
┌─────────────────┐ ┌──────────────┐
│  Error Logger   │ │ State Saver  │
└─────────────────┘ └──────────────┘
```

### Components

#### ErrorRecoveryManager
Main coordinator for error handling and recovery:
```javascript
class ErrorRecoveryManager {
  constructor(options) {
    this.continueOnError = options.continueOnError || false;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.stateFile = options.stateFile || '.image-optimization-state.json';
    this.errorLog = options.errorLog || 'image-optimization-errors.log';
  }

  async processWithRecovery(operation, context) {
    // Handles retries and error logging
  }

  async saveState(state) {
    // Saves processing state for resume
  }

  async loadState() {
    // Loads previous state if exists
  }
}
```

#### RetryHandler
Implements exponential backoff retry logic:
```javascript
class RetryHandler {
  async retry(operation, options) {
    const { maxAttempts, delay, backoff, shouldRetry } = options;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts || !shouldRetry(error)) {
          throw error;
        }
        await this.delay(delay * Math.pow(backoff, attempt - 1));
      }
    }
  }
}
```

#### ErrorLogger
Structured error logging:
```javascript
class ErrorLogger {
  constructor(logPath) {
    this.logPath = logPath;
    this.errors = [];
  }

  logError(file, error, context) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      file,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context,
      retryCount: context.retryCount || 0
    };
    
    this.errors.push(errorEntry);
    this.appendToFile(errorEntry);
  }

  generateReport() {
    // Creates summary report
  }
}
```

### Error Categories

#### Retryable Errors
- `ENOENT` - File not found (might be temporary)
- `EBUSY` - Resource busy
- `ETIMEDOUT` - Network timeout
- `ECONNRESET` - Connection reset
- Git LFS download failures

#### Non-Retryable Errors
- Invalid image format
- Corrupted file data
- Validation failures
- Out of memory
- Permission denied

### API Design

```javascript
// CLI flags
--continue-on-error    // Don't stop on individual failures
--max-retries=3       // Maximum retry attempts
--retry-delay=1000    // Initial retry delay in ms
--resume              // Resume from saved state
--error-log=PATH      // Custom error log location

// Configuration in .imagerc
{
  "errorRecovery": {
    "continueOnError": true,
    "maxRetries": 3,
    "retryDelay": 1000,
    "exponentialBackoff": true,
    "saveState": true,
    "errorLog": "./optimization-errors.log"
  }
}
```

### State Management

```javascript
// State file format
{
  "version": "1.0",
  "startedAt": "2024-01-10T10:00:00Z",
  "lastUpdatedAt": "2024-01-10T10:15:00Z",
  "configuration": { /* snapshot of config */ },
  "progress": {
    "total": 1000,
    "processed": 450,
    "succeeded": 440,
    "failed": 10,
    "remaining": 550
  },
  "files": {
    "processed": [
      { "path": "img1.png", "status": "success", "outputs": [...] },
      { "path": "img2.png", "status": "failed", "error": "..." }
    ],
    "pending": [
      "img3.png",
      "img4.png"
    ]
  }
}
```

## Implementation Plan

### Phase 1: Basic Error Handling
- [x] Add --continue-on-error flag
- [x] Implement basic error logging
- [x] Continue processing after failures
- [x] Generate summary report

### Phase 2: Retry Logic
- [ ] Implement RetryHandler class
- [ ] Add exponential backoff
- [ ] Configure retryable error types
- [ ] Add retry attempt logging

### Phase 3: State Management
- [ ] Implement state saving
- [ ] Add --resume flag
- [ ] Handle state file corruption
- [ ] Clean up old state files

### Phase 4: Integration
- [ ] Update optimize-images.js
- [ ] Add configuration options
- [ ] Update documentation
- [ ] Add comprehensive tests

## Test Plan

### Unit Tests
- RetryHandler with various error types
- ErrorLogger file operations
- State save/load functionality
- Error classification logic

### Integration Tests
- Full batch with mixed success/failures
- Resume from interrupted state
- Retry behavior with mocked errors
- Configuration loading

### E2E Tests
- Large batch with real failures
- Network interruption simulation
- Disk space exhaustion
- Process termination and resume

## Success Criteria

- 95% of transient errors recovered automatically
- Zero data loss from interrupted batches
- Clear error reporting for debugging
- Minimal performance impact (<5%)
- Reliable state management

## References

- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Graceful Degradation](https://en.wikipedia.org/wiki/Graceful_degradation)