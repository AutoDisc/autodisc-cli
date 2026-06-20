import type { Command } from 'commander';
import { logger } from '../../lib/logger.js';

export function registerAuthCommands(program: Command) {
  program
    .command('login')
    .description('Authenticate with Autodisc')
    .option('--token [token]', 'Provide an Autodisc API token (skips interactive flows)')
    .option('--browser', 'Authenticate via browser sign-in flow (default)')
    .option('--device', 'Authenticate via device code flow')
    .action(async (options: { token?: string | boolean; browser?: boolean; device?: boolean }) => {
      const { login } = await import('./login.js');
      try {
        await login({ token: options.token, browser: Boolean(options.browser), device: Boolean(options.device) });
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('logout')
    .description('Log out and clear saved Autodisc credentials')
    .action(async () => {
      const { logout } = await import('./logout.js');
      try {
        await logout();
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('whoami')
    .description('Show the currently authenticated Autodisc user')
    .action(async () => {
      const { whoAmI } = await import('./whoami.js');
      try {
        await whoAmI();
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });
}
