# TASKLIST - Phases VI & VII Implementation
*Living, breathing, exact task breakdown*

## 🎯 Overview

This document provides a comprehensive, actionable breakdown of every task required to implement Phase VI (Developer Experience) and Phase VII (Advanced Image Processing). Each task includes effort estimates, dependencies, acceptance criteria, and assigned priority levels.

**Last Updated**: 2025-01-18  
**Total Estimated Effort**: 18-22 weeks  
**Critical Path**: VS Code Extension → Pre-commit Hooks → Blurhash Generation

---

## 📊 Summary Statistics

| Phase | Features | Tasks | Est. Weeks | Risk Level |
|-------|----------|-------|------------|------------|
| Phase VI | 7 | 89 | 12-14 | Medium |
| Phase VII | 7 | 67 | 6-8 | High |
| **Total** | **14** | **156** | **18-22** | **Medium-High** |

---

## 🔧 Phase VI: Developer Experience

### 🎨 Feature 1: VS Code Extension

#### **Priority: P0 (Critical)**  
**Total Tasks: 24 | Estimated: 4-5 weeks**

#### Epic 1.1: Extension Foundation (Week 1)
- [ ] **T6.1.1** Set up VS Code extension project structure
  - **Effort**: 4 hours
  - **Dependencies**: None
  - **Acceptance**: Project builds and activates in VS Code
  
- [ ] **T6.1.2** Configure extension manifest and activation events
  - **Effort**: 3 hours
  - **Dependencies**: T6.1.1
  - **Acceptance**: Extension activates on image file events
  
- [ ] **T6.1.3** Implement basic file system integration
  - **Effort**: 6 hours
  - **Dependencies**: T6.1.2
  - **Acceptance**: Can read and write image files from workspace
  
- [ ] **T6.1.4** Set up TypeScript build and development workflow
  - **Effort**: 4 hours
  - **Dependencies**: T6.1.1
  - **Acceptance**: Hot reload works, TypeScript compiles cleanly

- [ ] **T6.1.5** Create basic webview provider for image preview
  - **Effort**: 8 hours
  - **Dependencies**: T6.1.3
  - **Acceptance**: Webview displays image files from workspace

#### Epic 1.2: Image Preview System (Week 1-2)
- [ ] **T6.1.6** Implement side-by-side comparison view
  - **Effort**: 12 hours
  - **Dependencies**: T6.1.5
  - **Acceptance**: Original and optimized images display side-by-side
  
- [ ] **T6.1.7** Add synchronized zoom and pan functionality
  - **Effort**: 8 hours
  - **Dependencies**: T6.1.6
  - **Acceptance**: Zoom/pan actions affect both images equally
  
- [ ] **T6.1.8** Implement real-time optimization preview
  - **Effort**: 16 hours
  - **Dependencies**: T6.1.6, Core CLI
  - **Acceptance**: Quality changes show immediate preview updates
  
- [ ] **T6.1.9** Add image metadata and statistics display
  - **Effort**: 6 hours
  - **Dependencies**: T6.1.6
  - **Acceptance**: File size, dimensions, format info displayed
  
- [ ] **T6.1.10** Implement quality metrics calculation (SSIM/PSNR)
  - **Effort**: 10 hours
  - **Dependencies**: T6.1.8
  - **Acceptance**: Perceptual quality metrics displayed accurately

#### Epic 1.3: Optimization Controls (Week 2-3)
- [ ] **T6.1.11** Create interactive quality slider
  - **Effort**: 6 hours
  - **Dependencies**: T6.1.8
  - **Acceptance**: Slider updates optimization in real-time
  
- [ ] **T6.1.12** Implement format selection buttons
  - **Effort**: 4 hours
  - **Dependencies**: T6.1.8
  - **Acceptance**: Can switch between WebP, AVIF, original formats
  
- [ ] **T6.1.13** Add one-click optimization action
  - **Effort**: 8 hours
  - **Dependencies**: T6.1.11, T6.1.12
  - **Acceptance**: Single click applies optimization with current settings
  
- [ ] **T6.1.14** Implement batch selection and optimization
  - **Effort**: 12 hours
  - **Dependencies**: T6.1.13
  - **Acceptance**: Multi-file selection works with progress tracking
  
