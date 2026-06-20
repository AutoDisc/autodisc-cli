import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureAuthenticated = vi.fn();
const getSession = vi.fn();
const listProjects = vi.fn();
const fetchServerLogs = vi.fn();
const loggerInfo = vi.fn();
const loggerWarn = vi.fn();

vi.mock('./auth/session.js', () => ({
  ensureAuthenticated: (...args: unknown[]) => ensureAuthenticated(...args),
  getSession: (...args: unknown[]) => getSession(...args),
}));

vi.mock('../lib/hosting.js', () => ({
  HostingAPI: class {
    listProjects = (...args: unknown[]) => listProjects(...args);
    fetchServerLogs = (...args: unknown[]) => fetchServerLogs(...args);
  },
}));

vi.mock('../lib/logger.js', () => ({
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

describe('showOverview', () => {
  it('shows a login-oriented overview when the machine is not authenticated', async () => {
    ensureAuthenticated.mockRejectedValue(new Error('Not authenticated. Please run "autodisc login".'));

    const { showOverview } = await import('./overview.js');
    await showOverview();

    expect(loggerWarn).toHaveBeenCalledWith('This machine is not authenticated yet.');
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('shows projects and recent logs when authenticated', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    ensureAuthenticated.mockResolvedValue({
      token: 'token',
      user: { id: 'user-1', email: 'user@example.com' },
      receivedAt: new Date().toISOString(),
    });
    getSession.mockReturnValue({
      token: 'token',
      user: { id: 'user-1', email: 'user@example.com' },
      receivedAt: new Date().toISOString(),
    });
    listProjects.mockResolvedValue([
      {
        id: 'project-1',
        user_id: 'user-1',
        name: 'Console',
        slug: 'console',
        services: [
          {
            id: 'server-1',
            user_id: 'user-1',
            name: 'web',
            source_type: 'repo',
            repo_full_name: 'AutoDisc/console',
            repo_branch: 'main',
            plan_type: 'starter',
            status: 'running',
            environment: {},
          },
        ],
      },
    ]);
    fetchServerLogs.mockResolvedValue({
      logs: 'line one\nline two\n',
    });

    const { showOverview } = await import('./overview.js');
    await showOverview();

    expect(listProjects).toHaveBeenCalled();
    expect(fetchServerLogs).toHaveBeenCalledWith(6, 'server-1');
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining('Projects (1)'));
    expect(stdoutSpy).toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });
});
