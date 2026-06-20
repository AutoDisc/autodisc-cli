import { describe, expect, it, vi, beforeEach } from 'vitest';

const runDeviceCodeLogin = vi.fn();
const runBrowserLogin = vi.fn();
const runApiTokenLogin = vi.fn();

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./device-code.js', () => ({
  runDeviceCodeLogin: (...args: unknown[]) => runDeviceCodeLogin(...args),
}));

vi.mock('./browser.js', () => ({
  runBrowserLogin: (...args: unknown[]) => runBrowserLogin(...args),
}));

vi.mock('./api-token.js', () => ({
  runApiTokenLogin: (...args: unknown[]) => runApiTokenLogin(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('login command flow selection', () => {
  it('prefers API token flow when --token provided', async () => {
    const { login } = await import('./login.js');
    await login({ token: 'abc123' });
    expect(runApiTokenLogin).toHaveBeenCalledWith('abc123');
    expect(runBrowserLogin).not.toHaveBeenCalled();
    expect(runDeviceCodeLogin).not.toHaveBeenCalled();
  });

  it('supports boolean --token flag', async () => {
    const { login } = await import('./login.js');
    await login({ token: true });
    expect(runApiTokenLogin).toHaveBeenCalledWith(true);
  });

  it('runs browser flow when --browser passed', async () => {
    const { login } = await import('./login.js');
    await login({ browser: true });
    expect(runBrowserLogin).toHaveBeenCalled();
    expect(runDeviceCodeLogin).not.toHaveBeenCalled();
  });

  it('falls back to browser flow by default', async () => {
    const { login } = await import('./login.js');
    await login({});
    expect(runBrowserLogin).toHaveBeenCalled();
    expect(runDeviceCodeLogin).not.toHaveBeenCalled();
  });

  it('runs device code flow when --device passed', async () => {
    const { login } = await import('./login.js');
    await login({ device: true });
    expect(runDeviceCodeLogin).toHaveBeenCalled();
  });
});
