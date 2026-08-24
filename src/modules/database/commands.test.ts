import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerDatabaseCommands } from './commands.js';

const addDatabase = vi.fn();
const bindDatabase = vi.fn();
const listDatabases = vi.fn();

vi.mock('./service.js', () => ({
  addDatabase: (...args: unknown[]) => addDatabase(...args),
  bindDatabase: (...args: unknown[]) => bindDatabase(...args),
  listDatabases: (...args: unknown[]) => listDatabases(...args),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.exitCode = undefined;
});

describe('database commands', () => {
  it('supports Railway-style top-level database creation', async () => {
    const program = new Command();
    registerDatabaseCommands(program);

    await program.parseAsync([
      'node',
      'autodisc',
      'add',
      '--database',
      'postgres',
      '--project',
      'mdboard',
      '--bind',
      'api:DATABASE_URL',
    ]);

    expect(addDatabase).toHaveBeenCalledWith('postgres', expect.objectContaining({
      database: 'postgres',
      project: 'mdboard',
      bind: 'api:DATABASE_URL',
      deploy: true,
    }));
  });

  it('passes explicit database binding without redeployment', async () => {
    const program = new Command();
    registerDatabaseCommands(program);

    await program.parseAsync([
      'node',
      'autodisc',
      'database',
      'bind',
      'postgres',
      'api',
      '--variable',
      'DATABASE_URL',
      '--no-deploy',
    ]);

    expect(bindDatabase).toHaveBeenCalledWith('postgres', 'api', {
      variable: 'DATABASE_URL',
      deploy: false,
    });
  });

  it('lists databases as JSON', async () => {
    const program = new Command();
    registerDatabaseCommands(program);

    await program.parseAsync(['node', 'autodisc', 'db', 'list', '--json']);

    expect(listDatabases).toHaveBeenCalledWith({ json: true });
  });
});
