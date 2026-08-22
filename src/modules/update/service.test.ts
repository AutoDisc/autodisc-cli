import { describe, expect, it, vi } from 'vitest';
import { fetchLatestVersion, installLatestVersion, isNewerVersion } from './service.js';

describe('CLI updates', () => {
  it('compares stable and prerelease versions', () => {
    expect(isNewerVersion('0.1.3', '0.1.2')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0-beta.2')).toBe(true);
    expect(isNewerVersion('1.0.0-beta.2', '1.0.0')).toBe(false);
    expect(isNewerVersion('0.1.2', '0.1.2')).toBe(false);
  });

  it('reads the latest version from npm', async () => {
    const fetchRegistry = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: '0.2.0' }),
    });

    await expect(fetchLatestVersion(fetchRegistry)).resolves.toBe('0.2.0');
    expect(fetchRegistry).toHaveBeenCalledOnce();
  });

  it('installs the exact version returned by npm', async () => {
    const installer = vi.fn().mockResolvedValue(undefined);

    await installLatestVersion('0.2.0', installer);

    expect(installer).toHaveBeenCalledWith(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', '--global', '@autodisc/cli@0.2.0'],
    );
  });
});
