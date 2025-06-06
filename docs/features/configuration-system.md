# Configuration System Feature Specification

## Overview

The configuration system allows users to customize image optimization behavior through a `.imagerc` configuration file. This enables project-specific settings without modifying code or using command-line arguments for every operation.

## Use Cases

1. **Different Projects, Different Needs**
   - A photography portfolio needs high-quality WebP at 95% quality
   - A blog wants smaller files with 80% quality
   - An e-commerce site needs specific thumbnail sizes

2. **Team Consistency**
   - All team members use the same optimization settings
   - Configuration is version-controlled with the project
   - No need to remember command-line flags

3. **Format Control**
   - Some projects only need WebP, not AVIF
   - Mobile apps might want smaller format subset
   - Legacy browsers need JPEG fallbacks

4. **Directory Organization**
   - Custom output directory structures
   - Different paths for different image types
   - Separate thumbnail directories

## User Stories

### As a developer
- I want to configure optimization settings once so that I don't need to specify them every time
- I want to exclude certain formats so that I don't generate files I won't use
- I want to set custom quality levels so that I can balance file size and visual quality

### As a team lead
- I want to enforce consistent settings across the team so that all images are optimized the same way
- I want to version control our optimization settings so that they're part of the project

### As a designer
- I want to preserve metadata in some images so that copyright information is retained
- I want different quality settings for different image types so that photos and graphics are optimized appropriately

## Requirements

### Functional Requirements

1. **Configuration File**
   - Support `.imagerc` (JSON format) in project root
   - Support `.imagerc.json` as alternative name
   - Configuration is optional (defaults still work)

2. **Configurable Settings**
   - Output formats (which formats to generate)
   - Quality settings (per-format quality levels)
   - Output directory path
   - Thumbnail generation (enabled/disabled)
   - Thumbnail size
   - Metadata preservation (keep/strip EXIF)

3. **Configuration Loading**
   - Load from project root automatically
   - Command-line arguments override config file
   - Validate configuration on load
   - Clear error messages for invalid config

4. **Backwards Compatibility**
   - Existing projects work without configuration
   - All current defaults are maintained
   - No breaking changes to CLI

### Non-Functional Requirements

1. **Performance**
   - Configuration loading < 10ms
   - No impact on optimization performance

2. **Usability**
   - Clear documentation with examples
   - Helpful validation error messages
   - Type-safe configuration schema

3. **Maintainability**
   - Single responsibility for config module
   - Easy to add new configuration options
   - Well-tested configuration logic

## Acceptance Criteria / Definition of Done

### Configuration Loading
- [ ] `.imagerc` file is detected and loaded from project root
- [ ] JSON parsing errors show helpful messages with line numbers
- [ ] Invalid configuration keys show warnings but don't fail
- [ ] Missing configuration file uses all defaults
- [ ] Configuration can be loaded from custom path via CLI flag

### Configuration Options
- [ ] `formats` array controls which output formats are generated
- [ ] `quality` object sets per-format quality (webp, avif, jpeg)
- [ ] `outputDir` sets custom output directory
- [ ] `generateThumbnails` boolean controls thumbnail generation
- [ ] `thumbnailWidth` sets thumbnail size
- [ ] `preserveMetadata` controls EXIF data handling

### Override Behavior
- [ ] CLI flags override config file values
- [ ] Environment variables override config file (if applicable)
- [ ] Override precedence is documented

### Validation
- [ ] Quality values must be 1-100
- [ ] Formats must be from allowed list
- [ ] Output directory is validated as writable
- [ ] Invalid values show clear error messages

### Testing
- [ ] Unit tests cover all configuration options
- [ ] Integration tests verify config + CLI interaction
- [ ] End-to-end tests confirm optimization uses config
- [ ] Error cases are tested (invalid JSON, bad values)

## Test Plan

### Unit Tests (`tests/lib/config-loader.test.js`)
1. **Loading behavior**
   - Loads valid configuration file
   - Returns defaults when no config exists
   - Handles invalid JSON gracefully
   - Handles missing file gracefully

2. **Validation**
   - Validates quality ranges (1-100)
   - Validates format strings
   - Validates required fields
   - Provides helpful error messages

3. **Merging**
   - Merges partial config with defaults
   - CLI args override config values
   - Deep merges nested objects correctly

### Integration Tests (`tests/lib/config-integration.test.js`)
1. **File system interaction**
   - Finds .imagerc in project root
   - Handles permission errors gracefully
   - Works with .imagerc.json alternative

2. **Configuration usage**
   - Image optimizer uses loaded config
   - Thumbnail generation respects config
   - Output paths follow configuration

### End-to-End Tests (`tests/config-e2e.test.js`)
1. **Full optimization flow**
   - Create .imagerc file
   - Run optimization
   - Verify outputs match configuration
   - Verify formats match configuration
   - Verify quality settings applied

2. **Override scenarios**
   - Config file + CLI flags
   - Missing config with CLI flags
   - Invalid config with defaults

## Example Configuration

```json
{
  "formats": ["webp", "original"],
  "quality": {
    "webp": 85,
    "avif": 80,
    "jpeg": 90
  },
  "outputDir": "optimized",
  "generateThumbnails": true,
  "thumbnailWidth": 200,
  "preserveMetadata": false
}
```

## Implementation Notes

- Use a schema validator for robust validation
- Consider supporting .imagerc.js for dynamic configs (future)
- Log configuration loading in verbose mode
- Consider supporting extends for shared configs (future)