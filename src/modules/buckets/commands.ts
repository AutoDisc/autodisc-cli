import { randomUUID } from 'node:crypto';
import type { Command } from 'commander';
import { runCommand } from '../../lib/command.js';
import { logger } from '../../lib/logger.js';
import { confirm } from '../../lib/prompts.js';
import { BucketsAPI, type Bucket, type BucketCreateResult } from './client.js';

type ProjectOptions = { project: string; json?: boolean };

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function formatBytes(value: number): string {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${(value / 1_000_000_000).toFixed(2)} GB`;
}

function printBucket(bucket: Bucket): void {
  logger.info(`${bucket.name} (${bucket.id})`);
  logger.info(`  Status:    ${bucket.status}${bucket.status_reason ? ` — ${bucket.status_reason}` : ''}`);
  logger.info(`  Region:    ${bucket.region}`);
  logger.info(`  Stored:    ${formatBytes(bucket.logical_bytes)} across ${bucket.object_count} objects`);
  logger.info(`  Billable:  ${formatBytes(bucket.billable_bytes)}`);
  if (bucket.endpoint) logger.info(`  Endpoint:  ${bucket.endpoint}`);
}

function printCredentials(result: BucketCreateResult): void {
  printBucket(result.bucket);
  if (!result.credentials) {
    logger.warn('Credentials are not shown on idempotent replay. Use the values saved from first creation.');
    return;
  }
  logger.warn('Save these credentials now. The secret is shown only once.');
  logger.info(`AWS_ACCESS_KEY_ID=${result.credentials.access_key_id}`);
  logger.info(`AWS_SECRET_ACCESS_KEY=${result.credentials.secret_access_key}`);
  logger.info(`AWS_ENDPOINT_URL_S3=${result.credentials.endpoint}`);
  logger.info(`AUTODISC_S3_BUCKET=${result.credentials.bucket}`);
  logger.info(`AWS_REGION=${result.credentials.region}`);
}

export function registerBucketCommands(program: Command): void {
  const buckets = program
    .command('buckets')
    .alias('bucket')
    .description('Create and manage project S3-compatible buckets');

  buckets.command('list')
    .requiredOption('--project <uuid>', 'Canonical project UUID')
    .option('--json', 'Print machine-readable JSON')
    .action((options: ProjectOptions) => runCommand(async () => {
      const items = await new BucketsAPI().list(options.project);
      if (options.json) printJson({ buckets: items });
      else if (!items.length) logger.info('No buckets are attached to this project.');
      else items.forEach(printBucket);
    }));

  buckets.command('get <bucket>')
    .requiredOption('--project <uuid>', 'Canonical project UUID')
    .option('--json', 'Print machine-readable JSON')
    .action((bucketId: string, options: ProjectOptions) => runCommand(async () => {
      const item = await new BucketsAPI().get(options.project, bucketId);
      if (options.json) printJson(item);
      else printBucket(item);
    }));

  buckets.command('create <name>')
    .description('Create a private bucket; the S3 secret is returned once')
    .requiredOption('--project <uuid>', 'Canonical project UUID')
    .requiredOption('--region <code>', 'Object storage region, for example fsn1')
    .option('--idempotency-key <key>', 'Stable retry key')
    .option('--json', 'Print machine-readable JSON including the one-time secret')
    .action((name: string, options: ProjectOptions & {
      region: string; idempotencyKey?: string;
    }) => runCommand(async () => {
      const result = await new BucketsAPI().create(options.project, {
        name,
        region: options.region,
        idempotencyKey: options.idempotencyKey?.trim() || `cli-bucket-create-${randomUUID()}`,
      });
      if (options.json) printJson(result);
      else printCredentials(result);
    }));

  buckets.command('usage <bucket>')
    .requiredOption('--project <uuid>', 'Canonical project UUID')
    .option('--json', 'Print machine-readable JSON')
    .action((bucketId: string, options: ProjectOptions) => runCommand(async () => {
      const usage = await new BucketsAPI().usage(options.project, bucketId);
      if (options.json) printJson(usage);
      else {
        logger.info(`Stored:     ${formatBytes(usage.logical_bytes)}`);
        logger.info(`Billable:   ${formatBytes(usage.billable_bytes)}`);
        logger.info(`Objects:    ${usage.object_count}`);
        logger.info(`Included:   ${usage.included_gb_month} GB-month/account/month`);
        logger.info(`After free: $${Number(usage.storage_price_usd_per_gb_month).toFixed(3)}/GB-month`);
      }
    }));

  buckets.command('delete <bucket>')
    .description('Delete an empty bucket and stop storage billing')
    .requiredOption('--project <uuid>', 'Canonical project UUID')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .action((bucketId: string, options: ProjectOptions & { yes?: boolean }) => runCommand(async () => {
      if (!options.yes) {
        if (!process.stdin.isTTY) throw new Error('Pass --yes to delete a bucket non-interactively.');
        if (!await confirm(`Permanently delete empty bucket "${bucketId}"?`, false)) {
          logger.info('Deletion cancelled.');
          return;
        }
      }
      await new BucketsAPI().delete(options.project, bucketId);
      logger.success(`Deleted bucket ${bucketId}.`);
    }));
}
