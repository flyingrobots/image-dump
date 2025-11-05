const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');

class ImageOptimizer {
  constructor(config = {}) {
    if (config.formats || config.quality || config.outputDir) {
      const {
        gitLfsDetector,
        gitLfsPuller,
        timestampChecker,
        imageProcessor,
        pathGenerator,
        processingConfigGenerator,
        fileOperations,
        logger,
        imageManifest,
        ...optimizerConfig
      } = config;

      this.config = optimizerConfig;
      this.gitLfsDetector = gitLfsDetector;
      this.gitLfsPuller = gitLfsPuller;
      this.timestampChecker = timestampChecker;
      this.imageProcessor = imageProcessor;
      this.pathGenerator = pathGenerator;
      this.processingConfigGenerator = processingConfigGenerator;
      this.fileOperations = fileOperations;
      this.logger = logger;
      this.imageManifest = imageManifest;
    } else {
      const {
        gitLfsDetector,
        gitLfsPuller,
        timestampChecker,
        imageProcessor,
        pathGenerator,
        processingConfigGenerator,
        fileOperations,
        logger,
        imageManifest
      } = config;

      this.gitLfsDetector = gitLfsDetector;
      this.gitLfsPuller = gitLfsPuller;
      this.timestampChecker = timestampChecker;
      this.imageProcessor = imageProcessor;
      this.pathGenerator = pathGenerator;
      this.processingConfigGenerator = processingConfigGenerator;
      this.fileOperations = fileOperations;
      this.logger = logger;
      this.imageManifest = imageManifest;

      this.config = {
        formats: ['webp', 'avif', 'original'],
        quality: {
          webp: 80,
          avif: 80,
          jpeg: 80
        },
        outputDir: 'optimized',
        generateThumbnails: true,
        thumbnailWidth: 200,
        preserveMetadata: false
      };
    }

    this.configSignature = this._computeConfigSignature(this.config);
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

    const sourceHash = options.sourceHash || await this._computeFileHash(inputPath);

    if (!options.forceReprocess && this.imageManifest) {
      const record = this.imageManifest.get(filename);
      if (record && record.sourceHash === sourceHash && record.configSignature === this.configSignature) {
        const outputsExist = await this._outputsExist(record.outputs || []);
        if (outputsExist) {
          this.logger.log(`⏭️  Skipping ${filename} (already cooked)`);
          return 'skipped';
        }
      }
    }

    // Generate output paths based on config
    const configuredPaths = this.generateConfiguredPaths(filename);
    const outputPaths = Object.values(configuredPaths);

    const needsProcessing = await this.timestampChecker.shouldProcess(
      inputPath,
      outputPaths,
      options.forceReprocess
    );

    if (!needsProcessing && !options.forceReprocess) {
      this.logger.log(`⏭️  Skipping ${filename} (already up to date)`);
      return 'skipped';
    }

    try {
      // Ensure output directory exists
      const outputDir = path.dirname(path.join(this.config.outputDir, filename));
      await fsp.mkdir(outputDir, { recursive: true });
      
      // Handle special cases
      if (ext === '.gif') {
        const copyPath = path.join(this.config.outputDir, filename);
        await this.fileOperations.copyFile(inputPath, copyPath);
        this.logger.log(`✅ Copied ${filename} (GIF files are not optimized)`);
        this._updateManifest(filename, sourceHash, [this._relativeToOutputDir(copyPath)]);
        return 'processed';
      }


      // Generate output paths and processing configs
      const paths = this.pathGenerator.generatePaths(filename);
      const configs = this.processingConfigGenerator ? 
        this.processingConfigGenerator.generate(filename, paths, this.config) :
        this.getProcessingConfigs(filename, inputPath);
      
      if (configs.length > 0) {
        // Ensure output directory exists
        const outputDir = path.dirname(configs[0].outputPath);
        await fsp.mkdir(outputDir, { recursive: true });
        
        const results = await this.imageProcessor.processImage(inputPath, configs);
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          throw new Error(`Failed to process ${filename}: ${failed[0].error}`);
        }
        this.logger.log(`✅ Optimized ${filename}`);
        const manifestOutputs = configs.map(config => this._relativeToOutputDir(config.outputPath));
        this._updateManifest(filename, sourceHash, manifestOutputs);
      }
      
      return 'processed';
    } catch (error) {
      this.logger.error(`❌ Error processing ${filename}: ${error.message}`);
      return 'error';
    }
  }
  
  generateConfiguredPaths(filename) {
    // Delegate to the path generator so subdirectories are preserved
    const paths = this.pathGenerator.generatePaths(filename);
    const ext = path.parse(filename).ext.toLowerCase();

    const selected = {};

    // Match processing behavior: skip WebP→WebP conversion
    if (this.config.formats.includes('webp') && ext !== '.webp') {
      selected.webp = paths.webp;
    }
    if (this.config.formats.includes('avif')) {
      selected.avif = paths.avif;
    }
    if (
      this.config.formats.includes('original') ||
      (ext === '.png' && this.config.formats.includes('png')) ||
      ((ext === '.jpg' || ext === '.jpeg') && this.config.formats.includes('jpeg'))
    ) {
      selected.original = paths.original;
    }
    if (this.config.generateThumbnails) {
      selected.thumbnail = paths.thumbnail;
    }

    return selected;
  }

  getProcessingConfigs(filename, _inputPath) {
    const name = path.parse(filename).name;
    const ext = path.parse(filename).ext.toLowerCase();
    const configs = [];
    
    // Add format-specific configs based on configuration
    // Skip WebP-to-WebP conversion (input WebP should only generate other formats)
    if (this.config.formats.includes('webp') && ext !== '.webp') {
      configs.push({
        outputPath: path.join(this.config.outputDir, `${name}.webp`),
        format: 'webp',
        options: { quality: this.config.quality.webp },
        resize: { width: 2000, height: 2000 }
      });
    }
    
    if (this.config.formats.includes('avif')) {
      configs.push({
        outputPath: path.join(this.config.outputDir, `${name}.avif`),
        format: 'avif',
        options: { quality: this.config.quality.avif },
        resize: { width: 2000, height: 2000 }
      });
    }
    
    if (this.config.formats.includes('original') || 
        (ext === '.png' && this.config.formats.includes('png')) ||
        ((ext === '.jpg' || ext === '.jpeg') && this.config.formats.includes('jpeg'))) {
      const isJpeg = ext === '.jpg' || ext === '.jpeg';
      configs.push({
        outputPath: path.join(this.config.outputDir, filename),
        format: isJpeg ? 'jpeg' : 'png',
        options: isJpeg ? { quality: this.config.quality.jpeg } : {},
        resize: { width: 2000, height: 2000 }
      });
    }
    
    if (this.config.generateThumbnails) {
      configs.push({
        outputPath: path.join(this.config.outputDir, `${name}-thumb.webp`),
        format: 'webp',
        options: { quality: this.config.quality.webp },
        resize: { width: this.config.thumbnailWidth, height: this.config.thumbnailWidth }
      });
    }
    
    return configs;
  }

  getManifest() {
    return this.imageManifest;
  }

  async flushManifest() {
    if (this.imageManifest) {
      await this.imageManifest.save();
    }
  }

  _computeConfigSignature(config) {
    const relevant = {
      formats: config.formats,
      quality: config.quality,
      generateThumbnails: config.generateThumbnails,
      thumbnailWidth: config.thumbnailWidth,
      preserveMetadata: config.preserveMetadata
    };
    return crypto
      .createHash('sha1')
      .update(JSON.stringify(relevant))
      .digest('hex');
  }

  _computeFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  async _outputsExist(relativeOutputs = []) {
    const checks = await Promise.all(
      relativeOutputs.map(async relativePath => {
        const absolute = path.join(this.config.outputDir, relativePath);
        try {
          await fsp.access(absolute);
          return true;
        } catch {
          return false;
        }
      })
    );

    return relativeOutputs.length === 0 || checks.every(Boolean);
  }

  _updateManifest(filename, sourceHash, outputs) {
    if (!this.imageManifest) {
      return;
    }

    const normalizedOutputs = Array.from(
      new Set((outputs || []).filter(Boolean))
    );

    const record = {
      sourceHash,
      outputs: normalizedOutputs,
      configSignature: this.configSignature,
      processedAt: new Date().toISOString()
    };

    this.imageManifest.update(filename, record);
  }

  _relativeToOutputDir(absolutePath) {
    return path.relative(this.config.outputDir, absolutePath);
  }
}

module.exports = ImageOptimizer;
