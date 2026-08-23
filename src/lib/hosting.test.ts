import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clientPost, clientPatch } = vi.hoisted(() => ({
  clientPost: vi.fn(),
  clientPatch: vi.fn(),
}));

vi.mock('./config.js', () => ({
  getConfigManager: () => ({
    getValue: vi.fn(),
  }),
}));

vi.mock('./http.js', () => ({
  createHttpClient: () => ({
    post: (...args: unknown[]) => clientPost(...args),
    patch: (...args: unknown[]) => clientPatch(...args),
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
  clientPost.mockReset();
  clientPatch.mockReset();
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
    })).rejects.toThrow('Checking the service state is required before retrying');
    expect(clientPost).toHaveBeenCalledTimes(1);
  });

  it('sends an idempotency key but does not repeat an ambiguous redeploy', async () => {
    clientPost.mockRejectedValue(responseError(524, 'Cloudflare origin timeout'));

    await expect(new HostingAPI().redeployServer('server-1')).rejects.toThrow(
      'could not confirm whether the redeploy request completed'
    );

    expect(clientPost).toHaveBeenCalledTimes(1);
    const config = clientPost.mock.calls[0]?.[2] as { headers: Record<string, string> };
    expect(config.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('marks an ambiguous service update for read-after-timeout recovery', async () => {
    clientPatch.mockRejectedValue(responseError(524, 'Cloudflare origin timeout'));

    await expect(new HostingAPI().updateServer('server-1', { name: 'example' })).rejects.toMatchObject({
      name: 'AmbiguousMutationError',
    });
    expect(clientPatch).toHaveBeenCalledTimes(1);
  });

  it('keeps definitive client errors concise', async () => {
    clientPost.mockRejectedValue(responseError(400, 'Server cannot be started'));

    await expect(new HostingAPI().startServer('server-1')).rejects.toThrow(/^Server cannot be started$/);
  });
});
