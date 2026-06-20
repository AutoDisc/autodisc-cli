import chalk from 'chalk';
import { HostingAPI } from '../../lib/hosting.js';
import { createSpinner } from '../../lib/spinner.js';
import { logger } from '../../lib/logger.js';

export async function restartServer() {
  const hosting = new HostingAPI();
  const spinner = createSpinner('Restarting hosting server');
  spinner.start();
  try {
    const stopped = await hosting.stopServer();
    logger.info(`Stopped ${stopped.name} (${stopped.status})`);
    const started = await hosting.startServer();
    spinner.succeed();
    logger.success(`Server ${started.name} ${chalk.cyan(started.status)}`);
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
