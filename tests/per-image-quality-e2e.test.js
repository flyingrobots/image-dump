const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const sharp = require('sharp');

describe('Per-Image Quality E2E', () => {
  let testDir;
  const scriptPath = path.join(__dirname, '..', 'scripts', 'optimize-images.js');
  const realImagePath = path.join(__dirname, '..', 'original', 'james.png'); // Use a real image
  
  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `per-image-quality-e2e-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Create directories
    await fs.mkdir('original', { recursive: true });
    await fs.mkdir('optimized', { recursive: true });
    await fs.mkdir('original/products', { recursive: true });
    await fs.mkdir('original/heroes', { recursive: true });
  });
  
  afterEach(async () => {
    process.chdir(__dirname);
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  describe('Pattern-based quality rules', () => {
    beforeEach(async () => {
      // Create config with quality rules
      const config = {
        formats: ['webp'],
        quality: {
          webp: 70  // Default quality
        },
        qualityRules: [
          {
            pattern: '*-hero.*',
            quality: { webp: 95 }
          },
          {
            pattern: '*-thumb.*',
            quality: { webp: 50 }
          }
        ]
      };
      
      await fs.writeFile('.imagerc', JSON.stringify(config, null, 2));
      
      // Copy real image to test locations
      await fs.copyFile(realImagePath, 'original/regular.png');
      await fs.copyFile(realImagePath, 'original/banner-hero.png');
      await fs.copyFile(realImagePath, 'original/product-thumb.png');
    });
    
    it('should apply different quality based on filename patterns', async () => {
      execSync(`node ${scriptPath}`, { encoding: 'utf8' });
      
      // Check file sizes - higher quality = larger file
      const regularSize = (await fs.stat('optimized/regular.webp')).size;
      const heroSize = (await fs.stat('optimized/banner-hero.webp')).size;
      const thumbSize = (await fs.stat('optimized/product-thumb.webp')).size;
      
      // Hero should be larger than regular (95 vs 70 quality)
      expect(heroSize).toBeGreaterThan(regularSize);
      // Thumb should be smaller than regular (50 vs 70 quality)
      expect(thumbSize).toBeLessThan(regularSize);
    });
  });
  
  describe('Directory-based quality rules', () => {
    beforeEach(async () => {
      const config = {
        formats: ['webp'],
        quality: {
          webp: 80
        },
        qualityRules: [
          {
            directory: 'products/',
            quality: { webp: 60 }
          },
          {
            directory: 'heroes/',
            quality: { webp: 90 }
          }
        ]
      };
      
      await fs.writeFile('.imagerc', JSON.stringify(config, null, 2));
      
      // Copy real image to test locations
      await fs.copyFile(realImagePath, 'original/regular.png');
      await fs.copyFile(realImagePath, 'original/products/widget.png');
      await fs.copyFile(realImagePath, 'original/heroes/banner.png');
    });
    
    it('should apply quality based on directory', async () => {
      execSync(`node ${scriptPath}`, { encoding: 'utf8' });
      
      const regularSize = (await fs.stat('optimized/regular.webp')).size;
      const productSize = (await fs.stat('optimized/products/widget.webp')).size;
      const heroSize = (await fs.stat('optimized/heroes/banner.webp')).size;
      
      // Hero should be largest (90 quality)
      expect(heroSize).toBeGreaterThan(regularSize);
      // Product should be smallest (60 quality)  
      expect(productSize).toBeLessThan(regularSize);
    });
  });
  
  describe('Size-based quality rules', () => {
    beforeEach(async () => {
      const config = {
        formats: ['webp'],
        quality: {
          webp: 70
        },
        qualityRules: [
          {
            minWidth: 2000,
            quality: { webp: 90 }
          },
          {
            maxWidth: 500,
            quality: { webp: 50 }
          }
        ]
      };
      
      await fs.writeFile('.imagerc', JSON.stringify(config, null, 2));
      
      // Create images of different sizes from the real image
      const smallImage = await sharp(realImagePath)
        .resize(300, 300)
        .png()
        .toBuffer();
      
      const mediumImage = await sharp(realImagePath)
        .resize(1000, 1000)
        .png()
        .toBuffer();
      
      const largeImage = await sharp(realImagePath)
        .resize(3000, 2000)
        .png()
        .toBuffer();
      
      await fs.writeFile('original/small.png', smallImage);
      await fs.writeFile('original/medium.png', mediumImage);
      await fs.writeFile('original/large.png', largeImage);
    });
    
    it('should apply quality based on image dimensions', async () => {
      execSync(`node ${scriptPath}`, { encoding: 'utf8' });
      
      const smallSize = (await fs.stat('optimized/small.webp')).size;
      const mediumSize = (await fs.stat('optimized/medium.webp')).size;
      const largeSize = (await fs.stat('optimized/large.webp')).size;
      
      // Large should have higher quality/size than medium
      expect(largeSize).toBeGreaterThan(mediumSize);
      
      // Small should have lower quality than medium
      expect(smallSize).toBeLessThan(mediumSize);
    });
  });
  
  describe('Combined rules', () => {
    beforeEach(async () => {
      const config = {
        formats: ['webp'],
        quality: {
          webp: 70
        },
        qualityRules: [
          {
            pattern: '*-hero.*',
            directory: 'marketing/',
            quality: { webp: 95 }
          },
          {
            pattern: '*-hero.*',
            quality: { webp: 85 }
          },
          {
            directory: 'marketing/',
            quality: { webp: 80 }
          }
        ]
      };
      
      await fs.writeFile('.imagerc', JSON.stringify(config, null, 2));
      
      await fs.mkdir('original/marketing', { recursive: true });
      
      // Copy real image to test locations
      await fs.copyFile(realImagePath, 'original/page-hero.png');
      await fs.copyFile(realImagePath, 'original/marketing/banner-hero.png');
      await fs.copyFile(realImagePath, 'original/marketing/regular.png');
    });
    
    it('should apply most specific rule', async () => {
      const result = execSync(`node ${scriptPath}`, { encoding: 'utf8' });
      
      // Should see custom quality messages
      expect(result).toContain('Applying custom quality');
      
      const heroSize = (await fs.stat('optimized/page-hero.webp')).size;
      const marketingHeroSize = (await fs.stat('optimized/marketing/banner-hero.webp')).size;
      const marketingRegularSize = (await fs.stat('optimized/marketing/regular.webp')).size;
      
      // marketing/banner-hero should have highest quality (95)
      expect(marketingHeroSize).toBeGreaterThan(heroSize);
      expect(marketingHeroSize).toBeGreaterThan(marketingRegularSize);
      
      // page-hero should have 85 quality
      expect(heroSize).toBeGreaterThan(marketingRegularSize);
    });
  });
  
  describe('Debug output', () => {
    it('should show which rules are being applied', async () => {
      const config = {
        formats: ['webp'],
        quality: { webp: 70 },
        qualityRules: [
          {
            pattern: '*-special.*',
            quality: { webp: 90 }
          }
        ]
      };
      
      await fs.writeFile('.imagerc', JSON.stringify(config, null, 2));
      
      // Copy real image for testing
      await fs.copyFile(realImagePath, 'original/image-special.png');
      
      const result = execSync(`node ${scriptPath}`, { encoding: 'utf8' });
      
      // Check for the custom quality message
      expect(result).toContain('Applying custom quality for image-special.png');
      expect(result).toContain('pattern: *-special.*');
    });
  });
});