import { HostingAPI } from '../../lib/hosting.js';
import { createSpinner } from '../../lib/spinner.js';
import { logger } from '../../lib/logger.js';
import { confirm } from '../../lib/prompts.js';

export interface DeleteCommandOptions {
  yes?: boolean;
}

export async function deleteServer(options: DeleteCommandOptions = {}) {
  const hosting = new HostingAPI();
  const server = await hosting.getServer();
  if (!server) {
    throw new Error('No hosting server found. Run "autodisc deploy" first.');
  }

  if (!options.yes) {
    if (!process.stdin.isTTY) {
      throw new Error('Refusing to delete without confirmation in a non-interactive terminal. Pass --yes to continue.');
    }
    const confirmed = await confirm(`Permanently delete "${server.name}"?`, false);
    if (!confirmed) {
      logger.info('Deletion cancelled.');
      return;
    }
  }

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
