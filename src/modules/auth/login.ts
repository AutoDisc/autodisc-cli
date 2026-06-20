import { logger } from '../../lib/logger.js';
import { runDeviceCodeLogin } from './device-code.js';
import { runBrowserLogin } from './browser.js';
import { runApiTokenLogin } from './api-token.js';

export interface LoginOptions {
  token?: string | boolean;
  browser?: boolean;
  device?: boolean;
}

export async function login(options: LoginOptions) {
  const tokenOption = options.token;
  if (tokenOption) {
    logger.info('Authenticating with API token...');
    await runApiTokenLogin(tokenOption);
    return;
  }

  if (options.device) {
    logger.info('Authenticating via device code flow...');
    await runDeviceCodeLogin();
    return;
  }

  if (options.browser || !options.device) {
    logger.info('Authenticating via browser...');
    await runBrowserLogin();
    return;
  }
}
