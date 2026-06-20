import path from 'path';
import os from 'os';

export const DEFAULT_API_URL = 'https://autodisc.xyz';
export const API_BASE_PATH = '/api';

export const CONFIG_DIR = process.env.AUTODISC_CONFIG_PATH
  ? path.resolve(process.env.AUTODISC_CONFIG_PATH)
  : path.join(os.homedir(), '.autodisc');

export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export const DEVICE_POLL_ERROR = {
  authorizationPending: 'authorization_pending',
  slowDown: 'slow_down',
};

export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
