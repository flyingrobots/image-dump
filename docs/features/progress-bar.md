# Feature: Batch Processing Progress Bar

**Status**: ✅ Completed  
**Priority**: 🟡 Medium  
**Milestone**: Phase 3 - Configuration & Customization  
**Issue**: #[TBD]

## Overview

Implement a visual progress bar for batch image processing operations that provides real-time feedback on processing status, including current file, percentage complete, time elapsed, and estimated time remaining.

## User Stories

### Story 1: User - Visual Progress Feedback
**As a** user processing many images  
**I want** to see progress during batch operations  
**So that** I know the system is working and how long it will take

**Acceptance Criteria:**
- [ ] Shows current file being processed
- [ ] Displays percentage complete
- [ ] Shows elapsed and remaining time
- [ ] Updates smoothly without flickering
- [ ] Works in different terminal sizes

### Story 2: CI/CD - Clean Output Mode
**As a** CI/CD pipeline  
**I want** to disable the progress bar  
**So that** logs remain clean and parseable

**Acceptance Criteria:**
- [ ] --quiet flag disables progress bar
- [ ] Still shows important status messages
- [ ] Exit codes unchanged
- [ ] Machine-readable output option

### Story 3: Developer - Detailed Progress Info
**As a** developer debugging issues  
**I want** detailed progress information  
**So that** I can identify bottlenecks

**Acceptance Criteria:**
- [ ] Shows processing speed (images/sec)
- [ ] Displays current operation (resize, compress, etc.)
- [ ] Memory usage indicator (optional)
- [ ] Can be combined with verbose mode

## Technical Specification

### Architecture

```
┌─────────────────┐
│ Progress Manager │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ CLI Bar │ │ Logger │
└────────┘ └────────┘
```

### Components

#### ProgressManager
Central progress tracking and reporting:
```javascript
class ProgressManager {
  constructor(options = {}) {
    this.total = options.total || 0;
    this.current = 0;
    this.startTime = Date.now();
    this.isQuiet = options.quiet || false;
    this.isTTY = process.stdout.isTTY;
  }

  start(total) {
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
    if (!this.isQuiet && this.isTTY) {
      this.bar = this.createProgressBar();
    }
  }

  update(current, tokens = {}) {
    this.current = current;
    if (this.bar) {
      this.bar.update(current, tokens);
    }
  }

  finish() {
    if (this.bar) {
      this.bar.stop();
    }
  }
}
```

### Progress Bar Options

#### Library Selection
After evaluation, we'll use `cli-progress` for its features:
- Multiple bar support
- Custom formatting
- Graceful degradation
- No dependencies
- Good performance

Alternative considered:
- `ora` - Good for spinners but limited for progress
- `progress` - Simple but less features
- `gauge` - NPM's choice but heavier

#### Display Format
```
Processing images  ▓▓▓▓▓▓▓▓▓░░░░░░░░░  45% | 📸 45/100 | ⏱️  0:23 | ETA: 0:28 | 💾 image-45.png
```

Components:
- Progress bar with filled/empty blocks
- Percentage complete
- Current/total counter
- Elapsed time
- Estimated time remaining
- Current file name

#### Compact Mode (narrow terminals)
```
[45/100] 45% image-45.png
```

### Integration Points

1. **Main processing loop**
   - Initialize progress before loop
   - Update after each image
   - Show completion summary

2. **Error handling**
   - Continue progress on errors
   - Show error count in bar
   - Red color for failures

3. **Resume mode**
   - Start from correct position
   - Account for skipped files
   - Show resumed state

### API Design

```javascript
// Simple usage
const progress = new ProgressManager({ quiet: isQuiet });
progress.start(imageFiles.length);

for (const [index, file] of imageFiles.entries()) {
  progress.update(index + 1, { 
    file: file.name,
    status: 'processing'
  });
  
  await processImage(file);
}

progress.finish();

// Advanced usage with substeps
progress.update(index + 1, {
  file: file.name,
  status: 'resizing',
  substep: '2/4'
});
```

### Configuration

```json
{
  "progress": {
    "enabled": true,
    "style": "default",
    "showSpeed": true,
    "showMemory": false
  }
}
```

CLI flags:
- `--quiet` or `-q`: Disable progress bar
- `--progress-style=<style>`: Choose progress style
- `--no-progress`: Explicitly disable

## Implementation Plan

### Phase 1: Basic Progress Bar
- [x] Add cli-progress dependency
- [x] Create ProgressManager class
- [x] Basic progress bar display
- [x] Terminal width detection

### Phase 2: Integration
- [ ] Integrate with main processing loop
- [ ] Update error recovery to work with progress
- [ ] Add --quiet flag support
- [ ] Handle non-TTY environments

### Phase 3: Enhanced Features
- [ ] Time estimation algorithm
- [ ] Processing speed calculation
- [ ] Substep progress (resize/compress)
- [ ] Color coding for status

### Phase 4: Polish
- [ ] Smooth updates without flicker
- [ ] Graceful terminal resize
- [ ] Accessibility considerations
- [ ] Documentation

## Test Plan

### Unit Tests
- Progress calculation accuracy
- Time estimation algorithm
- Terminal width handling
- Non-TTY fallback

### Integration Tests
- Progress with error recovery
- Resume mode progress
- Quiet mode operation
- Large batch handling

### Manual Tests
- Different terminal emulators
- SSH sessions
- CI/CD environments
- Terminal resizing

## Success Criteria

- Progress updates at least 10 times per second
- No terminal flickering
- Accurate time estimates (±10%)
- Works in all common terminals
- Minimal performance impact (<1%)

## References

- [cli-progress documentation](https://github.com/npkgz/cli-progress)
- [Terminal control sequences](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [Progress bar UX best practices](https://www.nngroup.com/articles/progress-indicators/)