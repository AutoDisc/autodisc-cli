import { createHttpClient, extractAxiosError } from '../../lib/http.js';
import { createSpinner } from '../../lib/spinner.js';
import { input } from '../../lib/prompts.js';
import { saveSession } from './session.js';
import type { User } from '../../types.js';

function normalizeToken(raw?: string | boolean): string {
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return '';
}

export async function runApiTokenLogin(provided?: string | boolean) {
  let token = normalizeToken(provided);
  if (!token) {
    token = await input('Enter your Autodisc API token:', {
      validate: (value) => (value?.trim() ? true : 'Token is required'),
    });
  }

  const spinner = createSpinner('Verifying API token');
  spinner.start();
  try {
    const client = createHttpClient({ token });
    const { data: user } = await client.get<User>('/auth/me');
    spinner.succeed();
    saveSession(token, user);
  } catch (error) {
    spinner.fail();
    throw new Error(extractAxiosError(error));
  }
}
