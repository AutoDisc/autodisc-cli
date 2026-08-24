import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import chalk from 'chalk';
import { AmbiguousMutationError, HostingAPI } from '../../lib/hosting.js';
import { getConfigManager } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { createSpinner } from '../../lib/spinner.js';
import type {
  HostingProjectResponse,
  HostingServerResponse,
  ManagedDatabaseResponse,
  ManagedDatabaseType,
} from '../../types.js';

export const MANAGED_DATABASE_TYPES: ManagedDatabaseType[] = [
  'postgres',
  'mysql',
  'mariadb',
  'mongo',
  'redis',
  'libsql',
];

export interface AddDatabaseOptions {
  project?: string;
  name?: string;
  description?: string;
  environment?: string;
  bind?: string;
  deploy?: boolean;
  json?: boolean;
}

function isDatabaseType(value: string): value is ManagedDatabaseType {
  return MANAGED_DATABASE_TYPES.includes(value as ManagedDatabaseType);
}

async function resolveProject(hosting: HostingAPI, selector?: string): Promise<HostingProjectResponse> {
  const selected = selector?.trim()
    || getConfigManager().getValue<string>('deploy.currentProject')
    || '';
  if (!selected) {
    throw new Error('No project is selected. Pass --project or run "autodisc project use <project>" first.');
  }
  const projects = await hosting.listProjects();
  const matches = projects.filter((project) => [project.id, project.slug, project.name].includes(selected));
  if (matches.length === 0) throw new Error(`Project "${selected}" was not found.`);
  if (matches.length > 1) throw new Error(`Multiple projects match "${selected}". Use the exact project ID.`);
  return hosting.getProject(matches[0].id);
}

function matchDatabase(databases: ManagedDatabaseResponse[], selector: string): ManagedDatabaseResponse {
  const matches = databases.filter((database) => [database.id, database.name].includes(selector));
  if (matches.length === 0) throw new Error(`Database "${selector}" was not found in this project.`);
  if (matches.length > 1) throw new Error(`Multiple databases match "${selector}". Use the exact database ID.`);
  return matches[0];
}

function matchService(project: HostingProjectResponse, selector: string): HostingServerResponse {
  const matches = project.services.filter((service) => [service.id, service.name].includes(selector));
  if (matches.length === 0) throw new Error(`Service "${selector}" was not found in project ${project.name}.`);
  if (matches.length > 1) throw new Error(`Multiple services match "${selector}". Use the exact service ID.`);
  const service = matches[0];
  if (['postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'libsql'].includes(service.service_type ?? '')) {
    throw new Error('A managed database must be bound to an application, worker, or cron service.');
  }
  return service;
}

function parseBinding(value: string): { service: string; variable?: string } {
  const separator = value.indexOf(':');
  if (separator < 0) return { service: value };
  const service = value.slice(0, separator).trim();
  const variable = value.slice(separator + 1).trim();
  if (!service || !variable) throw new Error('--bind must use SERVICE or SERVICE:VARIABLE.');
  return { service, variable };
}

function safeDatabase(database: ManagedDatabaseResponse) {
  return {
    ...database,
    connection: {
      host: database.connection.host ?? null,
      port: database.connection.port,
      database: database.connection.database ?? null,
      username: database.connection.username ? '[hidden]' : null,
      password: database.connection.password ? '[hidden]' : null,
      url: database.connection.url ? '[hidden]' : null,
    },
  };
}

function reportDatabase(database: ManagedDatabaseResponse): void {
  logger.info(`Name:       ${database.name}`);
  logger.info(`Engine:     ${database.engine}${database.version ? ` ${database.version}` : ''}`);
  logger.info(`Status:     ${database.status}${database.status_reason ? ` (${database.status_reason})` : ''}`);
  const network = database.private_networking as { state?: string; hostname?: string; port?: number };
  logger.info(`Network:    ${network.state ?? 'unknown'}`);
  if (network.hostname) logger.info(`Address:    ${network.hostname}:${network.port ?? database.connection.port}`);
  logger.info(`Database ID: ${database.id}`);
}

async function waitForDatabase(
  hosting: HostingAPI,
  initial: ManagedDatabaseResponse,
  attempts = 40,
): Promise<ManagedDatabaseResponse> {
  let database = initial;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (database.status === 'running' && database.connection.url) return database;
    if (database.status === 'error') {
      throw new Error(`Database ${database.name} failed: ${database.status_reason ?? 'runtime_error'}`);
    }
    if (attempt < attempts) await sleep(1_500);
    database = await hosting.getManagedDatabase(database.id);
  }
  return database;
}

async function recoverCreatedDatabase(
  hosting: HostingAPI,
  projectId: string,
  type: ManagedDatabaseType,
  name: string,
): Promise<ManagedDatabaseResponse | null> {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const database = (await hosting.listProjectDatabases(projectId))
        .find((candidate) => candidate.name === name && candidate.engine === type);
      if (database) return database;
    } catch {
      // The read can briefly share the same proxy failure as the create request.
    }
    if (attempt < 20) await sleep(1_500);
  }
  return null;
}

