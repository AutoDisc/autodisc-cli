import chalk from 'chalk';
import { ensureAuthenticated, getSession } from './auth/session.js';
import { HostingAPI } from '../lib/hosting.js';
import { logger } from '../lib/logger.js';
import type { HostingProjectResponse, HostingServerResponse } from '../types.js';

const MAX_PROJECTS = 5;
const LOG_TAIL_LINES = 6;

function formatStatus(server: HostingServerResponse) {
  const color =
    server.status === 'running'
      ? chalk.green
      : server.status === 'error'
        ? chalk.red
        : server.status === 'provisioning'
          ? chalk.yellow
          : chalk.cyan;

  const base = color(server.status);
  return server.status_reason ? `${base} (${server.status_reason})` : base;
}

function formatServiceLine(service: HostingServerResponse) {
  const source = service.repo_full_name
    ? `${service.repo_full_name}@${service.repo_branch ?? 'main'}`
    : service.source_type;
  return `  - ${service.name}  ${formatStatus(service)}  ${chalk.gray(source)}`;
}

function summarizeProject(project: HostingProjectResponse) {
  const running = project.services.filter((service) => service.status === 'running').length;
  const total = project.services.length;
  logger.info(`${chalk.bold(project.name)} ${chalk.gray(`/${project.slug}`)}  ${running}/${total} running`);

  if (total === 0) {
    logger.info(chalk.gray('  No services yet'));
    return;
  }

  project.services.slice(0, 3).forEach((service) => logger.info(formatServiceLine(service)));
  if (total > 3) {
    logger.info(chalk.gray(`  ...and ${total - 3} more services`));
  }
}

function selectLogServer(projects: HostingProjectResponse[]) {
  for (const project of projects) {
    const running = project.services.find((service) => service.status === 'running');
    if (running) return running;
  }
  for (const project of projects) {
    if (project.services[0]) return project.services[0];
  }
  return null;
}

function printRecentLogs(logs: string) {
  const lines = logs
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-LOG_TAIL_LINES);

  if (lines.length === 0) {
    logger.info(chalk.gray('No recent log lines available.'));
    return;
  }

  lines.forEach((line) => {
    process.stdout.write(`${chalk.gray('  ')}${line}\n`);
  });
}

function printNextSteps(authenticated: boolean, hasProjects: boolean) {
  logger.info('');
  logger.info(chalk.bold('Next steps'));
  if (!authenticated) {
    logger.info('  autodisc login');
    logger.info('  autodisc init');
    logger.info('  autodisc deploy');
    return;
  }

  if (!hasProjects) {
    logger.info('  autodisc init');
    logger.info('  autodisc deploy');
    return;
  }

  logger.info('  autodisc deploy');
  logger.info('  autodisc status');
  logger.info('  autodisc logs --follow');
}

export async function showOverview() {
  const hosting = new HostingAPI();

  try {
    const session = await ensureAuthenticated();
    logger.info(chalk.bold('Autodisc overview'));
    logger.info(
      `Signed in as ${chalk.cyan(session.user.email || getSession()?.user?.email || 'your account')}`
    );

    const projects = await hosting.listProjects();
    logger.info('');
    logger.info(chalk.bold(`Projects (${projects.length})`));

    if (projects.length === 0) {
      logger.info(chalk.gray('No projects yet. Start by running `autodisc init` and `autodisc deploy`.'));
      printNextSteps(true, false);
      return;
    }

    projects.slice(0, MAX_PROJECTS).forEach(summarizeProject);
    if (projects.length > MAX_PROJECTS) {
      logger.info(chalk.gray(`...and ${projects.length - MAX_PROJECTS} more projects`));
    }

    const logServer = selectLogServer(projects);
    if (logServer) {
      logger.info('');
      logger.info(chalk.bold(`Recent logs: ${logServer.name}`));
      try {
        const { logs } = await hosting.fetchServerLogs(LOG_TAIL_LINES, logServer.id);
        printRecentLogs(logs);
      } catch (error) {
        logger.warn(`Could not load recent logs: ${(error as Error).message}`);
      }
    }

    printNextSteps(true, true);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('Not authenticated')) {
      logger.info(chalk.bold('Autodisc overview'));
      logger.warn('This machine is not authenticated yet.');
      printNextSteps(false, false);
      return;
    }
    throw error;
  }
}
