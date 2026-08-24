import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { registerBucketCommands } from './commands.js';

describe('bucket command registration', () => {
  it('exposes project management and resident-storage usage commands', () => {
    const program = new Command();
    registerBucketCommands(program);
    const buckets = program.commands.find((command) => command.name() === 'buckets');

    expect(buckets?.alias()).toBe('bucket');
    expect(buckets?.commands.map((command) => command.name())).toEqual([
      'list', 'get', 'create', 'usage', 'delete',
    ]);
    expect(buckets?.commands.find((command) => command.name() === 'create')?.helpInformation())
      .toContain('returned once');
  });
});
