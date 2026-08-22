import type { Command } from 'commander';
import { runCommand } from '../../lib/command.js';
import { logger } from '../../lib/logger.js';
import { fetchLatestVersion, installLatestVersion, isNewerVersion } from './service.js';

type UpdateOptions = {
  check?: boolean;
  json?: boolean;
};

export function registerUpdateCommand(program: Command, currentVersion: string) {
  program
    .command('update')
    .description('Check for and install the latest Autodisc CLI')
    .option('--check', 'Check for an update without installing it')
    .option('--json', 'Print machine-readable update information')
    .action(async (options: UpdateOptions) => {
      await runCommand(async () => {
        const latestVersion = await fetchLatestVersion();
        const updateAvailable = isNewerVersion(latestVersion, currentVersion);

        if (options.json) {
          console.log(JSON.stringify({ currentVersion, latestVersion, updateAvailable }));
        } else if (!updateAvailable) {
          logger.success(`Autodisc CLI ${currentVersion} is up to date`);
        } else if (options.check) {
          logger.info(`Autodisc CLI ${latestVersion} is available (installed: ${currentVersion})`);
          logger.info('Run `autodisc update` to install it');
        }

        if (!updateAvailable || options.check) return;

        if (!options.json) {
          logger.info(`Updating Autodisc CLI ${currentVersion} → ${latestVersion}`);
        }
        await installLatestVersion(latestVersion);
        if (!options.json) {
          logger.success(`Updated Autodisc CLI to ${latestVersion}`);
        }
      });
    });
}
