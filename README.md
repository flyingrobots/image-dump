# Image Dump

A personal image hosting repository so I can use GitHub's raw.githubusercontent.com as a free CDN.

## Structure

Repo is prettu simple:

- `original/` - Source images (tracked by Git LFS)
- `optimized/` - Processed images ready for use
- `scripts/` - Image optimization tooling

## Usage

Dump images into the `original` directory, then run `npm run optimize`, or `npm run optimize:watch` if you want to run with a file watcher enabled.

### Adding New Images

1. Drop images into `original/`
2. Run `npm run optimize`
3. Commit and push

### Using Images

**In GitHub READMEs:**
```markdown
![Alt text](https://raw.githubusercontent.com/YOUR_USERNAME/image-dump/main/optimized/image-name.webp)
```

**In HTML with fallback:**
```html
<picture>
  <source srcset="https://raw.githubusercontent.com/YOUR_USERNAME/image-dump/main/optimized/image.webp" type="image/webp">
  <img src="https://raw.githubusercontent.com/YOUR_USERNAME/image-dump/main/optimized/image.png" alt="Description">
</picture>
```

## What Gets Generated

For each image in `original/`, the optimization script creates:
- **WebP version** - Modern format, smaller file size
- **AVIF version** - Next-gen format, even better compression (not all browsers support yet)
- **Optimized PNG/JPEG** - Fallback for compatibility (max 2000x2000)
- **Thumbnail** - WebP thumbnail (max 400x400) with `-thumb` suffix

Special handling:
- **GIF files** - Copied as-is to preserve animation
- **WebP input** - Optimized and thumbnailed, but kept as WebP

## Setup

```bash
# Install dependencies
npm install

# Run optimization
npm run optimize

# Force reprocess all images (ignores timestamps)
npm run optimize -- --force
```

## Technical Details

- Uses [Sharp](https://sharp.pixelplumbing.com/) for image processing
- Git LFS stores original images efficiently
- Optimized images are version controlled normally for fast CDN access
- Supported input formats: PNG, JPEG, GIF, WebP
- WebP quality: 85% (80% for thumbnails)
- AVIF quality: 80%
- JPEG quality: 90%
- PNG compression: Level 9
- EXIF metadata stripped for privacy