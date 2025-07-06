# 🖼️ Image Dump

[![Run Tests](https://github.com/flyingrobots/image-dump/actions/workflows/test.yml/badge.svg)](https://github.com/flyingrobots/image-dump/actions/workflows/test.yml)
[![Optimize Images](https://github.com/flyingrobots/image-dump/actions/workflows/optimize-images.yml/badge.svg)](https://github.com/flyingrobots/image-dump/actions/workflows/optimize-images.yml)

Transform your repository into a high-performance image CDN. Drop images in, get optimized versions out - automatically, securely, and efficiently.

## What is Image Dump?

Image Dump turns any GitHub repository into a powerful image optimization and delivery system. It automatically converts your images to modern formats (WebP, AVIF), applies smart compression, and serves them directly from GitHub's CDN - all while protecting against malicious files and resource abuse.

### Key Benefits

- **🚀 Zero Infrastructure** - Runs entirely on GitHub Actions, no servers needed
- **🔒 Enterprise Security** - Built-in protection against malicious images and attacks
- **⚡ Modern Formats** - Automatic WebP/AVIF conversion for 50-80% smaller files
- **🎯 Smart Optimization** - Different quality settings per image based on your rules
- **🐳 No Dependencies** - Everything runs in Docker, works anywhere

## Quick Start

1. **Drop images in the `original/` folder**
2. **Push to GitHub**
3. **Find optimized versions in `optimized/`**

That's it! No configuration needed for basic usage.

```bash
# Run locally (Docker required, nothing else)
npm run optimize

# Force reprocess all images
npm run optimize:force

# Watch mode for development
npm run optimize:watch
```

## Features

### 🎨 Image Processing
- Multiple output formats (WebP, AVIF, JPEG, PNG)
- Configurable quality levels with per-image rules
- Automatic format selection based on best compression
- Thumbnail generation with custom dimensions
- Metadata preservation or stripping
- Batch processing with progress tracking

### 🔐 Security & Validation
- **File Validation** - Magic byte verification ensures files are real images
- **Size Protection** - Configurable file size and dimension limits
- **Attack Prevention** - Blocks ZIP bombs, script injections, and polyglot files
- **Resource Limits** - CPU and memory caps prevent denial of service
- **EXIF Sanitization** - Removes potentially harmful metadata
- **Deep Scanning** - Optional steganography detection

### 🚄 Performance
- Skip processing for unchanged files
- Concurrent processing with controlled parallelism
- Git LFS support for large files
- Resume interrupted batches
- Real-time progress with ETA
- Docker-based for consistent performance

### ⚙️ Configuration
- `.imagerc` file for project settings
- Per-directory quality rules
- Pattern-based quality matching
- Size-based optimization rules
- CLI flags for one-off adjustments
- Environment variable support

## Configuration

Create `.imagerc` in your project root:

```json
{
  "formats": ["webp", "avif", "original"],
  "quality": {
    "webp": 85,
    "avif": 80,
    "jpeg": 90
  },
  "outputDir": "optimized",
  "generateThumbnails": true,
  "thumbnailWidth": 200,
  "preserveMetadata": false,
  "security": {
    "maxFileSize": 52428800,
    "maxDimensions": { "width": 10000, "height": 10000 },
    "enableDeepValidation": true
  }
}
```

### Advanced Quality Rules

Apply different settings based on patterns, directories, or image dimensions:

```json
{
  "qualityRules": [
    {
      "pattern": "*-hero.jpg",
      "quality": { "webp": 95, "avif": 90 }
    },
    {
      "directory": "products/",
      "quality": { "webp": 85 }
    },
    {
      "minWidth": 2000,
      "quality": { "jpeg": 95, "webp": 90 }
    }
  ]
}
```

### Security Configuration

```json
{
  "security": {
    "maxFileSize": 52428800,              // 50MB limit
    "allowedFormats": ["jpg", "jpeg", "png", "webp", "gif"],
    "detectPolyglot": true,               // Detect hidden file types
    "sanitizeExif": true,                 // Remove GPS data, comments
    "resourceLimits": {
      "maxMemory": 1073741824,            // 1GB memory limit
      "maxCpuTime": 30000,                // 30 second CPU limit
      "maxConcurrency": 5                 // Process 5 images at once
    }
  }
}
```

## CLI Usage

```bash
# Basic optimization
npm run optimize

# With options
npm run optimize -- --quality=95 --format=webp

# Continue after errors
npm run optimize -- --continue-on-error

# Resume interrupted batch
npm run optimize -- --resume

# Quiet mode (no progress bar)
npm run optimize -- --quiet

# Custom config file
npm run optimize -- --config=production.imagerc
```

## GitHub Actions

Automatic optimization on every push:

```yaml
name: Optimize Images
on:
  push:
    paths:
      - 'original/**'
      - '.imagerc'

jobs:
  optimize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run optimize
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'Optimize images'
```

## Using Optimized Images

### In Markdown
```markdown
![Product](https://raw.githubusercontent.com/username/repo/main/optimized/product.webp)
```

### In HTML (with fallbacks)
```html
<picture>
  <source srcset="optimized/hero.avif" type="image/avif">
  <source srcset="optimized/hero.webp" type="image/webp">
  <img src="optimized/hero.jpg" alt="Hero image" loading="lazy">
</picture>
```

### Direct CDN URLs
```
https://raw.githubusercontent.com/username/repo/main/optimized/image.webp
https://cdn.jsdelivr.net/gh/username/repo@main/optimized/image.webp
```

## Installation

### As GitHub Template
1. Click "Use this template" on GitHub
2. Clone your new repository
3. Start adding images to `original/`

### In Existing Project
```bash
# Clone the repo
git clone https://github.com/flyingrobots/image-dump.git
cd image-dump

# Copy core files to your project
cp -r scripts src package.json docker-compose.yml .dockerignore /your/project/

# Install dependencies (optional - everything runs in Docker)
npm install
```

## Development

```bash
# First time setup
./scripts/setup-dev.sh

# Run tests (in Docker, same as CI)
npm test

# Watch tests
npm run test:watch

# Lint code
npm run lint

# Build Docker images
make build
```

### Project Structure
```
image-dump/
├── original/           # Source images (your input)
├── optimized/          # Optimized images (output)
├── scripts/            # CLI and optimization scripts
├── src/                # Core processing modules
│   ├── lib/           # Image processing components
│   └── security/      # Security validation modules
├── tests/             # Comprehensive test suite
├── docs/              # Documentation
└── .github/           # GitHub Actions workflows
```

## Security Features

Image Dump includes enterprise-grade security out of the box:

### 🛡️ Input Validation
- Magic byte verification (prevents fake images)
- File size limits (prevents resource exhaustion)
- Dimension limits (prevents memory bombs)
- Format whitelist (only safe formats allowed)

### 🚨 Attack Prevention
- **ZIP Bomb Detection** - Identifies compressed archives hiding as images
- **Script Injection** - Blocks SVG files with embedded JavaScript
- **Polyglot Files** - Detects files trying to be multiple formats
- **EXIF Exploits** - Sanitizes metadata that could contain malicious code

### 🔒 Resource Protection
- Memory usage limits per operation
- CPU time limits to prevent infinite loops
- Concurrent operation throttling
- Graceful degradation under load

## Performance

Typical optimization results:
- **JPEG → WebP**: 25-35% smaller
- **PNG → WebP**: 50-80% smaller  
- **Any → AVIF**: 50-85% smaller (with slight quality trade-off)

Processing speed:
- ~100-200ms per image (1-2 MP)
- ~300-500ms per image (5-10 MP)
- Parallel processing of 5 images by default

## Roadmap

- ✅ **Phase 1-4**: Core features, security, configuration (COMPLETE)
- 🚧 **Phase 5**: Web UI and REST API
- 📋 **Phase 6**: VS Code extension, GitHub App
- 📋 **Phase 7**: AI-powered optimization, CDN integration

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Areas we'd love help with:
- Additional image format support
- Performance optimizations
- Security enhancements
- Documentation improvements
- Test coverage expansion

## License

MIT - See [LICENSE](LICENSE) for details.

---

<p align="center">
Built with ❤️ for developers who care about performance
</p>

<p align="center">
  <a href="https://github.com/flyingrobots/image-dump/issues">Report Bug</a> •
  <a href="https://github.com/flyingrobots/image-dump/discussions">Discussions</a> •
  <a href="docs/">Documentation</a>
</p>