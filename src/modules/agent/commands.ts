import type { Command } from 'commander';
import { logger } from '../../lib/logger.js';

interface SetupCommandOptions {
  path?: string;
  message?: string;
}

interface ChatCommandOptions {
  path?: string;
  message?: string;
}

export function registerAgentCommands(program: Command) {
  program
    .command('agent:setup')
    .description('Use the Autodisc AI agent to generate or refine autodisc.yml')
    .option('-p, --path <dir>', 'Project directory (default: cwd)')
    .option('-m, --message <text>', 'Custom instruction for the agent')
    .action(async (options: SetupCommandOptions) => {
      const { runAgentSetup } = await import('./setup.js');
      try {
        await runAgentSetup(options);
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('agent:chat')
    .description('Send a follow-up question to the Autodisc agent for this project')
    .option('-p, --path <dir>', 'Project directory (default: cwd)')
    .option('-m, --message <text>', 'Message to send (will prompt if omitted)')
    .action(async (options: ChatCommandOptions) => {
      const { runAgentChat } = await import('./chat.js');
      try {
        await runAgentChat(options);
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });
}
