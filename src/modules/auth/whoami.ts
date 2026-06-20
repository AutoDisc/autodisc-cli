import { createHttpClient, extractAxiosError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import { createSpinner } from '../../lib/spinner.js';
import { getSession, requireSession, saveSession } from './session.js';
import type { User } from '../../types.js';

export async function whoAmI() {
  const session = await requireSession();
  if (session.user?.email) {
    logger.info(`Authenticated as ${session.user.email}`);
  } else {
    logger.info('Authenticated. Fetching account details...');
  }

  const spinner = createSpinner('Checking session');
  spinner.start();
  try {
    const client = createHttpClient();
    const { data: user } = await client.get<User>('/auth/me');
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
