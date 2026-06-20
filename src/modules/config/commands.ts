import util from 'node:util';
import type { Command } from 'commander';
import { getConfigManager } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

function formatValue(value: unknown) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return util.inspect(value, { depth: null, colors: false, compact: false });
}

function parseInputValue(raw: string, options: { json?: boolean; boolean?: boolean; number?: boolean }) {
  if (options.json) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }
  }
  if (options.boolean) {
    if (['true', '1', 'yes'].includes(raw.toLowerCase())) return true;
    if (['false', '0', 'no'].includes(raw.toLowerCase())) return false;
    throw new Error('Boolean values must be one of: true, false, 1, 0, yes, no');
  }
  if (options.number) {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      throw new Error('Value must be a valid number when using --number');
    }
    return parsed;
  }
  return raw;
}

export function registerConfigCommands(program: Command) {
  program
    .command('config')
    .description('Show the current CLI configuration')
    .option('--raw', 'Show sensitive values (tokens, etc.)')
    .action((options: { raw?: boolean }) => {
      const config = getConfigManager();
      const data = config.getAll(!options.raw);
      logger.info(JSON.stringify(data, null, 2));
    });

  program
    .command('config:get <path>')
    .description('Get a configuration value (dot notation)')
    .action((path: string) => {
      const config = getConfigManager();
      const value = config.getValue(path);
      logger.info(formatValue(value));
    });

  program
    .command('config:set <path> <value>')
    .description('Set a configuration value')
    .option('--json', 'Parse the value as JSON')
    .option('--boolean', 'Treat the value as boolean (true/false/1/0)')
    .option('--number', 'Treat the value as a number')
    .action((path: string, value: string, options: { json?: boolean; boolean?: boolean; number?: boolean }) => {
      try {
        const parsed = parseInputValue(value, options);
        const config = getConfigManager();
        config.setValue(path, parsed);
        logger.success(`Updated ${path}`);
      } catch (error) {
        logger.error((error as Error).message);
        process.exitCode = 1;
      }
    });
}
