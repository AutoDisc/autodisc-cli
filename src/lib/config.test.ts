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
  delete process.env.AUTODISC_TOKEN;
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.AUTODISC_API_URL;
  delete process.env.AUTODISC_TOKEN;
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

  it('masks sensitive tokens when requested', () => {
    const manager = createManager();
    manager.setAuth(createSession());
    const masked = manager.getAll(true);
    expect(masked.auth?.token).toBe('abcd…5678');
  });
});
