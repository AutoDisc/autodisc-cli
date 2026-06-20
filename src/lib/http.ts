import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { getConfigManager } from './config.js';
import { API_BASE_PATH } from './constants.js';
import pkg from '../../package.json' with { type: 'json' };

interface ClientOptions {
  token?: string | null;
  includeAuth?: boolean;
}

export function createHttpClient(options?: ClientOptions): AxiosInstance {
  const configManager = getConfigManager();
  const token = options?.token ?? null;
  const includeAuth = options?.includeAuth ?? true;
  const baseURL = `${configManager.getApiUrl()}${API_BASE_PATH}`;

  const instance = axios.create({
    baseURL,
    timeout: configManager.getTimeout(),
    headers: {
      'User-Agent': `autodisc-cli/${pkg.version as string}`,
    },
  });

  instance.interceptors.request.use(async (config) => {
    let authToken = token;
    if (includeAuth && !authToken) {
      if (process.env.AUTODISC_TOKEN) {
        authToken = process.env.AUTODISC_TOKEN;
      } else {
        const { ensureAuthenticated } = await import('../modules/auth/session.js');
        authToken = (await ensureAuthenticated()).token;
      }
    }
    if (includeAuth && authToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${authToken}`;
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
    (error: AxiosError) => {
      if (error.response?.status === 401 && includeAuth) {
        throw new Error('Authentication failed. Please run "autodisc login".');
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export function extractAxiosError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<{ detail?: string; message?: string }>;
    const detail = err.response?.data?.detail || err.response?.data?.message;
    if (detail) return detail;
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
