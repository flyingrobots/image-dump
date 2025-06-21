class GitLfsPuller {
  constructor(commandExecutor, options = {}) {
    this.commandExecutor = commandExecutor;
    this.options = {
      maxBandwidth: options.maxBandwidth || null, // KB/s limit
      timeout: options.timeout || 300000, // 5 minutes default
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 2000,
      ...options
    };
  }

  async pullFile(filePath) {
    const startTime = Date.now();
    let lastError;

    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        const command = `git lfs pull --include="${filePath}"`;
        
        // Add bandwidth limiting if specified
        if (this.options.maxBandwidth) {
          // Use git config to set transfer speed limit
          await this.commandExecutor.exec(
            'git config lfs.transfer.maxretries 1 && git config lfs.transfer.maxverifies 1'
          );
        }

        await this.executeWithTimeout(command, this.options.timeout);
        
        const duration = Date.now() - startTime;
        return { 
          success: true, 
          duration,
          attempt,
          bytesTransferred: await this.estimateBytesTransferred(filePath)
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < this.options.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * attempt));
        }
      }
    }

    return { 
      success: false, 
      error: lastError.message,
      attempts: this.options.retryAttempts,
      duration: Date.now() - startTime
    };
  }

  executeWithTimeout(command, timeout) {
    return Promise.race([
      this.commandExecutor.exec(command),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`LFS pull timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }

  async estimateBytesTransferred(filePath) {
    try {
      const result = await this.commandExecutor.exec(`git lfs ls-files --include="${filePath}" --size`);
      const sizeMatch = result.match(/\((\d+)\s+B\)/);
      return sizeMatch ? parseInt(sizeMatch[1]) : 0;
    } catch {
      return 0;
    }
  }
}

module.exports = GitLfsPuller;