import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clientPost, createOptions } = vi.hoisted(() => ({
  clientPost: vi.fn(),
  createOptions: vi.fn(),
}));

vi.mock('./http.js', () => ({
  createHttpClient: (options: unknown) => {
    createOptions(options);
    return { post: (...args: unknown[]) => clientPost(...args) };
  },
  extractAxiosError: (error: unknown) => error instanceof Error ? error.message : 'request failed',
}));

import { AnonymousDeploymentsAPI } from './anonymous-deployments.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnonymousDeploymentsAPI', () => {
  it('creates a 24-hour GitHub Drop without enabling CLI authentication', async () => {
    clientPost.mockResolvedValue({
      data: {
        drop_id: 'drop-1',
        status: 'ready',
        status_url: 'https://api.autodisc.xyz/api/v1/drops/drop-1',
        expires_at: '2026-08-15T00:00:00Z',
        control_token: 'dropctl_live_secret',
        claim_url: 'https://autodisc.xyz/claim/drop-1#token=secret',
        limits: {},
      },
    });

    const result = await new AnonymousDeploymentsAPI().deployRepository({
      name: 'example',
      repository: 'https://github.com/example/project',
      branch: 'main',
    });

    expect(createOptions).toHaveBeenCalledWith({ includeAuth: false });
    expect(clientPost).toHaveBeenCalledWith('/v1/drops', {
      name: 'example',
      source: {
        kind: 'github',
        url: 'https://github.com/example/project',
        ref: 'main',
      },
      lifetime_hours: 24,
      requested_mode: 'auto',
      start_command: undefined,
      setup_command: undefined,
      port: undefined,
      environment: {},
    });
    expect(result.drop_id).toBe('drop-1');
  });
});