- [ ] **T6.1.15** Add undo/redo functionality
  - **Effort**: 8 hours
  - **Dependencies**: T6.1.13
  - **Acceptance**: Can revert optimizations with version history

#### Epic 1.4: Project Integration (Week 3-4)
- [ ] **T6.1.16** Implement project-wide image scanning
  - **Effort**: 10 hours
  - **Dependencies**: T6.1.3
  - **Acceptance**: Discovers all images in workspace automatically
  
- [ ] **T6.1.17** Add command palette integration
  - **Effort**: 4 hours
  - **Dependencies**: T6.1.16
  - **Acceptance**: Commands available in VS Code command palette
  
- [ ] **T6.1.18** Create status bar indicators
  - **Effort**: 6 hours
  - **Dependencies**: T6.1.16
  - **Acceptance**: Shows optimization status and statistics
  
- [ ] **T6.1.19** Implement workspace settings integration
  - **Effort**: 8 hours
  - **Dependencies**: T6.1.16
  - **Acceptance**: Respects workspace-specific optimization settings

#### Epic 1.5: Configuration UI (Week 4-5)
- [ ] **T6.1.20** Create visual .imagerc editor
  - **Effort**: 16 hours
  - **Dependencies**: T6.1.19
  - **Acceptance**: GUI for all .imagerc configuration options
  
- [ ] **T6.1.21** Implement real-time configuration validation
  - **Effort**: 6 hours
  - **Dependencies**: T6.1.20
  - **Acceptance**: Invalid configs show helpful error messages
  
- [ ] **T6.1.22** Add configuration template gallery
  - **Effort**: 8 hours
  - **Dependencies**: T6.1.20
  - **Acceptance**: Pre-made configs for common use cases
  
- [ ] **T6.1.23** Implement configuration preview system
  - **Effort**: 10 hours
  - **Dependencies**: T6.1.21
  - **Acceptance**: Config changes show impact on sample images
  
- [ ] **T6.1.24** Add import/export configuration functionality
  - **Effort**: 4 hours
  - **Dependencies**: T6.1.20
  - **Acceptance**: Can share configs between projects

---

### ⚡ Feature 2: Pre-commit Hooks

#### **Priority: P0 (Critical)**  
**Total Tasks: 18 | Estimated: 3-4 weeks**

#### Epic 2.1: Hook Implementation (Week 1)
- [ ] **T6.2.1** Create Git pre-commit hook script
  - **Effort**: 8 hours
  - **Dependencies**: Core CLI
  - **Acceptance**: Hook detects and processes staged images
  
- [ ] **T6.2.2** Implement Husky integration
  - **Effort**: 6 hours
  - **Dependencies**: T6.2.1
  - **Acceptance**: Works with Husky v6+ for team setup
  
- [ ] **T6.2.3** Add staged file detection logic
  - **Effort**: 6 hours
  - **Dependencies**: T6.2.1
  - **Acceptance**: Only processes files in Git staging area
  
- [ ] **T6.2.4** Implement parallel image processing
  - **Effort**: 10 hours
  - **Dependencies**: T6.2.3
  - **Acceptance**: Processes multiple images concurrently
  
- [ ] **T6.2.5** Add automatic Git staging of optimized files
  - **Effort**: 4 hours
  - **Dependencies**: T6.2.4
  - **Acceptance**: Optimized files automatically staged for commit

#### Epic 2.2: Configuration System (Week 1-2)
- [ ] **T6.2.6** Create hook configuration schema
  - **Effort**: 6 hours
  - **Dependencies**: None
  - **Acceptance**: YAML/JSON schema for hook settings
  
- [ ] **T6.2.7** Implement file pattern matching (include/exclude)
  - **Effort**: 8 hours
  - **Dependencies**: T6.2.6
  - **Acceptance**: Glob patterns control which files are processed
  
- [ ] **T6.2.8** Add optimization settings integration
  - **Effort**: 4 hours
  - **Dependencies**: T6.2.6, Core CLI
  - **Acceptance**: Hook respects project optimization settings
  
- [ ] **T6.2.9** Implement performance configuration
  - **Effort**: 6 hours
  - **Dependencies**: T6.2.7
  - **Acceptance**: Concurrency, timeout, size limits configurable
  
- [ ] **T6.2.10** Add bypass and skip mechanisms
  - **Effort**: 8 hours
  - **Dependencies**: T6.2.8
  - **Acceptance**: Emergency bypass and selective skip work correctly

