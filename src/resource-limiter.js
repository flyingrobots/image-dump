const fs = require('fs').promises;

class ResourceLimiter {
  constructor(dependencies = {}) {
    this.fs = dependencies.fs || fs;
    this.process = dependencies.process || process;
    
    this.activeProcesses = new Set();
    this.memoryUsageHistory = [];
    this.cpuUsageHistory = [];
    
    // Default limits
    this.limits = {
      maxMemoryPerImage: 512 * 1024 * 1024, // 512MB per image
      maxCpuTimePerImage: 60000, // 60 seconds
      maxConcurrentProcesses: 4,
      maxDiskSpaceUsage: 10 * 1024 * 1024 * 1024, // 10GB
      memoryThreshold: 0.8, // 80% of available memory
      cpuThreshold: 0.9, // 90% CPU usage
      ...dependencies.limits
    };
    
    this.monitoring = {
      enabled: dependencies.monitoring !== false,
      interval: dependencies.monitoringInterval || 1000 // 1 second
    };
    
    if (this.monitoring.enabled) {
      this.startMonitoring();
    }
  }

  async withResourceLimits(operation, resourceConfig = {}) {
    const config = {
      maxMemory: resourceConfig.maxMemory || this.limits.maxMemoryPerImage,
      maxCpuTime: resourceConfig.maxCpuTime || this.limits.maxCpuTimePerImage,
      ...resourceConfig
    };

    // Check if we can start new process
    this.checkConcurrencyLimits();
    
    // Check system resources
    await this.checkSystemResources();
    
    const processId = this.generateProcessId();
    this.activeProcesses.add(processId);
    
    let memoryInterval;
    const startTime = Date.now();
    let peakMemory = 0;
    let memoryCheckFailed = false;
    let memoryError;
    
    try {
      // Set up memory monitoring
      if (config.maxMemory > 0) {
        memoryInterval = setInterval(() => {
          try {
            const memUsage = this.process.memoryUsage();
            const currentMemory = memUsage.heapUsed + memUsage.external;
            peakMemory = Math.max(peakMemory, currentMemory);
            
            if (currentMemory > config.maxMemory) {
              memoryCheckFailed = true;
              memoryError = new Error(`Memory limit exceeded: ${currentMemory} > ${config.maxMemory}`);
              clearInterval(memoryInterval);
            }
          } catch (error) {
            memoryCheckFailed = true;
            memoryError = error;
            clearInterval(memoryInterval);
          }
        }, 100); // Check every 100ms
      }
      
      // Execute operation with timeout using Promise.race
      const operationPromise = operation();
      
      let result;
      if (config.maxCpuTime > 0) {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`CPU time limit exceeded: ${config.maxCpuTime}ms`));
          }, config.maxCpuTime);
        });
        
        result = await Promise.race([operationPromise, timeoutPromise]);
      } else {
        result = await operationPromise;
      }
      
      // Check if memory limit was exceeded during operation
      if (memoryCheckFailed) {
        throw memoryError;
      }
      
      // Record performance metrics
      const executionTime = Date.now() - startTime;
      this.recordMetrics(processId, {
        executionTime,
        peakMemory,
        success: true
      });
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordMetrics(processId, {
        executionTime,
        peakMemory,
        success: false,
        error: error.message
      });
      
      throw error;
      
    } finally {
      // Clean up
      if (memoryInterval) {
        clearInterval(memoryInterval);
      }
      this.activeProcesses.delete(processId);
    }
  }

  checkConcurrencyLimits() {
    if (this.activeProcesses.size >= this.limits.maxConcurrentProcesses) {
      throw new Error(`Concurrency limit exceeded: ${this.activeProcesses.size} >= ${this.limits.maxConcurrentProcesses}`);
    }
  }

  async checkSystemResources() {
    // Check available memory
    const memUsage = this.process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const usedMemoryRatio = (memUsage.heapUsed + memUsage.external) / totalMemory;
    
    if (usedMemoryRatio > this.limits.memoryThreshold) {
      throw new Error(`System memory threshold exceeded: ${(usedMemoryRatio * 100).toFixed(1)}% > ${(this.limits.memoryThreshold * 100)}%`);
    }
    
    // Check disk space (simplified check)
    await this.checkDiskSpace();
  }

  async checkDiskSpace() {
    try {
      // Get current working directory stats
      await this.fs.stat(this.process.cwd());
      // This is a simplified implementation
      // In a real implementation, you'd use statvfs or similar to get actual disk usage
      // For now, we'll skip disk space checking as it requires platform-specific code
      return true;
    } catch {
      // If we can't check disk space, allow the operation to continue
      return true;
    }
  }

  startMonitoring() {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }
    
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.monitoring.interval);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  collectSystemMetrics() {
    const memUsage = this.process.memoryUsage();
    const cpuUsage = this.process.cpuUsage();
    
    // Store metrics (keep last 60 entries = 1 minute of data at 1s intervals)
    this.memoryUsageHistory.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });
    
    this.cpuUsageHistory.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    // Keep only recent history
    if (this.memoryUsageHistory.length > 60) {
      this.memoryUsageHistory.shift();
    }
    if (this.cpuUsageHistory.length > 60) {
      this.cpuUsageHistory.shift();
    }
  }

  recordMetrics(_processId, _metrics) {
    // In a real implementation, you might want to store these metrics
    // for analysis, alerting, or reporting purposes
    if (this.monitoring.enabled) {
      // Log performance metrics (could be sent to monitoring system)
      // Debug logging would go here if enabled
      // console.debug(`Process ${processId}: ${JSON.stringify(metrics)}`);
    }
  }

  generateProcessId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  getResourceUsage() {
    return {
      activeProcesses: this.activeProcesses.size,
      maxConcurrentProcesses: this.limits.maxConcurrentProcesses,
      memoryUsage: this.process.memoryUsage(),
      memoryHistory: this.memoryUsageHistory.slice(-10), // Last 10 entries
      cpuHistory: this.cpuUsageHistory.slice(-10) // Last 10 entries
    };
  }

  updateLimits(newLimits) {
    this.limits = { ...this.limits, ...newLimits };
  }

  async gracefulShutdown() {
    this.stopMonitoring();
    
    // Wait for active processes to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeProcesses.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeProcesses.size > 0) {
      console.warn(`Shutdown timeout: ${this.activeProcesses.size} processes still active`);
    }
  }
}

module.exports = ResourceLimiter;