const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const INPUT_DIR = 'original';
const OUTPUT_DIR = 'optimized';

// Parse command line arguments
const args = process.argv.slice(2);
const forceReprocess = args.includes('--force');

async function getFileModTime(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.mtime;
  } catch {
    return null;
  }
}

async function shouldProcessImage(inputPath, outputPaths) {
  if (forceReprocess) return true;
  
  const inputModTime = await getFileModTime(inputPath);
  if (!inputModTime) return false;

  for (const outputPath of outputPaths) {
    const outputModTime = await getFileModTime(outputPath);
    if (!outputModTime || inputModTime > outputModTime) {
      return true;
    }
  }
  
  return false;
}

async function optimizeImage(inputPath, filename) {
  const name = path.parse(filename).name;
  const ext = path.parse(filename).ext.toLowerCase();
  
  // Define output paths
  const outputPaths = [
    path.join(OUTPUT_DIR, `${name}.webp`),
    path.join(OUTPUT_DIR, `${name}.avif`),
    path.join(OUTPUT_DIR, `${name}${ext === '.png' ? '.png' : '.jpg'}`),
    path.join(OUTPUT_DIR, `${name}-thumb.webp`)
  ];
  
  // Check if we need to process this image
  const needsProcessing = await shouldProcessImage(inputPath, outputPaths);
  if (!needsProcessing) {
    console.log(`⏭️  Skipping ${filename} (already up to date)`);
    return 'skipped';
  }
  
  try {
    // Handle GIF files - just copy them
    if (ext === '.gif') {
      await fs.copyFile(inputPath, path.join(OUTPUT_DIR, filename));
      console.log(`✅ Copied ${filename} (GIF files are not optimized)`);
      return 'processed';
    }
    
    // Handle WebP input - optimize but keep as WebP
    if (ext === '.webp') {
      const image = sharp(inputPath);
      
      // Create optimized WebP
      await image
        .clone()
        .resize(2000, 2000, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: 85 })
        .toFile(path.join(OUTPUT_DIR, filename));
      
      // Create thumbnail
      await image
        .clone()
        .resize(400, 400, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: 80 })
        .toFile(path.join(OUTPUT_DIR, `${name}-thumb.webp`));
        
      console.log(`✅ Optimized ${filename}`);
      return 'processed';
    }
    
    // Load image once and rotate based on EXIF data
    const image = sharp(inputPath)
      .rotate() // Auto-rotate based on EXIF orientation
      .withMetadata({
        // Strip all metadata except copyright
        exif: {},
        icc: false,
        xmp: false,
        iptc: false,
        tifftagPhotoshop: false
      });
    
    // Create WebP version
    await image
      .clone()
      .resize(2000, 2000, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality: 85 })
      .toFile(outputPaths[0]);
    
    // Create AVIF version (better compression than WebP)
    await image
      .clone()
      .resize(2000, 2000, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .avif({ quality: 80 })
      .toFile(outputPaths[1]);
    
    // Create optimized PNG/JPEG
    if (ext === '.png') {
      await image
        .clone()
        .resize(2000, 2000, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .png({ compressionLevel: 9 })
        .toFile(outputPaths[2]);
    } else {
      await image
        .clone()
        .resize(2000, 2000, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ quality: 90 })
        .toFile(outputPaths[2]);
    }
    
    // Create thumbnail
    await image
      .clone()
      .resize(400, 400, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality: 80 })
      .toFile(outputPaths[3]);
      
    console.log(`✅ Optimized ${filename}`);
    return 'processed';
  } catch (error) {
    console.error(`❌ Error processing ${filename}: ${error.message}`);
    return 'error';
  }
}

async function main() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    const files = await fs.readdir(INPUT_DIR);
    const imageFiles = files.filter(f => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );
    
    if (imageFiles.length === 0) {
      console.log('No images found in the original directory');
      return;
    }
    
    console.log(`Found ${imageFiles.length} images to process...`);
    if (forceReprocess) {
      console.log('Force reprocessing enabled - all images will be regenerated\n');
    } else {
      console.log('');
    }
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const file of imageFiles) {
      const result = await optimizeImage(path.join(INPUT_DIR, file), file);
      if (result === 'processed') processed++;
      else if (result === 'skipped') skipped++;
      else if (result === 'error') errors++;
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Optimization complete!');
    console.log(`   Processed: ${processed} images`);
    console.log(`   Skipped: ${skipped} images (already up to date)`);
    if (errors > 0) {
      console.log(`   Errors: ${errors} images`);
    }
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);