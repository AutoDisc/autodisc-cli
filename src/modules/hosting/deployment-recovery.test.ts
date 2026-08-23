import { describe, expect, it, vi } from 'vitest';
import type { HostingServerResponse } from '../../types.js';
import { recoverAmbiguousDeployment } from './deployment-recovery.js';

function server(overrides: Partial<HostingServerResponse> = {}): HostingServerResponse {
  return {
    id: 'server-1',
    user_id: 'user-1',
    name: 'example',
    source_type: 'repo',
    repo_full_name: 'AutoDisc/example',
    repo_branch: 'main',
    start_command: 'npm start',
    detected_stack: 'node',
    plan_type: 'builder',
    status: 'error',
    environment: { NODE_ENV: 'production' },
    ...overrides,
  };
}

function client(currentServer: HostingServerResponse | null, deploymentId = 'deployment-old') {
  return {
    getServer: vi.fn().mockResolvedValue(currentServer),
    getProject: vi.fn().mockResolvedValue({ services: currentServer ? [currentServer] : [] }),
    listDeployments: vi.fn().mockResolvedValue(deploymentId ? [{ id: deploymentId }] : []),
  };
}

const baseOptions = {
  projectId: 'project-1',
  serviceName: 'example',
  serverId: 'server-1',
  previousDeploymentId: 'deployment-old',
  attempts: 1,
  intervalMs: 0,
};

describe('ambiguous deployment recovery', () => {
  it('accepts a new deployment record even if the build already failed', async () => {
    const hosting = client(server(), 'deployment-new');

    await expect(recoverAmbiguousDeployment(hosting, baseOptions)).resolves.toMatchObject({
      deploymentAccepted: true,
      evidence: 'new_deployment',
    });
  });

  it('accepts provisioning as proof that the request reached the runtime', async () => {
    const hosting = client(server({ status: 'provisioning' }));

    await expect(recoverAmbiguousDeployment(hosting, baseOptions)).resolves.toMatchObject({
      deploymentAccepted: true,
      evidence: 'provisioning',
    });
  });

  it('recognizes persisted settings without claiming a deployment started', async () => {
    const hosting = client(server());

    await expect(recoverAmbiguousDeployment(hosting, {
      ...baseOptions,
      previousServer: server({ start_command: 'node old-server.js' }),
      expectedSettings: {
        repo_full_name: 'AutoDisc/example',
        repo_branch: 'main',
        start_command: 'npm start',
        environment: { NODE_ENV: 'production' },
      },
    })).resolves.toMatchObject({
      deploymentAccepted: false,
      evidence: 'settings_applied',
    });
  });

  it('does not treat a stale running service as proof of a redeploy', async () => {
    const hosting = client(server({ status: 'running' }));

    await expect(recoverAmbiguousDeployment(hosting, baseOptions)).resolves.toBeNull();
  });

  it('does not use unchanged settings as evidence that a timed-out update landed', async () => {
    const unchanged = server({ status: 'running' });
    const hosting = client(unchanged);

    await expect(recoverAmbiguousDeployment(hosting, {
      ...baseOptions,
      previousServer: unchanged,
      expectedSettings: {
        repo_full_name: 'AutoDisc/example',
        repo_branch: 'main',
        start_command: 'npm start',
      },
    })).resolves.toBeNull();
  });

  it('finds a newly created service through its project', async () => {
    const created = server({ status: 'stopped' });
    const hosting = client(created);

    await expect(recoverAmbiguousDeployment(hosting, {
      ...baseOptions,
      serverId: undefined,
      serviceDidNotExist: true,
    })).resolves.toMatchObject({
      server: created,
      deploymentAccepted: false,
      evidence: 'created_service',
    });
    expect(hosting.getProject).toHaveBeenCalledWith('project-1');
  });
});
