import { HostingAPI } from '../../lib/hosting.js';
import { createSpinner } from '../../lib/spinner.js';
import { logger } from '../../lib/logger.js';

export async function deleteServer() {
  const hosting = new HostingAPI();
  const spinner = createSpinner('Deleting hosting server');
  spinner.start();
  try {
    const server = await hosting.deleteServer();
    spinner.succeed();
    logger.success(`Deleted hosting server ${server.name}`);
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
