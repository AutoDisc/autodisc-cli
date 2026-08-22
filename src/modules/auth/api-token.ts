import { createHttpClient, extractAxiosError } from '../../lib/http.js';
import { createSpinner } from '../../lib/spinner.js';
import { input } from '../../lib/prompts.js';
import { normalizeUser, saveSession } from './session.js';
import type { SessionIdentityResponse } from '../../types.js';
import { credentialTypeForToken } from './credential.js';

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
    const credentialType = credentialTypeForToken(token);
    const client = createHttpClient({ token, credentialType });
    if (credentialType === 'api_key') {
      await client.get('/servers/regions');
      spinner.succeed();
      saveSession(
        token,
        { id: '', email: '' },
        undefined,
        undefined,
        'api_key',
      );
      return;
    }
    const { data } = await client.get<SessionIdentityResponse>('/auth/me');
    spinner.succeed();
    saveSession(token, normalizeUser(data));
  } catch (error) {
    spinner.fail();
    throw new Error(extractAxiosError(error));
  }
}
