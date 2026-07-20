import { setTimeout as sleep } from 'node:timers/promises';
import chalk from 'chalk';
import { HostingAPI, redactServerEnvironment } from '../../lib/hosting.js';
import { logger } from '../../lib/logger.js';
import type { HostingDeploymentResponse, HostingServerResponse, HostingStatsResponse } from '../../types.js';

export interface MetricsOptions {
  json?: boolean;
  watch?: boolean;
  interval?: number;
}

interface MetricsSnapshot {
  timestamp: string;
  server: HostingServerResponse | null;
  stats: HostingStatsResponse | null;
  latest_deployment: HostingDeploymentResponse | null;
}

function formatPercent(value?: number | null) {
  return typeof value === 'number' ? `${value.toFixed(1)}%` : 'n/a';
}

function formatMemory(stats: HostingStatsResponse | null) {
  if (!stats || typeof stats.memory_usage_mb !== 'number') return 'n/a';
  const usage = `${stats.memory_usage_mb.toFixed(1)} MB`;
  if (typeof stats.memory_limit_mb !== 'number') return usage;
  return `${usage} / ${stats.memory_limit_mb.toFixed(0)} MB`;
}

function formatDeploy(deployment: HostingDeploymentResponse | null) {
  if (!deployment) return 'n/a';
  const ref = deployment.commit_sha ? ` ${deployment.commit_sha.slice(0, 7)}` : '';
  const branch = deployment.branch ? ` ${deployment.branch}` : '';
  const error = deployment.error_message ? ` (${deployment.error_message})` : '';
  return `${deployment.status}${branch}${ref}${error}`;
}

function printJson(value: unknown, pretty = true) {
  process.stdout.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
}

async function fetchSnapshot(hosting: HostingAPI): Promise<MetricsSnapshot> {
  const server = await hosting.getServer();
  if (!server) {
    return {
      timestamp: new Date().toISOString(),
      server: null,
      stats: null,
      latest_deployment: null,
    };
  }

  const [stats, deployments] = await Promise.all([
    hosting.fetchStats(server.id),
    hosting.listDeployments(1, server.id),
  ]);

  return {
    timestamp: new Date().toISOString(),
    server: redactServerEnvironment(server),
    stats,
    latest_deployment: deployments[0] ?? null,
  };
}

function printSnapshot(snapshot: MetricsSnapshot, watch: boolean) {
  if (!snapshot.server) {
    logger.warn('No hosting server found. Run `autodisc deploy` first.');
    return;
  }

  const { server, stats, latest_deployment: latestDeployment } = snapshot;
  if (watch) {
    logger.info(chalk.gray(snapshot.timestamp));
  }
  logger.info(`Name:        ${server.name}`);
  logger.info(`Status:      ${chalk.cyan(server.status)}${server.status_reason ? ` (${server.status_reason})` : ''}`);
  logger.info(`Plan:        ${server.plan_type}`);
  logger.info(`CPU:         ${formatPercent(stats?.cpu_percent)}${typeof server.cpu_limit === 'number' ? ` of ${server.cpu_limit} vCPU` : ''}`);
  logger.info(`Memory:      ${formatMemory(stats)} (${formatPercent(stats?.memory_percent)})`);
  logger.info(`Deploy:      ${formatDeploy(latestDeployment)}`);
}

export async function showMetrics(options: MetricsOptions = {}) {
  const hosting = new HostingAPI();
  const interval = options.interval ?? 2;

  if (!options.watch) {
    const snapshot = await fetchSnapshot(hosting);
    if (options.json) {
      printJson(snapshot);
      return;
    }
    printSnapshot(snapshot, false);
    return;
  }

  let running = true;
  const onSigint = () => {
    running = false;
    process.exitCode = 0;
  };
  process.once('SIGINT', onSigint);

  try {
    while (running) {
      const snapshot = await fetchSnapshot(hosting);
      if (options.json) {
        printJson(snapshot, false);
      } else {
        printSnapshot(snapshot, true);
        logger.info(chalk.gray('---'));
      }
      await sleep(interval * 1000);
    }
  } finally {
    process.off('SIGINT', onSigint);
  }
}
