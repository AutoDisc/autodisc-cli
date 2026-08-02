import { Option, type Command } from 'commander';
import { runCommand } from '../../lib/command.js';

export function registerAuthCommands(program: Command) {
  program
    .command('login')
    .description('Authenticate with Autodisc')
    .option('--token [token]', 'Provide an Autodisc API token (skips interactive flows)')
    .option('--browser', 'Authenticate via browser sign-in flow (default)')
    // Keep the flag for forward compatibility and existing callers, but do not
    // advertise a flow that the production API does not currently expose.
    .addOption(new Option('--device', 'Authenticate via device code flow').hideHelp())
    .action(async (options: { token?: string | boolean; browser?: boolean; device?: boolean }) => {
      await runCommand(async () => {
        const { login } = await import('./login.js');
        await login({ token: options.token, browser: Boolean(options.browser), device: Boolean(options.device) });
      });
    });

  program
    .command('logout')
    .description('Log out and clear saved Autodisc credentials')
    .action(async () => {
      await runCommand(async () => {
        const { logout } = await import('./logout.js');
        await logout();
      });
    });

  program
    .command('whoami')
    .description('Show the currently authenticated Autodisc user')
    .action(async () => {
      await runCommand(async () => {
        const { whoAmI } = await import('./whoami.js');
        await whoAmI();
      });
    });
}
