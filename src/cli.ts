import { Command } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import { registerAuthCommands } from './modules/auth/commands.js';
import { registerConfigCommands } from './modules/config/commands.js';
import { registerHostingCommands } from './modules/hosting/commands.js';

export function createProgram() {
  const program = new Command();

  program
    .name('autodisc')
    .description('Autodisc CLI — Agent focused development tool')
    .version(pkg.version as string)
    .action(async () => {
      const { showOverview } = await import('./modules/overview.js');
      await showOverview();
    });

  registerAuthCommands(program);
  registerConfigCommands(program);
  registerHostingCommands(program);

  return program;
}
