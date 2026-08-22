import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { getConfigManager } from './config.js';
import { API_BASE_PATH } from './constants.js';
import pkg from '../../package.json' with { type: 'json' };
import type { AuthCredentialType } from '../types.js';
import {
  credentialHeaders,
  credentialTypeForToken,
  environmentCredential,
} from '../modules/auth/credential.js';

interface ClientOptions {
  token?: string | null;
  credentialType?: AuthCredentialType;
  includeAuth?: boolean;
  publicApi?: boolean;
}

interface RetryableRequestConfig extends AxiosRequestConfig {
  _autodiscAuthRetried?: boolean;
  _autodiscCredentialType?: AuthCredentialType;
}

export function createHttpClient(options?: ClientOptions): AxiosInstance {
  const configManager = getConfigManager();
  const token = options?.token ?? null;
  const initialCredential = token
    ? { token, credentialType: credentialTypeForToken(token, options?.credentialType) }
    : environmentCredential() ?? configManager.getAuth();
  const includeAuth = options?.includeAuth ?? true;
  const apiUrl = options?.publicApi || initialCredential?.credentialType === 'api_key'
    ? configManager.getPublicApiUrl()
    : configManager.getApiUrl();
  const baseURL = `${apiUrl}${API_BASE_PATH}`;

  const instance = axios.create({
    baseURL,
    timeout: configManager.getTimeout(),
    headers: {
      'User-Agent': `autodisc-cli/${pkg.version as string}`,
    },
  });

  instance.interceptors.request.use(async (config) => {
    let credential = token
      ? { token, credentialType: credentialTypeForToken(token, options?.credentialType) }
      : environmentCredential();
    if (includeAuth && !credential) {
      const { ensureAuthenticated } = await import('../modules/auth/session.js');
      const session = await ensureAuthenticated();
      credential = {
        token: session.token,
        credentialType: credentialTypeForToken(session.token, session.credentialType),
      };
    }
    if (includeAuth && credential) {
      config.headers = config.headers || {};
      Object.assign(
        config.headers,
        credentialHeaders(credential.token, credential.credentialType),
      );
      (config as RetryableRequestConfig)._autodiscCredentialType = credential.credentialType;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const contentType = String(response.headers?.['content-type'] ?? '').toLowerCase();
      const looksLikeHtml =
        contentType.includes('html') ||
        (typeof response.data === 'string' && /^\s*<(!doctype|html)/i.test(response.data));
      if (looksLikeHtml) {
        throw new Error(
          `Unexpected HTML response from ${baseURL}${response.config.url ?? ''} — API URL may be wrong (current: ${configManager.getApiUrl()}). Set AUTODISC_API_URL to the real backend.`
        );
      }
      return response;
    },
    async (error: AxiosError) => {
      if (error.response?.status === 401 && includeAuth) {
        const requestConfig = error.config as RetryableRequestConfig | undefined;
        if (
          requestConfig?._autodiscCredentialType === 'api_key'
        ) {
          throw new Error('API key rejected. Create a new key under Account → Tokens and try again.');
        }
        if (!token && !environmentCredential() && requestConfig && !requestConfig._autodiscAuthRetried) {
          requestConfig._autodiscAuthRetried = true;
          try {
            const { refreshAuthenticatedSession } = await import('../modules/auth/session.js');
            const refreshed = await refreshAuthenticatedSession();
            requestConfig.headers = requestConfig.headers || {};
            requestConfig.headers.Authorization = `Bearer ${refreshed.token}`;
            return instance.request(requestConfig);
          } catch (refreshError) {
            if (getConfigManager().getAuth()) throw refreshError;
            // An invalid refresh clears the stored session; fall through to the
            // stable login instruction in that case.
          }
        }
        throw new Error('Authentication failed. Please run "autodisc login".');
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export function extractAxiosError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<{ detail?: string; error?: string; message?: string }>;
    const detail = err.response?.data?.detail || err.response?.data?.error || err.response?.data?.message;
    if (detail) {
      if (typeof detail === 'string' && detail.trim().startsWith('{')) {
        try {
          const nested = JSON.parse(detail) as { detail?: string; error?: string; message?: string };
          return nested.detail || nested.error || nested.message || detail;
        } catch {
          return detail;
        }
      }
      return detail;
    }
    if (err.response) return `Request failed with status ${err.response.status}`;
    if (err.request) return 'No response received from server';
    return err.message;
  }
  return (error as Error)?.message ?? 'Unknown error';
}

export async function requestWithAuth<T>(config: AxiosRequestConfig<T>): Promise<T> {
  const client = createHttpClient();
  const response = await client.request<T>(config);
  return response.data;
}