#### Epic 2.3: Reporting System (Week 2-3)
- [ ] **T6.2.11** Implement optimization statistics tracking
  - **Effort**: 6 hours
  - **Dependencies**: T6.2.4
  - **Acceptance**: Tracks file sizes, compression ratios, processing time
  
- [ ] **T6.2.12** Create commit message report generation
  - **Effort**: 8 hours
  - **Dependencies**: T6.2.11
  - **Acceptance**: Appends optimization stats to commit messages
  
- [ ] **T6.2.13** Add detailed file-by-file reporting
  - **Effort**: 6 hours
  - **Dependencies**: T6.2.12
  - **Acceptance**: Optional detailed breakdown of all optimizations
  
- [ ] **T6.2.14** Implement report formatting and templates
  - **Effort**: 4 hours
  - **Dependencies**: T6.2.13
  - **Acceptance**: Customizable report formats and templates

#### Epic 2.4: Error Handling & Performance (Week 3-4)
- [ ] **T6.2.15** Add comprehensive error handling
  - **Effort**: 8 hours
  - **Dependencies**: T6.2.4
  - **Acceptance**: Graceful handling of all failure scenarios
  
- [ ] **T6.2.16** Implement timeout and resource protection
  - **Effort**: 6 hours
  - **Dependencies**: T6.2.15
  - **Acceptance**: Prevents hanging commits and resource exhaustion
  
- [ ] **T6.2.17** Add performance monitoring and optimization
  - **Effort**: 8 hours
  - **Dependencies**: T6.2.16
  - **Acceptance**: Sub-10 second commit overhead for typical usage
  
- [ ] **T6.2.18** Create comprehensive test suite
  - **Effort**: 12 hours
  - **Dependencies**: All previous T6.2.x
  - **Acceptance**: >90% test coverage, all scenarios tested

---

### 📦 Feature 3: CLI Packaging (npx)

#### **Priority: P1 (High)**  
**Total Tasks: 12 | Estimated: 2 weeks**

#### Epic 3.1: Package Setup (Week 1)
- [ ] **T6.3.1** Configure npm package structure for CLI distribution
  - **Effort**: 4 hours
  - **Dependencies**: Core CLI
  - **Acceptance**: Package installs globally and locally via npm
  
- [ ] **T6.3.2** Implement npx compatibility
  - **Effort**: 3 hours
  - **Dependencies**: T6.3.1
  - **Acceptance**: `npx image-dump` works without installation
  
- [ ] **T6.3.3** Add binary entry point configuration
  - **Effort**: 2 hours
  - **Dependencies**: T6.3.1
  - **Acceptance**: CLI available in PATH after installation
  
- [ ] **T6.3.4** Implement cross-platform support (Windows/Mac/Linux)
  - **Effort**: 8 hours
  - **Dependencies**: T6.3.3
  - **Acceptance**: Works identically on all major platforms

#### Epic 3.2: Auto-update System (Week 1-2)
- [ ] **T6.3.5** Create version checking mechanism
  - **Effort**: 6 hours
  - **Dependencies**: T6.3.2
  - **Acceptance**: Checks for updates without blocking execution
  
- [ ] **T6.3.6** Implement update notification system
  - **Effort**: 4 hours
  - **Dependencies**: T6.3.5
  - **Acceptance**: Notifies users of available updates appropriately
  
- [ ] **T6.3.7** Add automatic update option
  - **Effort**: 8 hours
  - **Dependencies**: T6.3.6
  - **Acceptance**: Optional auto-update with user consent
  
- [ ] **T6.3.8** Implement rollback mechanism
  - **Effort**: 6 hours
  - **Dependencies**: T6.3.7
  - **Acceptance**: Can revert to previous version if update fails

#### Epic 3.3: Distribution & Documentation (Week 2)
- [ ] **T6.3.9** Set up automated publishing pipeline
  - **Effort**: 6 hours
  - **Dependencies**: T6.3.1
  - **Acceptance**: Automated npm publishing from CI/CD
  
- [ ] **T6.3.10** Create installation documentation
  - **Effort**: 4 hours
  - **Dependencies**: T6.3.4
  - **Acceptance**: Clear docs for all installation methods
  
