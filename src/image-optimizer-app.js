const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ImageOptimizerApp {
  constructor({
    config,
    progressManager,
    errorRecoveryManager,
    qualityRulesEngine,
    optimizer,
    logger,
    manifest,
    dependencyContainer, // Add this
    inputDir = 'original'
  }) {
    this.config = config;
    this.progressManager = progressManager;
    this.errorRecoveryManager = errorRecoveryManager;
    this.qualityRulesEngine = qualityRulesEngine;
    this.optimizer = optimizer; // This will be the singleton for single-threaded tasks
    this.logger = logger;
    this.inputDir = inputDir;
    this.manifest = manifest;
    this.dependencyContainer = dependencyContainer; // Store the container
  }

  async processImages(options = {}) {
    const { forceReprocess, pullLfs, continueOnError, resumeFlag, selectedFiles } = options;
  
    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });
  
      const allImageFiles = await this._findImageFiles(this.inputDir);
      const imageFiles = this._applySelection(allImageFiles, selectedFiles);
  
      if (imageFiles.length === 0) {
        this.logger.log(selectedFiles?.length > 0 ? 'No matching images to process' : 'No images found in the original directory');
        return { processed: 0, skipped: 0, errors: 0, lfsPointers: 0, lfsErrors: 0 };
      }
  
      this.progressManager.start(imageFiles.length);
      this.logger.log(`Found ${imageFiles.length} images to process...`);
      if (forceReprocess) {this.logger.log('Force reprocessing enabled - all images will be regenerated');}
      if (pullLfs) {this.logger.log('Git LFS auto-pull enabled - pointer files will be downloaded');}
      this.logger.log('');
  
      const stats = { processed: 0, skipped: 0, errors: 0, lfsPointers: 0, lfsErrors: 0 };
      const savedState = await this.errorRecoveryManager.loadState();
      let startIndex = 0;
      if (resumeFlag && savedState) {
        startIndex = savedState.checkpoint?.processedCount || savedState.progress?.processed || 0;
        if (startIndex > 0) {this.logger.log(`📂 Resuming from previous state... (starting at image ${startIndex + 1})`);}
      }
  
      const filesToProcess = imageFiles.slice(startIndex);
      const fileQueue = [...filesToProcess];
  
      const numWorkers = this.config.parallelBatchSize || os.cpus().length;
      this.logger.log(`Spawning ${numWorkers} workers for parallel processing...`);
  
      const workers = Array.from({ length: numWorkers }, (_, _i) => {
        return (async () => {
          // Each worker gets its own optimizer instance
          const optimizer = this.dependencyContainer.createImageOptimizer(this.config, this.logger);
  
          while (fileQueue.length > 0) {
            const file = fileQueue.shift();
            if (!file) {continue;}
  
            try {
              const imageQuality = await this.qualityRulesEngine.getQualityForImage(path.join(this.inputDir, file));
              const mergedQuality = { ...this.config.quality, ...imageQuality };
  
              const result = await optimizer.optimizeImage(
                path.join(this.inputDir, file),
                file,
                { forceReprocess, pullLfs, quality: mergedQuality }
              );
  
              this._updateStats(stats, result, file);
  
              if (result === 'error') {
                const error = new Error(`Failed to process ${file}`);
                await this.errorRecoveryManager.logError(file, error, { type: 'processing_error' });
                if (!continueOnError) {throw error;}
              }
  
              this.errorRecoveryManager.recordProcessedFile(file, { status: result });
              await this.errorRecoveryManager.maybeCheckpoint({ total: imageFiles.length });
            } catch (error) {
              stats.errors++;
              this.progressManager.increment({ status: 'error', filename: file });
              await this.errorRecoveryManager.logError(file, error, { type: 'processing_error' });
              await this.errorRecoveryManager.maybeCheckpoint({ total: imageFiles.length });
              if (!continueOnError) {throw error;}
            }
          }
        })();
      });
  
      await Promise.all(workers);
  
      // Save manifest after all workers are done
      if (this.manifest?.isDirty()) {
        await this.manifest.save();
      }
  
      this.progressManager.finish(false);
  
      if (stats.errors === 0) {
        await this.errorRecoveryManager.clearState();
      } else {
        await this.errorRecoveryManager.saveState({ 
          processedCount: imageFiles.length,
          totalCount: imageFiles.length 
        });
      }
  
      return stats;
  
    } catch (error) {
      this.progressManager.finish();
      this.logger.error('Fatal error:', error);
      await this.errorRecoveryManager.logError('FATAL', error, { type: 'fatal' });
      if (this.manifest?.isDirty()) {
        await this.manifest.save();
      }
      throw error;
    }
  }
  async _findImageFiles(dir, relativePath = '') {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativeFilePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await this._findImageFiles(fullPath, relativeFilePath);
        files.push(...subFiles);
      } else if (entry.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(entry.name)) {
        files.push(relativeFilePath);
      }
    }
    
    return files;
  }

  _applySelection(allFiles, selectedFiles = []) {
    if (!selectedFiles || selectedFiles.length === 0) {
      return allFiles;
    }

    const normalizedSelection = selectedFiles.map(file => file.replace(/\\/g, '/'));
    const available = new Set(allFiles.map(file => file.replace(/\\/g, '/')));
    const normalized = new Set(normalizedSelection);

    const missing = normalizedSelection.filter(item => !available.has(item));
    if (missing.length > 0 && this.logger && typeof this.logger.log === 'function') {
      this.logger.log(`Skipping ${missing.length} selected item(s) not found: ${missing.join(', ')}`);
    }

    return allFiles.filter(file => normalized.has(file.replace(/\\/g, '/')));
  }

  watchForChanges(options = {}) {
    const { pullLfs } = options;
    const chokidar = require('chokidar');
    
    this.logger.log('👀 Watching for changes in the original directory...');
    this.logger.log('Press Ctrl+C to stop\n');
    
    const watcher = chokidar.watch(this.inputDir, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    const processFile = async (filePath, action) => {
      const file = path.basename(filePath);
      if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
        return;
      }
      
      this.logger.log(`\n${action === 'add' ? '📸 New' : '🔄'} image ${action === 'add' ? 'detected' : 'changed'}: ${file}`);
      
      try {
        const imageQuality = await this.qualityRulesEngine.getQualityForImage(filePath);
        const mergedQuality = {
          ...this.config.quality,
          ...imageQuality
        };
        
        const result = await this.optimizer.optimizeImage(
          filePath,
          file,
          { 
            forceReprocess: true,
            pullLfs,
            quality: mergedQuality
          }
        );
        
        if (result === 'processed') {
          this.logger.log(`✅ ${action === 'add' ? 'Optimized' : 'Re-optimized'} ${file}`);
        } else if (result === 'error') {
          this.logger.error(`❌ Failed to optimize ${file}`);
        }
        if (typeof this.optimizer.flushManifest === 'function') {
          await this.optimizer.flushManifest();
        }
      } catch (error) {
        this.logger.error(`❌ Error processing ${file}:`, error.message);
      }
    };
    
    watcher.on('add', filePath => processFile(filePath, 'add'));
    watcher.on('change', filePath => processFile(filePath, 'change'));
    watcher.on('error', error => this.logger.error('❌ Watcher error:', error));
    
    return watcher;
  }

  showSummary(stats, quietMode, errorLog) {
    if (!quietMode) {
      this.logger.log('\n' + '='.repeat(50));
      this.logger.log('✅ Optimization complete!');
      this.logger.log(`   Processed: ${stats.processed} images`);
      this.logger.log(`   Skipped: ${stats.skipped} images (already up to date)`);
      if (stats.lfsPointers > 0) {
        this.logger.log(`   Git LFS pointers: ${stats.lfsPointers} files (use --pull-lfs flag)`);
      }
      if (stats.lfsErrors > 0) {
        this.logger.log(`   Git LFS errors: ${stats.lfsErrors} files`);
      }
      if (stats.errors > 0) {
        this.logger.log(`   Errors: ${stats.errors} images`);
        this.logger.log(`   Error details logged to: ${errorLog}`);
      }
      this.logger.log('='.repeat(50));
    }
  }

  _updateStats(stats, result, file) {
    switch (result) {
      case 'processed': 
        stats.processed++; 
        this.progressManager.increment({ status: 'processed', filename: file });
        break;
      case 'skipped': 
        stats.skipped++; 
        this.progressManager.increment({ status: 'skipped', filename: file });
        break;
      case 'error': 
        stats.errors++; 
        this.progressManager.increment({ status: 'error', filename: file });
        break;
      case 'lfs-pointer': 
        stats.lfsPointers++; 
        this.progressManager.increment({ status: 'skipped', filename: file });
        break;
      case 'lfs-error': 
        stats.lfsErrors++; 
        this.progressManager.increment({ status: 'error', filename: file });
        break;
    }
  }
}

module.exports = ImageOptimizerApp;
