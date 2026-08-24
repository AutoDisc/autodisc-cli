import { describe, expect, it } from 'vitest';
import { actionableLogsError } from './logs.js';

describe('logs diagnostics', () => {
  it('prevents an edge timeout from being presented as an application diagnosis', () => {
    const result = actionableLogsError(new Error(
      'The origin web server did not respond to Cloudflare within the allowed time.',
    ));

    expect(result.message).toContain('does not identify the application\'s runtime cause');
    expect(result.message).toContain('Do not delete or recreate the project');
  });
});
