import { clearSession, getSession } from './session.js';
import { logger } from '../../lib/logger.js';

export async function logout() {
  const session = getSession();
  if (!session?.token) {
    logger.info('You are already logged out.');
    return;
  }
  clearSession();
}
