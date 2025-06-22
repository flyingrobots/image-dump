const path = require('path');

class FormatWhitelistEnforcer {
  constructor(dependencies = {}) {
    this.fs = dependencies.fs || require('fs').promises;
    this.imageValidator = dependencies.imageValidator;
    
    // Default allowed formats with their properties
    this.defaultAllowedFormats = {
      jpeg: {
        extensions: ['.jpg', '.jpeg'],
        mimeTypes: ['image/jpeg'],
        magicBytes: [[0xFF, 0xD8, 0xFF]],
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedFeatures: ['progressive', 'metadata']
      },
      png: {
        extensions: ['.png'],
        mimeTypes: ['image/png'],
        magicBytes: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
        maxSize: 50 * 1024 * 1024,
        allowedFeatures: ['transparency', 'metadata']
      },
      webp: {
        extensions: ['.webp'],
        mimeTypes: ['image/webp'],
        magicBytes: [[0x52, 0x49, 0x46, 0x46]], // RIFF header
        maxSize: 50 * 1024 * 1024,
        allowedFeatures: ['animation', 'transparency', 'metadata']
      },
      gif: {
        extensions: ['.gif'],
        mimeTypes: ['image/gif'],
        magicBytes: [[0x47, 0x49, 0x46, 0x38]],
        maxSize: 100 * 1024 * 1024, // Larger limit for animated GIFs
        allowedFeatures: ['animation', 'transparency']
      },
      avif: {
        extensions: ['.avif'],
        mimeTypes: ['image/avif'],
        magicBytes: [[0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]], // ftypavif at offset 4
        maxSize: 50 * 1024 * 1024,
        allowedFeatures: ['transparency', 'metadata', 'hdr']
      },
      bmp: {
        extensions: ['.bmp'],
        mimeTypes: ['image/bmp'],
        magicBytes: [[0x42, 0x4D]],
        maxSize: 100 * 1024 * 1024,
        allowedFeatures: []
      },
      tiff: {
        extensions: ['.tif', '.tiff'],
        mimeTypes: ['image/tiff'],
        magicBytes: [
          [0x49, 0x49, 0x2A, 0x00], // Little endian
          [0x4D, 0x4D, 0x00, 0x2A]  // Big endian
        ],
        maxSize: 200 * 1024 * 1024, // Larger limit for high-res images
        allowedFeatures: ['metadata', 'multipage']
      }
    };
  }

  async enforceWhitelist(filePath, whitelistConfig = {}) {
    const config = {
      allowedFormats: whitelistConfig.allowedFormats || Object.keys(this.defaultAllowedFormats),
      strictValidation: whitelistConfig.strictValidation !== false,
      polyglotDetection: whitelistConfig.polyglotDetection !== false,
      deepValidation: whitelistConfig.deepValidation !== false,
      customFormats: whitelistConfig.customFormats || {},
      ...whitelistConfig
    };

    const result = {
      allowed: false,
      format: null,
      errors: [],
      warnings: [],
      detectedFormats: []
    };

    try {
      // Merge custom formats with defaults
      const formatDefinitions = { ...this.defaultAllowedFormats, ...config.customFormats };

      // Step 1: Basic extension check
      const extensionResult = this.checkExtension(filePath, config.allowedFormats, formatDefinitions);
      if (!extensionResult.allowed && config.strictValidation) {
        result.errors.push(extensionResult.error);
        return result;
      }
      
      if (extensionResult.warning) {
        result.warnings.push(extensionResult.warning);
      }

      // Step 2: Magic bytes validation
      const magicBytesResult = await this.validateMagicBytes(filePath, config.allowedFormats, formatDefinitions);
      if (!magicBytesResult.valid) {
        result.errors.push(magicBytesResult.error);
        return result;
      }

      result.detectedFormats.push(magicBytesResult.format);

      // Step 3: Deep format validation using Sharp
      if (config.deepValidation && this.imageValidator) {
        const validationResult = await this.imageValidator.validateImage(filePath, {
          allowedFormats: config.allowedFormats,
          validateMagicBytes: false, // Already done
          validateCorruption: true
        });

        if (!validationResult.valid) {
          result.errors.push(...validationResult.errors);
          return result;
        }

        if (validationResult.metadata && validationResult.metadata.format) {
          result.detectedFormats.push(validationResult.metadata.format);
        }
      }

      // Step 4: Polyglot detection
      if (config.polyglotDetection) {
        const polyglotResult = await this.detectPolyglot(filePath, formatDefinitions);
        if (polyglotResult.isPolyglot) {
          result.errors.push(`File appears to be a polyglot: ${polyglotResult.details}`);
          return result;
        }
        if (polyglotResult.warning) {
          result.warnings.push(polyglotResult.warning);
        }
      }

      // Step 5: Format consistency check
      const uniqueFormats = [...new Set(result.detectedFormats)];
      if (uniqueFormats.length > 1) {
        result.warnings.push(`Multiple formats detected: ${uniqueFormats.join(', ')}`);
      }

      const primaryFormat = uniqueFormats[0] || magicBytesResult.format;
      
      // Step 6: Check format-specific constraints
      if (formatDefinitions[primaryFormat]) {
        const constraintResult = await this.checkFormatConstraints(filePath, primaryFormat, formatDefinitions[primaryFormat]);
        if (!constraintResult.valid) {
          result.errors.push(...constraintResult.errors);
          return result;
        }
        result.warnings.push(...constraintResult.warnings);
      }

      // Final validation
      if (config.allowedFormats.includes(primaryFormat)) {
        result.allowed = true;
        result.format = primaryFormat;
      } else {
        result.errors.push(`Format ${primaryFormat} is not in the allowed formats list`);
      }

    } catch (error) {
      result.errors.push(`Whitelist enforcement failed: ${error.message}`);
    }

    return result;
  }

