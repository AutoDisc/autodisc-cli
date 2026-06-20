import axios, { AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../../types.js';

const createHttpClient = vi.fn();
const extractAxiosError = vi.fn((error: unknown) => (error as Error).message);
const loggerSuccess = vi.fn();

const store: { auth?: AuthSession } = {};
const configManager = {
  getAuth: () => store.auth,
  setAuth: (session: AuthSession) => {
    store.auth = session;
  },
  clearAuth: () => {
    delete store.auth;
  },
};

vi.mock('../../lib/config.js', () => ({
  getConfigManager: () => configManager,
}));

vi.mock('../../lib/http.js', () => ({
  createHttpClient: (...args: unknown[]) => createHttpClient(...args),
  extractAxiosError: (...args: unknown[]) => extractAxiosError(...args),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: (...args: unknown[]) => loggerSuccess(...args),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

function expiredSession(overrides?: Partial<AuthSession>): AuthSession {
  return {
    token: 'expired-token',
    refreshToken: 'refresh-token',
    user: { id: 'user-1', email: 'user@example.com' },
    receivedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

function freshSession(overrides?: Partial<AuthSession>): AuthSession {
  return {
    token: 'fresh-token',
    refreshToken: 'refresh-token',
    user: { id: 'user-1', email: 'user@example.com' },
    receivedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AUTODISC_TOKEN;
  delete store.auth;
});

describe('session management', () => {
  it('preserves the stored refresh token when saving a refreshed access token', async () => {
    const { saveSession } = await import('./session.js');
    store.auth = freshSession({ refreshToken: 'persist-me' });

    saveSession('updated-token', { id: 'user-1', email: 'user@example.com' }, 1800);

    expect(store.auth?.token).toBe('updated-token');
    expect(store.auth?.refreshToken).toBe('persist-me');
    expect(loggerSuccess).toHaveBeenCalled();
  });

  it('returns the stored session when it is still fresh', async () => {
    const { ensureAuthenticated } = await import('./session.js');
    store.auth = freshSession();

    const session = await ensureAuthenticated();

    expect(session.token).toBe('fresh-token');
    expect(createHttpClient).not.toHaveBeenCalled();
  });

  it('refreshes the session when the access token has expired', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        user: { id: 'user-1', email: 'user@example.com' },
      },
    });
    createHttpClient.mockReturnValue({ post });
    store.auth = expiredSession();

    const { ensureAuthenticated } = await import('./session.js');
    const session = await ensureAuthenticated();

    expect(createHttpClient).toHaveBeenCalledWith({ includeAuth: false });
    expect(post).toHaveBeenCalledWith('/cli/auth/refresh', {
      refresh_token: 'refresh-token',
    });
    expect(session.token).toBe('new-access-token');
    expect(store.auth?.refreshToken).toBe('new-refresh-token');
  });

  it('clears the saved session and prompts for login when refresh is rejected', async () => {
    const post = vi.fn().mockRejectedValue(
      new axios.AxiosError(
        'Unauthorized',
        '401',
        undefined,
        undefined,
        {
          status: 401,
          statusText: 'Unauthorized',
          data: { error: 'invalid refresh token' },
          headers: new AxiosHeaders(),
          config: { headers: new AxiosHeaders() },
        }
      )
    );
    createHttpClient.mockReturnValue({ post });
    store.auth = expiredSession();

    const { ensureAuthenticated } = await import('./session.js');

    await expect(ensureAuthenticated()).rejects.toThrow('Not authenticated. Please run "autodisc login".');
    expect(store.auth).toBeUndefined();
  });
});
