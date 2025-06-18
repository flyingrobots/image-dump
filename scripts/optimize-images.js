const DependencyContainer = require('../src/dependency-container');
const ImageOptimizerApp = require('../src/image-optimizer-app');
const CliParser = require('../src/cli-parser');

const INPUT_DIR = 'original';

async function main() {
  try {
    // Parse CLI arguments
    const cliParser = new CliParser();
    const options = cliParser.parse();

    // Show help if requested
    if (cliParser.hasFlag('--help') || cliParser.hasFlag('-h')) {
      console.log(CliParser.getHelpText());
      process.exit(0);
    }

    // Create dependency container
    const container = new DependencyContainer();
    
    // Load configuration
    const configLoader = container.getConfigLoader();
    const config = await configLoader.loadConfig();
    
    // Apply CLI overrides
    if (options.noThumbnails) {
      config.generateThumbnails = false;
    }
    
    // Create logger
    const logger = container.createLogger(options.quietMode);
    
    // Create managers
    const progressManager = container.getProgressManager(options.quietMode);
    const errorRecoveryManager = container.getErrorRecoveryManager({
      continueOnError: options.continueOnError !== undefined ? options.continueOnError : (config.errorRecovery?.continueOnError !== undefined ? config.errorRecovery.continueOnError : true),
      maxRetries: config.errorRecovery?.maxRetries || options.maxRetries,
      retryDelay: config.errorRecovery?.retryDelay || options.retryDelay,
      exponentialBackoff: config.errorRecovery?.exponentialBackoff !== false,
      errorLog: config.errorRecovery?.errorLog || options.errorLog,
      resume: options.resumeFlag
    });
    
    // Create quality rules engine
    const qualityRulesEngine = container.getQualityRulesEngine(config.qualityRules || []);
    
    // Create optimizer
    const optimizer = container.getImageOptimizer(config, logger);
    
    // Create application
    const app = new ImageOptimizerApp({
      config,
      progressManager,
      errorRecoveryManager,
      qualityRulesEngine,
      optimizer,
      logger,
      inputDir: INPUT_DIR
    });
    
    // Resolve final options with config defaults
    const resolvedOptions = {
      ...options,
      continueOnError: options.continueOnError !== undefined ? options.continueOnError : (config.errorRecovery?.continueOnError !== undefined ? config.errorRecovery.continueOnError : true)
    };
    
    // Run the application
    if (options.watchMode) {
      // Run initial optimization
      const stats = await app.processImages(resolvedOptions);
      app.showSummary(stats, options.quietMode, options.errorLog);
      
      // Start watching
      await app.watchForChanges(resolvedOptions);
    } else {
      const stats = await app.processImages(resolvedOptions);
      app.showSummary(stats, options.quietMode, options.errorLog);
    }
    
  } catch (error) {
    console.error('Failed to run image optimizer:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };