import fs from 'fs';
import path from 'path';
import Conf from 'conf';
import { CLIConfig, AuthSession } from '../types.js';
import { CONFIG_FILE, DEFAULT_API_URL } from './constants.js';

const DEFAULT_TIMEOUT = 30_000;

const DEFAULT_CONFIG: CLIConfig = {
  api: {
    url: process.env.AUTODISC_API_URL || DEFAULT_API_URL,
    timeout: DEFAULT_TIMEOUT,
  },
  deploy: {
    currentProject: null,
    currentServer: null,
    defaultPlan: 'builder',
    autoConfirm: false,
  },
  ui: {
    colors: process.env.AUTODISC_NO_COLOR !== '1',
    emoji: true,
    verbose: Boolean(process.env.AUTODISC_DEBUG),
  },
  telemetry: {
    enabled: false,
  },
};

function resolveConfigPath(customPath?: string) {
  const filePath = customPath || CONFIG_FILE;
  const normalized = path.resolve(filePath);
  const dir = path.dirname(normalized);
  const ext = path.extname(normalized);
  const configName = ext ? path.basename(normalized, ext) : path.basename(normalized);
  return { normalized, dir, configName };
}

export class ConfigManager {
  private store: Conf<CLIConfig>;
  private filePath: string;

  constructor(customPath?: string) {
    const { normalized, dir, configName } = resolveConfigPath(customPath);
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = normalized;
    this.store = new Conf<CLIConfig>({
      cwd: dir,
      configName,
      defaults: DEFAULT_CONFIG,
      projectSuffix: '',
    });
  }

  get path() {
    return this.filePath;
  }

  get storeSnapshot(): CLIConfig {
    return this.store.store;
  }

  getEffectiveConfig(): CLIConfig {
    return {
      ...this.store.store,
      api: {
        ...this.store.store.api,
        url: process.env.AUTODISC_API_URL || this.store.store.api.url,
      },
      ui: {
        ...this.store.store.ui,
        colors: process.env.AUTODISC_NO_COLOR === '1' ? false : this.store.store.ui.colors,
        verbose: Boolean(process.env.AUTODISC_DEBUG) || this.store.store.ui.verbose,
      },
    };
  }

  getToken(): string | undefined {
    return process.env.AUTODISC_TOKEN || this.store.store.auth?.token;
  }

  getTimeout() {
    return this.store.store.api.timeout;
  }

  getApiUrl() {
    return this.getEffectiveConfig().api.url.replace(/\/$/, '');
  }

  setAuth(session: AuthSession) {
    this.store.set('auth', session);
  }

  clearAuth() {
    this.store.delete('auth');
  }

  getAuth(): AuthSession | undefined {
    const auth = this.store.store.auth;
    if (!auth) return undefined;
    const userValid =
      auth.user && typeof auth.user === 'object' && !Array.isArray(auth.user) &&
      typeof (auth.user as { id?: unknown }).id === 'string' &&
      typeof (auth.user as { email?: unknown }).email === 'string';
    if (!userValid || typeof auth.token !== 'string') {
      this.store.delete('auth');
      return undefined;
    }
    return auth;
  }

  getValue<T>(pathKey: string): T | undefined {
    return this.store.get(pathKey as any) as T | undefined;
  }

  setValue(pathKey: string, value: unknown) {
    this.store.set(pathKey as any, value as any);
  }

  getAll(maskSensitive = false): CLIConfig {
    if (!maskSensitive) {
      return this.store.store;
    }

    const clone: CLIConfig = JSON.parse(JSON.stringify(this.store.store));
    if (clone.auth?.token) {
      clone.auth.token = '[redacted]';
    }
    if (clone.auth?.refreshToken) {
      clone.auth.refreshToken = '[redacted]';
    }
    return clone;
  }
}

let singleton: ConfigManager | null = null;

export function getConfigManager() {
  if (!singleton) {
    singleton = new ConfigManager();
  }
  return singleton;
}
