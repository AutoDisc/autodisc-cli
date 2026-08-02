import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clientPost } = vi.hoisted(() => ({
  clientPost: vi.fn(),
}));

vi.mock('./config.js', () => ({
  getConfigManager: () => ({
    getValue: vi.fn(),
  }),
}));

vi.mock('./http.js', () => ({
  createHttpClient: () => ({
    post: (...args: unknown[]) => clientPost(...args),
  }),
  extractAxiosError: (error: unknown) => error instanceof Error ? error.message : 'request failed',
}));

import { HostingAPI } from './hosting.js';

function responseError(status: number, message: string) {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { error: message } },
  });
}

const server = {
  id: 'server-1',
  name: 'example',
  status: 'provisioning',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HostingAPI mutation handling', () => {
  it('does not automatically repeat an ambiguous start request', async () => {
    clientPost.mockRejectedValue(responseError(502, 'Cloudflare origin error'));

    await expect(new HostingAPI().startServer('server-1')).rejects.toThrow(
      'could not confirm whether the start request completed'
    );
    expect(clientPost).toHaveBeenCalledTimes(1);
  });

  it('does not automatically repeat an ambiguous bundle deployment', async () => {
    clientPost.mockRejectedValue(responseError(504, 'Request timed out'));

    await expect(new HostingAPI().deployBundle('server-1', {
      upload_key: 'uploads/example.zip',
    })).rejects.toThrow('Run "autodisc status" before retrying');
    expect(clientPost).toHaveBeenCalledTimes(1);
  });

  it('reuses one idempotency key when a redeploy is retried', async () => {
    clientPost
      .mockRejectedValueOnce(responseError(502, 'Temporary gateway failure'))
      .mockResolvedValueOnce({ data: server });

    await expect(new HostingAPI().redeployServer('server-1')).resolves.toEqual(server);

    expect(clientPost).toHaveBeenCalledTimes(2);
    const firstConfig = clientPost.mock.calls[0]?.[2] as { headers: Record<string, string> };
    const secondConfig = clientPost.mock.calls[1]?.[2] as { headers: Record<string, string> };
    expect(firstConfig.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondConfig.headers['Idempotency-Key']).toBe(firstConfig.headers['Idempotency-Key']);
  });

  it('keeps definitive client errors concise', async () => {
    clientPost.mockRejectedValue(responseError(400, 'Server cannot be started'));

    await expect(new HostingAPI().startServer('server-1')).rejects.toThrow(/^Server cannot be started$/);
  });
});
