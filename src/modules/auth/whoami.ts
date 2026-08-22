import { createHttpClient, extractAxiosError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import { createSpinner } from '../../lib/spinner.js';
import { getSession, normalizeUser, requireSession, saveSession } from './session.js';
import type { SessionIdentityResponse } from '../../types.js';

export async function whoAmI() {
  const session = await requireSession();
  if (session.credentialType === 'api_key') {
    const spinner = createSpinner('Checking API key');
    spinner.start();
    try {
      await createHttpClient().get('/servers/regions');
      spinner.succeed();
      logger.success(`Authenticated with API key ${session.token.slice(0, 12)}…`);
      return;
    } catch (error) {
      spinner.fail();
      logger.error(extractAxiosError(error));
      throw error;
    }
  }
  if (session.user?.email) {
    logger.info(`Authenticated as ${session.user.email}`);
  } else {
    logger.info('Authenticated. Fetching account details...');
  }

  const spinner = createSpinner('Checking session');
  spinner.start();
  try {
    const client = createHttpClient();
    const { data } = await client.get<SessionIdentityResponse>('/auth/me');
    const user = normalizeUser(data);
    spinner.succeed();
    saveSession(session.token, user);
    logger.success(`You are logged in as ${user.email}`);
  } catch (error) {
    spinner.fail();
    if (!getSession()?.token) {
      logger.error('Not authenticated. Please run "autodisc login".');
      return;
    }
    logger.error(extractAxiosError(error));
    throw error;
  }
}
