import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { HostingAPI } from '../../lib/hosting.js';
import { createSpinner } from '../../lib/spinner.js';
import { logger } from '../../lib/logger.js';

function formatEnv(env: Record<string, string>) {
  const entries = Object.entries(env);
  if (!entries.length) {
    logger.info(chalk.gray('No environment variables configured.'));
    return;
  }
  entries
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      logger.info(`${chalk.cyan(key)}=${value}`);
    });
}

function parseKeyValue(pair: string) {
  const [key, ...rest] = pair.split('=');
  if (!key || !rest.length) {
    throw new Error(`Invalid KEY=VALUE pair: ${pair}`);
  }
  return { key: key.trim(), value: rest.join('=').trim() };
}

function parseDotEnv(content: string) {
  const env: Record<string, string> = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return env;
}

function serializeEnv(env: Record<string, string>) {
  return Object.entries(env)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export async function listEnv() {
  const hosting = new HostingAPI();
  const spinner = createSpinner('Fetching environment variables');
  spinner.start();
  try {
    const env = await hosting.getEnvironment();
    spinner.stop();
    formatEnv(env);
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export async function setEnv(pairs: string[]) {
  if (!pairs.length) {
    throw new Error('Provide at least one KEY=VALUE pair');
  }
  const hosting = new HostingAPI();
  const spinner = createSpinner('Updating environment variables');
  spinner.start();
  try {
    const current = await hosting.getEnvironment();
    pairs.forEach((pair) => {
      const { key, value } = parseKeyValue(pair);
      current[key] = value;
    });
    await hosting.updateEnvironment(current);
    spinner.succeed();
    logger.success('Environment updated');
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export async function unsetEnv(keys: string[]) {
  if (!keys.length) {
    throw new Error('Provide at least one KEY to remove');
  }
  const hosting = new HostingAPI();
  const spinner = createSpinner('Removing environment variables');
  spinner.start();
  try {
    const current = await hosting.getEnvironment();
    keys.forEach((key) => delete current[key]);
    await hosting.updateEnvironment(current);
    spinner.succeed();
    logger.success('Environment updated');
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export async function pullEnv(options: { path?: string }) {
  const targetPath = path.resolve(options.path ?? '.env');
  const hosting = new HostingAPI();
  const spinner = createSpinner(`Writing environment to ${path.basename(targetPath)}`);
  spinner.start();
  try {
    const env = await hosting.getEnvironment();
    fs.writeFileSync(targetPath, `${serializeEnv(env)}\n`);
    spinner.succeed();
    logger.success(`Environment written to ${targetPath}`);
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export async function pushEnv(filePath?: string) {
  const resolved = path.resolve(filePath ?? '.env');
  if (!fs.existsSync(resolved)) {
    throw new Error(`Env file not found: ${resolved}`);
  }
  const hosting = new HostingAPI();
  const spinner = createSpinner('Uploading environment variables');
  spinner.start();
  try {
    const content = fs.readFileSync(resolved, 'utf8');
    const parsed = parseDotEnv(content);
    await hosting.updateEnvironment(parsed);
    spinner.succeed();
    logger.success('Environment updated');
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
