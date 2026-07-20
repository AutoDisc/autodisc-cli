import { Command, Option } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import { runCommand } from './lib/command.js';
import { registerAgentCommands } from './modules/agent/commands.js';
import { registerAuthCommands } from './modules/auth/commands.js';
import { registerConfigCommands } from './modules/config/commands.js';
import { registerHostingCommands } from './modules/hosting/commands.js';
import { registerProjectCommands } from './modules/project/commands.js';

export function createProgram() {
  const program = new Command();

  program
    .name('autodisc')
    .description('Deploy and manage applications on Autodisc')
    .version(pkg.version as string)
    .addOption(new Option('--api-url <url>', 'Override the Autodisc API URL').env('AUTODISC_API_URL'))
    .option('--verbose', 'Show diagnostic details')
    .option('--no-color', 'Disable colored output')
    .showHelpAfterError('(run with --help for usage)')
    .showSuggestionAfterError(true)
    .action(async () => {
      await runCommand(async () => {
        const { showOverview } = await import('./modules/overview.js');
        await showOverview();
      });
    });

  program.hook('preAction', (command) => {
    const options = command.opts<{ apiUrl?: string; verbose?: boolean; color?: boolean }>();
    if (options.apiUrl) process.env.AUTODISC_API_URL = options.apiUrl;
    if (options.verbose) process.env.AUTODISC_DEBUG = '1';
    if (options.color === false) {
      process.env.AUTODISC_NO_COLOR = '1';
      process.env.NO_COLOR = '1';
    }
  });

  registerAuthCommands(program);
  registerConfigCommands(program);
  registerHostingCommands(program);
  registerAgentCommands(program);
  registerProjectCommands(program);

  program
    .command('doctor')
    .description('Check the local CLI setup, project config, and API connection')
    .option('--json', 'Print machine-readable JSON')
    .option('--offline', 'Skip the API connection check')
    .option('-p, --path <dir>', 'Project directory to inspect (default: cwd)')
    .action(async (options: { json?: boolean; offline?: boolean; path?: string }) => {
      await runCommand(async () => {
        const { runDoctor } = await import('./modules/doctor.js');
        await runDoctor({ json: Boolean(options.json), network: !options.offline, path: options.path });
      });
    });

  return program;
}
