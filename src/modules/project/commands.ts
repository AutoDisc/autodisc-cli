import type { Command } from 'commander';
import { setTimeout as sleep } from 'node:timers/promises';
import { runCommand } from '../../lib/command.js';
import { getConfigManager } from '../../lib/config.js';
import { AmbiguousMutationError, HostingAPI, redactServerEnvironment } from '../../lib/hosting.js';
import { logger } from '../../lib/logger.js';
import { confirm } from '../../lib/prompts.js';
import type { HostingProjectResponse, HostingServerResponse } from '../../types.js';

function matchProject(projects: HostingProjectResponse[], selector: string): HostingProjectResponse {
  const matches = projects.filter((project) => [project.id, project.slug, project.name].includes(selector));
  if (matches.length === 0) throw new Error(`Project "${selector}" was not found.`);
  if (matches.length > 1) throw new Error(`Multiple projects match "${selector}". Use the exact project ID.`);
  return matches[0];
}

function matchService(services: HostingServerResponse[], selector?: string): HostingServerResponse {
  if (!selector && services.length === 1) return services[0];
  if (!selector) throw new Error('This project has multiple services. Pass --service with a service ID or name.');
  const matches = services.filter((service) => [service.id, service.name].includes(selector));
  if (matches.length === 0) throw new Error(`Service "${selector}" was not found in this project.`);
  if (matches.length > 1) throw new Error(`Multiple services match "${selector}". Use the exact service ID.`);
  return matches[0];
}

async function requireCurrentProject(hosting: HostingAPI): Promise<HostingProjectResponse> {
  const projectId = getConfigManager().getValue<string>('deploy.currentProject');
  if (!projectId) throw new Error('No project is selected. Run "autodisc project use <project>" first.');
  return hosting.getProject(projectId);
}

async function listProjects(json: boolean): Promise<void> {
  const projects = await new HostingAPI().listProjects();
  const currentId = getConfigManager().getValue<string>('deploy.currentProject');
  if (json) {
    const safeProjects = projects.map((project) => ({
      ...project,
      services: project.services.map(redactServerEnvironment),
    }));
    process.stdout.write(`${JSON.stringify({ projects: safeProjects, current_project_id: currentId ?? null }, null, 2)}\n`);
    return;
  }
  if (projects.length === 0) {
    logger.info('No projects found. Run "autodisc deploy" to create one.');
    return;
  }
  projects.forEach((project) => {
    const marker = project.id === currentId ? '*' : ' ';
    logger.info(`${marker} ${project.name} (${project.slug}) — ${project.services.length} service(s) — ${project.id}`);
    project.services.forEach((service) => {
      const type = service.managed_addon_type || service.service_type || 'app';
      logger.info(`    - ${service.name} — ${type} — ${service.status}`);
    });
  });
}

function managedDatabaseServices(project: HostingProjectResponse): HostingServerResponse[] {
  const databaseTypes = new Set(['postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'libsql']);
  return project.services.filter((service) => {
    const type = service.managed_addon_type || service.service_type || '';
    return service.detected_stack === 'managed_database' || databaseTypes.has(type);
  });
}

async function deletionCompleted(
  hosting: HostingAPI,
  projectId: string,
  attempts = 6,
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const projects = await hosting.listProjects();
      if (!projects.some((project) => project.id === projectId)) return true;
    } catch {
      // The read can briefly share the same edge failure as the delete.
    }
    if (attempt < attempts) await sleep(1_000);
  }
  return false;
}

export interface DeleteProjectOptions {
  yes?: boolean;
  forceManagedData?: boolean;
}

export async function deleteProject(
  selector: string,
  options: DeleteProjectOptions = {},
): Promise<void> {
  const hosting = new HostingAPI();
  const target = matchProject(await hosting.listProjects(), selector);
  const databases = managedDatabaseServices(target);
  if (options.yes && databases.length > 0 && !options.forceManagedData) {
    const names = databases.map((service) => service.name).join(', ');
    throw new Error(
      `Project "${target.name}" contains managed database data (${names}). ` +
      'Refusing non-interactive deletion without --force-managed-data.',
    );
  }
  if (!options.yes) {
    if (!process.stdin.isTTY) throw new Error('Pass --yes to delete a project non-interactively.');
    const databaseWarning = databases.length > 0
      ? ` This permanently deletes managed database data: ${databases.map((service) => service.name).join(', ')}.`
      : '';
    if (!await confirm(`Permanently delete project "${target.name}" and all services?${databaseWarning}`, false)) {
      logger.info('Deletion cancelled.');
      return;
    }
  }

  let confirmedAfterTimeout = false;
  try {
    await hosting.deleteProject(target.id);
  } catch (error) {
    if (!(error instanceof AmbiguousMutationError) || !await deletionCompleted(hosting, target.id)) {
      throw error;
    }
    confirmedAfterTimeout = true;
  }

  const config = getConfigManager();
  if (config.getValue<string>('deploy.currentProject') === target.id) {
    config.setValue('deploy.currentProject', null);
    config.setValue('deploy.currentServer', null);
  }
  logger.success(
    confirmedAfterTimeout
      ? `Deleted project ${target.name} (confirmed after the response timed out)`
      : `Deleted project ${target.name}`,
  );
}

async function useProject(selector: string, serviceSelector?: string): Promise<void> {
  const hosting = new HostingAPI();
  const project = matchProject(await hosting.listProjects(), selector);
  const hydrated = await hosting.getProject(project.id);
  const service = matchService(hydrated.services, serviceSelector);
  const config = getConfigManager();
  config.setValue('deploy.currentProject', hydrated.id);
  config.setValue('deploy.currentServer', service.id);
  logger.success(`Using ${hydrated.name}/${service.name}`);
}

export function registerProjectCommands(program: Command): void {
  const project = program.command('project').description('List, select, and operate on Autodisc projects');

  project
    .command('list')
    .description('List accessible projects and services')
    .option('--json', 'Print machine-readable JSON')
    .action(async (options: { json?: boolean }) => runCommand(() => listProjects(Boolean(options.json))));

  project
    .command('create <name>')
    .description('Create an empty Autodisc project and select it')
    .action(async (name: string) => runCommand(async () => {
      const created = await new HostingAPI().createProject(name);
      const config = getConfigManager();
      config.setValue('deploy.currentProject', created.id);
      config.setValue('deploy.currentServer', null);
      logger.success(`Created project ${created.name} (${created.id})`);
    }));

  project
    .command('use <project>')
    .description('Select the project and service used by service commands')
    .option('-s, --service <id-or-name>', 'Service to select when the project has multiple services')
    .action(async (selector: string, options: { service?: string }) =>
      runCommand(() => useProject(selector, options.service))
    );

  project
    .command('stop')
    .description('Stop every service in the selected project')
    .action(async () => runCommand(async () => {
      const hosting = new HostingAPI();
      const current = await requireCurrentProject(hosting);
      await hosting.stopProject(current.id);
      logger.success(`Stopped project ${current.name}`);
    }));

  project
    .command('redeploy')
    .description('Redeploy every service in the selected project')
    .action(async () => runCommand(async () => {
      const hosting = new HostingAPI();
      const current = await requireCurrentProject(hosting);
      await hosting.redeployProject(current.id);
      logger.success(`Redeploy started for ${current.name}`);
    }));

  project
    .command('delete <project>')
    .description('Permanently delete a named project and all of its services')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .option('--force-managed-data', 'Also permanently delete managed databases and their data')
    .action(async (selector: string, options: DeleteProjectOptions) =>
      runCommand(() => deleteProject(selector, options))
    );
}
