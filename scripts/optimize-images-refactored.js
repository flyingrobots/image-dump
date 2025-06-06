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

const INPUT_DIR = 'original';
const OUTPUT_DIR = 'optimized';

// Parse command line arguments
const args = process.argv.slice(2);
const forceReprocess = args.includes('--force');
const pullLfs = args.includes('--pull-lfs');

// Create dependencies
const fileReader = { readFile: fs.readFile };
const fileStats = { stat: fs.stat };
const commandExecutor = { 
  exec: (command) => execSync(command, { stdio: 'inherit' }) 
};
const fileOperations = { copyFile: fs.copyFile };
const logger = {
  log: console.log.bind(console),
  error: console.error.bind(console)
};

// Wire up components
const gitLfsDetector = new GitLfsDetector(fileReader);
const gitLfsPuller = new GitLfsPuller(commandExecutor);
const timestampChecker = new FileTimestampChecker(fileStats);
const imageProcessor = new ImageProcessor(sharp);
const pathGenerator = new OutputPathGenerator(OUTPUT_DIR);

const optimizer = new ImageOptimizer({
  gitLfsDetector,
  gitLfsPuller,
  timestampChecker,
  imageProcessor,
  pathGenerator,
  fileOperations,
  logger
});

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
    
    const stats = {
      processed: 0,
      skipped: 0,
      errors: 0,
      lfsPointers: 0,
      lfsErrors: 0
    };
    
    for (const file of imageFiles) {
      const result = await optimizer.optimizeImage(
        path.join(INPUT_DIR, file), 
        file,
        { forceReprocess, pullLfs }
      );
      
      switch (result) {
        case 'processed': stats.processed++; break;
        case 'skipped': stats.skipped++; break;
        case 'error': stats.errors++; break;
        case 'lfs-pointer': stats.lfsPointers++; break;
        case 'lfs-error': stats.lfsErrors++; break;
      }
    }
    
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
    }
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };