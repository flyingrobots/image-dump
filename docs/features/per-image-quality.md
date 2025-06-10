# Feature: Per-Image Quality Settings

**Status**: ✅ Completed  
**Priority**: 🟡 Medium  
**Milestone**: Phase 3 - Configuration & Customization  
**Issue**: #[TBD]

## Overview

Enable users to apply different quality settings to specific images based on filename patterns, directory rules, or metadata tags. This allows fine-grained control over optimization, such as using higher quality for hero images or lower quality for thumbnails.

## User Stories

### Story 1: Designer - Hero Image Quality
**As a** web designer  
**I want** to use higher quality for hero images  
**So that** important visuals look their best

**Acceptance Criteria:**
- [x] Can set higher quality for files matching pattern (e.g., `*-hero.png`)
- [x] Pattern matching works with wildcards
- [x] Overrides default quality settings
- [x] Works with all output formats

### Story 2: Developer - Directory-Based Rules
**As a** developer organizing assets  
**I want** different quality settings per directory  
**So that** I can optimize based on usage context

**Acceptance Criteria:**
- [x] Can configure quality by directory path
- [x] Subdirectories inherit parent rules
- [x] Can override inherited rules
- [x] Clear precedence order

### Story 3: Photographer - Size-Based Quality
**As a** photographer  
**I want** to maintain quality for high-resolution images  
**So that** detail is preserved in large prints

**Acceptance Criteria:**
- [x] Can set quality based on image dimensions
- [x] Threshold-based rules (e.g., >4K resolution)
- [x] Works with aspect ratio rules
- [x] Combines with other rule types

## Technical Specification

### Architecture

```
┌─────────────────┐
│ Quality Rules   │
│    Engine       │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Pattern │ │ Size   │
│Matcher │ │ Checker│
└────────┘ └────────┘
```

### Rule System Design

```javascript
// Configuration structure
{
  "quality": {
    "webp": 80,
    "avif": 80,
    "jpeg": 80
  },
  "qualityRules": [
    {
      "pattern": "*-hero.*",
      "quality": {
        "webp": 95,
        "avif": 90,
        "jpeg": 95
      }
    },
    {
      "directory": "backgrounds/",
      "quality": {
        "webp": 70,
        "avif": 65
      }
    },
    {
      "minWidth": 3840,
      "quality": {
        "webp": 90,
        "avif": 85,
        "jpeg": 90
      }
    },
    {
      "pattern": "*-thumb.*",
      "directory": "products/",
      "quality": {
        "webp": 60
      }
    }
  ]
}
```

### Rule Evaluation Order

1. **Specificity**: More specific rules override general ones
2. **Priority order**:
   - Pattern + Directory (most specific)
   - Size + Pattern
   - Size + Directory
   - Pattern only
   - Directory only
   - Size only
   - Default quality (least specific)

### Implementation Classes

#### QualityRulesEngine
```javascript
class QualityRulesEngine {
  constructor(rules = []) {
    this.rules = this.sortRulesBySpecificity(rules);
  }

  getQualityForImage(imagePath, metadata) {
    const matchingRules = this.rules.filter(rule => 
      this.ruleMatches(rule, imagePath, metadata)
    );
    
    // Merge all matching rules in order
    return this.mergeQualitySettings(matchingRules);
  }

  ruleMatches(rule, imagePath, metadata) {
    const patternMatch = !rule.pattern || 
      minimatch(path.basename(imagePath), rule.pattern);
    
    const directoryMatch = !rule.directory || 
      imagePath.includes(rule.directory);
    
    const sizeMatch = this.checkSizeRule(rule, metadata);
    
    return patternMatch && directoryMatch && sizeMatch;
  }

  checkSizeRule(rule, metadata) {
    if (!metadata) return true;
    
    if (rule.minWidth && metadata.width < rule.minWidth) return false;
    if (rule.minHeight && metadata.height < rule.minHeight) return false;
    if (rule.maxWidth && metadata.width > rule.maxWidth) return false;
    if (rule.maxHeight && metadata.height > rule.maxHeight) return false;
    
    return true;
  }

  sortRulesBySpecificity(rules) {
    return rules.sort((a, b) => {
      const scoreA = this.getSpecificityScore(a);
      const scoreB = this.getSpecificityScore(b);
      return scoreB - scoreA; // Higher score = more specific
    });
  }

  getSpecificityScore(rule) {
    let score = 0;
    if (rule.pattern) score += 4;
    if (rule.directory) score += 2;
    if (rule.minWidth || rule.minHeight || 
        rule.maxWidth || rule.maxHeight) score += 1;
    return score;
  }
}
```

