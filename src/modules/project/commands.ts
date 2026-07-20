import type { Command } from 'commander';
import { runCommand } from '../../lib/command.js';
import { getConfigManager } from '../../lib/config.js';
import { HostingAPI, redactServerEnvironment } from '../../lib/hosting.js';
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
  });
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
    .action(async (selector: string, options: { yes?: boolean }) => runCommand(async () => {
      const hosting = new HostingAPI();
      const target = matchProject(await hosting.listProjects(), selector);
      if (!options.yes) {
        if (!process.stdin.isTTY) throw new Error('Pass --yes to delete a project non-interactively.');
        if (!await confirm(`Permanently delete project "${target.name}" and all services?`, false)) {
          logger.info('Deletion cancelled.');
          return;
        }
      }
      await hosting.deleteProject(target.id);
      const config = getConfigManager();
      if (config.getValue<string>('deploy.currentProject') === target.id) {
        config.setValue('deploy.currentProject', null);
        config.setValue('deploy.currentServer', null);
      }
      logger.success(`Deleted project ${target.name}`);
    }));
}
