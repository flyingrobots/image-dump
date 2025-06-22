const fs = require('fs').promises;

class MaliciousFileDetector {
  constructor(dependencies = {}) {
    this.fs = dependencies.fs || fs;
    this.sharp = dependencies.sharp || require('sharp');
    
    // Known malicious patterns and signatures
    this.suspiciousPatterns = {
      // SVG script injection patterns
      svg: [
        /<script[^>]*>/i,
        /javascript:/i,
        /data:text\/html/i,
        /onload=/i,
        /onerror=/i,
        /onclick=/i,
        /onmouseover=/i,
        /<iframe[^>]*>/i,
        /<object[^>]*>/i,
        /<embed[^>]*>/i,
        /xlink:href.*javascript:/i
      ],
      
      // EXIF injection patterns
      exif: [
        /<?php/i,
        /<script/i,
        /javascript:/i,
        /data:text\/html/i,
        /<\?xml.*encoding.*\?>/i
      ],
      
      // Archive signatures (potential ZIP bombs)
      archives: [
        { pattern: [0x50, 0x4B, 0x03, 0x04], name: 'ZIP' },
        { pattern: [0x50, 0x4B, 0x05, 0x06], name: 'ZIP (empty)' },
        { pattern: [0x50, 0x4B, 0x07, 0x08], name: 'ZIP (spanned)' },
        { pattern: [0x52, 0x61, 0x72, 0x21], name: 'RAR' },
        { pattern: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], name: '7-Zip' }
      ],
      
      // Known exploit signatures
      exploits: [
        // CVE-2016-3714 ImageMagick (ImageTragick)
        { pattern: 'https://example.com/image.jpg', name: 'ImageMagick URL injection' },
        { pattern: '|echo', name: 'Command injection' },
        { pattern: '$(', name: 'Command substitution' },
        { pattern: '`', name: 'Command execution' }
      ]
    };
    
    this.zipBombThresholds = {
      maxUncompressedSize: 1024 * 1024 * 1024, // 1GB uncompressed
      maxCompressionRatio: 100, // 100:1 compression ratio
      maxFiles: 10000, // Maximum files in archive
      maxNestingLevel: 10 // Maximum nesting depth
    };
    
