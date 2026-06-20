#!/usr/bin/env node
import { logger } from './lib/logger.js';
import { createProgram } from './cli.js';

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
  process.exitCode = 1;
});

async function main() {
  try {
    await createProgram().parseAsync(process.argv);
  } catch (error) {
    logger.error((error as Error).message);
    process.exitCode = 1;
  }
}

main();
