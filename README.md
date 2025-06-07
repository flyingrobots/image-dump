# Image Dump

[![Run Tests](https://github.com/flyingrobots/image-dump/actions/workflows/test.yml/badge.svg)](https://github.com/flyingrobots/image-dump/actions/workflows/test.yml)
[![Optimize Images](https://github.com/flyingrobots/image-dump/actions/workflows/optimize-images.yml/badge.svg)](https://github.com/flyingrobots/image-dump/actions/workflows/optimize-images.yml)

A high-performance image optimization pipeline that uses GitHub as a CDN. Drop images in, get optimized versions out.

## ✨ Features

- 🖼️ **Multi-format output** - WebP, AVIF, and optimized originals
- 🚀 **Automatic optimization** - GitHub Actions processes on push
- 🔍 **Smart processing** - Only processes changed images
- 🐳 **Dockerized** - No local dependencies needed
- 🧪 **Fully tested** - Comprehensive test suite
- 🔐 **Git LFS support** - Efficient large file handling

## 🚀 Quick Start

```bash
# Optimize images
make optimize
```

Images go in `original/`, optimized versions appear in `optimized/`. That's it!

## 📖 Documentation

- **[Getting Started Guide](docs/guides/getting-started.md)** - Detailed setup and usage
- **[Technical Architecture](docs/architecture/technical-architecture.md)** - System design
- **[Development Roadmap](docs/ROADMAP.md)** - What's planned
- **[All Documentation](docs/)** - Complete documentation index

## 🛠️ Usage

### Basic Commands

```bash
# Optimize new/changed images
make optimize

# Force reprocess all images
make optimize-force

# Run tests
make test
```

### Configuration

Create a `.imagerc` file in your project root to customize optimization settings:

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
  "preserveMetadata": false
}
```

#### Configuration Options

- **formats**: Array of output formats (`webp`, `avif`, `original`, `jpeg`, `png`)
- **quality**: Quality settings for each format (1-100)
- **outputDir**: Where to save optimized images
- **generateThumbnails**: Create thumbnail versions
- **thumbnailWidth**: Thumbnail size in pixels
- **preserveMetadata**: Keep EXIF/metadata (`true`) or strip it (`false`, default)
- **errorRecovery**: Configure error handling and retry behavior (see below)
- **qualityRules**: Apply different quality settings per image (see below)

See [.imagerc.example](.imagerc.example) for all available options.

#### Error Recovery Configuration

Configure error recovery in your `.imagerc`:

```json
{
  "errorRecovery": {
    "continueOnError": true,
    "maxRetries": 3,
    "retryDelay": 1000,
    "exponentialBackoff": true
  }
}
```

Or use command-line flags:
- `--continue-on-error`: Continue processing after failures
- `--max-retries=3`: Number of retry attempts (default: 3)
- `--retry-delay=1000`: Initial retry delay in ms (default: 1000)
- `--resume`: Resume from previous interrupted run
- `--error-log=PATH`: Custom error log location
- `--quiet` or `-q`: Disable progress bar and non-essential output

#### Per-Image Quality Settings

Apply different quality settings based on filename patterns, directories, or image dimensions:

```json
{
  "quality": {
    "webp": 80,
    "avif": 80
  },
  "qualityRules": [
    {
      "pattern": "*-hero.*",
      "quality": { "webp": 95, "avif": 90 }
    },
    {
      "directory": "products/thumbnails/",
      "quality": { "webp": 60 }
    },
    {
      "minWidth": 3000,
      "quality": { "jpeg": 95 }
    },
    {
      "pattern": "*-thumb.*",
      "directory": "gallery/",
      "quality": { "webp": 50 }
    }
  ]
}
```

Rules are applied in order of specificity - more specific rules override general ones.

### Using Optimized Images

```markdown
![Image](https://raw.githubusercontent.com/flyingrobots/image-dump/main/optimized/image.webp)
```

<details>
<summary>Advanced HTML with fallbacks</summary>

```html
<picture>
  <source srcset=".../image.avif" type="image/avif">
  <source srcset=".../image.webp" type="image/webp">
  <img src=".../image.jpg" alt="Description">
</picture>
```

</details>

## 🏗️ Project Structure

```
image-dump/
├── original/          # Put source images here
├── optimized/         # Optimized images appear here
├── scripts/           # Optimization code
│   └── lib/          # Modular components
├── tests/            # Test suite
├── docs/             # Documentation
└── .github/          # GitHub Actions workflows
```

## 🧪 Development

### Setup

First time setup (enables automatic tests before push):
```bash
./scripts/setup-dev.sh
```

### Testing

**`make test` or `npm test` runs exactly what CI runs:**
1. Tests with coverage
2. Console.log detection in src/
3. Focused test detection (.only/.skip)
4. Docker build verification

```bash
# Run tests (same as CI)
make test
# or
npm test

# Watch mode for development
make test-watch

# Individual commands (if needed)
make test-coverage  # Just test coverage
make lint-check     # Just lint checks
```

All tests run in Docker. There is no difference between local and CI - they run identical commands.

### Docker Commands

```bash
# Build Docker images
make build

# Rebuild without cache
make rebuild

# Clean up containers and images
make clean
```

**Note**: Tests ALWAYS run in Docker. This ensures your local environment exactly matches CI.

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](docs/development/contributing.md) and check the [Roadmap](docs/ROADMAP.md) for planned features.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

<p align="center">
  <a href="docs/guides/getting-started.md">Get Started</a> •
  <a href="docs/">Documentation</a> •
  <a href="https://github.com/flyingrobots/image-dump/issues">Issues</a>
</p>