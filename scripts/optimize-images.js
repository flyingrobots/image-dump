const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const ConfigLoader = require('../src/config-loader');
const ErrorRecoveryManager = require('../src/error-recovery-manager');
const ProgressManager = require('../src/progress-manager');
const QualityRulesEngine = require('../src/quality-rules-engine');

// Parse command line arguments
const args = process.argv.slice(2);
const forceReprocess = args.includes('--force');
const pullLfs = args.includes('--pull-lfs');
const noThumbnails = args.includes('--no-thumbnails');
const continueOnError = args.includes('--continue-on-error');
const resumeFlag = args.includes('--resume');
const quietMode = args.includes('--quiet') || args.includes('-q');

// Extract error recovery options
const maxRetriesArg = args.find(arg => arg.startsWith('--max-retries='));
const maxRetries = maxRetriesArg ? parseInt(maxRetriesArg.split('=')[1]) : 3;

const retryDelayArg = args.find(arg => arg.startsWith('--retry-delay='));
const retryDelay = retryDelayArg ? parseInt(retryDelayArg.split('=')[1]) : 1000;

const errorLogArg = args.find(arg => arg.startsWith('--error-log='));
const errorLog = errorLogArg ? errorLogArg.split('=')[1] : 'image-optimization-errors.log';

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

async function getOutputPaths(relativePath) {
  const dir = path.dirname(relativePath);
  const basename = path.basename(relativePath);
  const name = path.parse(basename).name;
  const ext = path.parse(basename).ext.toLowerCase();
  const paths = [];
  
  // Generate paths based on configured formats
  if (config.formats.includes('webp')) {
    paths.push(path.join(config.outputDir, dir, `${name}.webp`));
  }
  
  if (config.formats.includes('avif')) {
    paths.push(path.join(config.outputDir, dir, `${name}.avif`));
  }
  
  if (config.formats.includes('original') || 
      config.formats.includes('jpeg') || 
      config.formats.includes('png')) {
    if (ext === '.gif' || ext === '.webp') {
      paths.push(path.join(config.outputDir, relativePath));
    } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      paths.push(path.join(config.outputDir, relativePath));
    }
  }
  
  if (config.generateThumbnails && !noThumbnails && 
      (config.formats.includes('webp') || config.formats.includes('avif'))) {
    paths.push(path.join(config.outputDir, dir, `${name}-thumb.webp`));
  }
  
  return paths;
}

