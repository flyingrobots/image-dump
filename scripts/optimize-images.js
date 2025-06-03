const sharp = require('sharp');
  const fs = require('fs').promises;
  const path = require('path');

  const INPUT_DIR = 'original';
  const OUTPUT_DIR = 'optimized';

  async function optimizeImage(inputPath, filename) {
    const name = path.parse(filename).name;
    
    // Create WebP version
    await sharp(inputPath)
      .resize(2000, 2000, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality: 85 })
      .toFile(path.join(OUTPUT_DIR, `${name}.webp`));
    
    // Create optimized PNG/JPEG
    if (filename.endsWith('.png')) {
      await sharp(inputPath)
        .resize(2000, 2000, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .png({ compressionLevel: 9 })
        .toFile(path.join(OUTPUT_DIR, `${name}.png`));
    } else {
      await sharp(inputPath)
        .resize(2000, 2000, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ quality: 90 })
        .toFile(path.join(OUTPUT_DIR, `${name}.jpg`));
    }
    
    // Create thumbnail
    await sharp(inputPath)
      .resize(400, 400, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality: 80 })
      .toFile(path.join(OUTPUT_DIR, `${name}-thumb.webp`));
  }

  async function main() {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    const files = await fs.readdir(INPUT_DIR);
    const imageFiles = files.filter(f => 
      /\.(jpg|jpeg|png)$/i.test(f)
    );
    
    for (const file of imageFiles) {
      console.log(`Optimizing ${file}...`);
      await optimizeImage(path.join(INPUT_DIR, file), file);
    }
    
    console.log('✅ Optimization complete!');
  }

  main().catch(console.error);