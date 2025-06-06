const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const sharp = require('sharp');

describe('Progress Bar E2E', () => {
  let testDir;
  const scriptPath = path.join(__dirname, '..', 'scripts', 'optimize-images.js');
  
  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `progress-bar-e2e-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Create directories
    await fs.mkdir('original', { recursive: true });
    await fs.mkdir('optimized', { recursive: true });
  });
  
  afterEach(async () => {
    process.chdir(__dirname);
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  describe('Progress bar display', () => {
    beforeEach(async () => {
      // Create test images
      for (let i = 0; i < 5; i++) {
        const image = await sharp({
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 255, g: 0, b: 0 }
          }
        })
        .png()
        .toBuffer();
        
        await fs.writeFile(path.join('original', `test${i}.png`), image);
      }
    });
    
    it('should show progress bar in TTY mode', async () => {
      // Note: This is hard to test as we're not in a real TTY
      // We'll just verify it doesn't crash and processes images
      const result = execSync(`node ${scriptPath}`, { 
        encoding: 'utf8',
        env: { ...process.env, FORCE_COLOR: '1' }
      });
      
      expect(result).toContain('Optimization complete!');
      expect(result).toContain('Processed: 5 images');
      
      // Check files were created
      const files = await fs.readdir('optimized');
      expect(files.length).toBeGreaterThan(5); // Images + thumbnails
    });
    
    it('should respect --quiet flag', async () => {
      const result = execSync(`node ${scriptPath} --quiet`, { 
        encoding: 'utf8'
      });
      
      // Should have minimal output
      expect(result).toBe('');
      
      // But files should still be processed
      const files = await fs.readdir('optimized');
      expect(files.length).toBeGreaterThan(5);
    });
    
    it('should work with --continue-on-error', async () => {
      // Add a corrupted image
      await fs.writeFile(path.join('original', 'corrupted.png'), Buffer.from('not an image'));
      
      const result = execSync(`node ${scriptPath} --continue-on-error`, { 
        encoding: 'utf8'
      });
      
      expect(result).toContain('Processed: 5 images');
      expect(result).toContain('Errors: 1 images');
    });
  });
  
  describe('Non-TTY mode', () => {
    it('should fall back to periodic updates in non-TTY', async () => {
      // Create 15 images to trigger periodic updates
      for (let i = 0; i < 15; i++) {
        const image = await sharp({
          create: {
            width: 10,
            height: 10,
            channels: 3,
            background: { r: 0, g: 255, b: 0 }
          }
        })
        .png()
        .toBuffer();
        
        await fs.writeFile(path.join('original', `image${i}.png`), image);
      }
      
      // Simulate non-TTY by piping through cat
      const result = execSync(`node ${scriptPath} | cat`, { 
        encoding: 'utf8',
        shell: true
      });
      
      // Should show initial message
      expect(result).toContain('Found 15 images to process...');
      
      // Should show completion
      expect(result).toContain('Optimization complete!');
      expect(result).toContain('Processed: 15 images');
    });
  });
  
  describe('Progress with resume', () => {
    it('should show correct progress when resuming', async () => {
      // Create images
      for (let i = 0; i < 10; i++) {
        const image = await sharp({
          create: {
            width: 50,
            height: 50,
            channels: 3,
            background: { r: 0, g: 0, b: 255 }
          }
        })
        .png()
        .toBuffer();
        
        await fs.writeFile(path.join('original', `pic${i}.png`), image);
      }
      
      // First run - process only some files
      execSync(`node ${scriptPath} --continue-on-error`, { encoding: 'utf8' });
      
      // Delete some output files to simulate partial completion
      const outputFiles = await fs.readdir('optimized');
      const filesToDelete = outputFiles.slice(0, 5);
      for (const file of filesToDelete) {
        await fs.unlink(path.join('optimized', file));
      }
      
      // Resume with progress
      const result = execSync(`node ${scriptPath} --resume`, { 
        encoding: 'utf8'
      });
      
      expect(result).toContain('Resuming from previous state');
      expect(result).toContain('Optimization complete!');
    });
  });
  
  describe('Performance', () => {
    it('should handle large batches efficiently', async () => {
      // Create 50 small images
      const imagePromises = [];
      for (let i = 0; i < 50; i++) {
        const promise = sharp({
          create: {
            width: 20,
            height: 20,
            channels: 3,
            background: { 
              r: Math.floor(Math.random() * 256),
              g: Math.floor(Math.random() * 256),
              b: Math.floor(Math.random() * 256)
            }
          }
        })
        .png()
        .toBuffer()
        .then(buffer => fs.writeFile(path.join('original', `perf${i}.png`), buffer));
        
        imagePromises.push(promise);
      }
      
      await Promise.all(imagePromises);
      
      const startTime = Date.now();
      
      execSync(`node ${scriptPath} --quiet`, { encoding: 'utf8' });
      
      const elapsed = Date.now() - startTime;
      
      // Should complete reasonably quickly (adjust threshold as needed)
      expect(elapsed).toBeLessThan(30000); // 30 seconds for 50 images
      
      // All images should be processed
      const files = await fs.readdir('optimized');
      const webpFiles = files.filter(f => f.endsWith('.webp') && !f.includes('thumb'));
      expect(webpFiles.length).toBe(50);
    });
  });
});