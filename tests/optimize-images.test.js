const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const sharp = require('sharp');

describe('optimize-images.js', () => {
  const testDir = path.join(os.tmpdir(), `image-dump-test-${Date.now()}`);
  const inputDir = path.join(testDir, 'original');
  const outputDir = path.join(testDir, 'optimized');
  const scriptPath = path.join(__dirname, '../scripts/optimize-images.js');

  beforeEach(async () => {
    // Clean up test directories
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const runScript = (args = '', env = {}) => {
    const originalDir = process.cwd();
    try {
      process.chdir(testDir);
      const result = execSync(`node ${scriptPath} ${args} 2>&1`, {
        env: { ...process.env, ...env },
        encoding: 'utf8',
        shell: true
      });
      return { output: result, exitCode: 0 };
    } catch (error) {
      return { 
        output: error.stdout || error.stderr || error.message,
        exitCode: error.status || 1
      };
    } finally {
      process.chdir(originalDir);
    }
  };

  test('should process valid PNG image without metadata errors', async () => {
    // Create a test PNG image
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    })
    .png()
    .toFile(path.join(inputDir, 'test.png'));

    const result = runScript();
    
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✅ Optimized test.png');
    expect(result.output).toContain('Processed: 1 images');
    
    // Check output files exist
    const outputFiles = await fs.readdir(outputDir);
    expect(outputFiles).toContain('test.png');
    expect(outputFiles).toContain('test.webp');
    expect(outputFiles).toContain('test.avif');
    expect(outputFiles).toContain('test-thumb.webp');
  });

  test('should exit with error code when processing fails', async () => {
    // Create an invalid/corrupt image file
    await fs.writeFile(path.join(inputDir, 'corrupt.png'), 'not a real png file');

    const result = runScript();
    
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('❌ Error processing corrupt.png');
    expect(result.output).toContain('Errors: 1 images');
  });

  test('should skip already processed images', async () => {
    // Create a test image
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 }
      }
    })
    .png()
    .toFile(path.join(inputDir, 'test.png'));

    // First run
    runScript();
    
    // Second run should skip
    const result = runScript();
    
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('⏭️  Skipping test.png (already up to date)');
    expect(result.output).toContain('Skipped: 1 images');
  });

  test('should force reprocess with --force flag', async () => {
    // Create a test image
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 }
      }
    })
    .png()
    .toFile(path.join(inputDir, 'test.png'));

    // First run
    runScript();
    
    // Second run with force should reprocess
    const result = runScript('--force');
    
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✅ Optimized test.png');
    expect(result.output).toContain('Processed: 1 images');
  });

  test('should handle multiple images with mixed results', async () => {
    // Create valid image
    await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 255, g: 255, b: 0, alpha: 1 }
      }
    })
    .png()
    .toFile(path.join(inputDir, 'valid.png'));

    // Create corrupt image
    await fs.writeFile(path.join(inputDir, 'corrupt.jpg'), 'not a real jpg');

    const result = runScript();
    
    expect(result.exitCode).toBe(1); // Should fail due to error
    expect(result.output).toContain('✅ Optimized valid.png');
    expect(result.output).toContain('❌ Error processing corrupt.jpg');
    expect(result.output).toContain('Processed: 1 images');
    expect(result.output).toContain('Errors: 1 images');
  });

  test('should handle WebP input files', async () => {
    // Create a test WebP image
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 }
      }
    })
    .webp()
    .toFile(path.join(inputDir, 'test.webp'));

    // Create config to only generate WebP format
    await fs.writeFile(
      path.join(testDir, '.imagerc'),
      JSON.stringify({
        formats: ['webp', 'original'],
        generateThumbnails: true
      })
    );

    const result = runScript();
    
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✅ Optimized test.webp');
    
    // Check output files
    const outputFiles = await fs.readdir(outputDir);
    expect(outputFiles).toContain('test.webp');
    expect(outputFiles).toContain('test-thumb.webp');
  });

  test('should copy GIF files without optimization', async () => {
    // Create a simple GIF file (just a valid header for testing)
    const gifHeader = Buffer.from('GIF89a', 'ascii');
    await fs.writeFile(path.join(inputDir, 'test.gif'), gifHeader);

    const result = runScript();
    
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✅ Copied test.gif (GIF files are not optimized)');
    
    // Check that GIF was copied
    const outputFiles = await fs.readdir(outputDir);
    expect(outputFiles).toContain('test.gif');
  });
});