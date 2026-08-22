import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const saveSession = vi.fn();
const spinnerSucceed = vi.fn();
const spinnerFail = vi.fn();

vi.mock('../../lib/http.js', () => ({
  createHttpClient: vi.fn(() => ({ get })),
  extractAxiosError: (error: unknown) => error instanceof Error ? error.message : 'failed',
}));

vi.mock('../../lib/prompts.js', () => ({ input: vi.fn() }));
vi.mock('../../lib/spinner.js', () => ({
  createSpinner: () => ({ start: vi.fn(), succeed: spinnerSucceed, fail: spinnerFail }),
}));
vi.mock('./session.js', () => ({
  normalizeUser: vi.fn(),
  saveSession: (...args: unknown[]) => saveSession(...args),
}));

beforeEach(() => vi.clearAllMocks());

describe('API token login', () => {
  it('verifies adk keys against the public API and stores their credential type', async () => {
    get.mockResolvedValue({ data: [] });
    const { runApiTokenLogin } = await import('./api-token.js');

    await runApiTokenLogin('adk_example');

    expect(get).toHaveBeenCalledWith('/servers/regions');
    expect(saveSession).toHaveBeenCalledWith(
      'adk_example',
      { id: '', email: '' },
      undefined,
      undefined,
      'api_key',
    );
    expect(spinnerSucceed).toHaveBeenCalled();
    expect(spinnerFail).not.toHaveBeenCalled();
  });
});
