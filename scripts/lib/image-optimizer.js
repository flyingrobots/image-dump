const path = require('path');

class ImageOptimizer {
  constructor({
    gitLfsDetector,
    gitLfsPuller,
    timestampChecker,
    imageProcessor,
    pathGenerator,
    fileOperations,
    logger
  }) {
    this.gitLfsDetector = gitLfsDetector;
    this.gitLfsPuller = gitLfsPuller;
    this.timestampChecker = timestampChecker;
    this.imageProcessor = imageProcessor;
    this.pathGenerator = pathGenerator;
    this.fileOperations = fileOperations;
    this.logger = logger;
  }

  async optimizeImage(inputPath, filename, options = {}) {
    const ext = path.parse(filename).ext.toLowerCase();

    // Check for Git LFS pointer
    if (await this.gitLfsDetector.isGitLfsPointer(inputPath)) {
      if (options.pullLfs) {
        this.logger.log(`📥 Pulling LFS file: ${filename}`);
        const pullResult = await this.gitLfsPuller.pullFile(inputPath);
        
        if (!pullResult.success) {
          this.logger.log(`❌ Error pulling LFS file: ${filename} - ${pullResult.error}`);
          return 'lfs-error';
        }

        // Check again after pull
        if (await this.gitLfsDetector.isGitLfsPointer(inputPath)) {
          this.logger.log(`❌ Failed to pull LFS file: ${filename}`);
          return 'lfs-error';
        }
      } else {
        this.logger.log(`⚠️  Skipping ${filename} (Git LFS pointer file - use --pull-lfs flag or run 'git lfs pull')`);
        return 'lfs-pointer';
      }
    }

    // Generate output paths
    const paths = this.pathGenerator.generatePaths(filename);
    const outputPaths = Object.values(paths);

    // Check if processing is needed
    const needsProcessing = await this.timestampChecker.shouldProcess(
      inputPath, 
      outputPaths, 
      options.forceReprocess
    );

    if (!needsProcessing) {
      this.logger.log(`⏭️  Skipping ${filename} (already up to date)`);
      return 'skipped';
    }

    try {
      // Handle special cases
      if (ext === '.gif') {
        await this.fileOperations.copyFile(inputPath, path.join(this.pathGenerator.outputDir, filename));
        this.logger.log(`✅ Copied ${filename} (GIF files are not optimized)`);
        return 'processed';
      }

      if (ext === '.webp') {
        // For WebP input, only create webp and thumbnail
        const webpConfigs = [
          {
            outputPath: paths.webp,
            format: 'webp',
            options: { quality: 85 },
            resize: { width: 2000, height: 2000 }
          },
          {
            outputPath: paths.thumbnail,
            format: 'webp',
            options: { quality: 80 },
            resize: { width: 400, height: 400 }
          }
        ];
        
        await this.imageProcessor.processImage(inputPath, webpConfigs);
        this.logger.log(`✅ Optimized ${filename}`);
        return 'processed';
      }

      // Process all formats
      const configs = this.pathGenerator.getProcessingConfigs(filename, paths);
      await this.imageProcessor.processImage(inputPath, configs);
      
      this.logger.log(`✅ Optimized ${filename}`);
      return 'processed';
    } catch (error) {
      this.logger.error(`❌ Error processing ${filename}: ${error.message}`);
      return 'error';
    }
  }
}

module.exports = ImageOptimizer;