import boxen from 'boxen';
import chalk from 'chalk';
import { DeviceCodeResponse, DeviceTokenResponse } from '../../types.js';
import { createHttpClient, extractAxiosError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import { createSpinner } from '../../lib/spinner.js';
import { sleep } from '../../lib/time.js';
import { DEVICE_POLL_ERROR, LOGIN_TIMEOUT_MS } from '../../lib/constants.js';
import { saveSession } from './session.js';

const POLL_INTERVAL_DEFAULT = 5_000;

export async function runDeviceCodeLogin() {
  const http = createHttpClient({ includeAuth: false });
  const spinner = createSpinner('Requesting device code');
  spinner.start();

  let response: DeviceCodeResponse;
  try {
    ({ data: response } = await http.post<DeviceCodeResponse>('/cli/auth/device-code'));
    spinner.succeed();
  } catch (error) {
    spinner.fail();
    const message = extractAxiosError(error);
    if (message.includes('404') || message.includes('status 404')) {
      throw new Error('Device code login is not available yet. Use "autodisc login" or "autodisc login --browser".');
    }
    throw new Error(message);
  }

  logger.info(
    boxen(
      `${chalk.bold('Visit:')} ${chalk.cyan(response.verification_uri)}\n${chalk.bold('Code:')} ${chalk.yellow(
        response.user_code
      )}`,
      { padding: 1, borderColor: 'blue', title: 'Autodisc Device Login' }
    )
  );

  const pollSpinner = createSpinner('Waiting for authentication');
  pollSpinner.start();

  const deadline = Date.now() + response.expires_in * 1000;
  const timeoutDeadline = Date.now() + LOGIN_TIMEOUT_MS;
  const interval = (response.interval ? response.interval * 1000 : POLL_INTERVAL_DEFAULT);
  let nextInterval = interval;

  while (Date.now() < deadline && Date.now() < timeoutDeadline) {
    try {
      const { data } = await http.get<DeviceTokenResponse>('/cli/auth/token', {
        params: { device_code: response.device_code },
      });
      pollSpinner.succeed();
      saveSession(data.access_token, data.user, data.expires_in, data.refresh_token);
      return;
    } catch (error) {
      const message = extractAxiosError(error);
      if (message.includes(DEVICE_POLL_ERROR.authorizationPending)) {
        await sleep(nextInterval);
        continue;
      }
      if (message.includes(DEVICE_POLL_ERROR.slowDown)) {
        nextInterval += 1_000;
        await sleep(nextInterval);
        continue;
      }
      pollSpinner.fail();
      throw new Error(message);
    }
  }

  pollSpinner.fail();
  throw new Error('Login timed out. Please run "autodisc login" again.');
}
