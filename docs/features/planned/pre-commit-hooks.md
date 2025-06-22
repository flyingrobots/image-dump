# Pre-commit Hooks - Automated Image Optimization

## 📋 Overview

**Feature ID**: `pre-commit-hooks`  
**Phase**: 6 - Developer Experience  
**Priority**: High  
**Dependencies**: Core CLI functionality  
**Status**: Planned  

## 🎯 Description

Automated pre-commit hooks that seamlessly integrate image optimization into the Git workflow, ensuring optimized images are committed automatically while providing flexibility for developer control and emergency bypasses.

## ✨ Features

### Git Pre-commit Hook Script
- **Automatic Integration**: Self-installing Git hook that runs before each commit
- **Smart Detection**: Identifies new or modified image files in staging area
- **Optimization Engine**: Applies project-specific optimization settings
- **Conflict Resolution**: Handles concurrent modifications gracefully
- **Performance Optimized**: Parallel processing for multiple images

### Husky Integration
- **Modern Workflow**: Full compatibility with Husky v6+ for consistent team setup
- **Package.json Configuration**: Zero-config setup via npm scripts
- **Team Synchronization**: Shared hook configuration across team members
- **CI/CD Integration**: Seamless integration with automated pipelines
- **Version Management**: Hook versioning and update mechanisms

### Configurable File Patterns
- **Pattern Matching**: Glob patterns for include/exclude file selection
- **Directory Targeting**: Specific directory optimization rules
- **File Size Thresholds**: Minimum file size requirements for optimization
- **Format Filtering**: Target specific image formats (PNG, JPEG, etc.)
- **Custom Extensions**: Support for custom file extensions and MIME types

### Skip Optimization Option
- **Emergency Bypass**: `--no-verify` flag compatibility for urgent commits
- **Selective Skip**: Per-file skip annotations via git attributes
- **Temporary Disable**: Environment variable to temporarily disable hooks
- **Performance Mode**: Fast-commit mode that queues optimization for later
- **Developer Choice**: Individual developer opt-out mechanisms

### Optimization Report in Commit Message
- **Automated Reporting**: Appends optimization statistics to commit messages
- **Savings Summary**: File size reductions and format conversions
- **Performance Impact**: Estimated loading time improvements
- **Change Log**: List of optimized files and applied transformations
- **Quality Metrics**: Compression ratios and quality assessments

## 🔧 Technical Specifications

### Hook Installation
```bash
#!/bin/sh
# .git/hooks/pre-commit
# Image Dump Pre-commit Hook

# Check if image-dump is available
if ! command -v npx image-dump &> /dev/null; then
    echo "Warning: image-dump not found. Skipping image optimization."
    exit 0
fi

# Run optimization on staged images
npx image-dump pre-commit --staged
```

### Husky Configuration
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "image-dump pre-commit --staged --report"
    }
  }
}
```

### Configuration Schema
```yaml
# .imagedump-hooks.yml
preCommit:
  enabled: true
  patterns:
    include:
      - "**/*.{jpg,jpeg,png,gif,webp,avif}"
      - "assets/**/*"
      - "public/images/**/*"
    exclude:
      - "node_modules/**"
      - "**/*.min.*"
      - "**/thumbnails/**"
  
  optimization:
    quality: 85
    formats: ["webp", "original"]
    maxFileSize: "5MB"
    skipLargeFiles: true
  
  reporting:
    enabled: true
    includeStats: true
    includeFileList: true
    summaryOnly: false
  
  performance:
    parallel: true
    maxConcurrency: 4
    timeout: 30000
    
  bypass:
    emergencyFlag: "--skip-image-optimization"
    environmentVar: "SKIP_IMAGE_OPTIMIZATION"
    allowIndividualSkip: true
```

## 🚀 User Stories

### Story 1: Seamless Integration
**As a** developer  
**I want** images to be automatically optimized when I commit  
**So that** I don't have to remember to optimize them manually  

**Acceptance Criteria:**
- Hook automatically detects staged image files
- Optimization runs without user intervention
- Commit proceeds normally after optimization
- Performance impact is minimal (<10 seconds for typical commits)

### Story 2: Team Consistency
**As a** team lead  
**I want** all team members to use the same image optimization settings  
**So that** our repository maintains consistent image quality and size  

**Acceptance Criteria:**
- Husky integration ensures all team members have hooks installed
- Configuration is shared via repository settings
- New team members automatically get optimization setup
- Settings can be updated centrally and sync across team

### Story 3: Emergency Bypass
**As a** developer  
**I want** to be able to skip image optimization during urgent commits  
**So that** I'm not blocked when time is critical  

**Acceptance Criteria:**
- `--no-verify` flag bypasses all pre-commit processing
- Environment variable can disable optimization temporarily
- Individual files can be marked to skip optimization
- Warning messages inform about bypassed optimization

### Story 4: Optimization Transparency
**As a** project maintainer  
**I want** to see what optimizations were applied in each commit  
**So that** I can track the impact and quality of automated optimization  

**Acceptance Criteria:**
- Commit messages include optimization statistics
- File-by-file breakdown of changes is available
- Savings metrics are clearly presented
- Quality impact is documented

## 🔧 Implementation Details

### File Detection Algorithm
```javascript
async function detectStagedImages() {
  const staged = await git.diff(['--cached', '--name-only']);
  const imageFiles = staged
    .split('\n')
    .filter(file => file.trim())
    .filter(file => isImageFile(file))
    .filter(file => shouldOptimize(file));
    
  return imageFiles;
}

