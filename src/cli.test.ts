import { describe, expect, it, vi } from 'vitest';
import { createProgram } from './cli.js';

const showOverview = vi.fn();

vi.mock('./modules/overview.js', () => ({
  showOverview: (...args: unknown[]) => showOverview(...args),
}));

describe('createProgram', () => {
  it('runs the overview when invoked without a subcommand', async () => {
    const program = createProgram();

    await program.parseAsync(['node', 'autodisc']);

    expect(showOverview).toHaveBeenCalled();
  });

  it('builds the Autodisc CLI with the expected top-level commands', () => {
    const program = createProgram();

    expect(program.name()).toBe('autodisc');
    expect(program.description()).toContain('Deploy and manage');

    const commandNames = program.commands.map((command) => command.name());
    expect(commandNames).toEqual([
      'login',
      'logout',
      'whoami',
      'config',
      'config:get',
      'config:set',
      'init',
      'deploy',
      'status',
      'logs',
      'metrics',
      'start',
      'stop',
      'restart',
      'delete',
      'env',
      'agent:setup',
      'agent:chat',
      'project',
      'doctor',
    ]);
  });

  it('exposes consistent global troubleshooting options', () => {
    const program = createProgram();
    const optionNames = program.options.map((option) => option.long);

    expect(optionNames).toEqual(expect.arrayContaining(['--api-url', '--verbose', '--no-color']));
  });

  it('registers the hosting env subcommands exposed by Autodisc', () => {
    const program = createProgram();
    const envCommand = program.commands.find((command) => command.name() === 'env');

    expect(envCommand).toBeDefined();
    expect(envCommand?.commands.map((command) => command.name())).toEqual([
      'set',
      'unset',
      'pull',
      'push',
    ]);
  });
});
