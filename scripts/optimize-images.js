const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Import our modules
const GitLfsDetector = require('../src/git-lfs-detector');
const GitLfsPuller = require('../src/git-lfs-puller');
const FileTimestampChecker = require('../src/file-timestamp-checker');
const ImageProcessor = require('../src/image-processor');
const OutputPathGenerator = require('../src/output-path-generator');
const ImageOptimizer = require('../src/image-optimizer');
const ConfigLoader = require('../src/config-loader');
const ErrorRecoveryManager = require('../src/error-recovery-manager');
const ProgressManager = require('../src/progress-manager');
const QualityRulesEngine = require('../src/quality-rules-engine');

const INPUT_DIR = 'original';

// Parse command line arguments
const args = process.argv.slice(2);
const forceReprocess = args.includes('--force');
const pullLfs = args.includes('--pull-lfs');
const noThumbnails = args.includes('--no-thumbnails');
const continueOnError = args.includes('--continue-on-error');
const resumeFlag = args.includes('--resume');
const quietMode = args.includes('--quiet') || args.includes('-q');
const watchMode = args.includes('--watch');

// Extract error recovery options
const maxRetriesArg = args.find(arg => arg.startsWith('--max-retries='));
const maxRetries = maxRetriesArg ? parseInt(maxRetriesArg.split('=')[1]) : 3;

const retryDelayArg = args.find(arg => arg.startsWith('--retry-delay='));
const retryDelay = retryDelayArg ? parseInt(retryDelayArg.split('=')[1]) : 1000;

const errorLogArg = args.find(arg => arg.startsWith('--error-log='));
const errorLog = errorLogArg ? errorLogArg.split('=')[1] : 'image-optimization-errors.log';

// Configuration and components will be initialized in main
let config = null;
let progressManager = null;
let errorRecoveryManager = null;
let qualityRulesEngine = null;
let logger = null;
let optimizer = null;

async function processImages() {
  try {
    await fs.mkdir(config.outputDir, { recursive: true });
    
    const files = await fs.readdir(INPUT_DIR);
    const imageFiles = files.filter(f => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );
    
    if (imageFiles.length === 0) {
      console.log('No images found in the original directory');
      return;
    }
    
    // Initialize progress manager
    progressManager.start(imageFiles.length);
    
    logger.log(`Found ${imageFiles.length} images to process...`);
    if (forceReprocess) {
      logger.log('Force reprocessing enabled - all images will be regenerated');
    }
    if (pullLfs) {
      logger.log('Git LFS auto-pull enabled - pointer files will be downloaded');
    }
    logger.log('');
    
    const stats = {
      processed: 0,
      skipped: 0,
      errors: 0,
      lfsPointers: 0,
      lfsErrors: 0
    };
    
    // Load any saved state
    const savedState = await errorRecoveryManager.loadState();
    const filesToProcess = imageFiles;
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const absoluteIndex = i;
      
      progressManager.setFilename(file);
      
      try {
        // Apply quality rules for this specific file
        const imageQuality = await qualityRulesEngine.getQualityForImage(
          path.join(INPUT_DIR, file)
        );
        
        // Merge with base quality settings
        const mergedQuality = {
          ...config.quality,
          ...imageQuality
        };
        
        const recoveryResult = await errorRecoveryManager.processWithRecovery(
          async () => {
            return await optimizer.optimizeImage(
              path.join(INPUT_DIR, file), 
              file,
              { 
                forceReprocess, 
                pullLfs,
                quality: mergedQuality
              }
            );
          },
          { file }
        );
        
        const result = recoveryResult.success ? recoveryResult.result : 'error';
        
        switch (result) {
          case 'processed': 
            stats.processed++; 
            progressManager.increment({ status: 'processed', filename: file });
            break;
          case 'skipped': 
            stats.skipped++; 
            progressManager.increment({ status: 'skipped', filename: file });
            break;
          case 'error': 
            stats.errors++; 
            progressManager.increment({ status: 'error', filename: file });
            if (!continueOnError) {
              throw new Error(`Failed to process ${file}`);
            }
            break;
          case 'lfs-pointer': 
            stats.lfsPointers++; 
            progressManager.increment({ status: 'skipped', filename: file });
            break;
          case 'lfs-error': 
            stats.lfsErrors++; 
            progressManager.increment({ status: 'error', filename: file });
            break;
        }
        
        // Record processed file
        errorRecoveryManager.recordProcessedFile(file, { status: result });
        
        // Save state periodically
        if (i % 10 === 0) {
          await errorRecoveryManager.saveState({ 
            processedCount: i + 1,
            totalCount: imageFiles.length 
          });
        }
        
      } catch (error) {
        stats.errors++;
        progressManager.completeFile(file, 'error');
        await errorRecoveryManager.logError(file, error);
        
        if (!continueOnError) {
          throw error;
        }
      }
    }
    
    // Finalize progress (don't show summary as we'll show our own)
    progressManager.finish(false);
    
    // Clean up error recovery state if all files processed successfully
    if (stats.errors === 0) {
      await errorRecoveryManager.clearState();
    } else {
      // Save final state
      await errorRecoveryManager.saveState({ 
        processedCount: imageFiles.length,
        totalCount: imageFiles.length 
      });
    }
    
    // Show summary
    if (!quietMode) {
      console.log('\n' + '='.repeat(50));
      console.log('✅ Optimization complete!');
      console.log(`   Processed: ${stats.processed} images`);
      console.log(`   Skipped: ${stats.skipped} images (already up to date)`);
      if (stats.lfsPointers > 0) {
        console.log(`   Git LFS pointers: ${stats.lfsPointers} files (use --pull-lfs flag)`);
      }
      if (stats.lfsErrors > 0) {
        console.log(`   Git LFS errors: ${stats.lfsErrors} files`);
      }
      if (stats.errors > 0) {
        console.log(`   Errors: ${stats.errors} images`);
        console.log(`   Error details logged to: ${errorLog}`);
      }
      console.log('='.repeat(50));
    }
    
    return stats;
  } catch (error) {
    progressManager.finish();
    console.error('Fatal error:', error);
    await errorRecoveryManager.logError('FATAL', error);
    process.exit(1);
  }
}

