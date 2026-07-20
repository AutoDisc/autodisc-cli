import type { Command } from 'commander';
import { runCommand } from '../../lib/command.js';

export function registerHostingCommands(program: Command) {
  program
    .command('init')
    .description('Analyze the current project and generate autodisc.yml')
    .option('-p, --path <dir>', 'Project directory to inspect (default: cwd)')
    .option('-f, --force', 'Overwrite an existing config without keeping the current file')
    .action(async (options: { path?: string; force?: boolean }) => {
      await runCommand(async () => {
        const { initProject } = await import('./init.js');
        await initProject(options);
      });
    });

  program
    .command('deploy')
    .description('Deploy the current project using autodisc.yml')
    .option('-c, --config <path>', 'Path to autodisc.yml (default: autodetected)')
    .option('-p, --path <dir>', 'Project directory to deploy (default: cwd)')
    .option('--project <id-or-name>', 'Deploy into an existing Autodisc project')
    .option('--no-start', 'Skip automatic start after upsert')
    .action(async (options: { config?: string; path?: string; project?: string; start?: boolean }) => {
      await runCommand(async () => {
        const { deploy } = await import('./deploy.js');
        await deploy(options);
      });
    });

  program
    .command('status')
    .description('Show the current hosting server status')
    .option('--json', 'Print machine-readable JSON')
    .action(async (options: { json?: boolean }) => {
      await runCommand(async () => {
        const { showStatus } = await import('./status.js');
        await showStatus({ json: Boolean(options.json) });
      });
    });

  program
    .command('logs')
    .description('Show recent logs for the hosting server')
    .option('-f, --follow', 'Stream logs and poll for updates')
    .option('-t, --tail <lines>', 'Number of log lines to fetch (default 200)')
    .option('--json', 'Print machine-readable JSON; with --follow, print newline-delimited snapshots')
    .action(async (options: { follow?: boolean; tail?: string; json?: boolean }) => {
      await runCommand(async () => {
        const tail = options.tail ? Number(options.tail) : undefined;
        if (tail !== undefined && (!Number.isInteger(tail) || tail < 1)) {
          throw new Error('--tail must be a positive integer');
        }
        const { showLogs } = await import('./logs.js');
        await showLogs({ follow: Boolean(options.follow), tail, json: Boolean(options.json) });
      });
    });

  program
    .command('metrics')
    .description('Show CPU, memory, and recent deployment status for the hosting server')
    .option('--json', 'Print machine-readable JSON; with --watch, print newline-delimited snapshots')
    .option('-w, --watch', 'Poll metrics until interrupted')
    .option('-i, --interval <seconds>', 'Polling interval for --watch (default 2)')
    .action(async (options: { json?: boolean; watch?: boolean; interval?: string }) => {
      await runCommand(async () => {
        const interval = options.interval ? Number(options.interval) : undefined;
        if (interval !== undefined && (!Number.isFinite(interval) || interval <= 0)) {
          throw new Error('--interval must be a positive number');
        }
        const { showMetrics } = await import('./metrics.js');
        await showMetrics({ json: Boolean(options.json), watch: Boolean(options.watch), interval });
      });
    });

  program
    .command('start')
    .description('Start the hosting server')
    .action(async () => {
      await runCommand(async () => {
        const { startServer } = await import('./start.js');
        await startServer();
      });
    });

  program
    .command('stop')
    .description('Stop the hosting server')
    .action(async () => {
      await runCommand(async () => {
        const { stopServer } = await import('./stop.js');
        await stopServer();
      });
    });

  program
    .command('restart')
    .description('Restart the hosting server')
    .action(async () => {
      await runCommand(async () => {
        const { restartServer } = await import('./restart.js');
        await restartServer();
      });
    });

  program
    .command('delete')
    .description('Permanently delete the hosting server')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .action(async (options: { yes?: boolean }) => {
      await runCommand(async () => {
        const { deleteServer } = await import('./delete.js');
        await deleteServer({ yes: Boolean(options.yes) });
      });
    });

  const env = program
    .command('env')
    .description('Manage hosting environment variables')
    .option('--show-values', 'Reveal environment values in terminal output')
    .option('--json', 'Print machine-readable JSON (keys only unless --show-values is set)');

  env.action(async (options: { showValues?: boolean; json?: boolean }) => {
    await runCommand(async () => {
      const { listEnv } = await import('./env.js');
      await listEnv({ showValues: Boolean(options.showValues), json: Boolean(options.json) });
    });
  });

  env
    .command('set [pairs...]')
    .description('Set KEY=VALUE pairs; pass a KEY without a value for a masked prompt')
    .action(async (pairs: string[]) => {
      await runCommand(async () => {
        const { setEnv } = await import('./env.js');
        await setEnv(pairs);
      });
    });

  env
    .command('unset <keys...>')
    .description('Remove one or more environment variables')
    .action(async (keys: string[]) => {
      await runCommand(async () => {
        const { unsetEnv } = await import('./env.js');
        await unsetEnv(keys);
      });
    });

  env
    .command('pull')
    .description('Download environment variables to a .env file')
    .option('-o, --output <path>', 'Target file (default: .env)')
    .action(async (options: { output?: string }) => {
      await runCommand(async () => {
        const { pullEnv } = await import('./env.js');
        await pullEnv({ path: options.output });
      });
    });

  env
    .command('push [file]')
    .description('Upload environment variables from a .env file')
    .action(async (file?: string) => {
      await runCommand(async () => {
        const { pushEnv } = await import('./env.js');
        await pushEnv(file);
      });
    });
}
