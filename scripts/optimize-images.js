const DependencyContainer = require('../src/dependency-container');
const ImageOptimizerApp = require('../src/image-optimizer-app');
const CliParser = require('../src/cli-parser');

const INPUT_DIR = 'original';

async function main() {
  try {
    // Parse CLI arguments
    const cliParser = new CliParser();
    const options = cliParser.parse();

    const envSelectedFiles = parseSelectionFromEnv(process.env);
    if (envSelectedFiles !== null) {
      options.selectedFiles = envSelectedFiles;
    }

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
    
    const manifest = container.getImageManifest(config.outputDir);
    await manifest.load();

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
      resume: options.resumeFlag,
      checkpointEveryN: options.checkpointEveryN !== undefined ? options.checkpointEveryN : config.errorRecovery?.checkpointEveryN,
      checkpointIntervalMs: options.checkpointIntervalMs !== undefined ? options.checkpointIntervalMs : config.errorRecovery?.checkpointIntervalMs
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
      manifest,
      dependencyContainer: container,
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

function parseSelectionFromEnv(env) {
  if (env.OPTIMIZE_SELECTION_MODE === 'all' || env.OPTIMIZE_SELECTION_ALL === '1') {
    return [];
  }

  const encoded = env.OPTIMIZE_SELECTION_B64;
  if (!encoded) {
    return null;
  }

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    return decoded
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.replace(/^\.\/?/, ''))
      .map(line => line.replace(/^original\//, ''));
  } catch (error) {
    console.error('Failed to parse OPTIMIZE_SELECTION_B64:', error.message);
    return null;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
