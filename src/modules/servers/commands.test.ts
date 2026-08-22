import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { registerServerCommands } from './commands.js';

describe('server command registration', () => {
  it('exposes catalogs, quote-first provisioning, reads, and lifecycle actions', () => {
    const program = new Command();
    registerServerCommands(program);
    const servers = program.commands.find((command) => command.name() === 'servers');

    expect(servers?.commands.map((command) => command.name())).toEqual([
      'regions',
      'shapes',
      'list',
      'get',
      'quote',
      'create',
      'start',
      'stop',
      'restart',
      'delete',
    ]);
    expect(servers?.commands.find((command) => command.name() === 'create')?.helpInformation())
      .toContain('--yes');
  });
});
