import axios from 'axios';
import { createHttpClient, extractAxiosError } from '../../lib/http.js';
import { getConfigManager } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { AuthSession, RefreshSessionResponse, User } from '../../types.js';

const EXPIRY_SKEW_MS = 60_000;
const DEFAULT_LOGIN_MESSAGE = 'Not authenticated. Please run "autodisc login".';

let refreshPromise: Promise<AuthSession> | null = null;

function computeExpiry(expiresIn?: number) {
  if (!expiresIn) return undefined;
  const expiry = new Date(Date.now() + expiresIn * 1000);
  return expiry.toISOString();
}

function isExpired(expiresAt?: string) {
  if (!expiresAt) return false;
  const expiryMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryMs)) {
    return true;
  }
  return expiryMs - Date.now() <= EXPIRY_SKEW_MS;
}

export function saveSession(token: string, user?: User, expiresIn?: number, refreshToken?: string) {
  const config = getConfigManager();
  const existing = config.getAuth();
  const session: AuthSession = {
    token,
    refreshToken: refreshToken ?? existing?.refreshToken,
    user: user ?? existing?.user ?? { id: '', email: '' },
    expiresAt: expiresIn === undefined ? existing?.expiresAt : computeExpiry(expiresIn),
    receivedAt: new Date().toISOString(),
  };
  config.setAuth(session);
  logger.success(`Authenticated${session.user.email ? ` as ${session.user.email}` : ''}`);
  return session;
}

export function clearSession() {
  const config = getConfigManager();
  config.clearAuth();
  logger.success('Logged out.');
}

export function getSession(): AuthSession | undefined {
  return getConfigManager().getAuth();
}

async function refreshSession(session: AuthSession, message: string) {
  if (!session.refreshToken) {
    throw new Error(message);
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const client = createHttpClient({ includeAuth: false });
        const { data } = await client.post<RefreshSessionResponse>('/cli/auth/refresh', {
          refresh_token: session.refreshToken,
        });
        return saveSession(data.access_token, data.user, data.expires_in, data.refresh_token ?? session.refreshToken);
      } catch (error) {
        if (axios.isAxiosError(error) && [400, 401].includes(error.response?.status ?? 0)) {
          getConfigManager().clearAuth();
          throw new Error(message);
        }
        throw new Error(extractAxiosError(error));
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function ensureAuthenticated(message = DEFAULT_LOGIN_MESSAGE) {
  if (process.env.AUTODISC_TOKEN) {
    return {
      token: process.env.AUTODISC_TOKEN,
      user: getSession()?.user ?? { id: '', email: '' },
      receivedAt: new Date().toISOString(),
    } satisfies AuthSession;
  }

  const session = getSession();
  if (!session?.token) {
    throw new Error(message);
  }

  if (!isExpired(session.expiresAt)) {
    return session;
  }

  return refreshSession(session, message);
}

export async function requireSession(message = DEFAULT_LOGIN_MESSAGE) {
  const session = getSession();
  if (!session?.token) {
    throw new Error(message);
  }
  return ensureAuthenticated(message);
}