function isImageFile(path) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
  const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}
```

### Optimization Pipeline
```javascript
async function optimizePreCommit(files, options) {
  const results = [];
  
  // Process files in parallel with concurrency limit
  const promises = files.map(async (file, index) => {
    if (index >= options.maxConcurrency) {
      await new Promise(resolve => setTimeout(resolve, 100 * index));
    }
    
    try {
      const result = await optimizeFile(file, options);
      results.push(result);
      
      // Stage optimized file
      await git.add(result.outputPath);
      
      return result;
    } catch (error) {
      console.warn(`Optimization failed for ${file}: ${error.message}`);
      return { file, error: error.message };
    }
  });
  
  return Promise.all(promises);
}
```

### Report Generation
```javascript
function generateCommitReport(optimizationResults) {
  const totalFiles = optimizationResults.length;
  const successfulOptimizations = optimizationResults.filter(r => !r.error);
  const totalSavings = successfulOptimizations.reduce((sum, r) => sum + r.sizeSavings, 0);
  
  const report = [
    '',
    '📸 Image Optimization Report:',
    `   • Files processed: ${totalFiles}`,
    `   • Successfully optimized: ${successfulOptimizations.length}`,
    `   • Total size savings: ${formatBytes(totalSavings)}`,
    `   • Average compression: ${calculateAverageCompression(successfulOptimizations)}%`,
    ''
  ];
  
  if (options.includeFileList) {
    report.push('   Optimized files:');
    successfulOptimizations.forEach(result => {
      report.push(`   • ${result.file}: ${formatBytes(result.sizeSavings)} saved`);
    });
    report.push('');
  }
  
  return report.join('\n');
}
```

## 🧪 Testing Strategy

### Unit Tests
- File detection logic
- Pattern matching algorithms
- Configuration parsing
- Report generation

### Integration Tests
- Git hook execution
- Husky integration
- Multi-file optimization
- Error handling scenarios

### End-to-End Tests
- Complete commit workflow
- Team setup scenarios
- Emergency bypass functionality
- Performance under load

### Performance Tests
- Large repository handling
- Concurrent file processing
- Memory usage optimization
- Timeout scenarios

## 📊 Performance Requirements

### Speed Targets
- **Small commits** (1-3 images): <5 seconds additional time
- **Medium commits** (4-10 images): <15 seconds additional time
- **Large commits** (10+ images): <30 seconds additional time
- **Hook installation**: <2 seconds
- **Configuration reload**: <1 second

### Resource Limits
- **Memory usage**: <512MB for optimization process
- **CPU usage**: <80% of available cores
- **Disk space**: <2x original file size during processing
- **Network**: No external dependencies during optimization

## 🔒 Security Considerations

### File Access Security
- Only access files explicitly staged for commit
- Validate file paths to prevent directory traversal
- Respect Git's file permissions and ownership
- No access to files outside repository boundaries

### Process Security
- Sandboxed execution of optimization commands
- Resource limits to prevent system exhaustion
- Timeout protection against hanging processes
- Safe handling of binary file content

### Configuration Security
- Validate configuration file syntax and values
- Prevent code injection through configuration
- Secure defaults for all settings
- Input sanitization for file patterns

## 📈 Monitoring & Analytics

### Usage Metrics
- Hook execution frequency
- Optimization success/failure rates
- Performance timing statistics
- Configuration usage patterns

### Error Tracking
- Failed optimization attempts
- Configuration errors
- Git integration issues
- Performance timeout events

### Optimization Impact
- Total bytes saved across repositories
- Average compression ratios achieved
- Most effective optimization settings
- ROI on development time investment

## 🔧 Configuration Examples

### Basic Setup
```bash
# Install in existing project
npm install --save-dev husky image-dump

# Initialize hooks
npx husky install
npx husky add .husky/pre-commit "npx image-dump pre-commit"

# Configure optimization
echo "quality: 85" > .imagerc
```

### Advanced Configuration
```yaml
# .imagedump-hooks.yml
preCommit:
  enabled: true
  patterns:
    include: ["src/**/*.{jpg,png}", "public/assets/**"]
    exclude: ["**/*.min.*", "**/compressed/**"]
  
  optimization:
    quality:
      jpg: 85
      png: 90
      webp: 80
    formats: ["webp", "original"]
    generateThumbnails: true
    
  reporting:
    enabled: true
    template: |
      🖼️  Optimized {{count}} images ({{savings}} saved)
      {{#each files}}
      • {{file}}: {{compression}}% compression
      {{/each}}
```

## ✅ Success Criteria

- [ ] Zero-configuration setup for new projects
- [ ] <5 second overhead for typical commits
- [ ] 100% compatibility with existing Git workflows
- [ ] Team-wide consistency in optimization settings
- [ ] Reliable emergency bypass mechanisms
- [ ] Clear optimization reporting in commit history
- [ ] Robust error handling and recovery
- [ ] Performance scales with repository size
- [ ] Security hardened against malicious input
- [ ] Comprehensive test coverage (>90%)

---

**Estimated Effort**: 3-4 weeks  
**Risk Level**: Medium  
**Dependencies**: Git hooks, Husky, Node.js CLI tools