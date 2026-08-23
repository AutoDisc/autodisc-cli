import { setTimeout as sleep } from 'node:timers/promises';
import type { HostingAPI, UpsertServerPayload } from '../../lib/hosting.js';
import type { HostingServerResponse } from '../../types.js';

type RecoveryClient = Pick<HostingAPI, 'getProject' | 'getServer' | 'listDeployments'>;

export interface DeploymentRecoveryOptions {
  projectId: string;
  serviceName: string;
  serverId?: string;
  previousDeploymentId?: string;
  previousServer?: HostingServerResponse;
  expectedSettings?: Partial<UpsertServerPayload>;
  serviceDidNotExist?: boolean;
  attempts?: number;
  intervalMs?: number;
}

export interface DeploymentRecoveryResult {
  server: HostingServerResponse;
  deploymentAccepted: boolean;
  evidence: 'created_service' | 'new_deployment' | 'provisioning' | 'settings_applied';
}

function environmentContains(
  actual: Record<string, string> | undefined,
  expected: Record<string, string> | undefined,
): boolean {
  if (!expected) return true;
  return Object.entries(expected).every(([key, value]) => actual?.[key] === value);
}

function settingsMatch(
  server: HostingServerResponse,
  expected: Partial<UpsertServerPayload> | undefined,
): boolean {
  if (!expected) return false;
  const comparable: Array<keyof UpsertServerPayload & keyof HostingServerResponse> = [
    'name',
    'source_type',
    'repo_full_name',
    'repo_branch',
    'source_upload_key',
    'source_upload_name',
    'start_command',
    'detected_stack',
    'auto_restart',
  ];
  return comparable.every((key) => expected[key] === undefined || server[key] === expected[key])
    && environmentContains(server.environment, expected.environment);
}

async function findServer(
  hosting: RecoveryClient,
  options: DeploymentRecoveryOptions,
): Promise<HostingServerResponse | null> {
  if (options.serverId) return hosting.getServer(options.serverId);
  const project = await hosting.getProject(options.projectId);
  return project.services.find((service) => service.name === options.serviceName) ?? null;
}

export async function latestDeploymentId(
  hosting: Pick<HostingAPI, 'listDeployments'>,
  serverId: string,
): Promise<string | undefined> {
  try {
    return (await hosting.listDeployments(1, serverId))[0]?.id;
  } catch {
    return undefined;
  }
}

export async function recoverAmbiguousDeployment(
  hosting: RecoveryClient,
  options: DeploymentRecoveryOptions,
): Promise<DeploymentRecoveryResult | null> {
  const attempts = options.attempts ?? 12;
  const intervalMs = options.intervalMs ?? 1_500;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const server = await findServer(hosting, options);
      if (server) {
        if (options.serviceDidNotExist) {
          return {
            server,
            deploymentAccepted: server.status === 'provisioning' || server.status === 'running',
            evidence: 'created_service',
          };
        }

        const deploymentId = await latestDeploymentId(hosting, server.id);
        if (deploymentId && deploymentId !== options.previousDeploymentId) {
          return { server, deploymentAccepted: true, evidence: 'new_deployment' };
        }
        if (server.status === 'provisioning') {
          return { server, deploymentAccepted: true, evidence: 'provisioning' };
        }
        const settingsChanged = options.previousServer
          ? !settingsMatch(options.previousServer, options.expectedSettings)
          : false;
        if (settingsChanged && settingsMatch(server, options.expectedSettings)) {
          return {
            server,
            deploymentAccepted: false,
            evidence: 'settings_applied',
          };
        }
      }
    } catch {
      // A read may race the mutation or briefly share the same proxy failure.
    }

    if (attempt < attempts) await sleep(intervalMs);
  }
  return null;
}
