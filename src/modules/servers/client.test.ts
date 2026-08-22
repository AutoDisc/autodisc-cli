import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, createHttpClient } = vi.hoisted(() => {
  const get = vi.fn();
  const post = vi.fn();
  return { get, post, createHttpClient: vi.fn(() => ({ get, post })) };
});

vi.mock('../../lib/http.js', () => ({ createHttpClient }));

import { ServersAPI } from './client.js';

beforeEach(() => vi.clearAllMocks());

describe('ServersAPI', () => {
  it('always targets the public API for both browser sessions and API keys', () => {
    new ServersAPI();
    expect(createHttpClient).toHaveBeenCalledWith({ publicApi: true });
  });

  it('uses canonical project UUID routes', async () => {
    get.mockResolvedValue({ data: [] });
    await new ServersAPI().list('project id');
    expect(get).toHaveBeenCalledWith('/v1/projects/project%20id/servers');
  });

  it('creates quotes with provider-neutral public fields', async () => {
    post.mockResolvedValue({ data: { id: 'quote-1' } });
    await new ServersAPI().quote('project-1', {
      region: 'us-west',
      shapeCode: 'micro-1',
      storageGb: 20,
      publicIpv4Enabled: true,
      quotaBehavior: 'stop',
    });
    expect(post).toHaveBeenCalledWith('/v1/projects/project-1/servers/quotes', {
      region: 'us-west',
      shape_code: 'micro-1',
      storage_gb: 20,
      public_ipv4_enabled: true,
      quota_behavior: 'stop',
    });
  });

  it('sends the accepted quote token and stable retry key when provisioning', async () => {
    post.mockResolvedValue({ data: { server: {}, operation: {} } });
    await new ServersAPI().create('project-1', {
      name: 'preview',
      quoteToken: 'quote-token',
      idempotencyKey: 'preview-1234',
    });
    expect(post).toHaveBeenCalledWith('/v1/projects/project-1/servers', {
      name: 'preview',
      quote_token: 'quote-token',
      idempotency_key: 'preview-1234',
      image_code: 'autodisc-linux',
    });
  });

  it('keeps lifecycle mutations project scoped', async () => {
    post.mockResolvedValue({ data: { server: {}, operation: {} } });
    await new ServersAPI().lifecycle('project-1', 'server-1', 'restart', 'restart-1234');
    expect(post).toHaveBeenCalledWith(
      '/v1/projects/project-1/servers/server-1/lifecycle',
      { action: 'restart', idempotency_key: 'restart-1234' },
    );
  });
});
