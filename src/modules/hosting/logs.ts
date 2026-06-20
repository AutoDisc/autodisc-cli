import readline from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';
import chalk from 'chalk';
import { HostingAPI } from '../../lib/hosting.js';
import { createSpinner } from '../../lib/spinner.js';
import { logger } from '../../lib/logger.js';

export interface LogsOptions {
  tail?: number;
  follow?: boolean;
  json?: boolean;
}

function colorize(line: string) {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('exception')) return chalk.red(line);
  if (lower.includes('warn')) return chalk.yellow(line);
  if (lower.includes('info')) return chalk.blue(line);
  return line;
}

function printLines(lines: string[], seen: Set<string>) {
  lines.forEach((line) => {
    if (!line.trim()) return;
    const key = `${line}-${seen.size}`;
    if (seen.has(key)) return;
    seen.add(key);
    process.stdout.write(`${colorize(line)}\n`);
  });
}

function toLogPayload(logs: string, tail: number) {
  return {
    timestamp: new Date().toISOString(),
    tail,
    logs,
    lines: logs.split('\n').filter((line) => line.trim()),
  };
}

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printJsonLine(value: unknown) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

export async function showLogs(options: LogsOptions = {}) {
  const hosting = new HostingAPI();
  const tail = options.tail ?? 200;
  const spinner = options.json ? null : createSpinner('Fetching logs');
  spinner?.start();
  try {
    const { logs } = await hosting.fetchLogs(tail);
    spinner?.stop();

    if (options.json) {
      const payload = toLogPayload(logs, tail);
      if (!options.follow) {
        printJson(payload);
        return;
      }
      printJsonLine(payload);
    }

    const seen = new Set<string>();
    if (!options.json) {
      printLines(logs.split('\n'), seen);
    }

    if (!options.follow) {
      return;
    }

    if (!options.json) {
      logger.info(chalk.gray('--- Streaming logs (Ctrl+C to stop) ---'));
    }
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    let running = true;
    process.stdin.on('data', (chunk) => {
      if (chunk.toString() === '\u0003') {
        running = false;
        process.stdout.write('\n');
        process.exitCode = 0;
      }
    });

    while (running) {
      await sleep(2000);
      const { logs: newLogs } = await hosting.fetchLogs(options.tail ?? 200);
      if (options.json) {
        printJsonLine(toLogPayload(newLogs, tail));
      } else {
        printLines(newLogs.split('\n'), seen);
      }
    }
  } catch (error) {
    spinner?.fail();
    throw error;
  }
}
