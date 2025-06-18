const FormatWhitelistEnforcer = require('../../src/format-whitelist-enforcer');

describe('FormatWhitelistEnforcer', () => {
  let enforcer;
  let mockFs;
  let mockImageValidator;

  beforeEach(() => {
    mockFs = {
      readFile: jest.fn(),
      stat: jest.fn()
    };

    mockImageValidator = {
      validateImage: jest.fn()
    };

    enforcer = new FormatWhitelistEnforcer({
      fs: mockFs,
      imageValidator: mockImageValidator
    });
  });

  describe('enforceWhitelist', () => {
    it('should allow valid JPEG files', async () => {
      // Mock file stats
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      // Mock JPEG magic bytes
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);

      const result = await enforcer.enforceWhitelist('/test/image.jpg', {
        allowedFormats: ['jpeg']
      });

      expect(result.allowed).toBe(true);
      expect(result.format).toBe('jpeg');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files with disallowed extensions', async () => {
      const result = await enforcer.enforceWhitelist('/test/image.xyz', {
        allowedFormats: ['jpeg', 'png']
      });

      expect(result.allowed).toBe(false);
      expect(result.errors).toContain('Extension .xyz is not allowed');
    });

    it('should reject files with no extension', async () => {
      const result = await enforcer.enforceWhitelist('/test/image', {
        allowedFormats: ['jpeg', 'png']
      });

      expect(result.allowed).toBe(false);
      expect(result.errors).toContain('File has no extension');
    });

    it('should reject files with invalid magic bytes', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      // Mock invalid magic bytes for JPEG file
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      mockFs.readFile.mockResolvedValue(invalidBuffer);

      const result = await enforcer.enforceWhitelist('/test/image.jpg', {
        allowedFormats: ['jpeg']
      });

      expect(result.allowed).toBe(false);
      expect(result.errors).toContain('No matching magic bytes found for allowed formats');
    });

    it('should validate WebP files correctly', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      // Mock WebP magic bytes (RIFF + WEBP)
      const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x2E, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      mockFs.readFile.mockResolvedValue(webpBuffer);

      const result = await enforcer.enforceWhitelist('/test/image.webp', {
        allowedFormats: ['webp']
      });

      expect(result.allowed).toBe(true);
      expect(result.format).toBe('webp');
    });

    it('should detect format not in whitelist', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);

      const result = await enforcer.enforceWhitelist('/test/image.jpg', {
        allowedFormats: ['png', 'webp'] // JPEG not allowed
      });

      expect(result.allowed).toBe(false);
      expect(result.errors).toContain('Format jpeg is not in the allowed formats list');
    });

    it('should enforce file size limits', async () => {
      mockFs.stat.mockResolvedValue({ size: 60 * 1024 * 1024 }); // 60MB
      
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);

      const result = await enforcer.enforceWhitelist('/test/huge.jpg', {
        allowedFormats: ['jpeg']
      });

      expect(result.allowed).toBe(false);
      expect(result.errors).toContain('File size 62914560 exceeds maximum 52428800 for jpeg');
    });

    it('should perform deep validation when enabled', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);

      mockImageValidator.validateImage.mockResolvedValue({
        valid: true,
        errors: [],
        metadata: { format: 'jpeg', width: 800, height: 600 }
      });

      const result = await enforcer.enforceWhitelist('/test/image.jpg', {
        allowedFormats: ['jpeg'],
        deepValidation: true
      });

      expect(result.allowed).toBe(true);
      expect(mockImageValidator.validateImage).toHaveBeenCalled();
    });

    it('should reject corrupted images when deep validation is enabled', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 });
      
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      mockFs.readFile.mockResolvedValue(jpegBuffer);

      mockImageValidator.validateImage.mockResolvedValue({
        valid: false,
        errors: ['Image appears corrupted']
      });

      const result = await enforcer.enforceWhitelist('/test/corrupt.jpg', {
        allowedFormats: ['jpeg'],
        deepValidation: true
      });

      expect(result.allowed).toBe(false);
      expect(result.errors).toContain('Image appears corrupted');
    });
  });

  describe('checkExtension', () => {
    it('should accept valid extensions', () => {
      const result = enforcer.checkExtension('/test/image.jpg', ['jpeg'], enforcer.defaultAllowedFormats);

      expect(result.allowed).toBe(true);
      expect(result.format).toBe('jpeg');
    });

    it('should reject invalid extensions', () => {
      const result = enforcer.checkExtension('/test/image.xyz', ['jpeg'], enforcer.defaultAllowedFormats);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Extension .xyz is not allowed');
    });

    it('should warn about ambiguous extensions', () => {
      const result = enforcer.checkExtension('/test/image.tiff', ['tiff'], enforcer.defaultAllowedFormats);

      expect(result.allowed).toBe(true);
      expect(result.format).toBe('tiff');
    });
  });

  describe('detectPolyglot', () => {
    it('should detect embedded format signatures', async () => {
      // Create buffer with JPEG signature embedded after some data
      const polyglotBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG header
        Buffer.from(Array(100).fill(0x00)), // Padding
        Buffer.from([0xFF, 0xD8, 0xFF]) // JPEG signature embedded
      ]);
      
      mockFs.readFile.mockResolvedValue(polyglotBuffer);

      const result = await enforcer.detectPolyglot('/test/polyglot.png', enforcer.defaultAllowedFormats);

      expect(result.isPolyglot).toBe(true);
      expect(result.details).toContain('jpeg signature found at offset');
    });

    it('should detect suspicious archive patterns', async () => {
      const suspiciousBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG header
        Buffer.from('PK'), // ZIP signature
        Buffer.from(Array(100).fill(0x00))
      ]);
      
      mockFs.readFile.mockResolvedValue(suspiciousBuffer);

      const result = await enforcer.detectPolyglot('/test/suspicious.png', enforcer.defaultAllowedFormats);

      expect(result.isPolyglot).toBe(false);
      expect(result.warning).toContain('Suspicious pattern detected: ZIP archive signature');
    });

    it('should not flag normal files as polyglots', async () => {
      const normalBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      mockFs.readFile.mockResolvedValue(normalBuffer);

      const result = await enforcer.detectPolyglot('/test/normal.png', enforcer.defaultAllowedFormats);

      expect(result.isPolyglot).toBe(false);
    });
  });

  describe('validateMagicBytes', () => {
    it('should validate PNG magic bytes', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      mockFs.readFile.mockResolvedValue(pngBuffer);

      const result = await enforcer.validateMagicBytes('/test/image.png', ['png'], enforcer.defaultAllowedFormats);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('png');
    });

    it('should validate GIF magic bytes', async () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      mockFs.readFile.mockResolvedValue(gifBuffer);

      const result = await enforcer.validateMagicBytes('/test/image.gif', ['gif'], enforcer.defaultAllowedFormats);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('gif');
    });

    it('should reject files with no matching magic bytes', async () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      mockFs.readFile.mockResolvedValue(invalidBuffer);

      const result = await enforcer.validateMagicBytes('/test/invalid.jpg', ['jpeg'], enforcer.defaultAllowedFormats);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No matching magic bytes found for allowed formats');
    });

    it('should reject files that are too small', async () => {
      const tinyBuffer = Buffer.from([0xFF, 0xD8]);
      mockFs.readFile.mockResolvedValue(tinyBuffer);

      const result = await enforcer.validateMagicBytes('/test/tiny.jpg', ['jpeg'], enforcer.defaultAllowedFormats);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File too small for magic byte validation');
    });
  });

  describe('custom formats', () => {
    it('should allow adding custom formats', () => {
      const customFormat = {
        extensions: ['.custom'],
        mimeTypes: ['image/custom'],
        magicBytes: [[0xCA, 0xFE, 0xBA, 0xBE]],
        maxSize: 10 * 1024 * 1024
      };

      enforcer.addCustomFormat('custom', customFormat);

      const definition = enforcer.getFormatDefinition('custom');
      expect(definition).toBeDefined();
      expect(definition.extensions).toContain('.custom');
    });

    it('should validate custom format definitions', () => {
      const invalidFormat = {
        extensions: ['.invalid']
        // Missing required fields
      };

      expect(() => {
        enforcer.addCustomFormat('invalid', invalidFormat);
      }).toThrow('Custom format invalid missing required field: mimeTypes');
    });
  });

  describe('utility methods', () => {
    it('should return default formats', () => {
      const formats = enforcer.getDefaultFormats();
      
      expect(formats).toContain('jpeg');
      expect(formats).toContain('png');
      expect(formats).toContain('webp');
    });

    it('should return format definitions', () => {
      const jpegDef = enforcer.getFormatDefinition('jpeg');
      
      expect(jpegDef).toBeDefined();
      expect(jpegDef.extensions).toContain('.jpg');
      expect(jpegDef.mimeTypes).toContain('image/jpeg');
    });

    it('should return null for unknown formats', () => {
      const unknownDef = enforcer.getFormatDefinition('unknown');
      
      expect(unknownDef).toBeNull();
    });
  });
});