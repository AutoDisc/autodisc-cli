import { describe, expect, it } from 'vitest';
import { checkApiUrl, checkNodeVersion } from './doctor.js';

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
});
