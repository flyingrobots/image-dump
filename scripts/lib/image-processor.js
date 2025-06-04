class ImageProcessor {
  constructor(sharp) {
    this.sharp = sharp;
  }

  async processImage(inputPath, outputConfigs) {
    const image = this.sharp(inputPath)
      .rotate()
      .withMetadata({
        exif: {}
      });

    const results = [];
    
    for (const config of outputConfigs) {
      try {
        const processor = image.clone();
        
        if (config.resize) {
          processor.resize(config.resize.width, config.resize.height, {
            withoutEnlargement: true,
            fit: 'inside'
          });
        }

        await processor[config.format](config.options).toFile(config.outputPath);
        results.push({ path: config.outputPath, success: true });
      } catch (error) {
        results.push({ path: config.outputPath, success: false, error: error.message });
      }
    }

    return results;
  }
}

module.exports = ImageProcessor;