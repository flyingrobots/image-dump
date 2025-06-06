const fs = require('fs').promises;
const path = require('path');

class ConfigLoader {
  constructor() {
    this.defaultConfig = {
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
    
    this.validFormats = ['webp', 'avif', 'original', 'jpeg', 'png'];
  }
  
  async loadConfig(projectRoot = process.cwd(), cliArgs = {}) {
    let fileConfig = {};
    
    // Try to load config file
    const configPath = await this.findConfigFile(projectRoot);
    if (configPath) {
      try {
        const configContent = await fs.readFile(configPath, 'utf8');
        try {
          fileConfig = JSON.parse(configContent);
        } catch (parseError) {
          throw new Error(`Invalid JSON in .imagerc: ${parseError.message}`);
        }
      } catch (error) {
        if (error.message.includes('Invalid JSON')) {
          throw error;
        }
        // File read error - use defaults
        fileConfig = {};
      }
    }
    
    // Merge configurations
    const merged = this.mergeConfigs(this.defaultConfig, fileConfig, cliArgs);
    
    // Validate the final configuration
    this.validateConfig(merged);
    
    return merged;
  }
  
  async findConfigFile(projectRoot) {
    const configNames = ['.imagerc', '.imagerc.json'];
    
    for (const configName of configNames) {
      const configPath = path.join(projectRoot, configName);
      try {
        const stats = await fs.stat(configPath);
        if (stats.isFile()) {
          return configPath;
        }
      } catch {
        // File doesn't exist or can't be accessed
        continue;
      }
    }
    
    return null;
  }
  
  validateConfig(config) {
    // Validate formats
    if (config.formats !== undefined) {
      if (!Array.isArray(config.formats)) {
        throw new Error('formats must be an array');
      }
      
      if (config.formats.length === 0) {
        throw new Error('At least one output format must be specified');
      }
      
      for (const format of config.formats) {
        if (!this.validFormats.includes(format)) {
          throw new Error(`Invalid format: ${format}. Valid formats are: ${this.validFormats.join(', ')}`);
        }
      }
    }
    
    // Validate quality values
    if (config.quality !== undefined) {
      const qualityFormats = ['webp', 'avif', 'jpeg'];
      for (const format of qualityFormats) {
        if (config.quality[format] !== undefined) {
          const quality = config.quality[format];
          if (typeof quality !== 'number' || quality < 1 || quality > 100) {
            throw new Error(`Quality for ${format} must be between 1 and 100`);
          }
        }
      }
    }
    
    // Validate thumbnail width
    if (config.thumbnailWidth !== undefined) {
      if (typeof config.thumbnailWidth !== 'number' || 
          config.thumbnailWidth < 10 || 
          config.thumbnailWidth > 1000) {
        throw new Error('Thumbnail width must be between 10 and 1000');
      }
    }
    
    // Validate output directory
    if (config.outputDir !== undefined) {
      if (typeof config.outputDir !== 'string' || config.outputDir.trim() === '') {
        throw new Error('Output directory cannot be empty');
      }
    }
  }
  
  mergeConfigs(defaults, fileConfig, cliArgs) {
    // Deep merge objects
    const merged = { ...defaults };
    
    // Merge file config
    for (const key in fileConfig) {
      if (key === 'quality' && typeof fileConfig[key] === 'object') {
        merged[key] = { ...merged[key], ...fileConfig[key] };
      } else {
        merged[key] = fileConfig[key];
      }
    }
    
    // Merge CLI args (highest priority)
    for (const key in cliArgs) {
      if (key === 'quality' && typeof cliArgs[key] === 'object') {
        merged[key] = { ...merged[key], ...cliArgs[key] };
      } else {
        merged[key] = cliArgs[key];
      }
    }
    
    return merged;
  }
}

module.exports = ConfigLoader;