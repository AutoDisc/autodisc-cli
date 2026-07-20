import chalk from 'chalk';
import { HostingAPI, redactServerEnvironment } from '../../lib/hosting.js';
import { logger } from '../../lib/logger.js';

export interface StatusOptions {
  json?: boolean;
}

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function showStatus(options: StatusOptions = {}) {
  const hosting = new HostingAPI();
  const server = await hosting.getServer();
  if (!server) {
    if (options.json) {
      printJson({ server: null });
      return;
    }
    logger.warn('No hosting server found. Run `autodisc deploy` first.');
    return;
  }

  if (options.json) {
    printJson({ server: redactServerEnvironment(server) });
    return;
  }

  logger.info(`Name:        ${server.name}`);
  logger.info(`Plan:        ${server.plan_type}`);
  logger.info(`Source:      ${server.source_type}`);
  logger.info(`Status:      ${chalk.cyan(server.status)}${server.status_reason ? ` (${server.status_reason})` : ''}`);
  if (server.repo_full_name) {
    logger.info(`Repo:        ${server.repo_full_name}@${server.repo_branch ?? 'main'}`);
  }
  if (server.start_command) {
    logger.info(`Start Cmd:   ${server.start_command}`);
  }
  if (server.environment && Object.keys(server.environment).length > 0) {
    logger.info('Environment:');
    Object.keys(server.environment).forEach((key) => logger.info(`  ${key}=[hidden]`));
  }
}
