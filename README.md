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
# Using Docker (recommended)
make optimize

# Using Node.js
npm install && npm run optimize
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

See [.imagerc.example](.imagerc.example) for all available options.

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