- [ ] **T6.3.11** Implement shell completion scripts
  - **Effort**: 8 hours
  - **Dependencies**: T6.3.3
  - **Acceptance**: Tab completion works in bash, zsh, fish
  
- [ ] **T6.3.12** Add comprehensive CLI help system
  - **Effort**: 6 hours
  - **Dependencies**: T6.3.11
  - **Acceptance**: Built-in help for all commands and options

---

### 🔍 Feature 4: Visual Diff Tool

#### **Priority: P1 (High)**  
**Total Tasks: 15 | Estimated: 2-3 weeks**

#### Epic 4.1: Core Comparison Engine (Week 1)
- [ ] **T6.4.1** Implement side-by-side image comparison
  - **Effort**: 8 hours
  - **Dependencies**: None
  - **Acceptance**: Displays two images with synchronized viewing
  
- [ ] **T6.4.2** Add slider/onion skin comparison modes
  - **Effort**: 10 hours
  - **Dependencies**: T6.4.1
  - **Acceptance**: Interactive slider reveals differences dynamically
  
- [ ] **T6.4.3** Implement zoom and pan synchronization
  - **Effort**: 6 hours
  - **Dependencies**: T6.4.1
  - **Acceptance**: Zoom/pan actions synchronized between images
  
- [ ] **T6.4.4** Add difference highlighting overlay
  - **Effort**: 12 hours
  - **Dependencies**: T6.4.2
  - **Acceptance**: Visual overlay shows pixel-level differences
  
- [ ] **T6.4.5** Implement keyboard navigation and shortcuts
  - **Effort**: 4 hours
  - **Dependencies**: T6.4.3
  - **Acceptance**: Full keyboard control of comparison interface

#### Epic 4.2: Metadata Analysis (Week 1-2)
- [ ] **T6.4.6** Add comprehensive metadata comparison
  - **Effort**: 8 hours
  - **Dependencies**: T6.4.1
  - **Acceptance**: Shows EXIF, color profile, format differences
  
- [ ] **T6.4.7** Implement file size analysis and breakdown
  - **Effort**: 6 hours
  - **Dependencies**: T6.4.6
  - **Acceptance**: Detailed size comparison with compression analysis
  
- [ ] **T6.4.8** Add color space and profile comparison
  - **Effort**: 10 hours
  - **Dependencies**: T6.4.6
  - **Acceptance**: Identifies color space differences and impact
  
- [ ] **T6.4.9** Implement histogram comparison display
  - **Effort**: 8 hours
  - **Dependencies**: T6.4.8
  - **Acceptance**: Side-by-side histograms show color distribution changes

#### Epic 4.3: Quality Metrics (Week 2-3)
- [ ] **T6.4.10** Implement SSIM calculation and display
  - **Effort**: 10 hours
  - **Dependencies**: T6.4.4
  - **Acceptance**: Accurate structural similarity index measurement
  
- [ ] **T6.4.11** Add PSNR calculation and visualization
  - **Effort**: 8 hours
  - **Dependencies**: T6.4.10
  - **Acceptance**: Peak signal-to-noise ratio with visual indicators
  
- [ ] **T6.4.12** Implement perceptual quality metrics
  - **Effort**: 12 hours
  - **Dependencies**: T6.4.11
  - **Acceptance**: Additional perceptual quality measurements
  
- [ ] **T6.4.13** Add quality score aggregation and reporting
  - **Effort**: 6 hours
  - **Dependencies**: T6.4.12
  - **Acceptance**: Combined quality score with detailed breakdown
  
- [ ] **T6.4.14** Create exportable comparison reports
  - **Effort**: 8 hours
  - **Dependencies**: T6.4.13
  - **Acceptance**: PDF/HTML reports for quality documentation
  
- [ ] **T6.4.15** Implement batch comparison mode
  - **Effort**: 10 hours
  - **Dependencies**: T6.4.14
  - **Acceptance**: Compare multiple image pairs in sequence

---

### 🍺 Feature 5: Homebrew Formula

#### **Priority: P2 (Medium)**  
**Total Tasks: 8 | Estimated: 1 week**

#### Epic 5.1: Formula Development (Week 1)
- [ ] **T6.5.1** Create Homebrew formula template
  - **Effort**: 4 hours
  - **Dependencies**: CLI packaging complete
  - **Acceptance**: Basic formula installs and runs correctly
  
