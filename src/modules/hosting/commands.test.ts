import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerHostingCommands } from './commands.js';

const initProject = vi.fn();
const deploy = vi.fn();
const showStatus = vi.fn();
const showLogs = vi.fn();
const showMetrics = vi.fn();
const listEnv = vi.fn();
const setEnv = vi.fn();
const unsetEnv = vi.fn();
const pullEnv = vi.fn();
const pushEnv = vi.fn();
const loggerError = vi.fn();

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: (...args: unknown[]) => loggerError(...args),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./init.js', () => ({
  initProject: (...args: unknown[]) => initProject(...args),
}));

vi.mock('./deploy.js', () => ({
  deploy: (...args: unknown[]) => deploy(...args),
}));

vi.mock('./status.js', () => ({
  showStatus: (...args: unknown[]) => showStatus(...args),
}));

vi.mock('./logs.js', () => ({
  showLogs: (...args: unknown[]) => showLogs(...args),
}));

vi.mock('./metrics.js', () => ({
  showMetrics: (...args: unknown[]) => showMetrics(...args),
}));

vi.mock('./env.js', () => ({
  listEnv: (...args: unknown[]) => listEnv(...args),
  setEnv: (...args: unknown[]) => setEnv(...args),
  unsetEnv: (...args: unknown[]) => unsetEnv(...args),
  pullEnv: (...args: unknown[]) => pullEnv(...args),
  pushEnv: (...args: unknown[]) => pushEnv(...args),
}));

function createProgram() {
  const program = new Command();
  registerHostingCommands(program);
  return program;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.exitCode = undefined;
});

afterEach(() => {
  process.exitCode = undefined;
});

describe('registerHostingCommands', () => {
  it('passes init options through to project initialization', async () => {
    const program = createProgram();

    await program.parseAsync(['node', 'autodisc', 'init', '--path', './demo', '--force']);

    expect(initProject).toHaveBeenCalledWith({ path: './demo', force: true });
  });

  it('passes deploy options through with start disabled when requested', async () => {
    const program = createProgram();

    await program.parseAsync(['node', 'autodisc', 'deploy', '--config', 'autodisc.staging.yml', '--path', './app', '--no-start']);

    expect(deploy).toHaveBeenCalledWith({
      config: 'autodisc.staging.yml',
      path: './app',
      start: false,
    });
  });

  it('normalizes log options before calling the logs module', async () => {
    const program = createProgram();

    await program.parseAsync(['node', 'autodisc', 'logs', '--follow', '--tail', '50', '--json']);

    expect(showLogs).toHaveBeenCalledWith({ follow: true, tail: 50, json: true });
  });

  it('reports invalid log tail values without invoking the logs module', async () => {
    const program = createProgram();

    await program.parseAsync(['node', 'autodisc', 'logs', '--tail', 'not-a-number']);

    expect(showLogs).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledWith('--tail must be a positive integer');
    expect(process.exitCode).toBe(1);
  });

  it('passes status JSON options through', async () => {
    const program = createProgram();

    await program.parseAsync(['node', 'autodisc', 'status', '--json']);

    expect(showStatus).toHaveBeenCalledWith({ json: true });
  });

  it('normalizes metrics options before calling the metrics module', async () => {
    const program = createProgram();

    await program.parseAsync(['node', 'autodisc', 'metrics', '--watch', '--interval', '5', '--json']);

    expect(showMetrics).toHaveBeenCalledWith({ json: true, watch: true, interval: 5 });
  });

  it('reports invalid metrics intervals without invoking the metrics module', async () => {
    const program = createProgram();

    await program.parseAsync(['node', 'autodisc', 'metrics', '--interval', '0']);

    expect(showMetrics).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledWith('--interval must be a positive number');
    expect(process.exitCode).toBe(1);
  });

  it('routes env commands to the expected handlers', async () => {
    const program = createProgram();

    await program.parseAsync(['node', 'autodisc', 'env']);
    await program.parseAsync(['node', 'autodisc', 'env', 'set', 'FOO=bar', 'BAR=baz']);
    await program.parseAsync(['node', 'autodisc', 'env', 'unset', 'FOO', 'BAR']);
    await program.parseAsync(['node', 'autodisc', 'env', 'pull', '--output', '.env.production']);
    await program.parseAsync(['node', 'autodisc', 'env', 'push', '.env.production']);

    expect(listEnv).toHaveBeenCalledTimes(1);
    expect(setEnv).toHaveBeenCalledWith(['FOO=bar', 'BAR=baz']);
    expect(unsetEnv).toHaveBeenCalledWith(['FOO', 'BAR']);
    expect(pullEnv).toHaveBeenCalledWith({ path: '.env.production' });
    expect(pushEnv).toHaveBeenCalledWith('.env.production');
  });
});
