const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const ConfigLoader = require('./lib/config-loader');

// Parse command line arguments
const args = process.argv.slice(2);
const forceReprocess = args.includes('--force');
const pullLfs = args.includes('--pull-lfs');
const noThumbnails = args.includes('--no-thumbnails');

// Will be populated by config
let config = {};

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

function applyMetadataSettings(sharpInstance, config) {
  if (config.preserveMetadata === true) {
    return sharpInstance.withMetadata();
  } else if (typeof config.preserveMetadata === 'object') {
    // TODO: Implement selective preservation
    return sharpInstance.withMetadata();
  }
  // Default: strip metadata (Sharp's default behavior)
  return sharpInstance;
}

async function getOutputPaths(filename) {
  const name = path.parse(filename).name;
  const ext = path.parse(filename).ext.toLowerCase();
  const paths = [];
  
  // Generate paths based on configured formats
  if (config.formats.includes('webp')) {
    paths.push(path.join(config.outputDir, `${name}.webp`));
  }
  
  if (config.formats.includes('avif')) {
    paths.push(path.join(config.outputDir, `${name}.avif`));
  }
  
  if (config.formats.includes('original') || 
      config.formats.includes('jpeg') || 
      config.formats.includes('png')) {
    if (ext === '.gif' || ext === '.webp') {
      paths.push(path.join(config.outputDir, filename));
    } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      paths.push(path.join(config.outputDir, filename));
    }
  }
  
  if (config.generateThumbnails && !noThumbnails && 
      (config.formats.includes('webp') || config.formats.includes('avif'))) {
    paths.push(path.join(config.outputDir, `${name}-thumb.webp`));
  }
  
  return paths;
}

