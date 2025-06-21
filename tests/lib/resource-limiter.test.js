const ResourceLimiter = require('../../src/resource-limiter');

describe('ResourceLimiter', () => {
  let limiter;
  let mockProcess;
  let mockFs;

  beforeEach(() => {
    mockProcess = {
      cwd: jest.fn(() => '/test'),
      memoryUsage: jest.fn(() => ({
        rss: 50 * 1024 * 1024,
        heapTotal: 40 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024,
        external: 5 * 1024 * 1024
      })),
      cpuUsage: jest.fn(() => ({
        user: 1000000,
        system: 500000
      }))
    };

    mockFs = {
      stat: jest.fn(() => Promise.resolve({ size: 1000 }))
    };

    // Mock os.totalmem()
    jest.doMock('os', () => ({
      totalmem: () => 8 * 1024 * 1024 * 1024 // 8GB
    }));

    limiter = new ResourceLimiter({
      process: mockProcess,
      fs: mockFs,
      monitoring: false,
      limits: {
        maxMemoryPerImage: 100 * 1024 * 1024, // 100MB
        maxCpuTimePerImage: 5000, // 5 seconds
        maxConcurrentProcesses: 2
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('withResourceLimits', () => {
    it('should execute operation successfully within limits', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await limiter.withResourceLimits(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should enforce CPU time limits', async () => {
      const operation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds
      });

      await expect(limiter.withResourceLimits(operation, { maxCpuTime: 1000 }))
        .rejects.toThrow('CPU time limit exceeded: 1000ms');
    }, 10000); // 10 second timeout for test

    it('should enforce memory limits', async () => {
      let memoryCallCount = 0;
      mockProcess.memoryUsage.mockImplementation(() => {
        memoryCallCount++;
        const baseMemory = 30 * 1024 * 1024;
        const excessMemory = memoryCallCount > 3 ? 200 * 1024 * 1024 : 0; // Exceed after 3 calls
        
        return {
          rss: 50 * 1024 * 1024,
          heapTotal: 40 * 1024 * 1024,
          heapUsed: baseMemory + excessMemory,
          external: 5 * 1024 * 1024
        };
      });

      const operation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 500)); // 500ms to allow memory checks
      });

      await expect(limiter.withResourceLimits(operation, { maxMemory: 100 * 1024 * 1024 }))
        .rejects.toThrow(/Memory limit exceeded/);
    });

    it('should enforce concurrency limits', async () => {
      const operation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200)); // Longer delay
      });

      // Start 2 operations (at the limit)
      const promise1 = limiter.withResourceLimits(operation);
      const promise2 = limiter.withResourceLimits(operation);

      // Wait a bit for operations to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Third operation should be rejected
      await expect(limiter.withResourceLimits(operation))
        .rejects.toThrow('Concurrency limit exceeded: 2 >= 2');

      // Wait for first two to complete
      await Promise.all([promise1, promise2]);
    });

    it('should handle operation failures gracefully', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(limiter.withResourceLimits(operation))
        .rejects.toThrow('Operation failed');
    });

    it('should clean up resources after operation completes', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const initialActiveProcesses = limiter.activeProcesses.size;
      await limiter.withResourceLimits(operation);
      const finalActiveProcesses = limiter.activeProcesses.size;

      expect(finalActiveProcesses).toBe(initialActiveProcesses);
    });

    it('should clean up resources after operation fails', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const initialActiveProcesses = limiter.activeProcesses.size;
      
      try {
        await limiter.withResourceLimits(operation);
      } catch {
        // Expected to fail
      }
      
      const finalActiveProcesses = limiter.activeProcesses.size;
      expect(finalActiveProcesses).toBe(initialActiveProcesses);
    });
  });

  describe('checkSystemResources', () => {
    it('should pass when system resources are within limits', async () => {
      // Mock low memory usage
      mockProcess.memoryUsage.mockReturnValue({
        rss: 50 * 1024 * 1024,
        heapTotal: 40 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024, // 30MB of 8GB = very low usage
        external: 5 * 1024 * 1024
      });

      await expect(limiter.checkSystemResources()).resolves.not.toThrow();
    });

    it('should reject when system memory usage is too high', async () => {
      // Mock high memory usage
      mockProcess.memoryUsage.mockReturnValue({
        rss: 7 * 1024 * 1024 * 1024, // 7GB RSS
        heapTotal: 6 * 1024 * 1024 * 1024,
        heapUsed: 5 * 1024 * 1024 * 1024, // 5GB heap of 8GB total = 62.5%
        external: 2 * 1024 * 1024 * 1024 // 2GB external = total 7GB/8GB = 87.5% > 80%
      });

      await expect(limiter.checkSystemResources())
        .rejects.toThrow(/System memory threshold exceeded/);
    });
  });

  describe('getResourceUsage', () => {
    it('should return current resource usage', () => {
      const usage = limiter.getResourceUsage();

      expect(usage).toHaveProperty('activeProcesses');
      expect(usage).toHaveProperty('maxConcurrentProcesses');
      expect(usage).toHaveProperty('memoryUsage');
      expect(usage.maxConcurrentProcesses).toBe(2);
    });
  });

  describe('updateLimits', () => {
    it('should update resource limits', () => {
      const newLimits = {
        maxMemoryPerImage: 200 * 1024 * 1024,
        maxConcurrentProcesses: 8
      };

      limiter.updateLimits(newLimits);

      expect(limiter.limits.maxMemoryPerImage).toBe(200 * 1024 * 1024);
      expect(limiter.limits.maxConcurrentProcesses).toBe(8);
      expect(limiter.limits.maxCpuTimePerImage).toBe(5000); // Should remain unchanged
    });
  });

  describe('monitoring', () => {
    it('should start and stop monitoring', () => {
      const limiterWithMonitoring = new ResourceLimiter({
        process: mockProcess,
        fs: mockFs,
        monitoring: true,
        monitoringInterval: 100
      });

      expect(limiterWithMonitoring.monitoringInterval).toBeDefined();

      limiterWithMonitoring.stopMonitoring();
      expect(limiterWithMonitoring.monitoringInterval).toBeNull();
    });

    it('should collect system metrics', () => {
      limiter.collectSystemMetrics();

      expect(limiter.memoryUsageHistory).toHaveLength(1);
      expect(limiter.cpuUsageHistory).toHaveLength(1);
      expect(limiter.memoryUsageHistory[0]).toHaveProperty('timestamp');
      expect(limiter.memoryUsageHistory[0]).toHaveProperty('heapUsed');
    });

    it('should limit history size', () => {
      // Add more than 60 entries
      for (let i = 0; i < 65; i++) {
        limiter.collectSystemMetrics();
      }

      expect(limiter.memoryUsageHistory).toHaveLength(60);
      expect(limiter.cpuUsageHistory).toHaveLength(60);
    });
  });

  describe('gracefulShutdown', () => {
    it('should wait for active processes to complete', async () => {
      const operation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 50));
      });

      // Start an operation
      const operationPromise = limiter.withResourceLimits(operation);

      // Start shutdown
      const shutdownPromise = limiter.gracefulShutdown();

      // Wait for both to complete
      await Promise.all([operationPromise, shutdownPromise]);

      expect(limiter.activeProcesses.size).toBe(0);
    });
  });
});