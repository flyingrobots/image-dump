# Feature: Metadata Preservation

**Status**: ✅ Completed  
**Priority**: 🟡 Medium  
**Milestone**: Phase 3 - Configuration & Customization  
**Issue**: #[TBD]

## Overview
Enable users to control whether image metadata (EXIF, IPTC, XMP) is preserved or stripped during optimization. This allows photographers to maintain copyright, camera settings, and location data, while others can reduce file size and protect privacy by removing metadata.

## User Stories

### Story 1: Photographer - Preserve Copyright
**As a** photographer  
**I want** to preserve metadata in my images  
**So that** copyright and camera information remains intact

**Acceptance Criteria:**
- [ ] Can enable metadata preservation in config
- [ ] EXIF data is maintained in output files
- [ ] Copyright and author fields are preserved
- [ ] Camera settings (ISO, aperture, etc.) are retained

### Story 2: Privacy-Conscious User - Strip Location
**As a** privacy-conscious user  
**I want** to remove all metadata from images  
**So that** no personal information is leaked

**Acceptance Criteria:**
- [ ] Can disable metadata preservation (default)
- [ ] All EXIF data is stripped
- [ ] GPS location data is removed
- [ ] No camera serial numbers remain

### Story 3: Developer - Selective Preservation
**As a** developer  
**I want** to preserve only specific metadata fields  
**So that** I can balance file size with information needs

**Acceptance Criteria:**
- [ ] Can specify which metadata to keep
- [ ] Can preserve copyright while removing GPS
- [ ] Can keep basic info while removing camera data
- [ ] Configuration is intuitive

## Technical Specification

### Architecture
The metadata preservation system will be integrated into the image processing pipeline, using Sharp's built-in metadata handling capabilities.

### Components
- **MetadataHandler**: Processes metadata based on configuration
- **ConfigLoader**: Extended to support metadata options
- **ImageProcessor**: Updated to apply metadata settings

### API Design
```javascript
// Configuration structure
{
  "preserveMetadata": false | true | {
    "copyright": true,
    "creator": true,
    "datetime": true,
    "camera": false,
    "gps": false,
    "all": false
  }
}

// MetadataHandler API
class MetadataHandler {
  getMetadataOptions(config) {
    // Returns Sharp-compatible metadata options
  }
  
  filterMetadata(metadata, config) {
    // Filters metadata based on configuration
  }
}
```

### Data Model
```javascript
// Metadata preservation options
const METADATA_FIELDS = {
  copyright: ['Copyright', 'Artist', 'Creator'],
  creator: ['Artist', 'Creator', 'Author'],
  datetime: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
  camera: ['Make', 'Model', 'LensModel', 'ISO', 'FNumber'],
  gps: ['GPSLatitude', 'GPSLongitude', 'GPSAltitude']
};

// Sharp metadata options mapping
const SHARP_METADATA_OPTIONS = {
  false: { withMetadata: false },
  true: { withMetadata: true },
  selective: { withMetadata: (metadata) => filterMetadata(metadata) }
};
```

### Dependencies
- Sharp (already included) - supports withMetadata option
- No additional dependencies needed

## Implementation Plan

### Phase 1: Basic Preservation Toggle
- [x] Add `preserveMetadata` to configuration schema
- [x] Update ConfigLoader validation
- [x] Implement basic true/false toggle
- [x] Write unit tests

### Phase 2: Sharp Integration
- [x] Update optimize-images.js to use metadata config
- [x] Test metadata preservation with all formats
- [x] Verify metadata is correctly preserved/stripped
- [x] Write integration tests

### Phase 3: Selective Preservation
- [ ] Implement MetadataHandler class (future enhancement)
- [ ] Add selective preservation options
- [ ] Update configuration to support field selection
- [ ] Write comprehensive tests

### Phase 4: Documentation & Testing
- [x] Update README with metadata options
- [x] Add examples to .imagerc.example
- [x] End-to-end testing with real images
- [x] Performance impact assessment (minimal)

## Test Plan

### Unit Tests
- **Configuration**: Valid/invalid metadata options
- **MetadataHandler**: Field filtering logic
- **Integration**: Config + metadata handling

### Integration Tests
- **Basic preservation**: On/off functionality
- **Format compatibility**: WebP, AVIF, JPEG metadata
- **Selective preservation**: Field filtering

### E2E Tests
- **Real images**: Test with photos containing metadata
- **Privacy check**: Ensure GPS removal works
- **Copyright preservation**: Verify copyright retained

## Security Considerations
- **Privacy**: Default to stripping metadata for privacy
- **Validation**: Ensure metadata doesn't contain malicious data
- **Size limits**: Prevent excessive metadata sizes

## Performance Considerations
- **Minimal overhead**: Metadata handling is fast
- **Memory usage**: Large metadata blocks handled efficiently
- **Caching**: No need to cache metadata

## Documentation Requirements
- **Configuration guide**: How to set metadata options
- **Privacy guide**: Best practices for metadata
- **Examples**: Common use cases

## Open Questions
- [ ] Should we support custom metadata injection?
- [ ] Should we warn when stripping copyright info?
- [ ] Should GPS removal be a separate option?
- [ ] Should we support metadata templates?

## References
- [Sharp withMetadata docs](https://sharp.pixelplumbing.com/api-output#withmetadata)
- [EXIF specification](https://www.exif.org/)
- [Privacy considerations](https://www.eff.org/deeplinks/2020/06/your-photos-metadata-may-be-revealing-more-you-think)