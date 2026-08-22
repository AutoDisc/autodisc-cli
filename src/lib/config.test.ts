import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigManager } from './config.js';
import type { AuthSession } from '../types.js';

let tempDir: string;

function createSession(overrides?: Partial<AuthSession>): AuthSession {
  return {
    token: 'abcd1234efgh5678',
    user: { id: 'user-1', email: 'user@example.com' },
    receivedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    expiresAt: undefined,
    ...overrides,
  };
}

function createManager() {
  const filePath = path.join(tempDir, 'config.json');
  return new ConfigManager(filePath);
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autodisc-cli-config-test-'));
  delete process.env.AUTODISC_API_URL;
  delete process.env.AUTODISC_PUBLIC_API_URL;
  delete process.env.AUTODISC_API_KEY;
  delete process.env.AUTODISC_TOKEN;
  delete process.env.AUTODISC_DEBUG;
  delete process.env.AUTODISC_NO_COLOR;
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.AUTODISC_API_URL;
  delete process.env.AUTODISC_PUBLIC_API_URL;
  delete process.env.AUTODISC_API_KEY;
  delete process.env.AUTODISC_TOKEN;
  delete process.env.AUTODISC_DEBUG;
  delete process.env.AUTODISC_NO_COLOR;
});

describe('ConfigManager', () => {
  it('applies AUTODISC_API_URL override when present', () => {
    process.env.AUTODISC_API_URL = 'https://custom.autodisc.dev';
    const manager = createManager();
    expect(manager.getApiUrl()).toBe('https://custom.autodisc.dev');
  });

  it('defaults new deploy config to the Builder plan', () => {
    const manager = createManager();
    expect(manager.getAll().deploy.defaultPlan).toBe('builder');
  });

  it('prefers AUTODISC_TOKEN over stored tokens', () => {
    const manager = createManager();
    manager.setAuth(createSession({ token: 'stored-token' }));
    process.env.AUTODISC_TOKEN = 'env-token';
    expect(manager.getToken()).toBe('env-token');
  });

  it('uses the public API origin for dashboard API keys', () => {
    const manager = createManager();
    expect(manager.getPublicApiUrl()).toBe('https://api.autodisc.xyz');
    process.env.AUTODISC_PUBLIC_API_URL = 'https://public.example.test/';
    expect(manager.getPublicApiUrl()).toBe('https://public.example.test');
  });

  it('prefers AUTODISC_API_KEY over other configured credentials', () => {
    const manager = createManager();
    manager.setAuth(createSession({ token: 'stored-token' }));
    process.env.AUTODISC_TOKEN = 'session-token';
    process.env.AUTODISC_API_KEY = 'adk_environment';
    expect(manager.getToken()).toBe('adk_environment');
  });

  it('masks sensitive tokens when requested', () => {
    const manager = createManager();
    manager.setAuth(createSession({ refreshToken: 'refresh-secret' }));
    const masked = manager.getAll(true);
    expect(masked.auth?.token).toBe('[redacted]');
    expect(masked.auth?.refreshToken).toBe('[redacted]');
  });

  it('honors debug and no-color environment overrides', () => {
    const manager = createManager();
    process.env.AUTODISC_DEBUG = '1';
    process.env.AUTODISC_NO_COLOR = '1';

    expect(manager.getEffectiveConfig().ui).toMatchObject({ verbose: true, colors: false });
  });
});
