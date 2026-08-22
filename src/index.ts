#!/usr/bin/env node
import { createProgram } from './cli.js';
import { reportCommandError } from './lib/command.js';
import pkg from '../package.json' with { type: 'json' };
import { maybeNotifyAboutUpdate } from './modules/update/notifier.js';

process.on('unhandledRejection', (reason) => {
  reportCommandError(reason);
});

async function main() {
  try {
    await createProgram().parseAsync(process.argv);
    if (!process.exitCode) {
      await maybeNotifyAboutUpdate(pkg.version as string);
    }
  } catch (error) {
    reportCommandError(error);
  }
}

main();