async function optimizeImage(inputPath, relativePath, imageQuality = null) {
  const dir = path.dirname(relativePath);
  const basename = path.basename(relativePath);
  const name = path.parse(basename).name;
  const ext = path.parse(basename).ext.toLowerCase();
  
  // Use provided quality or fall back to config
  const quality = imageQuality || config.quality;
  
  // Check for Git LFS pointer
  if (await isGitLfsPointer(inputPath)) {
    if (pullLfs) {
      console.log(`📥 Pulling LFS file: ${relativePath}`);
      const { execSync } = require('child_process');
      try {
        execSync(`git lfs pull --include="original/${relativePath}"`, { 
          stdio: 'inherit' 
        });
        
        // Check again after pull
        if (await isGitLfsPointer(inputPath)) {
          console.error(`❌ Failed to pull LFS file: ${relativePath}`);
          return 'lfs-error';
        }
      } catch (error) {
        console.error(`❌ Error pulling LFS file: ${relativePath} - ${error.message}`);
        return 'lfs-error';
      }
    } else {
      if (!quietMode) {
        console.log(`⚠️  Skipping ${relativePath} (Git LFS pointer file - use --pull-lfs flag or run 'git lfs pull')`);
      }
      return 'lfs-pointer';
    }
  }

  // Ensure output subdirectory exists
  const outputSubdir = path.join(config.outputDir, dir);
  if (dir !== '.') {
    await fs.mkdir(outputSubdir, { recursive: true });
  }
  
  const outputPaths = await getOutputPaths(relativePath);
  
  // Check if processing is needed
  const needsProcessing = await shouldProcessImage(inputPath, outputPaths);
  
  if (!needsProcessing) {
    if (!quietMode) {
      // Progress bar will show skipped status
    }
    return 'skipped';
  }

  try {
    // Handle GIF files - just copy them
    if (ext === '.gif') {
      await fs.copyFile(inputPath, path.join(config.outputDir, relativePath));
      if (!quietMode) {
        // Progress bar will show the status
      }
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
          .webp({ quality: quality.webp })
          .toFile(path.join(config.outputDir, relativePath))
        );
      }
      
      if (config.generateThumbnails && !noThumbnails) {
        tasks.push(
          sharp(inputPath)
            .resize(config.thumbnailWidth, config.thumbnailWidth, {
              fit: 'cover',
              position: 'centre'
            })
            .webp({ quality: quality.webp })
            .toFile(path.join(outputSubdir, `${name}-thumb.webp`))
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
          console.error(`❌ Validation failed for ${relativePath}: ${validationError.message}`);
          return 'error';
        }
      }
      
      console.log(`✅ Optimized ${relativePath}`);
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
          [isJpeg ? 'jpeg' : 'png'](isJpeg ? { quality: quality.jpeg } : {})
          .toFile(path.join(config.outputDir, relativePath))
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
        .avif({ quality: quality.avif })
        .toFile(path.join(outputSubdir, `${name}.avif`))
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
        .webp({ quality: quality.webp })
        .toFile(path.join(outputSubdir, `${name}.webp`))
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
          .webp({ quality: quality.webp })
          .toFile(path.join(outputSubdir, `${name}-thumb.webp`))
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
        console.error(`❌ Validation failed for ${relativePath}: ${validationError.message}`);
        return 'error';
      }
    }
    
    if (!quietMode) {
      // Progress bar will show the status
    }
    return 'processed';
  } catch (error) {
    if (!quietMode) {
      console.error(`❌ Error processing ${relativePath}: ${error.message}`);
    }
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
    // Initialize error recovery manager
    const errorRecovery = new ErrorRecoveryManager({
      continueOnError,
      maxRetries,
      retryDelay,
      errorLog,
      exponentialBackoff: true
    });
    
    // Initialize progress manager
    const progress = new ProgressManager({
      quiet: quietMode,
      showSpeed: true,
      showETA: true
    });
    
    // Handle graceful shutdown
    const cleanup = () => {
      progress.cleanup();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Check if we're resuming from a previous run
    let resumeState = null;
    if (resumeFlag) {
      resumeState = await errorRecovery.loadState();
      if (resumeState && !quietMode) {
        console.log('📂 Resuming from previous state...');
        console.log(`   Previously processed: ${resumeState.progress.processed} files`);
        console.log(`   Remaining: ${resumeState.progress.remaining} files\n`);
      } else if (!resumeState && !quietMode) {
        console.log('⚠️  No previous state found, starting fresh\n');
      }
    }
    
    // Load configuration
    const configLoader = new ConfigLoader();
    
    // Build CLI args from parsed flags
    const cliArgs = {};
    if (noThumbnails) {
      cliArgs.generateThumbnails = false;
    }
    
    try {
      config = await configLoader.loadConfig(process.cwd(), cliArgs);
      
      // Merge with error recovery config if present
      if (config.errorRecovery) {
        Object.assign(errorRecovery, {
          continueOnError: config.errorRecovery.continueOnError ?? errorRecovery.continueOnError,
          maxRetries: config.errorRecovery.maxRetries ?? errorRecovery.maxRetries,
          retryDelay: config.errorRecovery.retryDelay ?? errorRecovery.retryDelay,
          exponentialBackoff: config.errorRecovery.exponentialBackoff ?? errorRecovery.exponentialBackoff
        });
      }
    
    } catch (error) {
      console.error(`❌ Configuration error: ${error.message}`);
      process.exit(1);
    }
    
    // Initialize quality rules engine
    const qualityRules = new QualityRulesEngine(config.qualityRules || []);
    
    // Ensure directories exist
    await fs.mkdir('original', { recursive: true });
    await fs.mkdir(config.outputDir, { recursive: true });

    // Get list of images to process recursively
    async function getImagesRecursively(dir, baseDir = dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await getImagesRecursively(fullPath, baseDir));
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            // Store relative path from baseDir
            files.push(path.relative(baseDir, fullPath));
          }
        }
      }
      
      return files;
    }
    
    const imageFiles = await getImagesRecursively('original');

    if (imageFiles.length === 0) {
      console.log('No images found in the original/ directory');
      return;
    }

    if (!quietMode) {
      console.log(`Found ${imageFiles.length} images to process...`);
      if (config.formats.length < 3 || !config.generateThumbnails) {
        console.log(`Using configuration: formats=[${config.formats.join(', ')}], thumbnails=${config.generateThumbnails}`);
      }
      console.log('');
    }

    // Process images
    let processed = 0;
    let skipped = 0;
    let lfsPointers = 0;
    let lfsErrors = 0;
    let errors = 0;
    const startTime = Date.now();

    // Determine which files to process
    let filesToProcess = imageFiles;
    if (resumeState && resumeState.files.pending.length > 0) {
      // Filter to only pending files if resuming
      filesToProcess = imageFiles.filter(file => 
        resumeState.files.pending.includes(file) || !errorRecovery.isFileProcessed(path.join('original', file))
      );
    }

    // Save initial state
    await errorRecovery.saveState({
      startedAt: resumeState?.startedAt || new Date().toISOString(),
      total: imageFiles.length,
      pending: filesToProcess.map(f => path.join('original', f)),
      configuration: config
    });
    
    // Start progress bar
    progress.start(filesToProcess.length, resumeFlag ? 'Resuming batch processing...' : '');

    for (const [index, file] of filesToProcess.entries()) {
      const inputPath = path.join('original', file);
      
      // Skip if already processed in resume mode
      if (errorRecovery.isFileProcessed(inputPath)) {
        const previousResult = errorRecovery.processedFiles.get(inputPath);
        if (previousResult && previousResult.status === 'success') {
          skipped++;
          progress.update(index + 1, { 
            filename: file, 
            status: 'skipped' 
          });
        } else {
          errors++;
          progress.update(index + 1, { 
            filename: file, 
            status: 'error' 
          });
        }
        continue;
      }
      
      // Update progress to show current file
      progress.setFilename(file);
      
      // Get image metadata for quality rules
      let metadata = null;
      try {
        metadata = await sharp(inputPath).metadata();
      } catch (err) {
        // If we can't read metadata, quality rules based on size won't apply
      }
      
      // Get quality settings for this specific image
      const imageQuality = qualityRules.getQualityForImage(file, metadata, config.quality);
      
      // Log if custom quality is being used (debug)
      if (JSON.stringify(imageQuality) !== JSON.stringify(config.quality) && !quietMode) {
        const matches = qualityRules.explainMatch(file, metadata);
        if (matches.length > 0) {
          console.log(`🎨 Applying custom quality for ${file}:`);
          matches.forEach(match => {
            console.log(`  - Rule: ${match.criteria}`);
            console.log(`    Quality: ${JSON.stringify(match.quality)}`);
          });
        }
      }
      
      // Wrap the optimization in error recovery
      const { success, result: optimizationResult, attempts } = await errorRecovery.processWithRecovery(
        async () => {
          const result = await optimizeImage(inputPath, file, imageQuality);
          if (result === 'error' || result === 'lfs-error') {
            throw new Error(`Optimization failed with result: ${result}`);
          }
          return result;
        },
        { file: inputPath }
      );
      
      const result = success ? optimizationResult : 'error';
      
      // Record the result
      errorRecovery.recordProcessedFile(inputPath, {
        status: success ? 'success' : 'failed',
        result,
        attempts,
        error: success ? null : 'Optimization failed'
      });
      
      // Update state periodically
      if ((processed + errors + skipped) % 10 === 0) {
        await errorRecovery.saveState({
          startedAt: resumeState?.startedAt || new Date().toISOString(),
          total: imageFiles.length,
          pending: filesToProcess.slice(index + 1).map(f => path.join('original', f)),
          configuration: config
        });
      }
      
      // Update progress and stats
      let statusForProgress = 'processed';
      
      switch (result) {
        case 'processed':
          processed++;
          statusForProgress = 'processed';
          break;
        case 'skipped':
          skipped++;
          statusForProgress = 'skipped';
          break;
        case 'lfs-pointer':
          lfsPointers++;
          statusForProgress = 'skipped';
          break;
        case 'lfs-error':
          lfsErrors++;
          errors++;
          statusForProgress = 'error';
          break;
        case 'error':
          errors++;
          statusForProgress = 'error';
          break;
      }
      
      // Update progress bar
      progress.update(index + 1, {
        filename: file,
        status: statusForProgress
      });
    }

    // Final state save
    await errorRecovery.saveState({
      startedAt: resumeState?.startedAt || new Date().toISOString(),
      total: imageFiles.length,
      pending: [],
      configuration: config
    });
    
    // Finish progress bar
    progress.finish(false); // Don't show built-in summary
    
    // Summary
    if (!quietMode) {
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
        
        // Generate error report
        const report = errorRecovery.generateReport();
        if (report.errors.length > 0) {
          console.log(`   Error details saved to: ${report.errorLogPath}`);
        }
      }
      
      // Show timing
      const elapsedTime = Date.now() - startTime;
      const seconds = Math.floor(elapsedTime / 1000);
      const minutes = Math.floor(seconds / 60);
      if (minutes > 0) {
        console.log(`   Time: ${minutes}m ${seconds % 60}s`);
      } else {
        console.log(`   Time: ${seconds}s`);
      }
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
      
      if (!quietMode) {
        console.log(`\n📊 Size Statistics:`);
        console.log(`   Original size: ${formatBytes(processedOriginalSize)}`);
        console.log(`   Optimized size: ${formatBytes(processedOptimizedSize)}`);
        if (savedBytes > 0) {
          console.log(`   Space saved: ${formatBytes(savedBytes)} (${savedPercent}%)`);
        } else {
          console.log(`   Size increased: ${formatBytes(Math.abs(savedBytes))} (+${Math.abs(savedPercent)}%)`);
        }
      }
    }
    
    if (!quietMode) {
      console.log('='.repeat(50));
    }
    
    // Clean up state file if everything was successful
    if (errors === 0 && !resumeFlag) {
      await errorRecovery.clearState();
    } else if (errors > 0 && continueOnError) {
      console.log(`\n⚠️  Some images failed to process. Run with --resume to retry failed images.`);
    }
    
    // Exit with error code if there were errors and not in continue-on-error mode
    if (errors > 0 && !continueOnError) {
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