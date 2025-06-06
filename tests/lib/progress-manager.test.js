const ProgressManager = require('../../scripts/lib/progress-manager');

// Mock cli-progress to avoid actual terminal output in tests
jest.mock('cli-progress', () => ({
  SingleBar: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn()
  })),
  Presets: {
    legacy: {}
  }
}));

// Mock ansi-colors
jest.mock('ansi-colors', () => ({
  cyan: (str) => str,
  green: (str) => str,
  red: (str) => str
}));

describe('ProgressManager', () => {
  let originalStdout;
  let progressManager;
  
  beforeEach(() => {
    // Save original stdout properties
    originalStdout = {
      isTTY: process.stdout.isTTY,
      columns: process.stdout.columns
    };
    
    // Mock console.log to prevent output during tests
    jest.spyOn(console, 'log').mockImplementation();
  });
  
  afterEach(() => {
    // Restore stdout properties
    process.stdout.isTTY = originalStdout.isTTY;
    process.stdout.columns = originalStdout.columns;
    
    // Restore console.log
    console.log.mockRestore();
    
    // Clear mocks
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      progressManager = new ProgressManager();
      
      expect(progressManager.total).toBe(0);
      expect(progressManager.current).toBe(0);
      expect(progressManager.isQuiet).toBe(false);
      expect(progressManager.showSpeed).toBe(true);
      expect(progressManager.showETA).toBe(true);
      expect(progressManager.compactMode).toBe(false);
    });
    
    it('should respect quiet option', () => {
      progressManager = new ProgressManager({ quiet: true });
      
      expect(progressManager.isQuiet).toBe(true);
    });
    
    it('should enable compact mode for narrow terminals', () => {
      process.stdout.columns = 60;
      progressManager = new ProgressManager();
      
      expect(progressManager.compactMode).toBe(true);
    });
    
    it('should handle missing terminal width', () => {
      process.stdout.columns = undefined;
      progressManager = new ProgressManager();
      
      expect(progressManager.terminalWidth).toBe(80);
    });
  });
  
  describe('start', () => {
    beforeEach(() => {
      process.stdout.isTTY = true;
      process.stdout.columns = 120;
    });
    
    it('should create progress bar in TTY mode', () => {
      progressManager = new ProgressManager();
      progressManager.start(100);
      
      expect(progressManager.bar).toBeTruthy();
      expect(progressManager.bar.start).toHaveBeenCalledWith(100, 0, {
        filename: 'Starting...',
        speed: '0',
        errors: 0
      });
    });
    
    it('should not create progress bar in quiet mode', () => {
      progressManager = new ProgressManager({ quiet: true });
      progressManager.start(100);
      
      expect(progressManager.bar).toBeNull();
      expect(console.log).not.toHaveBeenCalled();
    });
    
    it('should fallback to console output in non-TTY mode', () => {
      process.stdout.isTTY = false;
      progressManager = new ProgressManager();
      progressManager.start(100);
      
      expect(progressManager.bar).toBeNull();
      expect(console.log).toHaveBeenCalledWith('Processing 100 images...');
    });
    
    it('should show initial message if provided', () => {
      progressManager = new ProgressManager();
      progressManager.start(100, 'Starting batch processing...');
      
      expect(console.log).toHaveBeenCalledWith('Starting batch processing...');
    });
  });
  
  describe('update', () => {
    beforeEach(() => {
      process.stdout.isTTY = true;
      progressManager = new ProgressManager();
      progressManager.start(100);
    });
    
    it('should update progress bar with current value', () => {
      progressManager.update(50, { filename: 'test.png' });
      
      expect(progressManager.current).toBe(50);
      expect(progressManager.bar.update).toHaveBeenCalledWith(50, 
        expect.objectContaining({
          filename: 'test.png',
          speed: expect.any(String),
          errors: 0
        })
      );
    });
    
    it('should track statistics', () => {
      progressManager.update(1, { status: 'processed' });
      progressManager.update(2, { status: 'skipped' });
      progressManager.update(3, { status: 'error' });
      
      expect(progressManager.stats).toEqual({
        processed: 1,
        skipped: 1,
        errors: 1
      });
    });
    
    it('should calculate speed correctly', () => {
      // Mock time progression
      const startTime = Date.now();
      progressManager.startTime = startTime - 5000; // 5 seconds ago
      
      progressManager.update(10, { filename: 'test.png' });
      
      expect(progressManager.bar.update).toHaveBeenCalledWith(10, 
        expect.objectContaining({
          speed: '2.0' // 10 images in 5 seconds = 2 img/s
        })
      );
    });
    
    it('should show progress in non-TTY mode every 10 items', () => {
      process.stdout.isTTY = false;
      progressManager = new ProgressManager();
      progressManager.start(100);
      
      console.log.mockClear();
      
      // Should not log for items 1-9
      for (let i = 1; i < 10; i++) {
        progressManager.update(i);
      }
      expect(console.log).not.toHaveBeenCalled();
      
      // Should log for item 10
      progressManager.update(10);
      expect(console.log).toHaveBeenCalledWith('Progress: 10/100 (10%)');
    });
  });
  
  describe('increment', () => {
    it('should increment current value by 1', () => {
      process.stdout.isTTY = true;
      progressManager = new ProgressManager();
      progressManager.start(100);
      
      progressManager.current = 5;
      progressManager.increment({ filename: 'test.png' });
      
      expect(progressManager.current).toBe(6);
      expect(progressManager.bar.update).toHaveBeenCalledWith(6, 
        expect.objectContaining({ filename: 'test.png' })
      );
    });
  });
  
  describe('finish', () => {
    beforeEach(() => {
      process.stdout.isTTY = true;
      progressManager = new ProgressManager();
      progressManager.start(100);
      progressManager.stats = {
        processed: 80,
        skipped: 15,
        errors: 5
      };
    });
    
    it('should stop progress bar and show summary', () => {
      progressManager.finish();
      
      expect(progressManager.bar.stop).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✨ Processing complete!');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Total: 100 images'));
      expect(console.log).toHaveBeenCalledWith('   Processed: 80');
      expect(console.log).toHaveBeenCalledWith('   Skipped: 15');
      expect(console.log).toHaveBeenCalledWith('   Errors: 5');
    });
    
    it('should skip summary if showSummary is false', () => {
      console.log.mockClear();
      progressManager.finish(false);
      
      expect(progressManager.bar.stop).toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled(); // No output when showSummary is false
    });
    
    it('should not show summary in quiet mode', () => {
      progressManager.isQuiet = true;
      console.log.mockClear();
      
      progressManager.finish();
      
      expect(console.log).not.toHaveBeenCalled();
    });
  });
  
  describe('handleResize', () => {
    it('should switch to compact mode when terminal becomes narrow', () => {
      process.stdout.isTTY = true;
      process.stdout.columns = 120;
      progressManager = new ProgressManager();
      progressManager.start(100);
      
      expect(progressManager.compactMode).toBe(false);
      
      // Simulate terminal resize
      process.stdout.columns = 60;
      progressManager.handleResize();
      
      expect(progressManager.compactMode).toBe(true);
    });
  });
  
  describe('cleanup', () => {
    it('should stop progress bar and add newline', () => {
      process.stdout.isTTY = true;
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
      
      progressManager = new ProgressManager();
      progressManager.start(100);
      progressManager.cleanup();
      
      expect(progressManager.bar.stop).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalledWith('\n');
      
      writeSpy.mockRestore();
    });
  });
});