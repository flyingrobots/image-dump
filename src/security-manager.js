class SecurityManager {
  constructor(dependencies = {}) {
    this.imageValidator = dependencies.imageValidator;
    this.resourceLimiter = dependencies.resourceLimiter;
    this.formatWhitelistEnforcer = dependencies.formatWhitelistEnforcer;
    this.maliciousFileDetector = dependencies.maliciousFileDetector;
    this.logger = dependencies.logger || console;
    
    // Default security configuration
    this.securityConfig = {
      enforceValidation: true,
      enforceResourceLimits: true,
      enforceFormatWhitelist: true,
      detectMaliciousContent: true,
      sanitizeFiles: true,
      blockOnThreat: true,
      logSecurityEvents: true,
      ...dependencies.securityConfig
    };
  }

  async performSecurityCheck(filePath, processingConfig = {}) {
    const startTime = Date.now();
    const result = {
      allowed: false,
      filePath,
      securityChecks: {
        validation: null,
        formatWhitelist: null,
        maliciousContent: null,
        resourceLimits: null
      },
      threats: [],
      warnings: [],
      sanitizedData: null,
      processingTime: 0
    };

    try {
      // Step 1: Basic image validation
      if (this.securityConfig.enforceValidation && this.imageValidator) {
        result.securityChecks.validation = await this.imageValidator.validateImage(filePath, {
          maxFileSize: processingConfig.maxFileSize,
          maxWidth: processingConfig.maxWidth,
          maxHeight: processingConfig.maxHeight,
          allowedFormats: processingConfig.allowedFormats,
          ...processingConfig.validation
        });

        if (!result.securityChecks.validation.valid) {
          result.threats.push({
            type: 'validation_failure',
            severity: 'high',
            details: result.securityChecks.validation.errors
          });
          
          if (this.securityConfig.blockOnThreat) {
            this.logSecurityEvent('VALIDATION_FAILED', filePath, result.securityChecks.validation.errors);
            return this.finalizeResult(result, startTime);
          }
        }

        if (result.securityChecks.validation.warnings?.length > 0) {
          result.warnings.push(...result.securityChecks.validation.warnings);
        }
      }

      // Step 2: Format whitelist enforcement
      if (this.securityConfig.enforceFormatWhitelist && this.formatWhitelistEnforcer) {
        result.securityChecks.formatWhitelist = await this.formatWhitelistEnforcer.enforceWhitelist(filePath, {
          allowedFormats: processingConfig.allowedFormats,
          strictValidation: processingConfig.strictFormatValidation,
          polyglotDetection: processingConfig.polyglotDetection,
          deepValidation: processingConfig.deepFormatValidation,
          ...processingConfig.formatWhitelist
        });

        if (!result.securityChecks.formatWhitelist.allowed) {
          result.threats.push({
            type: 'format_violation',
            severity: 'high',
            details: result.securityChecks.formatWhitelist.errors
          });
          
          if (this.securityConfig.blockOnThreat) {
            this.logSecurityEvent('FORMAT_VIOLATION', filePath, result.securityChecks.formatWhitelist.errors);
            return this.finalizeResult(result, startTime);
          }
        }

        if (result.securityChecks.formatWhitelist.warnings?.length > 0) {
          result.warnings.push(...result.securityChecks.formatWhitelist.warnings);
        }
      }

      // Step 3: Malicious content detection
      if (this.securityConfig.detectMaliciousContent && this.maliciousFileDetector) {
        result.securityChecks.maliciousContent = await this.maliciousFileDetector.detectMaliciousContent(filePath, {
          checkZipBombs: processingConfig.checkZipBombs,
          checkSvgScripts: processingConfig.checkSvgScripts,
          sanitizeExif: processingConfig.sanitizeExif,
          detectSteganography: processingConfig.detectSteganography,
          checkKnownExploits: processingConfig.checkKnownExploits,
          ...processingConfig.maliciousDetection
        });

        if (result.securityChecks.maliciousContent.isMalicious) {
          result.threats.push({
            type: 'malicious_content',
            severity: 'critical',
            confidence: result.securityChecks.maliciousContent.confidence,
            details: result.securityChecks.maliciousContent.threats
          });
          
          if (this.securityConfig.blockOnThreat) {
            this.logSecurityEvent('MALICIOUS_CONTENT', filePath, result.securityChecks.maliciousContent.threats);
            return this.finalizeResult(result, startTime);
          }
        }

        if (result.securityChecks.maliciousContent.warnings?.length > 0) {
          result.warnings.push(...result.securityChecks.maliciousContent.warnings);
        }

        // Handle sanitized data
        if (this.securityConfig.sanitizeFiles && result.securityChecks.maliciousContent.sanitizedData) {
          result.sanitizedData = result.securityChecks.maliciousContent.sanitizedData;
        }
      }

      // Step 4: Resource limits check (for processing operation)
      if (this.securityConfig.enforceResourceLimits && this.resourceLimiter) {
        try {
          await this.resourceLimiter.checkSystemResources();
          await this.resourceLimiter.checkConcurrencyLimits();
          
          result.securityChecks.resourceLimits = {
            passed: true,
            systemResources: this.resourceLimiter.getResourceUsage()
          };
        } catch (error) {
          result.securityChecks.resourceLimits = {
            passed: false,
            error: error.message
          };
          
          result.threats.push({
            type: 'resource_exhaustion',
            severity: 'medium',
            details: error.message
          });
          
          if (this.securityConfig.blockOnThreat) {
            this.logSecurityEvent('RESOURCE_EXHAUSTION', filePath, error.message);
            return this.finalizeResult(result, startTime);
          }
        }
      }

      // If we've made it here without blocking, the file is allowed
      result.allowed = true;
      this.logSecurityEvent('SECURITY_CHECK_PASSED', filePath, null, 'info');

    } catch (error) {
      result.threats.push({
        type: 'security_check_error',
        severity: 'high',
        details: `Security check failed: ${error.message}`
      });
      
      this.logSecurityEvent('SECURITY_CHECK_ERROR', filePath, error.message);
    }

    return this.finalizeResult(result, startTime);
  }

  async performSecureProcessing(filePath, processingOperation, processingConfig = {}) {
    // First perform security checks
    const securityResult = await this.performSecurityCheck(filePath, processingConfig);
    
    if (!securityResult.allowed) {
      throw new Error(`Security check failed for ${filePath}: ${securityResult.threats.map(t => t.details).join(', ')}`);
    }

    // Determine which file to process (original or sanitized)
    const fileToProcess = securityResult.sanitizedData ? securityResult.sanitizedData : filePath;
    
    // Perform processing with resource limits
    if (this.securityConfig.enforceResourceLimits && this.resourceLimiter) {
      return this.resourceLimiter.withResourceLimits(
        () => processingOperation(fileToProcess),
        {
          maxMemory: processingConfig.maxMemoryPerImage,
          maxCpuTime: processingConfig.maxCpuTimePerImage,
          ...processingConfig.resourceLimits
        }
      );
    } else {
      return processingOperation(fileToProcess);
    }
  }

  finalizeResult(result, startTime) {
    result.processingTime = Date.now() - startTime;
    
    // Log comprehensive security summary
    if (this.securityConfig.logSecurityEvents) {
      const summary = {
        file: result.filePath,
        allowed: result.allowed,
        threatsCount: result.threats.length,
        warningsCount: result.warnings.length,
        processingTime: result.processingTime
      };
      
      if (result.threats.length > 0) {
        this.logger.warn('Security threats detected:', summary);
      } else if (result.warnings.length > 0) {
        this.logger.info('Security warnings:', summary);
      }
    }
    
    return result;
  }

  logSecurityEvent(eventType, filePath, details, level = 'warn') {
    if (!this.securityConfig.logSecurityEvents) {
      return;
    }

    const event = {
      timestamp: new Date().toISOString(),
      type: eventType,
      file: filePath,
      details: details
    };

    if (this.logger[level]) {
      this.logger[level](`Security Event [${eventType}]:`, event);
    } else {
      this.logger.log(`Security Event [${eventType}]:`, event);
    }
  }

  getSecurityMetrics() {
    const metrics = {
      resourceUsage: null,
      threatSignatures: null,
      allowedFormats: null
    };

    if (this.resourceLimiter) {
      metrics.resourceUsage = this.resourceLimiter.getResourceUsage();
    }

    if (this.formatWhitelistEnforcer) {
      metrics.allowedFormats = this.formatWhitelistEnforcer.getDefaultFormats();
    }

    if (this.maliciousFileDetector) {
      metrics.threatSignatures = {
        exploitCount: this.maliciousFileDetector.suspiciousPatterns.exploits.length,
        svgPatternCount: this.maliciousFileDetector.suspiciousPatterns.svg.length,
        exifPatternCount: this.maliciousFileDetector.suspiciousPatterns.exif.length
      };
    }

    return metrics;
  }

  updateSecurityConfig(newConfig) {
    this.securityConfig = { ...this.securityConfig, ...newConfig };
  }

  async performBulkSecurityScan(filePaths, config = {}) {
    const results = {
      scanned: 0,
      allowed: 0,
      blocked: 0,
      warnings: 0,
      threats: [],
      processingTime: 0
    };

    const startTime = Date.now();

    for (const filePath of filePaths) {
      try {
        const result = await this.performSecurityCheck(filePath, config);
        results.scanned++;
        
        if (result.allowed) {
          results.allowed++;
        } else {
          results.blocked++;
        }
        
        if (result.warnings.length > 0) {
          results.warnings++;
        }
        
        if (result.threats.length > 0) {
          results.threats.push(...result.threats.map(t => ({ file: filePath, ...t })));
        }
        
      } catch (error) {
        results.threats.push({
          file: filePath,
          type: 'scan_error',
          severity: 'medium',
          details: error.message
        });
      }
    }

    results.processingTime = Date.now() - startTime;
    return results;
  }

  generateSecurityReport() {
    const metrics = this.getSecurityMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      configuration: this.securityConfig,
      metrics: metrics,
      components: {
        imageValidator: !!this.imageValidator,
        resourceLimiter: !!this.resourceLimiter,
        formatWhitelistEnforcer: !!this.formatWhitelistEnforcer,
        maliciousFileDetector: !!this.maliciousFileDetector
      }
    };
  }
}

module.exports = SecurityManager;