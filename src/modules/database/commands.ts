import type { Command } from 'commander';
import { runCommand } from '../../lib/command.js';

type ProjectOptions = { project?: string; json?: boolean };

function registerAddOptions(command: Command): Command {
  return command
    .option('--project <id-or-name>', 'Target project (defaults to the selected project)')
    .option('--name <name>', 'Database name (defaults to the engine name)')
    .option('--description <text>', 'Describe what the database stores')
    .option('--environment <id>', 'Target project environment ID')
    .option('--bind <service[:variable]>', 'Bind the connection URL to a service')
    .option('--no-deploy', 'Do not redeploy the bound service')
    .option('--json', 'Print machine-readable JSON with credentials redacted');
}

export function registerDatabaseCommands(program: Command): void {
  registerAddOptions(
    program.command('add').description('Add a service or managed database to the selected project')
      .requiredOption('--database <type>', 'Database engine: postgres, mysql, mariadb, mongo, redis, or libsql')
  ).action(async (options: {
    database: string;
    project?: string;
    name?: string;
    description?: string;
    environment?: string;
    bind?: string;
    deploy?: boolean;
    json?: boolean;
  }) => runCommand(async () => {
    const { addDatabase } = await import('./service.js');
    await addDatabase(options.database, options);
  }));

  const database = program.command('database').alias('db').description('Manage project databases');

  registerAddOptions(database.command('add <type>').description('Create and optionally bind a managed database'))
    .action(async (type: string, options: Record<string, unknown>) => runCommand(async () => {
      const { addDatabase } = await import('./service.js');
      await addDatabase(type, options);
    }));

  database.command('list')
    .description('List managed databases in a project')
    .option('--project <id-or-name>', 'Target project')
    .option('--json', 'Print machine-readable JSON with credentials redacted')
    .action(async (options: ProjectOptions) => runCommand(async () => {
      const { listDatabases } = await import('./service.js');
      await listDatabases(options);
    }));

  database.command('status <database>')
    .description('Inspect a managed database')
    .option('--project <id-or-name>', 'Target project')
    .option('--json', 'Print machine-readable JSON with credentials redacted')
    .action(async (selector: string, options: ProjectOptions) => runCommand(async () => {
      const { showDatabase } = await import('./service.js');
      await showDatabase(selector, options);
    }));

  database.command('bind <database> <service>')
    .description('Bind a database connection securely to one service')
    .option('--project <id-or-name>', 'Target project')
    .option('--variable <key>', 'Environment variable name (defaults by engine)')
    .option('--no-deploy', 'Do not redeploy the bound service')
    .action(async (databaseSelector: string, serviceSelector: string, options: {
      project?: string;
      variable?: string;
      deploy?: boolean;
    }) => runCommand(async () => {
      const { bindDatabase } = await import('./service.js');
      await bindDatabase(databaseSelector, serviceSelector, options);
    }));

  for (const action of ['start', 'stop', 'redeploy'] as const) {
    database.command(`${action} <database>`)
      .description(`${action[0].toUpperCase()}${action.slice(1)} a managed database`)
      .option('--project <id-or-name>', 'Target project')
      .action(async (selector: string, options: { project?: string }) => runCommand(async () => {
        const { databaseAction } = await import('./service.js');
        await databaseAction(selector, action, options);
      }));
  }

  database.command('delete <database>')
    .description('Permanently delete a managed database and its data')
    .option('--project <id-or-name>', 'Target project')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .action(async (selector: string, options: { project?: string; yes?: boolean }) => runCommand(async () => {
      const { deleteDatabase } = await import('./service.js');
      await deleteDatabase(selector, options);
    }));
}
