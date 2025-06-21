const MaliciousFileDetector = require('../../src/malicious-file-detector');

describe('MaliciousFileDetector', () => {
  let detector;
  let mockFs;
  let mockSharp;

  beforeEach(() => {
    mockFs = {
      readFile: jest.fn()
    };

    // Create a more complete Sharp mock
    const sharpInstance = {
      metadata: jest.fn(),
      withMetadata: jest.fn().mockReturnThis(),
      toBuffer: jest.fn()
    };
    
    mockSharp = jest.fn(() => sharpInstance);
    mockSharp.mockReturnValue(sharpInstance);

    detector = new MaliciousFileDetector({ fs: mockFs, sharp: mockSharp });
  });

  describe('detectMaliciousContent', () => {
    it('should detect clean files as non-malicious', async () => {
      const cleanBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]); // JPEG
      mockFs.readFile.mockResolvedValue(cleanBuffer);
      
      const sharpInstance = mockSharp();
      sharpInstance.metadata.mockResolvedValue({ width: 800, height: 600, channels: 3 });

      const result = await detector.detectMaliciousContent('/test/clean.jpg');

      expect(result.isMalicious).toBe(false);
      expect(result.threats).toHaveLength(0);
    });

    it('should detect ZIP bomb in image file', async () => {
      // ZIP signature in what appears to be an image file
      const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      mockFs.readFile.mockResolvedValue(zipBuffer);

      const result = await detector.detectMaliciousContent('/test/zipbomb.jpg');

      expect(result.isMalicious).toBe(true);
      expect(result.threats).toHaveLength(1);
      expect(result.threats[0].type).toBe('zip_bomb');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect SVG script injection', async () => {
      const maliciousSvg = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg">
          <script>alert('XSS')</script>
          <rect width="100" height="100"/>
        </svg>
      `);
      mockFs.readFile.mockResolvedValue(maliciousSvg);

      const result = await detector.detectMaliciousContent('/test/malicious.svg');

      expect(result.isMalicious).toBe(true);
      expect(result.threats).toHaveLength(1);
      expect(result.threats[0].type).toBe('svg_script_injection');
      expect(result.threats[0].hasScripts).toBe(true);
    });

    it('should detect known exploit signatures', async () => {
      const exploitBuffer = Buffer.from('Some image data with |echo malicious command');
      mockFs.readFile.mockResolvedValue(exploitBuffer);

      const result = await detector.detectMaliciousContent('/test/exploit.jpg');

      expect(result.isMalicious).toBe(true);
      expect(result.threats).toHaveLength(1);
      expect(result.threats[0].type).toBe('known_exploit');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should sanitize malicious EXIF data', async () => {
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      const maliciousExif = Buffer.from('<?php system($_GET["cmd"]); ?>');
      const sanitizedBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);

      mockFs.readFile.mockResolvedValue(imageBuffer);
      
      // Access the sharp instance created in beforeEach
      const sharpInstance = mockSharp();
      sharpInstance.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        exif: maliciousExif
      });
      sharpInstance.toBuffer.mockResolvedValue(sanitizedBuffer);

      const result = await detector.detectMaliciousContent('/test/exif-malicious.jpg');

      expect(result.isMalicious).toBe(true);
      expect(result.sanitizedData).toBeDefined();
      expect(result.threats[0].type).toBe('exif_analysis');
    });

    it('should detect steganography indicators', async () => {
      // Create a buffer with random data for high entropy
      const largeBuffer = Buffer.alloc(10000000);
      // Fill with pseudo-random data to ensure high entropy
      for (let i = 0; i < largeBuffer.length; i++) {
        largeBuffer[i] = Math.floor(Math.random() * 256);
      }
      mockFs.readFile.mockResolvedValue(largeBuffer);
      
      const sharpInstance = mockSharp();
      sharpInstance.metadata.mockResolvedValue({
        width: 100,
        height: 100,
        channels: 3 // Expected: 30KB, Actual: 10MB - ratio > 50
      });

      const result = await detector.detectMaliciousContent('/test/stego.jpg', {
        detectSteganography: true
      });

      // The steganography detection puts results in warnings array with proper structure
      expect(result.warnings.length).toBeGreaterThan(0);
      const stegoWarning = result.warnings.find(w => w.type === 'steganography');
      expect(stegoWarning).toBeDefined();
    });
  });

  describe('detectZipBomb', () => {
    it('should detect ZIP signature in image files', () => {
      const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

      const result = detector.detectZipBomb(zipBuffer, '/test/fake.jpg');

      expect(result.isZipBomb).toBe(true);
      expect(result.details.archiveType).toBe('ZIP');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should not flag legitimate ZIP files', () => {
      const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

      const result = detector.detectZipBomb(zipBuffer, '/test/legitimate.zip');

      expect(result.isZipBomb).toBe(false);
    });

    it('should detect other archive formats', () => {
      const rarBuffer = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]);

      const result = detector.detectZipBomb(rarBuffer, '/test/fake.jpg');

      expect(result.isZipBomb).toBe(true);
      expect(result.details.archiveType).toBe('RAR');
    });
  });

  describe('detectSvgScriptInjection', () => {
    it('should detect script tags in SVG', async () => {
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <script>malicious_code()</script>
        </svg>
      `;
      const svgBuffer = Buffer.from(svgContent);

      const result = await detector.detectSvgScriptInjection(svgBuffer, '/test/malicious.svg');

      expect(result.hasScripts).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect javascript: URLs in SVG', async () => {
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <a href="javascript:alert('XSS')">Click me</a>
        </svg>
      `;
      const svgBuffer = Buffer.from(svgContent);

      const result = await detector.detectSvgScriptInjection(svgBuffer, '/test/malicious.svg');

      expect(result.hasScripts).toBe(true);
      expect(result.findings).toHaveLength(1);
    });

    it('should detect event handlers in SVG', async () => {
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <rect onload="malicious()" width="100" height="100"/>
        </svg>
      `;
      const svgBuffer = Buffer.from(svgContent);

      const result = await detector.detectSvgScriptInjection(svgBuffer, '/test/malicious.svg');

      expect(result.hasScripts).toBe(true);
    });

    it('should not flag non-SVG files', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);

      const result = await detector.detectSvgScriptInjection(jpegBuffer, '/test/image.jpg');

      expect(result.hasScripts).toBe(false);
    });
  });

  describe('analyzeExifData', () => {
    it('should detect malicious PHP code in EXIF', async () => {
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const maliciousExif = Buffer.from('<?php system($_GET["cmd"]); ?>');
      const sanitizedBuffer = Buffer.from([0xFF, 0xD8]);

      const sharpInstance = mockSharp();
      sharpInstance.metadata.mockResolvedValue({
        exif: maliciousExif
      });
      sharpInstance.toBuffer.mockResolvedValue(sanitizedBuffer);

      const result = await detector.analyzeExifData(imageBuffer, '/test/image.jpg');

      expect(result.malicious).toBe(true);
      expect(result.sanitized).toBe(true);
      expect(result.sanitizedBuffer).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect unusually large EXIF data', async () => {
      const largeExif = Buffer.alloc(100000, 0x41); // 100KB of 'A'
      
      const sharpInstance = mockSharp();
      sharpInstance.metadata.mockResolvedValue({
        exif: largeExif
      });

      const result = await detector.analyzeExifData(Buffer.alloc(1000), '/test/image.jpg');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Unusually large EXIF data');
    });

    it('should handle images without EXIF data', async () => {
      const sharpInstance = mockSharp();
      sharpInstance.metadata.mockResolvedValue({
        width: 800,
        height: 600
        // No exif property
      });

      const result = await detector.analyzeExifData(Buffer.alloc(1000), '/test/image.jpg');

      expect(result.malicious).toBe(false);
      expect(result.sanitized).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('detectSteganography', () => {
    it('should detect unusual file size ratios', async () => {
      // Create a buffer with random data for high entropy
      const largeBuffer = Buffer.alloc(10000000); // 10MB buffer
      // Fill with pseudo-random data to ensure high entropy
      for (let i = 0; i < largeBuffer.length; i++) {
        largeBuffer[i] = Math.floor(Math.random() * 256);
      }
      
      const sharpInstance = mockSharp();
      sharpInstance.metadata.mockResolvedValue({
        width: 100,
        height: 100,
        channels: 3 // Expected size: 100*100*3 = 30,000 bytes, actual: 10MB (ratio = 333 > 50)
      });

      const result = await detector.detectSteganography(largeBuffer, '/test/image.jpg');

      expect(result.suspicious).toBe(true);
      expect(result.indicators).toContain('File size unusually large for image dimensions');
    });

    it('should detect suspicious metadata patterns', async () => {
      const exifWithStego = Buffer.from('Camera info with hidden stego data');
      const sharpInstance = mockSharp();
      sharpInstance.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        channels: 3,
        exif: exifWithStego
      });

      const result = await detector.detectSteganography(Buffer.alloc(1000), '/test/image.jpg');

      expect(result.indicators.some(i => i.includes('stego'))).toBe(true);
    });
  });

  describe('detectKnownExploits', () => {
    it('should detect ImageMagick exploit patterns', () => {
      const exploitBuffer = Buffer.from('https://example.com/image.jpg|echo vulnerable');

      const result = detector.detectKnownExploits(exploitBuffer);

      expect(result.found).toBe(true);
      expect(result.exploits).toHaveLength(2); // URL injection + echo command
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect command injection patterns', () => {
      const exploitBuffer = Buffer.from('image data $(rm -rf /) more data');

      const result = detector.detectKnownExploits(exploitBuffer);

      expect(result.found).toBe(true);
      expect(result.exploits).toHaveLength(1);
    });
  });

  describe('utility methods', () => {
    it('should calculate entropy correctly', () => {
      // Test with uniform distribution (max entropy)
      const uniformBuffer = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
      const entropy = detector.calculateEntropy(uniformBuffer);
      
      expect(entropy).toBeCloseTo(3, 1); // log2(8) = 3
    });

    it('should calculate LSB entropy', () => {
      const testBuffer = Buffer.from([0b10101010, 0b01010101, 0b11110000, 0b00001111]);
      
      const entropy = detector.calculateLSBEntropy(testBuffer);
      
      expect(entropy).toBeGreaterThan(0);
      expect(entropy).toBeLessThanOrEqual(1);
    });

    it('should match byte patterns correctly', () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const pattern = [0xFF, 0xD8, 0xFF];

      const matches = detector.bytesMatch(buffer, pattern, 0);

      expect(matches).toBe(true);
    });

    it('should not match incorrect patterns', () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const pattern = [0x89, 0x50, 0x4E];

      const matches = detector.bytesMatch(buffer, pattern, 0);

      expect(matches).toBe(false);
    });
  });

  describe('updateThreatSignatures', () => {
    it('should allow updating threat signatures', () => {
      const newSignatures = {
        exploits: [
          { pattern: 'new_exploit_pattern', name: 'New exploit' }
        ],
        svg: [/new_svg_pattern/i]
      };

      const initialExploitCount = detector.suspiciousPatterns.exploits.length;
      const initialSvgCount = detector.suspiciousPatterns.svg.length;

      detector.updateThreatSignatures(newSignatures);

      expect(detector.suspiciousPatterns.exploits).toHaveLength(initialExploitCount + 1);
      expect(detector.suspiciousPatterns.svg).toHaveLength(initialSvgCount + 1);
    });
  });
});