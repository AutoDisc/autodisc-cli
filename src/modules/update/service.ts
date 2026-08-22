import { spawn } from 'node:child_process';

export const CLI_PACKAGE_NAME = '@autodisc/cli';
export const CLI_REGISTRY_URL = 'https://registry.npmjs.org/@autodisc%2fcli/latest';

type RegistryResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type FetchRegistry = (url: string, init: { signal: AbortSignal }) => Promise<RegistryResponse>;
type PackageInstaller = (executable: string, args: string[]) => Promise<void>;

function parseVersion(version: string) {
  const normalized = version.trim().replace(/^v/, '');
  const [core, prerelease] = normalized.split('-', 2);
  const parts = core.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid CLI version: ${version}`);
  }
  return { parts, prerelease };
}

export function isNewerVersion(candidate: string, current: string) {
  const next = parseVersion(candidate);
  const installed = parseVersion(current);
  const length = Math.max(next.parts.length, installed.parts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (next.parts[index] || 0) - (installed.parts[index] || 0);
    if (difference !== 0) return difference > 0;
  }

  if (next.prerelease === installed.prerelease) return false;
  if (!next.prerelease) return Boolean(installed.prerelease);
  if (!installed.prerelease) return false;
  return next.prerelease.localeCompare(installed.prerelease, undefined, { numeric: true }) > 0;
}

export async function fetchLatestVersion(
  fetchRegistry: FetchRegistry = fetch,
  timeoutMs = 1_500,
) {
  const response = await fetchRegistry(CLI_REGISTRY_URL, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`npm registry returned HTTP ${response.status}`);
  }

  const payload = await response.json() as { version?: unknown };
  if (typeof payload.version !== 'string' || !payload.version.trim()) {
    throw new Error('npm registry returned an invalid CLI version');
  }
  return payload.version;
}

async function defaultInstaller(executable: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(
        signal
          ? `npm update was terminated by ${signal}`
          : `npm update exited with code ${code ?? 'unknown'}`,
      ));
    });
  });
}

export async function installLatestVersion(
  version: string,
  installer: PackageInstaller = defaultInstaller,
) {
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await installer(npmExecutable, [
    'install',
    '--global',
    `${CLI_PACKAGE_NAME}@${version}`,
  ]);
}
