const fs = require('fs').promises;

class ImageValidator {
  constructor(dependencies = {}) {
    this.fs = dependencies.fs || fs;
    this.sharp = dependencies.sharp || require('sharp');
    
    // Magic bytes for supported formats
    this.magicBytes = {
      jpeg: [0xFF, 0xD8, 0xFF],
      png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
      gif: [0x47, 0x49, 0x46, 0x38], // GIF8
      avif: [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], // ftypavif at offset 4
      bmp: [0x42, 0x4D],
      tiff: [0x49, 0x49, 0x2A, 0x00], // Little endian TIFF
      tiffBE: [0x4D, 0x4D, 0x00, 0x2A] // Big endian TIFF
    };
    
    this.mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.avif': 'image/avif',
      '.bmp': 'image/bmp',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff'
    };
  }

  async validateImage(filePath, validationConfig = {}) {
    const config = {
      maxFileSize: validationConfig.maxFileSize || 50 * 1024 * 1024, // 50MB
      maxWidth: validationConfig.maxWidth || 10000,
      maxHeight: validationConfig.maxHeight || 10000,
      minWidth: validationConfig.minWidth || 1,
      minHeight: validationConfig.minHeight || 1,
      allowedFormats: validationConfig.allowedFormats || ['jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'tiff'],
      validateMagicBytes: validationConfig.validateMagicBytes !== false,
      validateDimensions: validationConfig.validateDimensions !== false,
      validateFileSize: validationConfig.validateFileSize !== false,
      validateCorruption: validationConfig.validateCorruption !== false,
      ...validationConfig
    };

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: null
    };

    try {
      // File size validation
      if (config.validateFileSize) {
        const stats = await this.fs.stat(filePath);
        if (stats.size > config.maxFileSize) {
          result.errors.push(`File size ${stats.size} bytes exceeds maximum allowed ${config.maxFileSize} bytes`);
          result.valid = false;
        }
        if (stats.size === 0) {
          result.errors.push('File is empty');
          result.valid = false;
        }
      }

      // Magic bytes validation
      if (config.validateMagicBytes) {
        const magicValidation = await this.validateMagicBytes(filePath);
        if (!magicValidation.valid) {
          result.errors.push(magicValidation.error);
          result.valid = false;
        } else {
          result.detectedFormat = magicValidation.format;
        }
      }

      // Format whitelist validation
      if (result.detectedFormat && !config.allowedFormats.includes(result.detectedFormat)) {
        result.errors.push(`Format ${result.detectedFormat} is not allowed`);
        result.valid = false;
      }

      // Sharp-based validation (dimensions, corruption)
      if (config.validateDimensions || config.validateCorruption) {
        try {
          const metadata = await this.sharp(filePath).metadata();
          result.metadata = {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            channels: metadata.channels,
            hasAlpha: metadata.hasAlpha
          };

          // Dimension validation
          if (config.validateDimensions) {
            if (metadata.width > config.maxWidth) {
              result.errors.push(`Image width ${metadata.width} exceeds maximum ${config.maxWidth}`);
              result.valid = false;
            }
            if (metadata.height > config.maxHeight) {
              result.errors.push(`Image height ${metadata.height} exceeds maximum ${config.maxHeight}`);
              result.valid = false;
            }
            if (metadata.width < config.minWidth) {
              result.errors.push(`Image width ${metadata.width} below minimum ${config.minWidth}`);
              result.valid = false;
            }
            if (metadata.height < config.minHeight) {
              result.errors.push(`Image height ${metadata.height} below minimum ${config.minHeight}`);
              result.valid = false;
            }
          }

          // Format consistency check
          if (result.detectedFormat && metadata.format && result.detectedFormat !== metadata.format) {
            result.warnings.push(`Magic bytes indicate ${result.detectedFormat} but Sharp detected ${metadata.format}`);
          }

        } catch (sharpError) {
          if (config.validateCorruption) {
            result.errors.push(`Image appears corrupted: ${sharpError.message}`);
            result.valid = false;
          }
        }
      }

    } catch (error) {
      result.errors.push(`Validation failed: ${error.message}`);
      result.valid = false;
    }

    return result;
  }

  async validateMagicBytes(filePath) {
    try {
      const buffer = await this.fs.readFile(filePath);
      
      if (buffer.length < 8) {
        return { valid: false, error: 'File too small to validate magic bytes' };
      }

      // Check JPEG
      if (this.matchesBytes(buffer, this.magicBytes.jpeg, 0)) {
        return { valid: true, format: 'jpeg' };
      }

      // Check PNG
      if (this.matchesBytes(buffer, this.magicBytes.png, 0)) {
        return { valid: true, format: 'png' };
      }

      // Check GIF
      if (this.matchesBytes(buffer, this.magicBytes.gif, 0)) {
        return { valid: true, format: 'gif' };
      }

      // Check BMP
      if (this.matchesBytes(buffer, this.magicBytes.bmp, 0)) {
        return { valid: true, format: 'bmp' };
      }

      // Check TIFF (little endian)
      if (this.matchesBytes(buffer, this.magicBytes.tiff, 0)) {
        return { valid: true, format: 'tiff' };
      }

      // Check TIFF (big endian)
      if (this.matchesBytes(buffer, this.magicBytes.tiffBE, 0)) {
        return { valid: true, format: 'tiff' };
      }

      // Check WebP (RIFF header + WEBP signature)
      if (this.matchesBytes(buffer, this.magicBytes.webp, 0) && 
          buffer.length >= 12 && 
          buffer.slice(8, 12).toString() === 'WEBP') {
        return { valid: true, format: 'webp' };
      }

      // Check AVIF (ftyp box with avif brand)
      if (buffer.length >= 12 && this.matchesBytes(buffer, this.magicBytes.avif, 4)) {
        return { valid: true, format: 'avif' };
      }

      return { valid: false, error: 'Unknown or unsupported image format' };

    } catch (error) {
      return { valid: false, error: `Failed to read file for magic byte validation: ${error.message}` };
    }
  }

  matchesBytes(buffer, pattern, offset = 0) {
    if (buffer.length < offset + pattern.length) {
      return false;
    }
    
    for (let i = 0; i < pattern.length; i++) {
      if (buffer[offset + i] !== pattern[i]) {
        return false;
      }
    }
    
    return true;
  }

  validateMimeType(filePath, expectedMimeType) {
    const ext = require('path').extname(filePath).toLowerCase();
    const detectedMimeType = this.mimeTypes[ext];
    
    if (!detectedMimeType) {
      return { valid: false, error: `Unknown file extension: ${ext}` };
    }
    
    if (expectedMimeType && detectedMimeType !== expectedMimeType) {
      return { valid: false, error: `MIME type mismatch: expected ${expectedMimeType}, got ${detectedMimeType}` };
    }
    
    return { valid: true, mimeType: detectedMimeType };
  }
}

module.exports = ImageValidator;