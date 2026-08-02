import { describe, expect, it } from 'vitest';
import { checkApiStatus, checkApiUrl, checkNodeVersion } from './doctor.js';

describe('doctor checks', () => {
  it('accepts supported Node.js releases', () => {
    expect(checkNodeVersion('18.0.0')).toMatchObject({ status: 'pass' });
    expect(checkNodeVersion('24.1.0')).toMatchObject({ status: 'pass' });
  });

  it('rejects unsupported Node.js releases', () => {
    expect(checkNodeVersion('16.20.0')).toMatchObject({ status: 'fail' });
  });

  it('only accepts HTTP API URLs', () => {
    expect(checkApiUrl('https://autodisc.xyz')).toMatchObject({ status: 'pass' });
    expect(checkApiUrl('file:///tmp/autodisc')).toMatchObject({ status: 'fail' });
    expect(checkApiUrl('not a url')).toMatchObject({ status: 'fail' });
  });

  it('fails when the reachable status endpoint reports an outage', () => {
    expect(checkApiStatus({
      status: 'outage',
      services: [
        { name: 'API', status: 'operational' },
        { name: 'Hosting', status: 'outage' },
      ],
    })).toEqual({
      name: 'API connection',
      status: 'fail',
      message: 'reachable, but Autodisc reports an outage; Hosting=outage',
    });
  });

  it('warns when the reachable status endpoint reports degraded service', () => {
    expect(checkApiStatus({
      status: 'degraded',
      services: [{ name: 'Fleet', status: 'degraded' }],
    })).toMatchObject({
      status: 'warn',
      message: 'reachable, but Autodisc reports degraded service; Fleet=degraded',
    });
  });

  it('passes an operational API status', () => {
    expect(checkApiStatus({ status: 'operational' })).toMatchObject({
      status: 'pass',
      message: 'reachable (operational)',
    });
  });
});
