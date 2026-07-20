import type { Command } from 'commander';
import { runCommand } from '../../lib/command.js';

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
      await runCommand(async () => {
        const { runAgentSetup } = await import('./setup.js');
        await runAgentSetup(options);
      });
    });

  program
    .command('agent:chat')
    .description('Send a follow-up question to the Autodisc agent for this project')
    .option('-p, --path <dir>', 'Project directory (default: cwd)')
    .option('-m, --message <text>', 'Message to send (will prompt if omitted)')
    .action(async (options: ChatCommandOptions) => {
      await runCommand(async () => {
        const { runAgentChat } = await import('./chat.js');
        await runAgentChat(options);
      });
    });
}
