const fs = require('fs').promises;
const path = require('path');

class ErrorRecoveryManager {
  constructor(options = {}) {
    this.continueOnError = options.continueOnError || false;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.exponentialBackoff = options.exponentialBackoff !== false;
    this.stateFile = options.stateFile || '.image-optimization-state.json';
    this.errorLog = options.errorLog || 'image-optimization-errors.log';
    this.errors = [];
    this.processedFiles = new Map();
  }

  async processWithRecovery(operation, context) {
    let lastError;
    const retryableErrors = ['ENOENT', 'EBUSY', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'];
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        return { success: true, result, attempts: attempt };
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = retryableErrors.includes(error.code) || 
                          (error.message && error.message.includes('LFS'));
        
        if (!isRetryable || attempt === this.maxRetries) {
          // Log the error
          await this.logError(context.file, error, { ...context, attempt });
          
          if (this.continueOnError) {
            return { success: false, error, attempts: attempt };
          } else {
            throw error;
          }
        }
        
        // Calculate delay with exponential backoff
        const delay = this.exponentialBackoff 
          ? this.retryDelay * Math.pow(2, attempt - 1)
          : this.retryDelay;
          
        console.log(`Retry attempt ${attempt}/${this.maxRetries} for ${context.file} after ${delay}ms...`);
        await this.sleep(delay);
      }
    }
    
    return { success: false, error: lastError, attempts: this.maxRetries };
  }

  async logError(file, error, context) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      file,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context: {
        ...context,
        retryCount: context.attempt || 0
      }
    };
    
    this.errors.push(errorEntry);
    
    // Append to error log file
    try {
      const logLine = JSON.stringify(errorEntry) + '\n';
      await fs.appendFile(this.errorLog, logLine);
    } catch (logError) {
      console.error('Failed to write to error log:', logError.message);
    }
  }

  async saveState(state) {
    const stateData = {
      version: '1.0',
      startedAt: state.startedAt || new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      configuration: state.configuration || {},
      progress: {
        total: state.total || 0,
        processed: this.processedFiles.size,
        succeeded: Array.from(this.processedFiles.values()).filter(f => f.status === 'success').length,
        failed: Array.from(this.processedFiles.values()).filter(f => f.status === 'failed').length,
        remaining: state.total - this.processedFiles.size
      },
      files: {
        processed: Array.from(this.processedFiles.entries()).map(([path, data]) => ({
          path,
          ...data
        })),
        pending: state.pending || []
      }
    };

    try {
      await fs.writeFile(this.stateFile, JSON.stringify(stateData, null, 2));
    } catch (error) {
      console.error('Failed to save state:', error.message);
    }
  }

  async loadState() {
    try {
      const stateData = await fs.readFile(this.stateFile, 'utf8');
      const state = JSON.parse(stateData);
      
      // Validate state version
      if (state.version !== '1.0') {
        console.warn('State file version mismatch, ignoring saved state');
        return null;
      }
      
      // Restore processed files
      if (state.files && state.files.processed) {
        state.files.processed.forEach(file => {
          this.processedFiles.set(file.path, {
            status: file.status,
            error: file.error,
            outputs: file.outputs
          });
        });
      }
      
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // No state file exists
      }
      console.error('Failed to load state:', error.message);
      return null;
    }
  }

  async clearState() {
    try {
      await fs.unlink(this.stateFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to clear state:', error.message);
      }
    }
  }

  recordProcessedFile(filePath, result) {
    this.processedFiles.set(filePath, result);
  }

  isFileProcessed(filePath) {
    return this.processedFiles.has(filePath);
  }

  generateReport() {
    const succeeded = Array.from(this.processedFiles.values()).filter(f => f.status === 'success').length;
    const failed = Array.from(this.processedFiles.values()).filter(f => f.status === 'failed').length;
    
    return {
      summary: {
        total: this.processedFiles.size,
        succeeded,
        failed,
        successRate: this.processedFiles.size > 0 ? (succeeded / this.processedFiles.size * 100).toFixed(1) + '%' : '0%'
      },
      errors: this.errors,
      errorLogPath: this.errorLog
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ErrorRecoveryManager;