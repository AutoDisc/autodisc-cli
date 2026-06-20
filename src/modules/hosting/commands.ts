import type { Command } from 'commander';
import { logger } from '../../lib/logger.js';

export function registerHostingCommands(program: Command) {
  program
    .command('init')
    .description('Analyze the current project and generate autodisc.yml')
    .option('-p, --path <dir>', 'Project directory to inspect (default: cwd)')
    .option('-f, --force', 'Overwrite an existing config without keeping the current file')
    .action(async (options: { path?: string; force?: boolean }) => {
      const { initProject } = await import('./init.js');
      try {
        await initProject(options);
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('deploy')
    .description('Deploy the current project using autodisc.yml')
    .option('-c, --config <path>', 'Path to autodisc.yml (default: autodetected)')
    .option('-p, --path <dir>', 'Project directory to deploy (default: cwd)')
    .option('--no-start', 'Skip automatic start after upsert')
    .action(async (options: { config?: string; path?: string; start?: boolean }) => {
      const { deploy } = await import('./deploy.js');
      try {
        await deploy(options);
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('status')
    .description('Show the current hosting server status')
    .option('--json', 'Print machine-readable JSON')
    .action(async (options: { json?: boolean }) => {
      const { showStatus } = await import('./status.js');
      try {
        await showStatus({ json: Boolean(options.json) });
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('logs')
    .description('Show recent logs for the hosting server')
    .option('-f, --follow', 'Stream logs and poll for updates')
    .option('-t, --tail <lines>', 'Number of log lines to fetch (default 200)')
    .option('--json', 'Print machine-readable JSON; with --follow, print newline-delimited snapshots')
    .action(async (options: { follow?: boolean; tail?: string; json?: boolean }) => {
      const { showLogs } = await import('./logs.js');
      try {
        const tail = options.tail ? Number(options.tail) : undefined;
        if (tail !== undefined && (!Number.isInteger(tail) || tail < 1)) {
          throw new Error('--tail must be a positive integer');
        }
        await showLogs({ follow: Boolean(options.follow), tail, json: Boolean(options.json) });
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('metrics')
    .description('Show CPU, memory, and recent deployment status for the hosting server')
    .option('--json', 'Print machine-readable JSON; with --watch, print newline-delimited snapshots')
    .option('-w, --watch', 'Poll metrics until interrupted')
    .option('-i, --interval <seconds>', 'Polling interval for --watch (default 2)')
    .action(async (options: { json?: boolean; watch?: boolean; interval?: string }) => {
      const { showMetrics } = await import('./metrics.js');
      try {
        const interval = options.interval ? Number(options.interval) : undefined;
        if (interval !== undefined && (!Number.isFinite(interval) || interval <= 0)) {
          throw new Error('--interval must be a positive number');
        }
        await showMetrics({ json: Boolean(options.json), watch: Boolean(options.watch), interval });
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('start')
    .description('Start the hosting server')
    .action(async () => {
      const { startServer } = await import('./start.js');
      try {
        await startServer();
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('stop')
    .description('Stop the hosting server')
    .action(async () => {
      const { stopServer } = await import('./stop.js');
      try {
        await stopServer();
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('restart')
    .description('Restart the hosting server')
    .action(async () => {
      const { restartServer } = await import('./restart.js');
      try {
        await restartServer();
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('delete')
    .description('Delete the hosting server')
    .action(async () => {
      const { deleteServer } = await import('./delete.js');
      try {
        await deleteServer();
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  const env = program.command('env').description('Manage hosting environment variables');

  env.action(async () => {
    const { listEnv } = await import('./env.js');
    try {
      await listEnv();
    } catch (error) {
      logger.error((error as Error).message);
      process.exitCode = 1;
    }
  });

  env
    .command('set [pairs...]')
    .description('Set one or more KEY=VALUE pairs')
    .action(async (pairs: string[]) => {
      const { setEnv } = await import('./env.js');
      try {
        await setEnv(pairs);
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  env
    .command('unset <keys...>')
    .description('Remove one or more environment variables')
    .action(async (keys: string[]) => {
      const { unsetEnv } = await import('./env.js');
      try {
        await unsetEnv(keys);
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  env
    .command('pull')
    .description('Download environment variables to a .env file')
    .option('-o, --output <path>', 'Target file (default: .env)')
    .action(async (options: { output?: string }) => {
      const { pullEnv } = await import('./env.js');
      try {
        await pullEnv({ path: options.output });
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  env
    .command('push [file]')
    .description('Upload environment variables from a .env file')
    .action(async (file?: string) => {
      const { pushEnv } = await import('./env.js');
      try {
        await pushEnv(file);
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });
}