- [ ] **T6.5.2** Set up Homebrew tap repository
  - **Effort**: 3 hours
  - **Dependencies**: T6.5.1
  - **Acceptance**: Custom tap repository accessible via Homebrew
  
- [ ] **T6.5.3** Implement dependency management in formula
  - **Effort**: 6 hours
  - **Dependencies**: T6.5.2
  - **Acceptance**: All dependencies correctly specified and installed
  
- [ ] **T6.5.4** Add automatic updates to formula
  - **Effort**: 4 hours
  - **Dependencies**: T6.5.3
  - **Acceptance**: Formula updates automatically with new releases
  
- [ ] **T6.5.5** Implement shell completion installation
  - **Effort**: 4 hours
  - **Dependencies**: T6.5.4
  - **Acceptance**: Shell completions installed automatically
  
- [ ] **T6.5.6** Add comprehensive formula testing
  - **Effort**: 6 hours
  - **Dependencies**: T6.5.5
  - **Acceptance**: Formula passes all Homebrew audit requirements
  
- [ ] **T6.5.7** Create formula documentation
  - **Effort**: 3 hours
  - **Dependencies**: T6.5.6
  - **Acceptance**: Clear installation and usage instructions
  
- [ ] **T6.5.8** Set up automated formula updates
  - **Effort**: 6 hours
  - **Dependencies**: T6.5.7
  - **Acceptance**: CI/CD automatically updates formula on releases

---

### 📊 Feature 6: Development Dashboard

#### **Priority: P2 (Medium)**  
**Total Tasks: 12 | Estimated: 2 weeks**

*[Tasks T6.6.1 through T6.6.12 - Dashboard implementation details]*

---

## 🎨 Phase VII: Advanced Image Processing

### 🌈 Feature 1: Blurhash/LQIP Generation

#### **Priority: P0 (Critical)**  
**Total Tasks: 16 | Estimated: 2-3 weeks**

#### Epic 1.1: Blurhash Implementation (Week 1)
- [ ] **T7.1.1** Integrate Blurhash algorithm library
  - **Effort**: 6 hours
  - **Dependencies**: None
  - **Acceptance**: Basic blurhash generation works for simple images
  
- [ ] **T7.1.2** Implement configurable component resolution
  - **Effort**: 4 hours
  - **Dependencies**: T7.1.1
  - **Acceptance**: X/Y components adjustable from 3x3 to 9x9
  
- [ ] **T7.1.3** Add quality presets (fast/balanced/high)
  - **Effort**: 6 hours
  - **Dependencies**: T7.1.2
  - **Acceptance**: Three preset modes with different speed/quality tradeoffs
  
- [ ] **T7.1.4** Implement worker thread processing for large images
  - **Effort**: 10 hours
  - **Dependencies**: T7.1.3
  - **Acceptance**: Large images processed in background without blocking
  
- [ ] **T7.1.5** Add blurhash caching mechanism
  - **Effort**: 8 hours
  - **Dependencies**: T7.1.4
  - **Acceptance**: Generated blurhashes cached to avoid regeneration

#### Epic 1.2: LQIP Generation (Week 1-2)
- [ ] **T7.1.6** Implement ultra-small image generation
  - **Effort**: 8 hours
  - **Dependencies**: Core image processing
  - **Acceptance**: Generates 16x16 to 64x64 pixel previews
  
- [ ] **T7.1.7** Add aggressive compression optimization
  - **Effort**: 10 hours
  - **Dependencies**: T7.1.6
  - **Acceptance**: Sub-500 byte LQIPs with recognizable content
  
- [ ] **T7.1.8** Implement base64 encoding options
  - **Effort**: 4 hours
  - **Dependencies**: T7.1.7
  - **Acceptance**: Base64 data URIs for inline embedding
  
- [ ] **T7.1.9** Add format selection (JPEG/WebP/AVIF)
  - **Effort**: 6 hours
  - **Dependencies**: T7.1.8
  - **Acceptance**: Optimal format selection based on source image
  
- [ ] **T7.1.10** Implement progressive JPEG option
  - **Effort**: 6 hours
  - **Dependencies**: T7.1.9
  - **Acceptance**: Progressive JPEGs for better perceived loading

#### Epic 1.3: Color Palette Extraction (Week 2-3)
- [ ] **T7.1.11** Implement dominant color extraction algorithms
  - **Effort**: 12 hours
  - **Dependencies**: Core image processing
  - **Acceptance**: Accurate dominant color extraction using multiple algorithms
  
