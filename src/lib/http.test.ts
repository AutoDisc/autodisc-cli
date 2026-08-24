import { describe, expect, it } from 'vitest';
import { extractAxiosError } from './http.js';

describe('extractAxiosError', () => {
  it('formats structured validation details instead of stringifying an object', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          detail: [
            { loc: ['body', 'service_id'], msg: 'Field required', type: 'missing' },
          ],
        },
      },
    };

    expect(extractAxiosError(error)).toBe('body.service_id: Field required');
  });

  it('unwraps nested object errors', () => {
    const error = {
      isAxiosError: true,
      response: { data: { error: { message: 'Database is not ready' } } },
    };

    expect(extractAxiosError(error)).toBe('Database is not ready');
  });
});
