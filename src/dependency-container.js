const fs = require('fs').promises;
const { execSync } = require('child_process');
const sharp = require('sharp');
const cliProgress = require('cli-progress');
const colors = require('ansi-colors');
const minimatch = require('minimatch');
const path = require('path');

const GitLfsDetector = require('./git-lfs-detector');
const GitLfsPuller = require('./git-lfs-puller');
const FileTimestampChecker = require('./file-timestamp-checker');
const ImageProcessor = require('./image-processor');
const OutputPathGenerator = require('./output-path-generator');
const ProcessingConfigGenerator = require('./processing-config-generator');
const ImageOptimizer = require('./image-optimizer');
const ConfigLoader = require('./config-loader');
const ErrorRecoveryManager = require('./error-recovery-manager');
const ProgressManager = require('./progress-manager');
const QualityRulesEngine = require('./quality-rules-engine');

class DependencyContainer {
  constructor(options = {}) {
    this.options = options;
    this.instances = {};
  }

  createFileReader() {
    return { readFile: fs.readFile };
  }

  createFileStats() {
    return { stat: fs.stat };
  }

  createCommandExecutor(logger) {
    return { 
      exec: command => {
        try {
          const result = execSync(command, { 
            stdio: ['pipe', 'pipe', 'pipe'],
            encoding: 'utf8'
          });
          if (result && logger) {
            logger.log(result.trim());
          }
          return result;
        } catch (error) {
          if (error.stderr && logger) {
            logger.error(error.stderr.toString().trim());
          }
          throw error;
        }
      }
    };
  }

  createFileOperations() {
    return { copyFile: fs.copyFile };
  }

  createLogger(quietMode) {
    return {
      log: (...args) => {
        if (!quietMode) {
          process.stdout.write(args.join(' ') + '\n');
        }
      },
      error: (...args) => {
        process.stderr.write(args.join(' ') + '\n');
      }
    };
  }

  getConfigLoader() {
    if (!this.instances.configLoader) {
      this.instances.configLoader = new ConfigLoader(fs, path);
    }
    return this.instances.configLoader;
  }

  getProgressManager(quietMode) {
    if (!this.instances.progressManager) {
      this.instances.progressManager = new ProgressManager(
        { quiet: quietMode },
        cliProgress,
        colors,
        process.stdout
      );
    }
    return this.instances.progressManager;
  }

  getErrorRecoveryManager(options) {
    if (!this.instances.errorRecoveryManager) {
      this.instances.errorRecoveryManager = new ErrorRecoveryManager(options);
    }
    return this.instances.errorRecoveryManager;
  }

  getQualityRulesEngine(rules) {
    if (!this.instances.qualityRulesEngine) {
      this.instances.qualityRulesEngine = new QualityRulesEngine(rules, minimatch, path);
    }
    return this.instances.qualityRulesEngine;
  }

  getGitLfsDetector() {
    if (!this.instances.gitLfsDetector) {
      this.instances.gitLfsDetector = new GitLfsDetector(this.createFileReader());
    }
    return this.instances.gitLfsDetector;
  }

  getGitLfsPuller(logger) {
    if (!this.instances.gitLfsPuller) {
      this.instances.gitLfsPuller = new GitLfsPuller(this.createCommandExecutor(logger));
    }
    return this.instances.gitLfsPuller;
  }

  getFileTimestampChecker() {
    if (!this.instances.timestampChecker) {
      this.instances.timestampChecker = new FileTimestampChecker(this.createFileStats());
    }
    return this.instances.timestampChecker;
  }

  getImageProcessor(config = {}) {
    if (!this.instances.imageProcessor) {
      this.instances.imageProcessor = new ImageProcessor(sharp, config);
    }
    return this.instances.imageProcessor;
  }

  getOutputPathGenerator(outputDir) {
    if (!this.instances.pathGenerator) {
      this.instances.pathGenerator = new OutputPathGenerator(outputDir);
    }
    return this.instances.pathGenerator;
  }

  getProcessingConfigGenerator(config) {
    if (!this.instances.processingConfigGenerator) {
      this.instances.processingConfigGenerator = new ProcessingConfigGenerator(config);
    }
    return this.instances.processingConfigGenerator;
  }

  getImageOptimizer(config, logger) {
    if (!this.instances.optimizer) {
      this.instances.optimizer = new ImageOptimizer({
        ...config,
        gitLfsDetector: this.getGitLfsDetector(),
        gitLfsPuller: this.getGitLfsPuller(logger),
        timestampChecker: this.getFileTimestampChecker(),
        imageProcessor: this.getImageProcessor(config),
        pathGenerator: this.getOutputPathGenerator(config.outputDir),
        processingConfigGenerator: this.getProcessingConfigGenerator(config),
        fileOperations: this.createFileOperations(),
        logger
      });
    }
    return this.instances.optimizer;
  }
}

module.exports = DependencyContainer;