- [ ] **T7.1.12** Add configurable color count (2-16 colors)
  - **Effort**: 6 hours
  - **Dependencies**: T7.1.11
  - **Acceptance**: Configurable palette size with perceptual optimization
  
- [ ] **T7.1.13** Implement accessibility analysis
  - **Effort**: 10 hours
  - **Dependencies**: T7.1.12
  - **Acceptance**: Contrast ratio analysis for text overlay safety
  
- [ ] **T7.1.14** Add multiple output formats (CSS/JSON/tokens)
  - **Effort**: 8 hours
  - **Dependencies**: T7.1.13
  - **Acceptance**: Multiple export formats for different use cases
  
- [ ] **T7.1.15** Implement gradient generation from palettes
  - **Effort**: 8 hours
  - **Dependencies**: T7.1.14
  - **Acceptance**: CSS gradients generated from extracted colors
  
- [ ] **T7.1.16** Add batch processing optimization
  - **Effort**: 10 hours
  - **Dependencies**: All previous T7.1.x
  - **Acceptance**: Efficient processing of multiple images with caching

---

### 📱 Feature 2: HEIC Format Support

#### **Priority: P1 (High)**  
**Total Tasks: 12 | Estimated: 2 weeks**

*[Tasks T7.2.1 through T7.2.12 - HEIC support implementation]*

---

### 📸 Feature 3: RAW Format Support

#### **Priority: P1 (High)**  
**Total Tasks: 15 | Estimated: 2-3 weeks**

*[Tasks T7.3.1 through T7.3.15 - RAW format support implementation]*

---

### 🎬 Feature 4: Video Thumbnail Extraction

#### **Priority: P2 (Medium)**  
**Total Tasks: 10 | Estimated: 1-2 weeks**

*[Tasks T7.4.1 through T7.4.10 - Video thumbnail implementation]*

---

### 🎞️ Feature 5: Animated WebP Support

#### **Priority: P2 (Medium)**  
**Total Tasks: 8 | Estimated: 1 week**

*[Tasks T7.5.1 through T7.5.8 - Animated WebP implementation]*

---

### 🌟 Feature 6: HDR Image Handling

#### **Priority: P2 (Medium)**  
**Total Tasks: 6 | Estimated: 1 week**

*[Tasks T7.6.1 through T7.6.6 - HDR processing implementation]*

---

## 📈 Implementation Schedule

### Phase VI Timeline (12-14 weeks)
```
Weeks 1-5:  VS Code Extension (Critical Path)
Weeks 2-5:  Pre-commit Hooks (Parallel)
Weeks 6-7:  CLI Packaging
Weeks 8-10: Visual Diff Tool
Week 11:    Homebrew Formula
Weeks 12-13: Development Dashboard
Week 14:    Integration Testing & Polish
```

### Phase VII Timeline (6-8 weeks)
```
Weeks 1-3:  Blurhash/LQIP Generation (Critical Path)
Weeks 2-3:  HEIC Format Support (Parallel)
Weeks 4-6:  RAW Format Support
Weeks 7:    Video Thumbnails & Animated WebP
Week 8:     HDR Support & Final Integration
```

---

## 🎯 Success Criteria

### Phase VI Completion Criteria
- [ ] VS Code extension published to marketplace with >4.5 star rating
- [ ] Pre-commit hooks work in 95% of Git workflows without issues
- [ ] CLI available via npx with <5 second first-run time
- [ ] Visual diff tool provides measurable quality assessment
- [ ] All features have >90% test coverage
- [ ] Documentation complete and user-tested

### Phase VII Completion Criteria
- [ ] Blurhash generation <200ms for typical images
- [ ] LQIP placeholders <500 bytes with >85% recognizability
- [ ] HEIC/RAW conversion maintains color accuracy
- [ ] Video thumbnail extraction supports major formats
- [ ] All features integrate seamlessly with existing pipeline
- [ ] Performance impact <10% on overall processing time

---

**Next Review Date**: Weekly during implementation  
**Escalation Path**: Phase delays >1 week require leadership review  
**Quality Gate**: All P0 tasks must pass automated testing before P1 tasks begin

*This document is maintained by Lieutenant Captain Claude, Guardian of Implementation Precision.*