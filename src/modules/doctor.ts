import fs from 'node:fs';
import path from 'node:path';
import { getConfigManager } from '../lib/config.js';
import { hasDeployConfig, loadDeployConfig } from '../lib/deploy-config.js';
import { createHttpClient, extractAxiosError } from '../lib/http.js';
import { logger } from '../lib/logger.js';

export type DoctorStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
}

export interface DoctorOptions {
  json?: boolean;
  network?: boolean;
  path?: string;
}

const MINIMUM_NODE_MAJOR = 18;

export function checkNodeVersion(version = process.versions.node): DoctorCheck {
  const major = Number(version.split('.')[0]);
  const supported = Number.isInteger(major) && major >= MINIMUM_NODE_MAJOR;
  return {
    name: 'Node.js',
    status: supported ? 'pass' : 'fail',
    message: supported
      ? `${version} (supported)`
      : `${version} is unsupported; install Node.js ${MINIMUM_NODE_MAJOR} or newer`,
  };
}

export function checkApiUrl(value: string): DoctorCheck {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('URL must use http or https');
    }
    return { name: 'API URL', status: 'pass', message: url.toString().replace(/\/$/, '') };
  } catch (error) {
    return {
      name: 'API URL',
      status: 'fail',
      message: `${value} is invalid: ${(error as Error).message}`,
    };
  }
}

function checkConfigStorage(configPath: string): DoctorCheck {
  const directory = path.dirname(configPath);
  try {
    fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
    return { name: 'Config storage', status: 'pass', message: configPath };
  } catch (error) {
    return {
      name: 'Config storage',
      status: 'fail',
      message: `${directory} is not readable and writable: ${(error as Error).message}`,
    };
  }
}

function checkProjectConfig(projectRoot: string): DoctorCheck {
  if (!hasDeployConfig(projectRoot)) {
    return {
      name: 'Project config',
      status: 'warn',
      message: `No autodisc.yml found in ${projectRoot}; run "autodisc init" when you are ready to deploy`,
    };
  }

  try {
    const config = loadDeployConfig(projectRoot);
    return {
      name: 'Project config',
      status: 'pass',
      message: `autodisc.yml is valid (${config.name})`,
    };
  } catch (error) {
    return {
      name: 'Project config',
      status: 'fail',
      message: (error as Error).message,
    };
  }
}

async function checkApiConnection(): Promise<DoctorCheck> {
  try {
    const client = createHttpClient({ includeAuth: false });
    const response = await client.get<{ status?: string }>('/status', { timeout: 5_000 });
    return {
      name: 'API connection',
      status: 'pass',
      message: `reachable${response.data.status ? ` (${response.data.status})` : ''}`,
    };
  } catch (error) {
    return {
      name: 'API connection',
      status: 'fail',
      message: extractAxiosError(error),
    };
  }
}

function printCheck(check: DoctorCheck): void {
  const message = `${check.name}: ${check.message}`;
  if (check.status === 'pass') logger.success(message);
  if (check.status === 'warn') logger.warn(message);
  if (check.status === 'fail') logger.error(message);
}

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorCheck[]> {
  const config = getConfigManager();
  const projectRoot = path.resolve(options.path ?? process.cwd());
  const checks: DoctorCheck[] = [
    checkNodeVersion(),
    checkApiUrl(config.getApiUrl()),
    checkConfigStorage(config.path),
    {
      name: 'Authentication',
      status: config.getToken() ? 'pass' : 'warn',
      message: config.getToken() ? 'credentials are configured' : 'not signed in; run "autodisc login"',
    },
    checkProjectConfig(projectRoot),
  ];

  if (options.network !== false && checks.find((check) => check.name === 'API URL')?.status !== 'fail') {
    checks.push(await checkApiConnection());
  } else if (options.network === false) {
    checks.push({ name: 'API connection', status: 'warn', message: 'skipped (--offline)' });
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: !checks.some((check) => check.status === 'fail'), checks }, null, 2)}\n`);
  } else {
    logger.info('Autodisc diagnostics');
    checks.forEach(printCheck);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warned = checks.filter((check) => check.status === 'warn').length;
    if (failed === 0) logger.success(`Doctor finished with ${warned} warning${warned === 1 ? '' : 's'}.`);
    else logger.error(`Doctor found ${failed} failure${failed === 1 ? '' : 's'} and ${warned} warning${warned === 1 ? '' : 's'}.`);
  }

  if (checks.some((check) => check.status === 'fail')) {
    process.exitCode = 1;
  }
  return checks;
}
