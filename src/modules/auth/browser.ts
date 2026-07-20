import http from 'node:http';
import { URL } from 'node:url';
import getPort from 'get-port';
import open from 'open';

import { createHttpClient, extractAxiosError } from '../../lib/http.js';
import { createSpinner } from '../../lib/spinner.js';
import { logger } from '../../lib/logger.js';
import { getConfigManager } from '../../lib/config.js';
import { LOGIN_TIMEOUT_MS } from '../../lib/constants.js';
import type { BrowserCallbackPayload, SessionIdentityResponse } from '../../types.js';
import { normalizeUser, saveSession } from './session.js';

const CALLBACK_PATH = '/callback';

function successHtml(message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Autodisc CLI</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem; color: #0f172a; }
      .card { max-width: 420px; border: 1px solid #cbd5f5; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1); }
      h1 { font-size: 1.4rem; margin-bottom: 0.75rem; }
      p { margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>You're all set!</h1>
      <p>${message}</p>
      <p>You can close this tab and return to your terminal.</p>
    </div>
  </body>
</html>`;
}

function errorHtml(message: string) {
  return successHtml(message);
}

export async function runBrowserLogin() {
  const config = getConfigManager();
  const apiUrl = config.getApiUrl();
  const port = await getPort();
  const authUrl = `${apiUrl}/cli/auth?port=${port}`;

  logger.info('Opening browser for authentication...');
  logger.info(`If the browser does not open, visit: ${authUrl}`);

  const payloadPromise = new Promise<BrowserCallbackPayload>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid request');
        return;
      }

      const requestUrl = new URL(req.url, `http://localhost:${port}`);
      if (requestUrl.pathname !== CALLBACK_PATH) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const token = requestUrl.searchParams.get('token');
      if (!token) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(errorHtml('Missing token in callback.'));
        reject(new Error('Browser login missing token.'));
        server.close();
        return;
      }

      const expiresIn = requestUrl.searchParams.get('expires_in');
      const refreshToken = requestUrl.searchParams.get('refresh_token') ?? undefined;

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(successHtml('Autodisc CLI authenticated successfully.'));

      resolve({
        token,
        refreshToken,
        expiresIn: expiresIn ? Number(expiresIn) : undefined,
      });
      server.close();
    });

    server.listen(port);

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Browser login timed out.'));
    }, LOGIN_TIMEOUT_MS);

    server.on('close', () => {
      clearTimeout(timeout);
    });
  });

  try {
    await open(authUrl, { wait: false });
  } catch (error) {
    logger.warn('Unable to automatically open your browser. Please open the URL above manually.');
  }

  const payload = await payloadPromise;

  const spinner = createSpinner('Finalizing authentication');
  spinner.start();

  try {
    const client = createHttpClient({ token: payload.token });
    const { data } = await client.get<SessionIdentityResponse>('/auth/me');
    spinner.succeed();
    saveSession(payload.token, normalizeUser(data), payload.expiresIn, payload.refreshToken);
  } catch (error) {
    spinner.fail();
    throw new Error(extractAxiosError(error));
  }
}
