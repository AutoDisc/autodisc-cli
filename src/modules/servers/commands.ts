import { randomUUID } from 'node:crypto';
import type { Command } from 'commander';
import { runCommand } from '../../lib/command.js';
import { logger } from '../../lib/logger.js';
import { confirm } from '../../lib/prompts.js';
import {
  ServersAPI,
  type Server,
  type ServerMutation,
  type ServerQuote,
} from './client.js';

type ProjectOptions = { project: string; json?: boolean };
type QuoteOptions = ProjectOptions & {
  region: string;
  shape: string;
  storage: string;
  ipv4?: boolean;
  overage?: boolean;
};

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseStorage(value: string): number {
  const storage = Number(value);
  if (!Number.isFinite(storage) || storage <= 0) {
    throw new Error('--storage must be a positive number of GB.');
  }
  return storage;
}

function retryKey(action: string, provided?: string): string {
  return provided?.trim() || `cli-${action}-${randomUUID()}`;
}

function printServer(server: Server): void {
  logger.info(`${server.name} (${server.id})`);
  logger.info(`  Status:   ${server.status}${server.status_reason ? ` — ${server.status_reason}` : ''}`);
  logger.info(`  Region:   ${server.region}`);
  logger.info(`  Compute:  ${server.vcpu_count} vCPU / ${(server.memory_mb / 1024).toFixed(1)} GB`);
  logger.info(`  IPv4:     ${server.public_ipv4_enabled ? 'enabled' : 'disabled'}`);
  const addresses = server.network_interfaces
    ?.filter((item) => item.address)
    .map((item) => item.address)
    .join(', ');
  if (addresses) logger.info(`  Address:  ${addresses}`);
}

function printQuote(quote: ServerQuote, includeToken: boolean): void {
  logger.info(`Quote:       ${quote.id}`);
  logger.info(`Region:      ${quote.region}`);
  logger.info(`Shape:       ${quote.shape_code} (${quote.vcpu_count} vCPU / ${(quote.memory_mb / 1024).toFixed(1)} GB)`);
  logger.info(`Storage:     ${quote.storage_gb} GB`);
  logger.info(`IPv4:        ${quote.public_ipv4_enabled ? 'enabled' : 'disabled'}`);
  logger.info(`Running:     $${Number(quote.running_rate_usd_per_hour).toFixed(4)}/hr`);
  logger.info(`730h est.:   $${Number(quote.running_price_usd_per_730_hours).toFixed(2)}`);
  logger.info(`Expires:     ${quote.expires_at}`);
  if (includeToken) logger.info(`Quote token: ${quote.token}`);
}

async function makeQuote(options: QuoteOptions): Promise<ServerQuote> {
  return new ServersAPI().quote(options.project, {
    region: options.region,
    shapeCode: options.shape,
    storageGb: parseStorage(options.storage),
    publicIpv4Enabled: Boolean(options.ipv4),
    quotaBehavior: options.overage ? 'use_overage' : 'stop',
  });
}

async function provision(
  name: string,
  options: QuoteOptions & { yes?: boolean; idempotencyKey?: string },
): Promise<void> {
  const quote = await makeQuote(options);
  if (!options.json) printQuote(quote, false);

  if (!options.yes) {
    if (!process.stdin.isTTY) {
      throw new Error('Pass --yes to provision a server non-interactively.');
    }
    const accepted = await confirm(
      `Provision "${name}" for $${Number(quote.running_rate_usd_per_hour).toFixed(4)}/hr?`,
      false,
    );
    if (!accepted) {
      logger.info('Provisioning cancelled.');
      return;
    }
  }

  const result = await new ServersAPI().create(options.project, {
    name,
    quoteToken: quote.token,
    idempotencyKey: retryKey('create', options.idempotencyKey),
  });
  if (options.json) printJson({ quote, ...result });
  else {
    logger.success(`Provisioning queued for ${result.server.name} (${result.server.id})`);
    logger.info(`Operation: ${result.operation.id} — ${result.operation.status}`);
  }
}

