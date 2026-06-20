import chalk from 'chalk';
import { HostingAPI } from '../../lib/hosting.js';
import { createSpinner } from '../../lib/spinner.js';
import { logger } from '../../lib/logger.js';

export async function stopServer() {
  const hosting = new HostingAPI();
  const spinner = createSpinner('Stopping hosting server');
  spinner.start();
  try {
    const server = await hosting.stopServer();
    spinner.succeed();
    logger.success(`Server ${server.name} ${chalk.cyan(server.status)}`);
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
