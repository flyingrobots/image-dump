const ImageValidator = require('../../src/image-validator');

describe('ImageValidator', () => {
  let validator;
  let mockFs;
  let mockSharp;

  beforeEach(() => {
    mockFs = {
      stat: jest.fn(),
      readFile: jest.fn()
    };

    // Create a Sharp instance mock
    const sharpInstance = {
      metadata: jest.fn()
    };
    
    // Mock Sharp to return the instance when called with any argument
    mockSharp = jest.fn(() => sharpInstance);

    validator = new ImageValidator({ fs: mockFs, sharp: mockSharp });
  });

  describe('validateImage', () => {
    it('should validate a valid JPEG image', async () => {
      // Mock file stats
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      // Mock JPEG magic bytes
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);
      
      // Mock Sharp metadata
      mockSharp().metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'jpeg',
        channels: 3,
        hasAlpha: false
      });

      const result = await validator.validateImage('/test/image.jpg');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.detectedFormat).toBe('jpeg');
      expect(result.metadata.width).toBe(800);
      expect(result.metadata.height).toBe(600);
    });

    it('should reject files that are too large', async () => {
      mockFs.stat.mockResolvedValue({ size: 100 * 1024 * 1024 }); // 100MB

      const result = await validator.validateImage('/test/image.jpg', {
        maxFileSize: 50 * 1024 * 1024 // 50MB limit
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File size 104857600 bytes exceeds maximum allowed 52428800 bytes');
    });

    it('should reject empty files', async () => {
      mockFs.stat.mockResolvedValue({ size: 0 });

      const result = await validator.validateImage('/test/empty.jpg');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should reject images with invalid magic bytes', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      // Mock invalid magic bytes
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      mockFs.readFile.mockResolvedValue(invalidBuffer);

      const result = await validator.validateImage('/test/invalid.jpg');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown or unsupported image format');
    });

    it('should reject images that exceed dimension limits', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);
      
      mockSharp().metadata.mockResolvedValue({
        width: 15000,
        height: 15000,
        format: 'jpeg'
      });

      const result = await validator.validateImage('/test/huge.jpg', {
        maxWidth: 10000,
        maxHeight: 10000
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Image width 15000 exceeds maximum 10000');
      expect(result.errors).toContain('Image height 15000 exceeds maximum 10000');
    });

    it('should reject images below minimum dimensions', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);
      
      mockSharp().metadata.mockResolvedValue({
        width: 5,
        height: 5,
        format: 'jpeg'
      });

      const result = await validator.validateImage('/test/tiny.jpg', {
        minWidth: 10,
        minHeight: 10
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Image width 5 below minimum 10');
      expect(result.errors).toContain('Image height 5 below minimum 10');
    });

    it('should reject formats not in whitelist', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);

      const result = await validator.validateImage('/test/image.jpg', {
        allowedFormats: ['png', 'webp'] // JPEG not allowed
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Format jpeg is not allowed');
    });

    it('should detect corrupted images', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);
      
      mockSharp().metadata.mockRejectedValue(new Error('Corrupt JPEG data'));

      const result = await validator.validateImage('/test/corrupt.jpg');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Image appears corrupted: Corrupt JPEG data');
    });
  });

  describe('validateMagicBytes', () => {
    it('should validate JPEG magic bytes', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);

      const result = await validator.validateMagicBytes('/test/image.jpg');

      expect(result.valid).toBe(true);
      expect(result.format).toBe('jpeg');
    });

    it('should validate PNG magic bytes', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      mockFs.readFile.mockResolvedValue(pngBuffer);

      const result = await validator.validateMagicBytes('/test/image.png');

      expect(result.valid).toBe(true);
      expect(result.format).toBe('png');
    });

    it('should validate WebP magic bytes', async () => {
      const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x2E, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      mockFs.readFile.mockResolvedValue(webpBuffer);

      const result = await validator.validateMagicBytes('/test/image.webp');

      expect(result.valid).toBe(true);
      expect(result.format).toBe('webp');
    });

    it('should reject files with invalid magic bytes', async () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      mockFs.readFile.mockResolvedValue(invalidBuffer);

      const result = await validator.validateMagicBytes('/test/invalid.jpg');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown or unsupported image format');
    });

    it('should reject files that are too small', async () => {
      const tinyBuffer = Buffer.from([0xFF, 0xD8]);
      mockFs.readFile.mockResolvedValue(tinyBuffer);

      const result = await validator.validateMagicBytes('/test/tiny.jpg');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File too small to validate magic bytes');
    });
  });

  describe('validateMimeType', () => {
    it('should validate JPEG MIME type', () => {
      const result = validator.validateMimeType('/test/image.jpg', 'image/jpeg');

      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should validate PNG MIME type', () => {
      const result = validator.validateMimeType('/test/image.png', 'image/png');

      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/png');
    });

    it('should reject unknown extensions', () => {
      const result = validator.validateMimeType('/test/image.xyz');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown file extension: .xyz');
    });

    it('should detect MIME type mismatches', () => {
      const result = validator.validateMimeType('/test/image.jpg', 'image/png');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('MIME type mismatch: expected image/png, got image/jpeg');
    });
  });

  describe('matchesBytes', () => {
    it('should match byte patterns correctly', () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const pattern = [0xFF, 0xD8, 0xFF];

      const result = validator.matchesBytes(buffer, pattern, 0);

      expect(result).toBe(true);
    });

    it('should not match incorrect patterns', () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const pattern = [0x89, 0x50, 0x4E];

      const result = validator.matchesBytes(buffer, pattern, 0);

      expect(result).toBe(false);
    });

    it('should handle offset correctly', () => {
      const buffer = Buffer.from([0x00, 0x00, 0xFF, 0xD8, 0xFF, 0xE0]);
      const pattern = [0xFF, 0xD8, 0xFF];

      const result = validator.matchesBytes(buffer, pattern, 2);

      expect(result).toBe(true);
    });

    it('should return false for insufficient buffer length', () => {
      const buffer = Buffer.from([0xFF, 0xD8]);
      const pattern = [0xFF, 0xD8, 0xFF];

      const result = validator.matchesBytes(buffer, pattern, 0);

      expect(result).toBe(false);
    });
  });
});