async function optimizeImage(inputPath, filename) {
  const name = path.parse(filename).name;
  const ext = path.parse(filename).ext.toLowerCase();
  
  // Check for Git LFS pointer
  if (await isGitLfsPointer(inputPath)) {
    if (pullLfs) {
      console.log(`📥 Pulling LFS file: ${filename}`);
      const { execSync } = require('child_process');
      try {
        execSync(`git lfs pull --include="${filename}"`, { 
          cwd: path.dirname(inputPath),
          stdio: 'inherit' 
        });
        
        // Check again after pull
        if (await isGitLfsPointer(inputPath)) {
          console.error(`❌ Failed to pull LFS file: ${filename}`);
          return 'lfs-error';
        }
      } catch (error) {
        console.error(`❌ Error pulling LFS file: ${filename} - ${error.message}`);
        return 'lfs-error';
      }
    } else {
      console.log(`⚠️  Skipping ${filename} (Git LFS pointer file - use --pull-lfs flag or run 'git lfs pull')`);
      return 'lfs-pointer';
    }
  }

  const outputPaths = await getOutputPaths(filename);
  
  // Check if processing is needed
  const needsProcessing = await shouldProcessImage(inputPath, outputPaths);
  
  if (!needsProcessing) {
    console.log(`⏭️  Skipping ${filename} (already up to date)`);
    return 'skipped';
  }

  try {
    // Handle GIF files - just copy them
    if (ext === '.gif') {
      await fs.copyFile(inputPath, path.join(config.outputDir, filename));
      console.log(`✅ Copied ${filename} (GIF files are not optimized)`);
      return 'processed';
    }

    // For WebP input, handle specially
    if (ext === '.webp') {
      const tasks = [];
      
      if (config.formats.includes('webp') || config.formats.includes('original')) {
        tasks.push(
          applyMetadataSettings(
            sharp(inputPath)
              .resize(2000, 2000, {
                fit: 'inside',
                withoutEnlargement: true
              }),
            config
          )
          .webp({ quality: config.quality.webp })
          .toFile(path.join(config.outputDir, filename))
        );
      }
      
      if (config.generateThumbnails && !noThumbnails) {
        tasks.push(
          sharp(inputPath)
            .resize(config.thumbnailWidth, config.thumbnailWidth, {
              fit: 'cover',
              position: 'centre'
            })
            .webp({ quality: config.quality.webp })
            .toFile(path.join(config.outputDir, `${name}-thumb.webp`))
        );
      }
      
      if (tasks.length > 0) {
        await Promise.all(tasks);
      }
      
      // Validate output files
      for (const outputPath of outputPaths) {
        try {
          await sharp(outputPath).metadata();
        } catch (validationError) {
          console.error(`❌ Validation failed for ${filename}: ${validationError.message}`);
          return 'error';
        }
      }
      
      console.log(`✅ Optimized ${filename}`);
      return 'processed';
    }

    // For other formats, process based on configuration
    const tasks = [];
    
    if (config.formats.includes('original') || 
        (ext === '.png' && config.formats.includes('png')) ||
        ((ext === '.jpg' || ext === '.jpeg') && config.formats.includes('jpeg'))) {
      const isJpeg = ext === '.jpg' || ext === '.jpeg';
      tasks.push(
        applyMetadataSettings(
          sharp(inputPath)
            .resize(2000, 2000, {
              fit: 'inside',
              withoutEnlargement: true
            }),
          config
        )
          [isJpeg ? 'jpeg' : 'png'](isJpeg ? { quality: config.quality.jpeg } : {})
          .toFile(path.join(config.outputDir, filename))
      );
    }
    
    if (config.formats.includes('avif')) {
      tasks.push(
        applyMetadataSettings(
          sharp(inputPath)
            .resize(2000, 2000, {
              fit: 'inside',
              withoutEnlargement: true
            }),
          config
        )
        .avif({ quality: config.quality.avif })
        .toFile(path.join(config.outputDir, `${name}.avif`))
      );
    }
    
    if (config.formats.includes('webp')) {
      tasks.push(
        applyMetadataSettings(
          sharp(inputPath)
            .resize(2000, 2000, {
              fit: 'inside',
              withoutEnlargement: true
            }),
          config
        )
        .webp({ quality: config.quality.webp })
        .toFile(path.join(config.outputDir, `${name}.webp`))
      );
    }
    
    if (config.generateThumbnails && !noThumbnails && 
        (config.formats.includes('webp') || config.formats.includes('avif'))) {
      tasks.push(
        sharp(inputPath)
          .resize(config.thumbnailWidth, config.thumbnailWidth, {
            fit: 'cover',
            position: 'centre'
          })
          .webp({ quality: config.quality.webp })
          .toFile(path.join(config.outputDir, `${name}-thumb.webp`))
      );
    }
    
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
    
    // Validate all output files exist and are valid
    for (const outputPath of outputPaths) {
      try {
        await sharp(outputPath).metadata();
      } catch (validationError) {
        console.error(`❌ Validation failed for ${filename}: ${validationError.message}`);
        return 'error';
      }
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
    // Load configuration
    const configLoader = new ConfigLoader();
    
    // Build CLI args from parsed flags
    const cliArgs = {};
    if (noThumbnails) {
      cliArgs.generateThumbnails = false;
    }
    
    try {
      config = await configLoader.loadConfig(process.cwd(), cliArgs);
    } catch (error) {
      console.error(`❌ Configuration error: ${error.message}`);
      process.exit(1);
    }
    
    // Ensure directories exist
    await fs.mkdir('original', { recursive: true });
    await fs.mkdir(config.outputDir, { recursive: true });

    // Get list of images to process
    const files = await fs.readdir('original');
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    if (imageFiles.length === 0) {
      console.log('No images found in the original/ directory');
      return;
    }

    console.log(`Found ${imageFiles.length} images to process...`);
    if (config.formats.length < 3 || !config.generateThumbnails) {
      console.log(`Using configuration: formats=[${config.formats.join(', ')}], thumbnails=${config.generateThumbnails}`);
    }
    console.log('');

    // Process images
    let processed = 0;
    let skipped = 0;
    let lfsPointers = 0;
    let lfsErrors = 0;
    let errors = 0;

    for (const file of imageFiles) {
      const inputPath = path.join('original', file);
      const result = await optimizeImage(inputPath, file);
      
      switch (result) {
        case 'processed':
          processed++;
          break;
        case 'skipped':
          skipped++;
          break;
        case 'lfs-pointer':
          lfsPointers++;
          break;
        case 'lfs-error':
          lfsErrors++;
          errors++;
          break;
        case 'error':
          errors++;
          break;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Optimization complete!');
    console.log(`   Processed: ${processed} images`);
    console.log(`   Skipped: ${skipped} images (already up to date)`);
    if (lfsPointers > 0) {
      console.log(`   LFS pointers: ${lfsPointers} files (use --pull-lfs to process)`);
    }
    if (lfsErrors > 0) {
      console.log(`   LFS errors: ${lfsErrors} files`);
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
        const inputPath = path.join('original', file);
        const name = path.parse(file).name;
        const ext = path.parse(file).ext.toLowerCase();
        
        try {
          const inputStats = await fs.stat(inputPath);
          processedOriginalSize += inputStats.size;
          
          // Check main output file (not thumbnails or alternate formats)
          const mainOutputPath = path.join(config.outputDir, ext === '.gif' ? file : 
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
    if (errors > 0) {
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