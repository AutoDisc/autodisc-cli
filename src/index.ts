#!/usr/bin/env node
import { createProgram } from './cli.js';
import { reportCommandError } from './lib/command.js';

process.on('unhandledRejection', (reason) => {
  reportCommandError(reason);
});

async function main() {
  try {
    await createProgram().parseAsync(process.argv);
  } catch (error) {
    reportCommandError(error);
  }
}

main();
