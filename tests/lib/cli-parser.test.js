const CliParser = require('../../src/cli-parser');

describe('CliParser checkpoint flags', () => {
  it('parses --checkpoint-every and --checkpoint-interval-ms as integers', () => {
    const args = ['--checkpoint-every=7', '--checkpoint-interval-ms=1500'];
    const parser = new CliParser(args);
    const opts = parser.parse();
    expect(opts.checkpointEveryN).toBe(7);
    expect(opts.checkpointIntervalMs).toBe(1500);
  });

  it('ignores invalid integers and leaves undefined', () => {
    const args = ['--checkpoint-every=abc'];
    const parser = new CliParser(args);
    const opts = parser.parse();
    expect(opts.checkpointEveryN).toBeUndefined();
  });
});

