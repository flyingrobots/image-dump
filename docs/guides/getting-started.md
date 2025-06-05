# Getting Started

This guide will help you get the image optimization system up and running quickly.

## Prerequisites

Choose one of the following:
- **Docker** (recommended) - [Install Docker](https://docs.docker.com/get-docker/)
- **Node.js 18+** - [Install Node.js](https://nodejs.org/)

## Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/flyingrobots/image-dump.git
cd image-dump

# Run optimization
make optimize

# That's it! Check the optimized/ directory
```

### Using Node.js

```bash
# Clone the repository
git clone https://github.com/flyingrobots/image-dump.git
cd image-dump

# Install dependencies
npm install

# Run optimization
npm run optimize

# Check the optimized/ directory
```

## Basic Usage

### Adding Images

1. Drop your images into the `original/` directory
2. Run the optimization command
3. Find optimized images in the `optimized/` directory

### Supported Formats

- **Input**: PNG, JPEG, GIF, WebP
- **Output**: WebP, AVIF, optimized PNG/JPEG, thumbnails

### What Gets Generated

For each image, you'll get:
- `image.webp` - Modern format (85% quality)
- `image.avif` - Next-gen format (80% quality)
- `image.png/jpg` - Optimized original format
- `image-thumb.webp` - 400x400 thumbnail

## Common Commands

### Docker Commands

```bash
# Optimize all images
make optimize

# Force reprocess all images
make optimize-force

# Run tests
make test

# See all commands
make help
```

### NPM Commands

```bash
# Optimize new/changed images
npm run optimize

# Force reprocess all
npm run optimize -- --force

# Handle Git LFS files
npm run optimize -- --pull-lfs

# Watch mode (auto-optimize on changes)
npm run optimize:watch
```

## Using Optimized Images

### In GitHub README

```markdown
![Alt text](https://raw.githubusercontent.com/flyingrobots/image-dump/main/optimized/image.webp)
```

### In HTML with Fallback

```html
<picture>
  <source srcset="https://raw.githubusercontent.com/flyingrobots/image-dump/main/optimized/image.avif" type="image/avif">
  <source srcset="https://raw.githubusercontent.com/flyingrobots/image-dump/main/optimized/image.webp" type="image/webp">
  <img src="https://raw.githubusercontent.com/flyingrobots/image-dump/main/optimized/image.jpg" alt="Description">
</picture>
```

### Responsive Images

```html
<picture>
  <source media="(max-width: 400px)" 
          srcset="https://raw.githubusercontent.com/flyingrobots/image-dump/main/optimized/image-thumb.webp">
  <source srcset="https://raw.githubusercontent.com/flyingrobots/image-dump/main/optimized/image.webp">
  <img src="https://raw.githubusercontent.com/flyingrobots/image-dump/main/optimized/image.jpg" alt="Description">
</picture>
```

## Automation

### GitHub Actions

Images are automatically optimized when pushed to the `original/` directory:

1. Push images to `original/`
2. GitHub Actions runs optimization
3. Optimized images are committed automatically
4. CDN URLs are immediately available

### Git LFS

Large images are stored efficiently with Git LFS:

```bash
# Pull LFS files
git lfs pull

# Track new file types
git lfs track "*.psd"
git add .gitattributes
git commit -m "Track PSD files with LFS"
```

## Troubleshooting

### Images Not Processing

1. Check file is in `original/` directory
2. Verify it's a supported format
3. For Docker, ensure volumes are mounted correctly
4. Check for error messages in console output

### Git LFS Issues

```bash
# Install Git LFS
git lfs install

# Pull all LFS files
git lfs pull

# Or use the flag
npm run optimize -- --pull-lfs
```

### Docker Issues

```bash
# Rebuild images
docker compose build --no-cache

# Clean up
docker compose down -v
docker system prune
```

## Next Steps

- Read the [Technical Architecture](../architecture/technical-architecture.md)
- Explore [Advanced Features](./advanced-usage.md)
- Set up [Development Environment](./development.md)
- View the [Roadmap](../ROADMAP.md)