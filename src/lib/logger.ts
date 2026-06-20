import chalk from 'chalk';
import util from 'node:util';
import { getConfigManager } from './config.js';

function colorize(text: string, colorFn: (input: string) => string) {
  const useColor = getConfigManager().getEffectiveConfig().ui.colors;
  return useColor ? colorFn(text) : text;
}

function formatMessage(message: unknown[]) {
  return message
    .map((value) => (typeof value === 'string' ? value : util.inspect(value, { colors: false, depth: null })))
    .join(' ');
}

export const logger = {
  info(...message: unknown[]) {
    console.log(colorize('ℹ', chalk.blue), formatMessage(message));
  },
  success(...message: unknown[]) {
    console.log(colorize('✓', chalk.green), formatMessage(message));
  },
  warn(...message: unknown[]) {
    console.warn(colorize('⚠', chalk.yellow), formatMessage(message));
  },
  error(...message: unknown[]) {
    console.error(colorize('✖', chalk.red), formatMessage(message));
  },
  debug(...message: unknown[]) {
    if (!getConfigManager().getEffectiveConfig().ui.verbose) return;
    console.log(colorize('…', chalk.gray), formatMessage(message));
  },
};
