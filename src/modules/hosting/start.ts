import chalk from 'chalk';
import { HostingAPI } from '../../lib/hosting.js';
import { createSpinner } from '../../lib/spinner.js';
import { logger } from '../../lib/logger.js';

export async function startServer() {
  const hosting = new HostingAPI();
  const spinner = createSpinner('Starting hosting server');
  spinner.start();
  try {
    const server = await hosting.startServer();
    spinner.succeed();
    logger.success(`Server ${server.name} ${chalk.cyan(server.status)}`);
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