  checkExtension(filePath, allowedFormats, formatDefinitions) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!ext) {
      return { allowed: false, error: 'File has no extension' };
    }

    // Find formats that support this extension
    const matchingFormats = allowedFormats.filter(format => {
      const formatDef = formatDefinitions[format];
      return formatDef && formatDef.extensions.includes(ext);
    });

    if (matchingFormats.length === 0) {
      return { allowed: false, error: `Extension ${ext} is not allowed` };
    }

    if (matchingFormats.length > 1) {
      return { 
        allowed: true, 
        warning: `Extension ${ext} matches multiple formats: ${matchingFormats.join(', ')}` 
      };
    }

    return { allowed: true, format: matchingFormats[0] };
  }

  async validateMagicBytes(filePath, allowedFormats, formatDefinitions) {
    try {
      const buffer = await this.fs.readFile(filePath);
      
      if (buffer.length < 2) {
        return { valid: false, error: 'File too small for magic byte validation' };
      }

      // Check each allowed format
      for (const format of allowedFormats) {
        const formatDef = formatDefinitions[format];
        if (!formatDef || !formatDef.magicBytes) {
          continue;
        }

        for (const magicBytePattern of formatDef.magicBytes) {
          if (this.matchesMagicBytes(buffer, magicBytePattern, format)) {
            return { valid: true, format };
          }
        }
      }

      return { valid: false, error: 'No matching magic bytes found for allowed formats' };

    } catch (error) {
      return { valid: false, error: `Magic byte validation failed: ${error.message}` };
    }
  }

  matchesMagicBytes(buffer, pattern, format) {
    // Special handling for different formats
    if (format === 'webp') {
      // WebP: Check RIFF header + WEBP signature
      return this.bytesMatch(buffer, pattern, 0) && 
             buffer.length >= 12 &&
             buffer.slice(8, 12).toString() === 'WEBP';
    } else if (format === 'avif') {
      // AVIF: Check ftyp box with avif brand at offset 4
      return buffer.length >= 12 && this.bytesMatch(buffer, pattern, 4);
    } else {
      // Standard magic byte check at beginning of file
      return this.bytesMatch(buffer, pattern, 0);
    }
  }

  bytesMatch(buffer, pattern, offset = 0) {
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

  async detectPolyglot(filePath, formatDefinitions) {
    try {
      const buffer = await this.fs.readFile(filePath);
      const detectedFormats = [];

      // Check for multiple format signatures in the same file
      for (const [format, definition] of Object.entries(formatDefinitions)) {
        if (!definition.magicBytes) {
          continue;
        }

        for (const magicBytePattern of definition.magicBytes) {
          // Check at beginning
          if (this.matchesMagicBytes(buffer, magicBytePattern, format)) {
            detectedFormats.push(format);
          }

          // Check for embedded signatures (polyglot detection)
          for (let offset = 1; offset < Math.min(buffer.length - magicBytePattern.length, 1024); offset++) {
            if (this.bytesMatch(buffer, magicBytePattern, offset)) {
              return {
                isPolyglot: true,
                details: `${format} signature found at offset ${offset}`
              };
            }
          }
        }
      }

      // Check for suspicious patterns
      const suspiciousPatterns = [
        { pattern: 'PK', description: 'ZIP archive signature' },
        { pattern: '7z', description: '7-Zip archive signature' },
        { pattern: 'Rar!', description: 'RAR archive signature' }
      ];

      for (const suspicious of suspiciousPatterns) {
        if (buffer.includes(Buffer.from(suspicious.pattern))) {
          return {
            isPolyglot: false,
            warning: `Suspicious pattern detected: ${suspicious.description}`
          };
        }
      }

      return { isPolyglot: false };

    } catch (error) {
      return { isPolyglot: false, warning: `Polyglot detection failed: ${error.message}` };
    }
  }

  async checkFormatConstraints(filePath, format, formatDefinition) {
    const result = { valid: true, errors: [], warnings: [] };

    try {
      // Check file size constraint
      if (formatDefinition.maxSize) {
        const stats = await this.fs.stat(filePath);
        if (stats.size > formatDefinition.maxSize) {
          result.errors.push(`File size ${stats.size} exceeds maximum ${formatDefinition.maxSize} for ${format}`);
          result.valid = false;
        }
      }

      // Additional format-specific checks could be added here
      // For example, checking for specific features, compression levels, etc.

    } catch (error) {
      result.warnings.push(`Format constraint check failed: ${error.message}`);
    }

    return result;
  }

  getDefaultFormats() {
    return Object.keys(this.defaultAllowedFormats);
  }

  getFormatDefinition(format) {
    return this.defaultAllowedFormats[format] || null;
  }

  addCustomFormat(name, definition) {
    // Validate the definition
    const requiredFields = ['extensions', 'mimeTypes', 'magicBytes'];
    for (const field of requiredFields) {
      if (!definition[field]) {
        throw new Error(`Custom format ${name} missing required field: ${field}`);
      }
    }

    this.defaultAllowedFormats[name] = {
      maxSize: 50 * 1024 * 1024,
      allowedFeatures: [],
      ...definition
    };
  }
}

module.exports = FormatWhitelistEnforcer;