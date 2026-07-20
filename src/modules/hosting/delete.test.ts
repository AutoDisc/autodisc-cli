import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServer: vi.fn(),
  deleteServer: vi.fn(),
  spinnerStart: vi.fn(),
  spinnerSucceed: vi.fn(),
  spinnerFail: vi.fn(),
}));

vi.mock('../../lib/hosting.js', () => ({
  HostingAPI: class {
    getServer = mocks.getServer;
    deleteServer = mocks.deleteServer;
  },
}));

vi.mock('../../lib/spinner.js', () => ({
  createSpinner: () => ({
    start: mocks.spinnerStart,
    succeed: mocks.spinnerSucceed,
    fail: mocks.spinnerFail,
  }),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/prompts.js', () => ({ confirm: vi.fn() }));

import { deleteServer } from './delete.js';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getServer.mockResolvedValue({ name: 'example-app' });
  mocks.deleteServer.mockResolvedValue({ name: 'example-app' });
});

describe('deleteServer', () => {
  it('deletes after explicit non-interactive confirmation', async () => {
    await deleteServer({ yes: true });

    expect(mocks.deleteServer).toHaveBeenCalledOnce();
    expect(mocks.spinnerSucceed).toHaveBeenCalledOnce();
  });

  it('refuses an unconfirmed delete in a non-interactive terminal', async () => {
    if (process.stdin.isTTY) return;

    await expect(deleteServer()).rejects.toThrow('Pass --yes to continue');
    expect(mocks.deleteServer).not.toHaveBeenCalled();
  });

  it('fails clearly when there is no current hosting server', async () => {
    mocks.getServer.mockResolvedValue(null);

    await expect(deleteServer({ yes: true })).rejects.toThrow('No hosting server found');
    expect(mocks.deleteServer).not.toHaveBeenCalled();
  });
});
