const ImageOptimizer = require('../../src/image-optimizer');

describe('ImageOptimizer', () => {
  let optimizer;
  let mockDependencies;

  beforeEach(() => {
    mockDependencies = {
      gitLfsDetector: {
        isGitLfsPointer: jest.fn().mockResolvedValue(false)
      },
      gitLfsPuller: {
        pullFile: jest.fn().mockResolvedValue({ success: true })
      },
      timestampChecker: {
        shouldProcess: jest.fn().mockResolvedValue(true)
      },
      imageProcessor: {
        processImage: jest.fn().mockResolvedValue([{ success: true }])
      },
      pathGenerator: {
        outputDir: '/output',
        generatePaths: jest.fn().mockReturnValue({
          webp: '/output/test.webp',
          avif: '/output/test.avif',
          original: '/output/test.png',
          thumbnail: '/output/test-thumb.webp'
        }),
        getProcessingConfigs: jest.fn().mockReturnValue([])
      },
      fileOperations: {
        copyFile: jest.fn().mockResolvedValue()
      },
      logger: {
        log: jest.fn(),
        error: jest.fn()
      }
    };
    
    optimizer = new ImageOptimizer(mockDependencies);
  });

  describe('optimizeImage', () => {
    it('should skip git-lfs pointer files when pullLfs is false', async () => {
      mockDependencies.gitLfsDetector.isGitLfsPointer.mockResolvedValue(true);
      
      const result = await optimizer.optimizeImage('/input/file.png', 'file.png', { pullLfs: false });
      
      expect(result).toBe('lfs-pointer');
      expect(mockDependencies.logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Git LFS pointer file')
      );
      expect(mockDependencies.gitLfsPuller.pullFile).not.toHaveBeenCalled();
    });

    it('should pull git-lfs files when pullLfs is true', async () => {
      mockDependencies.gitLfsDetector.isGitLfsPointer
        .mockResolvedValueOnce(true)  // First check: is pointer
        .mockResolvedValueOnce(false); // After pull: not pointer
      
      const result = await optimizer.optimizeImage('/input/file.png', 'file.png', { pullLfs: true });
      
      expect(mockDependencies.gitLfsPuller.pullFile).toHaveBeenCalledWith('/input/file.png');
      expect(result).toBe('processed');
    });

    it('should handle failed git-lfs pulls', async () => {
      mockDependencies.gitLfsDetector.isGitLfsPointer.mockResolvedValue(true);
      mockDependencies.gitLfsPuller.pullFile.mockResolvedValue({ 
        success: false, 
        error: 'Object not found' 
      });
      
      const result = await optimizer.optimizeImage('/input/file.png', 'file.png', { pullLfs: true });
      
      expect(result).toBe('lfs-error');
      expect(mockDependencies.logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Error pulling LFS file')
      );
    });

    it('should skip files that are already up to date', async () => {
      mockDependencies.timestampChecker.shouldProcess.mockResolvedValue(false);
      
      const result = await optimizer.optimizeImage('/input/file.png', 'file.png');
      
      expect(result).toBe('skipped');
      expect(mockDependencies.imageProcessor.processImage).not.toHaveBeenCalled();
    });

    it('should copy GIF files without processing', async () => {
      const result = await optimizer.optimizeImage('/input/animation.gif', 'animation.gif');
      
      expect(result).toBe('processed');
      expect(mockDependencies.fileOperations.copyFile).toHaveBeenCalledWith(
        '/input/animation.gif',
        'optimized/animation.gif'
      );
      expect(mockDependencies.imageProcessor.processImage).not.toHaveBeenCalled();
    });

    it('should process WebP input files correctly', async () => {
      const result = await optimizer.optimizeImage('/input/image.webp', 'image.webp');
      
      expect(result).toBe('processed');
      expect(mockDependencies.imageProcessor.processImage).toHaveBeenCalled();
      expect(mockDependencies.imageProcessor.processImage.mock.calls[0][1]).toHaveLength(2);
    });

    it('should handle processing errors', async () => {
      mockDependencies.imageProcessor.processImage.mockRejectedValue(new Error('Sharp error'));
      
      const result = await optimizer.optimizeImage('/input/file.png', 'file.png');
      
      expect(result).toBe('error');
      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing file.png')
      );
    });

    it('should process normal images with all formats', async () => {
      const result = await optimizer.optimizeImage('/input/photo.jpg', 'photo.jpg');
      
      expect(result).toBe('processed');
      expect(mockDependencies.imageProcessor.processImage).toHaveBeenCalled();
      expect(mockDependencies.logger.log).toHaveBeenCalledWith('✅ Optimized photo.jpg');
    });
  });
});