const cliProgress = require('cli-progress');
const colors = require('ansi-colors');

class ProgressManager {
  constructor(options = {}) {
    this.total = options.total || 0;
    this.current = 0;
    this.startTime = null;
    this.isQuiet = options.quiet || false;
    this.isTTY = process.stdout.isTTY;
    this.bar = null;
    this.stats = {
      processed: 0,
      skipped: 0,
      errors: 0
    };
    
    // Custom format options
    this.showSpeed = options.showSpeed !== false;
    this.showETA = options.showETA !== false;
    this.compactMode = options.compact || false;
    
    // Detect terminal width for responsive design
    this.terminalWidth = process.stdout.columns || 80;
    
    // Use compact mode for narrow terminals
    if (this.terminalWidth < 80) {
      this.compactMode = true;
    }
  }

  createProgressBar() {
    // Define custom format based on terminal width
    let format;
    
    if (this.compactMode) {
      // Compact format for narrow terminals or CI environments
      format = '[{bar}] {percentage}% | {value}/{total} | {filename}';
    } else {
      // Full format with all information
      const parts = [
        'Processing images',
        colors.cyan('{bar}'),
        '{percentage}%',
        '|',
        '📸 {value}/{total}'
      ];
      
      if (this.showSpeed) {
        parts.push('|', '⚡ {speed} img/s');
      }
      
      if (this.showETA) {
        parts.push('|', '⏱️  {duration_formatted}', '|', 'ETA: {eta_formatted}');
      }
      
      parts.push('|', '💾 {filename}');
      
      if (this.stats.errors > 0) {
        parts.push('|', colors.red('❌ {errors} errors'));
      }
      
      format = parts.join(' ');
    }
    
    // Create progress bar with custom format
    const bar = new cliProgress.SingleBar({
      format,
      barCompleteChar: '▓',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
      etaBuffer: 10,
      fps: 10
    }, cliProgress.Presets.legacy);
    
    return bar;
  }

  start(total, initialMessage = '') {
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
    this.stats = {
      processed: 0,
      skipped: 0,
      errors: 0
    };
    
    if (!this.isQuiet && this.isTTY && total > 0) {
      if (initialMessage) {
        console.log(initialMessage);
      }
      
      this.bar = this.createProgressBar();
      this.bar.start(total, 0, {
        filename: 'Starting...',
        speed: '0',
        errors: 0
      });
    } else if (!this.isQuiet && total > 0) {
      // Non-TTY fallback (CI environments)
      console.log(`Processing ${total} images...`);
    }
  }

  update(current, tokens = {}) {
    this.current = current;
    
    // Update stats if provided
    if (tokens.status === 'processed') this.stats.processed++;
    else if (tokens.status === 'skipped') this.stats.skipped++;
    else if (tokens.status === 'error') this.stats.errors++;
    
    if (this.bar) {
      // Calculate speed
      const elapsed = (Date.now() - this.startTime) / 1000;
      const speed = elapsed > 0 ? (current / elapsed).toFixed(1) : '0';
      
      // Prepare update tokens
      const updateTokens = {
        filename: tokens.filename || tokens.file || 'Processing...',
        speed,
        errors: this.stats.errors,
        ...tokens
      };
      
      this.bar.update(current, updateTokens);
    } else if (!this.isQuiet && !this.isTTY && current % 10 === 0) {
      // Non-TTY progress updates every 10 items
      const percentage = Math.round((current / this.total) * 100);
      console.log(`Progress: ${current}/${this.total} (${percentage}%)`);
    }
  }

  increment(tokens = {}) {
    this.update(this.current + 1, tokens);
  }

  setFilename(filename) {
    if (this.bar) {
      this.bar.update(this.current, { filename });
    }
  }

  finish(showSummary = true) {
    if (this.bar) {
      this.bar.stop();
      
      if (showSummary && !this.isQuiet) {
        console.log(''); // Empty line after progress bar
      }
    }
    
    if (showSummary && !this.isQuiet) {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      const speed = elapsed > 0 ? (this.total / elapsed).toFixed(1) : '0';
      
      console.log(colors.green('✨ Processing complete!'));
      console.log(`   Total: ${this.total} images in ${elapsed}s (${speed} img/s)`);
      if (this.stats.processed > 0) {
        console.log(`   Processed: ${this.stats.processed}`);
      }
      if (this.stats.skipped > 0) {
        console.log(`   Skipped: ${this.stats.skipped}`);
      }
      if (this.stats.errors > 0) {
        console.log(colors.red(`   Errors: ${this.stats.errors}`));
      }
    }
  }

  // Handle terminal resize
  handleResize() {
    const newWidth = process.stdout.columns || 80;
    if (newWidth !== this.terminalWidth) {
      this.terminalWidth = newWidth;
      this.compactMode = newWidth < 80;
      
      // Recreate progress bar with new format
      if (this.bar) {
        this.bar.stop();
        this.bar = this.createProgressBar();
        this.bar.start(this.total, this.current);
      }
    }
  }

  // Clean up on exit
  cleanup() {
    if (this.bar) {
      this.bar.stop();
      process.stdout.write('\n');
    }
  }
}

module.exports = ProgressManager;