    this.steganographyIndicators = [
      // LSB steganography indicators
      { name: 'High entropy in LSBs', threshold: 0.9 },
      { name: 'Unusual file size for dimensions', threshold: 50 },
      { name: 'Suspicious metadata patterns', patterns: ['stego', 'hidden', 'secret'] }
    ];
  }

  async detectMaliciousContent(filePath, detectionConfig = {}) {
    const config = {
      checkZipBombs: detectionConfig.checkZipBombs !== false,
      checkSvgScripts: detectionConfig.checkSvgScripts !== false,
      sanitizeExif: detectionConfig.sanitizeExif !== false,
      detectSteganography: detectionConfig.detectSteganography !== false,
      checkKnownExploits: detectionConfig.checkKnownExploits !== false,
      ...detectionConfig
    };

    const result = {
      isMalicious: false,
      threats: [],
      warnings: [],
      sanitizedData: null,
      confidence: 0
    };

    try {
      // Read file for analysis
      const buffer = await this.fs.readFile(filePath);
      
      // Check for ZIP bomb characteristics
      if (config.checkZipBombs) {
        const zipBombResult = await this.detectZipBomb(buffer, filePath);
        if (zipBombResult.isZipBomb) {
          result.isMalicious = true;
          result.threats.push(zipBombResult);
          result.confidence = Math.max(result.confidence, zipBombResult.confidence);
        } else if (zipBombResult.suspicious) {
          result.warnings.push(zipBombResult);
        }
      }

      // Check for SVG script injection
      if (config.checkSvgScripts) {
        const svgResult = await this.detectSvgScriptInjection(buffer, filePath);
        if (svgResult.hasScripts) {
          result.isMalicious = true;
          result.threats.push(svgResult);
          result.confidence = Math.max(result.confidence, svgResult.confidence);
        }
      }

      // Check and sanitize EXIF data
      if (config.sanitizeExif) {
        const exifResult = await this.analyzeExifData(buffer, filePath);
        if (exifResult.malicious) {
          result.isMalicious = true;
          result.threats.push({
            type: 'exif_analysis',
            ...exifResult
          });
          result.confidence = Math.max(result.confidence, exifResult.confidence);
        }
        if (exifResult.sanitized) {
          result.sanitizedData = exifResult.sanitizedBuffer;
        }
        if (exifResult.warnings.length > 0) {
          result.warnings.push(...exifResult.warnings);
        }
      }

      // Check for steganography indicators
      if (config.detectSteganography) {
        const stegoResult = await this.detectSteganography(buffer, filePath);
        if (stegoResult.suspicious) {
          result.warnings.push({
            type: 'steganography',
            ...stegoResult
          });
          result.confidence = Math.max(result.confidence, stegoResult.confidence * 0.5); // Lower confidence for stego
        }
      }

      // Check for known exploit signatures
      if (config.checkKnownExploits) {
        const exploitResult = this.detectKnownExploits(buffer);
        if (exploitResult.found) {
          result.isMalicious = true;
          result.threats.push(exploitResult);
          result.confidence = Math.max(result.confidence, exploitResult.confidence);
        }
      }

      // Additional heuristic checks
      const heuristicResult = this.performHeuristicAnalysis(buffer, filePath);
      result.warnings.push(...heuristicResult.warnings);
      if (heuristicResult.suspicious) {
        result.confidence = Math.max(result.confidence, heuristicResult.confidence * 0.3);
      }

    } catch (error) {
      result.warnings.push({
        type: 'analysis_error',
        message: `Malicious content detection failed: ${error.message}`,
        confidence: 0
      });
    }

    return result;
  }

  detectZipBomb(buffer, filePath) {
    const result = {
      isZipBomb: false,
      suspicious: false,
      type: 'zip_bomb',
      confidence: 0,
      details: {}
    };

    try {
      // Check for archive signatures
      const archiveSignature = this.detectArchiveSignature(buffer);
      if (!archiveSignature) {
        return result;
      }

      result.details.archiveType = archiveSignature.name;

      // For images that contain archive signatures, this is highly suspicious
      const ext = require('path').extname(filePath).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.avif'].includes(ext)) {
        result.isZipBomb = true;
        result.confidence = 0.9;
        result.details.reason = 'Archive signature found in image file';
        return result;
      }

      // Basic ZIP bomb detection heuristics
      if (archiveSignature.name === 'ZIP') {
        const suspiciousIndicators = this.analyzeZipStructure(buffer);
        if (suspiciousIndicators.score > 0.7) {
          result.isZipBomb = true;
          result.confidence = suspiciousIndicators.score;
          result.details = { ...result.details, ...suspiciousIndicators };
        } else if (suspiciousIndicators.score > 0.3) {
          result.suspicious = true;
          result.confidence = suspiciousIndicators.score;
          result.details = { ...result.details, ...suspiciousIndicators };
        }
      }

    } catch (error) {
      result.details.error = error.message;
    }

    return result;
  }

  detectArchiveSignature(buffer) {
    for (const archive of this.suspiciousPatterns.archives) {
      if (this.bytesMatch(buffer, archive.pattern, 0)) {
        return archive;
      }
    }
    return null;
  }

  analyzeZipStructure(buffer) {
    const indicators = {
      score: 0,
      reasons: []
    };

    // Look for central directory end record
    const endRecord = buffer.lastIndexOf(Buffer.from([0x50, 0x4B, 0x05, 0x06]));
    if (endRecord === -1) {
      indicators.reasons.push('No central directory end record found');
      indicators.score += 0.3;
      return indicators;
    }

    try {
      // Read central directory info
      const totalFiles = buffer.readUInt16LE(endRecord + 8);
      const cdSize = buffer.readUInt32LE(endRecord + 12);
      
      // Suspicious indicators
      if (totalFiles > this.zipBombThresholds.maxFiles) {
        indicators.reasons.push(`Too many files: ${totalFiles}`);
        indicators.score += 0.4;
      }
      
      if (cdSize > buffer.length * 0.8) {
        indicators.reasons.push('Unusually large central directory');
        indicators.score += 0.3;
      }

      // Check for repeated file names (classic ZIP bomb pattern)
      const fileNamePattern = /(.{1,20})\1{5,}/; // Repeated pattern
      if (fileNamePattern.test(buffer.toString('binary'))) {
        indicators.reasons.push('Repeated filename patterns detected');
        indicators.score += 0.5;
      }

    } catch {
      indicators.reasons.push('Error parsing ZIP structure');
      indicators.score += 0.2;
    }

    return indicators;
  }

  detectSvgScriptInjection(buffer, _filePath) {
    const result = {
      hasScripts: false,
      type: 'svg_script_injection',
      confidence: 0,
      findings: []
    };

    // Only check SVG files
    const ext = require('path').extname(_filePath).toLowerCase();
    if (ext !== '.svg') {
      return result;
    }

    const content = buffer.toString('utf8');

    for (const pattern of this.suspiciousPatterns.svg) {
      const matches = content.match(pattern);
      if (matches) {
        result.hasScripts = true;
        result.findings.push({
          pattern: pattern.source,
          match: matches[0],
          position: content.indexOf(matches[0])
        });
        result.confidence = Math.max(result.confidence, 0.8);
      }
    }

    return result;
  }

  async analyzeExifData(buffer, _filePath) {
    const result = {
      malicious: false,
      sanitized: false,
      sanitizedBuffer: null,
      warnings: [],
      type: 'exif_analysis',
      confidence: 0
    };

    try {
      // Use Sharp to get metadata
      const metadata = await this.sharp(buffer).metadata();
      
      if (metadata.exif) {
        const exifString = metadata.exif.toString();
        
        // Check for malicious patterns in EXIF data
        for (const pattern of this.suspiciousPatterns.exif) {
          if (pattern.test(exifString)) {
            result.malicious = true;
            result.confidence = 0.9;
            result.warnings.push(`Suspicious EXIF content: ${pattern.source}`);
          }
        }

        // Check for unusually large EXIF data
        if (metadata.exif.length > 65536) { // 64KB
          result.warnings.push('Unusually large EXIF data detected');
          result.confidence = Math.max(result.confidence, 0.3);
        }

        // Sanitize EXIF data by removing it
        if (result.malicious || result.warnings.length > 0) {
          try {
            result.sanitizedBuffer = await this.sharp(buffer)
              .withMetadata(false) // Remove all metadata
              .toBuffer();
            result.sanitized = true;
          } catch (sanitizeError) {
            result.warnings.push(`Failed to sanitize EXIF data: ${sanitizeError.message}`);
          }
        }
      }

    } catch (error) {
      result.warnings.push(`EXIF analysis failed: ${error.message}`);
    }

    return result;
  }

  async detectSteganography(buffer, _filePath) {
    const result = {
      suspicious: false,
      type: 'steganography',
      confidence: 0,
      indicators: []
    };

    try {
      // Get image metadata for analysis
      const metadata = await this.sharp(buffer).metadata();
      
      if (!metadata.width || !metadata.height) {
        return result;
      }

      // Calculate expected file size for the image dimensions
      const expectedSize = metadata.width * metadata.height * (metadata.channels || 3);
      const actualSize = buffer.length;
      const sizeRatio = actualSize / expectedSize;

      // Check for unusual file size ratio
      if (sizeRatio > this.steganographyIndicators[1].threshold) {
        result.indicators.push('File size unusually large for image dimensions');
        result.confidence += 0.2;
      }

      // Analyze entropy in LSBs (simplified)
      const entropy = this.calculateLSBEntropy(buffer);
      if (entropy > this.steganographyIndicators[0].threshold) {
        result.indicators.push('High entropy detected in least significant bits');
        result.confidence += 0.3;
      }

      // Check for suspicious metadata
      if (metadata.exif) {
        const exifString = metadata.exif.toString().toLowerCase();
        for (const pattern of this.steganographyIndicators[2].patterns) {
          if (exifString.includes(pattern)) {
            result.indicators.push(`Suspicious metadata pattern: ${pattern}`);
            result.confidence += 0.2;
          }
        }
      }

      result.suspicious = result.confidence > 0.3;

    } catch (error) {
      result.indicators.push(`Steganography analysis failed: ${error.message}`);
    }

    return result;
  }

  calculateLSBEntropy(buffer) {
    // Simplified LSB entropy calculation
    // In a real implementation, you'd analyze actual pixel data
    const lsbs = [];
    for (let i = 0; i < Math.min(buffer.length, 10000); i++) {
      lsbs.push(buffer[i] & 1); // Extract LSB
    }

    // Calculate Shannon entropy
    const counts = lsbs.reduce((acc, bit) => {
      acc[bit] = (acc[bit] || 0) + 1;
      return acc;
    }, {});

    let entropy = 0;
    const total = lsbs.length;
    for (const count of Object.values(counts)) {
      const p = count / total;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
  }

  detectKnownExploits(buffer) {
    const result = {
      found: false,
      type: 'known_exploit',
      confidence: 0,
      exploits: []
    };

    const content = buffer.toString('binary');

    for (const exploit of this.suspiciousPatterns.exploits) {
      if (content.includes(exploit.pattern)) {
        result.found = true;
        result.exploits.push(exploit);
        result.confidence = Math.max(result.confidence, 0.95);
      }
    }

    return result;
  }

  performHeuristicAnalysis(buffer, _filePath) {
    const result = {
      suspicious: false,
      warnings: [],
      confidence: 0
    };

    // Check for unusual file patterns
    const nullBytes = (buffer.toString('binary').match(/\0/g) || []).length;
    const nullRatio = nullBytes / buffer.length;
    
    if (nullRatio > 0.5) {
      result.warnings.push({
        type: 'unusual_pattern',
        message: 'File contains unusually high number of null bytes',
        confidence: 0.3
      });
      result.suspicious = true;
    }

    // Check for high entropy (might indicate encryption/compression)
    const entropy = this.calculateEntropy(buffer);
    if (entropy > 7.5) { // High entropy threshold
      result.warnings.push({
        type: 'high_entropy',
        message: 'File has unusually high entropy',
        confidence: 0.2
      });
    }

    return result;
  }

  calculateEntropy(buffer) {
    const counts = {};
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      counts[byte] = (counts[byte] || 0) + 1;
    }

    let entropy = 0;
    const total = buffer.length;
    for (const count of Object.values(counts)) {
      const p = count / total;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
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

  updateThreatSignatures(newSignatures) {
    // Allow updating threat signatures for new threats
    if (newSignatures.exploits) {
      this.suspiciousPatterns.exploits.push(...newSignatures.exploits);
    }
    if (newSignatures.svg) {
      this.suspiciousPatterns.svg.push(...newSignatures.svg);
    }
    if (newSignatures.exif) {
      this.suspiciousPatterns.exif.push(...newSignatures.exif);
    }
  }
}

module.exports = MaliciousFileDetector;