async function watchForChanges() {
  const chokidar = require('chokidar');
  
  console.log('👀 Watching for changes in the original directory...');
  console.log('Press Ctrl+C to stop\n');
  
  const watcher = chokidar.watch(INPUT_DIR, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });
  
  watcher.on('add', async (filePath) => {
    const file = path.basename(filePath);
    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) return;
    
    console.log(`\n📸 New image detected: ${file}`);
    
    try {
      const imageQuality = await qualityRulesEngine.getQualityForImage(filePath);
      const mergedQuality = {
        ...config.quality,
        ...imageQuality
      };
      
      const result = await optimizer.optimizeImage(
        filePath,
        file,
        { 
          forceReprocess: true,
          pullLfs,
          quality: mergedQuality
        }
      );
      
      if (result === 'processed') {
        console.log(`✅ Optimized ${file}`);
      } else if (result === 'error') {
        console.error(`❌ Failed to optimize ${file}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });
  
  watcher.on('change', async (filePath) => {
    const file = path.basename(filePath);
    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) return;
    
    console.log(`\n🔄 Image changed: ${file}`);
    
    try {
      const imageQuality = await qualityRulesEngine.getQualityForImage(filePath);
      const mergedQuality = {
        ...config.quality,
        ...imageQuality
      };
      
      const result = await optimizer.optimizeImage(
        filePath,
        file,
        { 
          forceReprocess: true,
          pullLfs,
          quality: mergedQuality
        }
      );
      
      if (result === 'processed') {
        console.log(`✅ Re-optimized ${file}`);
      } else if (result === 'error') {
        console.error(`❌ Failed to optimize ${file}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });
  
  watcher.on('error', error => {
    console.error('❌ Watcher error:', error);
  });
}

async function main() {
  try {
    // Load configuration
    const configLoader = new ConfigLoader();
    config = await configLoader.loadConfig();
    
    // Apply CLI overrides
    if (noThumbnails) {
      config.generateThumbnails = false;
    }
    
    // Create dependencies
    const fileReader = { readFile: fs.readFile };
    const fileStats = { stat: fs.stat };
    const commandExecutor = { 
      exec: (command) => execSync(command, { stdio: 'inherit' }) 
    };
    const fileOperations = { copyFile: fs.copyFile };
    
    // Create progress manager
    progressManager = new ProgressManager({ quiet: quietMode });
    
    // Create error recovery manager
    const errorRecoveryOptions = {
      continueOnError: continueOnError || config.errorRecovery?.continueOnError || true,
      maxRetries: config.errorRecovery?.maxRetries || maxRetries,
      retryDelay: config.errorRecovery?.retryDelay || retryDelay,
      exponentialBackoff: config.errorRecovery?.exponentialBackoff !== false,
      errorLog: config.errorRecovery?.errorLog || errorLog,
      resume: resumeFlag
    };
    errorRecoveryManager = new ErrorRecoveryManager(errorRecoveryOptions);
    
    // Create quality rules engine
    qualityRulesEngine = new QualityRulesEngine(config.qualityRules || []);
    
    // Create logger that respects quiet mode
    logger = {
      log: (...args) => !quietMode && console.log(...args),
      error: (...args) => console.error(...args)
    };
    
    // Wire up components
    const gitLfsDetector = new GitLfsDetector(fileReader);
    const gitLfsPuller = new GitLfsPuller(commandExecutor);
    const timestampChecker = new FileTimestampChecker(fileStats);
    const imageProcessor = new ImageProcessor(sharp);
    const pathGenerator = new OutputPathGenerator(config.outputDir);
    
    // Create optimizer with full config
    optimizer = new ImageOptimizer({
      ...config,
      gitLfsDetector,
      gitLfsPuller,
      timestampChecker,
      imageProcessor,
      pathGenerator,
      fileOperations,
      logger
    });
    
    if (watchMode) {
      // Run initial optimization
      await processImages();
      // Start watching
      await watchForChanges();
    } else {
      await processImages();
    }
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };