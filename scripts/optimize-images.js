const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const INPUT_DIR = 'original';
const OUTPUT_DIR = 'optimized';

// Parse command line arguments
const args = process.argv.slice(2);
const forceReprocess = args.includes('--force');
const pullLfs = args.includes('--pull-lfs');

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

async function isGitLfsPointer(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    // Git LFS pointer files start with this version line
    return content.startsWith('version https://git-lfs.github.com/spec/v1');
  } catch {
    // If we can't read as text, it's likely a binary file (actual image)
    return false;
  }
}

async function optimizeImage(inputPath, filename) {
  const name = path.parse(filename).name;
  const ext = path.parse(filename).ext.toLowerCase();
  
  // Check if this is a git-lfs pointer file
  if (await isGitLfsPointer(inputPath)) {
    if (pullLfs) {
      console.log(`📥 Pulling LFS file: ${filename}`);
      const { execSync } = require('child_process');
      try {
        execSync(`git lfs pull --include="${inputPath}"`, { stdio: 'inherit' });
        // Check again if it's still a pointer (pull might have failed)
        if (await isGitLfsPointer(inputPath)) {
          console.log(`❌ Failed to pull LFS file: ${filename}`);
          return 'lfs-error';
        }
      } catch (error) {
        console.log(`❌ Error pulling LFS file: ${filename} - ${error.message}`);
        return 'lfs-error';
      }
    } else {
      console.log(`⚠️  Skipping ${filename} (Git LFS pointer file - use --pull-lfs flag or run 'git lfs pull')`);
      return 'lfs-pointer';
    }
  }
  
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
      
      // Validate output files
      try {
        await sharp(path.join(OUTPUT_DIR, filename)).metadata();
        await sharp(path.join(OUTPUT_DIR, `${name}-thumb.webp`)).metadata();
      } catch (validationError) {
        console.error(`❌ Validation failed for ${filename}: ${validationError.message}`);
        return 'error';
      }
      
      console.log(`✅ Optimized ${filename}`);
      return 'processed';
    }
    
    // Load image once and rotate based on EXIF data
    const image = sharp(inputPath)
      .rotate(); // Auto-rotate based on EXIF orientation
    
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
    
    // Validate all output files exist and are valid
    try {
      for (const outputPath of outputPaths) {
        await sharp(outputPath).metadata();
      }
    } catch (validationError) {
      console.error(`❌ Validation failed for ${filename}: ${validationError.message}`);
      return 'error';
    }
    
    console.log(`✅ Optimized ${filename}`);
    return 'processed';
  } catch (error) {
    console.error(`❌ Error processing ${filename}: ${error.message}`);
    return 'error';
  }
}

async function getDirectorySize(dirPath) {
  let totalSize = 0;
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // Directory might not exist yet
  }
  return totalSize;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      console.log('Force reprocessing enabled - all images will be regenerated');
    }
    if (pullLfs) {
      console.log('Git LFS auto-pull enabled - pointer files will be downloaded');
    }
    console.log('');
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let lfsPointers = 0;
    let lfsErrors = 0;
    
    for (const file of imageFiles) {
      const result = await optimizeImage(path.join(INPUT_DIR, file), file);
      if (result === 'processed') processed++;
      else if (result === 'skipped') skipped++;
      else if (result === 'error') errors++;
      else if (result === 'lfs-pointer') lfsPointers++;
      else if (result === 'lfs-error') lfsErrors++;
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Optimization complete!');
    console.log(`   Processed: ${processed} images`);
    console.log(`   Skipped: ${skipped} images (already up to date)`);
    if (lfsPointers > 0) {
      console.log(`   Git LFS pointers: ${lfsPointers} files (use --pull-lfs flag)`);
    }
    if (lfsErrors > 0) {
      console.log(`   Git LFS errors: ${lfsErrors} files`);
    }
    if (errors > 0) {
      console.log(`   Errors: ${errors} images`);
    }
    
    // Calculate and display size savings
    if (processed > 0) {
      let processedOriginalSize = 0;
      let processedOptimizedSize = 0;
      
      // Calculate sizes only for processed files
      for (const file of imageFiles) {
        const inputPath = path.join(INPUT_DIR, file);
        const name = path.parse(file).name;
        const ext = path.parse(file).ext.toLowerCase();
        
        try {
          const inputStats = await fs.stat(inputPath);
          processedOriginalSize += inputStats.size;
          
          // Check main output file (not thumbnails or alternate formats)
          const mainOutputPath = path.join(OUTPUT_DIR, ext === '.gif' ? file : 
            (ext === '.webp' ? file : `${name}${ext === '.png' ? '.png' : '.jpg'}`));
          
          try {
            const outputStats = await fs.stat(mainOutputPath);
            processedOptimizedSize += outputStats.size;
          } catch {
            // Output file might not exist if there was an error
          }
        } catch {
          // Input file might not exist
        }
      }
      
      const savedBytes = processedOriginalSize - processedOptimizedSize;
      const savedPercent = processedOriginalSize > 0 ? ((savedBytes / processedOriginalSize) * 100).toFixed(1) : 0;
      
      console.log(`\n📊 Size Statistics:`);
      console.log(`   Original size: ${formatBytes(processedOriginalSize)}`);
      console.log(`   Optimized size: ${formatBytes(processedOptimizedSize)}`);
      if (savedBytes > 0) {
        console.log(`   Space saved: ${formatBytes(savedBytes)} (${savedPercent}%)`);
      } else {
        console.log(`   Size increased: ${formatBytes(Math.abs(savedBytes))} (+${Math.abs(savedPercent)}%)`);
      }
    }
    
    console.log('='.repeat(50));
    
    // Exit with error code if there were errors
    if (errors > 0 || lfsErrors > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Export functions for testing
module.exports = {
  isGitLfsPointer,
  shouldProcessImage,
  optimizeImage,
  getDirectorySize,
  formatBytes,
  main
};

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}