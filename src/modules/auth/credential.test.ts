import { afterEach, describe, expect, it } from 'vitest';
import {
  credentialHeaders,
  credentialTypeForToken,
  environmentCredential,
} from './credential.js';

afterEach(() => {
  delete process.env.AUTODISC_API_KEY;
  delete process.env.AUTODISC_TOKEN;
});

describe('CLI credential selection', () => {
  it('recognizes dashboard API keys and sends only X-API-Key', () => {
    expect(credentialTypeForToken('adk_example')).toBe('api_key');
    expect(credentialHeaders('adk_example')).toEqual({ 'X-API-Key': 'adk_example' });
  });

  it('keeps browser sessions on bearer authentication', () => {
    expect(credentialTypeForToken('session-token')).toBe('session');
    expect(credentialHeaders('session-token')).toEqual({
      Authorization: 'Bearer session-token',
    });
  });

  it('prefers AUTODISC_API_KEY over the legacy token environment variable', () => {
    process.env.AUTODISC_API_KEY = 'adk_ci';
    process.env.AUTODISC_TOKEN = 'session-token';
    expect(environmentCredential()).toEqual({
      token: 'adk_ci',
      credentialType: 'api_key',
    });
  });
});
