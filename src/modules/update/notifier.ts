import { getConfigManager } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { fetchLatestVersion, isNewerVersion } from './service.js';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;

type UpdateCheckState = {
  checkedAt?: string;
  latestVersion?: string;
};

function shouldSkipUpdateNotice(args: string[]) {
  return Boolean(
    process.env.CI
    || process.env.AUTODISC_DISABLE_UPDATE_CHECK === '1'
    || args.includes('--json')
    || args.includes('--help')
    || args.includes('-h')
    || args.includes('--version')
    || args.includes('-V')
    || args[2] === 'update'
    || !process.stderr.isTTY,
  );
}

export async function maybeNotifyAboutUpdate(currentVersion: string, args = process.argv) {
  if (shouldSkipUpdateNotice(args)) return;

  const config = getConfigManager();
  const state = config.getValue<UpdateCheckState>('updates') || {};
  const checkedAt = state.checkedAt ? Date.parse(state.checkedAt) : Number.NaN;
  const checkIsFresh = Number.isFinite(checkedAt) && Date.now() - checkedAt < CHECK_INTERVAL_MS;

  let latestVersion = state.latestVersion;
  if (!checkIsFresh) {
    try {
      latestVersion = await fetchLatestVersion();
      config.setValue('updates', {
        checkedAt: new Date().toISOString(),
        latestVersion,
      });
    } catch (error) {
      logger.debug('Unable to check for a CLI update:', error);
      return;
    }
  }

  if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
    logger.warn(`Autodisc CLI ${latestVersion} is available. Run \`autodisc update\`.`);
  }
}