async function bindAndMaybeDeploy(
  hosting: HostingAPI,
  project: HostingProjectResponse,
  database: ManagedDatabaseResponse,
  binding: string,
  deploy: boolean,
): Promise<{ service: HostingServerResponse; variable: string }> {
  const target = parseBinding(binding);
  const service = matchService(project, target.service);
  const variable = await hosting.bindManagedDatabase(database.id, service.id, target.variable);
  logger.success(`Bound ${database.name} to ${service.name} as ${variable.key}`);
  if (deploy) {
    const spinner = createSpinner(`Redeploying ${service.name}`);
    spinner.start();
    try {
      await hosting.redeployServer(service.id);
      spinner.succeed();
    } catch (error) {
      if (!(error instanceof AmbiguousMutationError)) {
        spinner.fail();
        throw error;
      }
      const current = await hosting.getServer(service.id);
      if (!current || !['provisioning', 'running'].includes(current.status)) {
        spinner.fail();
        throw error;
      }
      spinner.succeed('Redeploy accepted; build is continuing');
    }
  }
  return { service, variable: variable.key };
}

export async function addDatabase(typeValue: string, options: AddDatabaseOptions = {}): Promise<void> {
  const type = typeValue.trim().toLowerCase();
  if (!isDatabaseType(type)) {
    throw new Error(`Unsupported database "${typeValue}". Choose: ${MANAGED_DATABASE_TYPES.join(', ')}.`);
  }
  const hosting = new HostingAPI();
  const project = await resolveProject(hosting, options.project);
  const name = options.name?.trim() || type;
  const existing = (await hosting.listProjectDatabases(project.id))
    .find((database) => database.name === name);
  let database: ManagedDatabaseResponse;
  if (existing) {
    if (existing.engine !== type) {
      throw new Error(`Database ${name} already exists with engine ${existing.engine}.`);
    }
    database = existing;
    logger.info(`Using existing ${type} database ${name}`);
  } else {
    const spinner = createSpinner(`Creating ${type} database ${name}`);
    spinner.start();
    try {
      database = await hosting.createProjectDatabase(project.id, {
        type,
        name,
        ...(options.description ? { description: options.description } : {}),
        ...(options.environment ? { environment_id: options.environment } : {}),
      }, randomUUID());
      spinner.succeed();
    } catch (error) {
      if (!(error instanceof AmbiguousMutationError)) {
        spinner.fail();
        throw error;
      }
      const recovered = await recoverCreatedDatabase(hosting, project.id, type, name);
      if (!recovered) {
        spinner.fail();
        throw error;
      }
      database = recovered;
      spinner.succeed('Database creation accepted; provisioning is continuing');
    }
  }

  database = await waitForDatabase(hosting, database);
  let bound: { service: HostingServerResponse; variable: string } | undefined;
  if (options.bind) {
    if (database.status !== 'running' || !database.connection.url) {
      throw new Error(`Database ${database.name} was created but is not ready to bind yet.`);
    }
    bound = await bindAndMaybeDeploy(hosting, project, database, options.bind, options.deploy !== false);
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ database: safeDatabase(database), binding: bound ?? null }, null, 2)}\n`);
    return;
  }
  logger.success(`${type} database ready: ${database.name} (${chalk.cyan(database.status)})`);
  reportDatabase(database);
}

export async function listDatabases(options: { project?: string; json?: boolean } = {}): Promise<void> {
  const hosting = new HostingAPI();
  const project = await resolveProject(hosting, options.project);
  const databases = await hosting.listProjectDatabases(project.id);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ project_id: project.id, databases: databases.map(safeDatabase) }, null, 2)}\n`);
    return;
  }
  if (databases.length === 0) {
    logger.info(`No managed databases in ${project.name}.`);
    return;
  }
  databases.forEach((database) => {
    logger.info(`${database.name} — ${database.engine}${database.version ? ` ${database.version}` : ''} — ${database.status} — ${database.id}`);
  });
}

export async function showDatabase(selector: string, options: { project?: string; json?: boolean } = {}): Promise<void> {
  const hosting = new HostingAPI();
  const project = await resolveProject(hosting, options.project);
  const selected = matchDatabase(await hosting.listProjectDatabases(project.id), selector);
  const database = await hosting.getManagedDatabase(selected.id);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ database: safeDatabase(database) }, null, 2)}\n`);
    return;
  }
  reportDatabase(database);
}

export async function bindDatabase(
  databaseSelector: string,
  serviceSelector: string,
  options: { project?: string; variable?: string; deploy?: boolean } = {},
): Promise<void> {
  const hosting = new HostingAPI();
  const project = await resolveProject(hosting, options.project);
  const database = await waitForDatabase(
    hosting,
    matchDatabase(await hosting.listProjectDatabases(project.id), databaseSelector),
  );
  const binding = options.variable ? `${serviceSelector}:${options.variable}` : serviceSelector;
  await bindAndMaybeDeploy(hosting, project, database, binding, options.deploy !== false);
}

export async function databaseAction(
  selector: string,
  action: 'start' | 'stop' | 'redeploy',
  options: { project?: string } = {},
): Promise<void> {
  const hosting = new HostingAPI();
  const project = await resolveProject(hosting, options.project);
  const database = matchDatabase(await hosting.listProjectDatabases(project.id), selector);
  const result = await hosting.databaseAction(database.id, action);
  logger.success(`${database.name}: ${result.status}`);
}

export async function deleteDatabase(
  selector: string,
  options: { project?: string; yes?: boolean } = {},
): Promise<void> {
  const hosting = new HostingAPI();
  const project = await resolveProject(hosting, options.project);
  const database = matchDatabase(await hosting.listProjectDatabases(project.id), selector);
  if (!options.yes) {
    const { confirm } = await import('../../lib/prompts.js');
    if (!process.stdin.isTTY) throw new Error('Pass --yes to delete a database non-interactively.');
    if (!await confirm(`Permanently delete database "${database.name}" and its data?`, false)) {
      logger.info('Deletion cancelled.');
      return;
    }
  }
  await hosting.deleteManagedDatabase(database.id);
  logger.success(`Deleted database ${database.name}`);
}