### Integration Points

1. **ConfigLoader**
   - Validate qualityRules array
   - Ensure rule quality values are valid

2. **optimize-images.js**
   - Create QualityRulesEngine instance
   - Get image metadata before processing
   - Apply per-image quality settings

3. **Image processing**
   - Pass custom quality to Sharp
   - Log which rules matched

### Pattern Matching

Using `minimatch` library for glob patterns:
- `*-hero.*` - Matches any hero image
- `banner-*.jpg` - Matches banner JPEGs
- `products/**/*.png` - Matches PNGs in products folder
- `!*-temp.*` - Excludes temporary files

## Implementation Plan

### Phase 1: Core Rule Engine
- [x] Create QualityRulesEngine class
- [x] Implement pattern matching
- [x] Implement directory matching
- [x] Add rule specificity sorting

### Phase 2: Size-Based Rules
- [x] Add image metadata reading
- [x] Implement size rule checking
- [x] Combine with other rule types
- [x] Test with various image sizes

### Phase 3: Integration
- [x] Update ConfigLoader validation
- [x] Integrate with optimize-images.js
- [x] Apply rules during processing
- [x] Add debug logging

### Phase 4: Testing
- [x] Unit tests for rule engine
- [x] Integration tests
- [x] E2E tests with real images
- [x] Performance testing

## Test Plan

### Unit Tests
- Pattern matching accuracy
- Directory rule inheritance
- Size threshold checking
- Rule priority ordering
- Quality merging logic

### Integration Tests
- Config loading with rules
- Rule application during processing
- Multiple rule combinations
- Edge cases (no matches, conflicts)

### E2E Tests
- Real image processing with rules
- Complex rule scenarios
- Performance with many rules
- Error handling

## Configuration Examples

### Example 1: E-commerce Site
```json
{
  "qualityRules": [
    {
      "pattern": "*-hero.*",
      "quality": { "webp": 95, "avif": 90 }
    },
    {
      "directory": "products/thumbnails/",
      "quality": { "webp": 60, "avif": 55 }
    },
    {
      "directory": "products/",
      "pattern": "*-detail-*",
      "quality": { "webp": 85, "avif": 80 }
    }
  ]
}
```

### Example 2: Photography Portfolio
```json
{
  "qualityRules": [
    {
      "minWidth": 3000,
      "quality": { "jpeg": 95, "webp": 90 }
    },
    {
      "directory": "gallery/prints/",
      "quality": { "jpeg": 100, "webp": 95 }
    },
    {
      "pattern": "*-preview.*",
      "quality": { "webp": 70 }
    }
  ]
}
```

## Success Criteria

- Rules correctly override default quality
- Pattern matching works as expected
- Performance impact <5% for typical use
- Clear documentation and examples
- Backwards compatible

## Implementation Notes

- **Pattern Support**: Uses minimatch for glob patterns (regex not currently needed)
- **Format Skipping**: Not implemented - all formats are generated with specified quality
- **Conflict Resolution**: Rules with same specificity are applied in order (first match wins)
- **Testing Tool**: Can be added in future phase if needed

## Completed Implementation

The per-image quality feature has been fully implemented with:
- Complete QualityRulesEngine class with all planned functionality
- Full integration with the optimization pipeline
- Comprehensive test coverage including unit and E2E tests
- Support for pattern, directory, and dimension-based rules
- Proper rule precedence and specificity scoring

## References

- [minimatch documentation](https://github.com/isaacs/minimatch)
- [Sharp quality options](https://sharp.pixelplumbing.com/api-output#jpeg)