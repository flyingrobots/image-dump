const path = require('path');

class OutputPathGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  generatePaths(filename) {
    const name = path.parse(filename).name;
    const ext = path.parse(filename).ext.toLowerCase();

    return {
      webp: path.join(this.outputDir, `${name}.webp`),
      avif: path.join(this.outputDir, `${name}.avif`),
      original: path.join(this.outputDir, `${name}${ext === '.png' ? '.png' : '.jpg'}`),
      thumbnail: path.join(this.outputDir, `${name}-thumb.webp`)
    };
  }

  getProcessingConfigs(filename, paths) {
    const ext = path.parse(filename).ext.toLowerCase();
    
    return [
      {
        outputPath: paths.webp,
        format: 'webp',
        options: { quality: 85 },
        resize: { width: 2000, height: 2000 }
      },
      {
        outputPath: paths.avif,
        format: 'avif',
        options: { quality: 80 },
        resize: { width: 2000, height: 2000 }
      },
      {
        outputPath: paths.original,
        format: ext === '.png' ? 'png' : 'jpeg',
        options: ext === '.png' ? { compressionLevel: 9 } : { quality: 90 },
        resize: { width: 2000, height: 2000 }
      },
      {
        outputPath: paths.thumbnail,
        format: 'webp',
        options: { quality: 80 },
        resize: { width: 400, height: 400 }
      }
    ];
  }
}

module.exports = OutputPathGenerator;