async function lifecycle(
  action: 'start' | 'stop' | 'restart' | 'delete',
  serverId: string,
  options: ProjectOptions & { yes?: boolean; idempotencyKey?: string },
): Promise<void> {
  if (action === 'delete' && !options.yes) {
    if (!process.stdin.isTTY) throw new Error('Pass --yes to delete a server non-interactively.');
    if (!await confirm(`Permanently delete server "${serverId}"?`, false)) {
      logger.info('Deletion cancelled.');
      return;
    }
  }
  const result: ServerMutation = await new ServersAPI().lifecycle(
    options.project,
    serverId,
    action,
    retryKey(action, options.idempotencyKey),
  );
  if (options.json) printJson(result);
  else logger.success(`${action} queued for ${result.server.name} — ${result.operation.status}`);
}

export function registerServerCommands(program: Command): void {
  const servers = program
    .command('servers')
    .description('Provision and manage project-scoped Autodisc VPS servers');

  servers.command('regions').option('--json', 'Print machine-readable JSON').action(
    (options: { json?: boolean }) => runCommand(async () => {
      const regions = await new ServersAPI().listRegions();
      if (options.json) printJson({ regions });
      else regions.forEach((region) => logger.info(`${region.code} — ${region.name}`));
    }),
  );

  servers.command('shapes').option('--json', 'Print machine-readable JSON').action(
    (options: { json?: boolean }) => runCommand(async () => {
      const shapes = await new ServersAPI().listShapes();
      if (options.json) printJson({ shapes });
      else shapes.forEach((shape) => logger.info(
        `${shape.code} — ${shape.name} — ${shape.vcpu_count} vCPU / ${(shape.memory_mb / 1024).toFixed(1)} GB — ${shape.architecture}`,
      ));
    }),
  );

  servers
    .command('list')
    .requiredOption('--project <uuid>', 'Canonical project UUID')
    .option('--json', 'Print machine-readable JSON')
    .action((options: ProjectOptions) => runCommand(async () => {
      const items = await new ServersAPI().list(options.project);
      if (options.json) printJson({ servers: items });
      else if (!items.length) logger.info('No servers are attached to this project.');
      else items.forEach(printServer);
    }));

  servers
    .command('get <server>')
    .requiredOption('--project <uuid>', 'Canonical project UUID')
    .option('--json', 'Print machine-readable JSON')
    .action((serverId: string, options: ProjectOptions) => runCommand(async () => {
      const server = await new ServersAPI().get(options.project, serverId);
      if (options.json) printJson(server);
      else printServer(server);
    }));

  servers
    .command('quote')
    .requiredOption('--project <uuid>', 'Canonical project UUID')
    .requiredOption('--region <code>', 'HostVDS-backed region code')
    .requiredOption('--shape <code>', 'Server shape code')
    .requiredOption('--storage <gb>', 'Storage size in GB')
    .option('--ipv4', 'Reserve a public IPv4 address')
    .option('--overage', 'Continue into metered overage after compute credit is exhausted')
    .option('--json', 'Print machine-readable JSON')
    .action((options: QuoteOptions) => runCommand(async () => {
      const quote = await makeQuote(options);
      if (options.json) printJson(quote);
      else printQuote(quote, true);
    }));

  servers
    .command('create <name>')
    .description('Review an exact quote, then provision a server')
    .requiredOption('--project <uuid>', 'Canonical project UUID')
    .requiredOption('--region <code>', 'HostVDS-backed region code')
    .requiredOption('--shape <code>', 'Server shape code')
    .requiredOption('--storage <gb>', 'Storage size in GB')
    .option('--ipv4', 'Reserve a public IPv4 address')
    .option('--overage', 'Continue into metered overage after compute credit is exhausted')
    .option('--idempotency-key <key>', 'Stable retry key')
    .option('-y, --yes', 'Accept the quote without prompting')
    .option('--json', 'Print machine-readable JSON')
    .action((name: string, options: QuoteOptions & { yes?: boolean; idempotencyKey?: string }) =>
      runCommand(() => provision(name, options)));

  for (const action of ['start', 'stop', 'restart', 'delete'] as const) {
    const command = servers
      .command(`${action} <server>`)
      .requiredOption('--project <uuid>', 'Canonical project UUID')
      .option('--idempotency-key <key>', 'Stable retry key')
      .option('--json', 'Print machine-readable JSON');
    if (action === 'delete') command.option('-y, --yes', 'Skip the confirmation prompt');
    command.action((serverId: string, options: ProjectOptions & { yes?: boolean; idempotencyKey?: string }) =>
      runCommand(() => lifecycle(action, serverId, options)));
  }
}
