import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServer = vi.fn();
const fetchStats = vi.fn();
const listDeployments = vi.fn();
const loggerInfo = vi.fn();
const loggerWarn = vi.fn();

vi.mock('../../lib/hosting.js', () => ({
  HostingAPI: class {
    getServer = (...args: unknown[]) => getServer(...args);
    fetchStats = (...args: unknown[]) => fetchStats(...args);
    listDeployments = (...args: unknown[]) => listDeployments(...args);
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfo(...args),
    success: vi.fn(),
    warn: (...args: unknown[]) => loggerWarn(...args),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('showMetrics', () => {
  it('prints a scriptable JSON snapshot', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    getServer.mockResolvedValue({
      id: 'server-1',
      user_id: 'user-1',
      name: 'web',
      source_type: 'repo',
      plan_type: 'builder',
      status: 'running',
      cpu_limit: 1,
      memory_mb: 512,
    });
    fetchStats.mockResolvedValue({
      cpu_percent: 12.34,
      memory_percent: 40,
      memory_usage_mb: 205,
      memory_limit_mb: 512,
    });
    listDeployments.mockResolvedValue([
      {
        id: 'deploy-1',
        server_id: 'server-1',
        status: 'success',
        commit_sha: 'abcdef123456',
        branch: 'main',
      },
    ]);

    const { showMetrics } = await import('./metrics.js');
    await showMetrics({ json: true });

    expect(fetchStats).toHaveBeenCalledWith('server-1');
    expect(listDeployments).toHaveBeenCalledWith(1, 'server-1');
    const payload = JSON.parse(stdoutSpy.mock.calls.map((call) => call[0]).join(''));
    expect(payload.server.id).toBe('server-1');
    expect(payload.stats.cpu_percent).toBe(12.34);
    expect(payload.latest_deployment.status).toBe('success');
    stdoutSpy.mockRestore();
  });

  it('warns when no server exists in human output', async () => {
    getServer.mockResolvedValue(null);

    const { showMetrics } = await import('./metrics.js');
    await showMetrics();

    expect(loggerWarn).toHaveBeenCalledWith('No hosting server found. Run `autodisc deploy` first.');
    expect(fetchStats).not.toHaveBeenCalled();
  });
});
