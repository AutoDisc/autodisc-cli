import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class AmbiguousMutationError extends Error {}
  return {
    AmbiguousMutationError,
    listProjects: vi.fn(),
    getProject: vi.fn(),
    listDeployments: vi.fn(),
    updateServer: vi.fn(),
    getServer: vi.fn(),
    redeployServer: vi.fn(),
    startServer: vi.fn(),
    setValue: vi.fn(),
    spinnerStart: vi.fn(),
    spinnerSucceed: vi.fn(),
    spinnerFail: vi.fn(),
    loggerInfo: vi.fn(),
    loggerSuccess: vi.fn(),
  };
});

const deployConfig = {
  version: '1',
  name: 'mdboard',
  source: {
    type: 'repo' as const,
    repo_full_name: 'yoits9090/mdboard',
    repo_branch: 'main',
  },
  runtime: {
    stack: 'dockerfile' as const,
    start_command: 'bun run start',
    port: 3000,
  },
  deployment: {
    plan_type: 'builder' as const,
    auto_restart: true,
  },
  environment: { NODE_ENV: 'production' },
};

const service = {
  id: 'server-1',
  user_id: 'user-1',
  name: 'mdboard',
  source_type: 'repo' as const,
  repo_full_name: 'yoits9090/mdboard',
  repo_branch: 'main',
  start_command: 'bun run start',
  detected_stack: 'dockerfile',
  plan_type: 'builder' as const,
  status: 'error' as const,
  environment: { NODE_ENV: 'production' },
};

vi.mock('../../lib/hosting.js', () => ({
  AmbiguousMutationError: mocks.AmbiguousMutationError,
  HostingAPI: class {
    listProjects = mocks.listProjects;
    getProject = mocks.getProject;
    listDeployments = mocks.listDeployments;
    updateServer = mocks.updateServer;
    getServer = mocks.getServer;
    redeployServer = mocks.redeployServer;
    startServer = mocks.startServer;
  },
}));

vi.mock('../../lib/deploy-config.js', () => ({
  hasDeployConfig: () => true,
  loadDeployConfig: () => deployConfig,
  saveDeployConfig: vi.fn(),
}));

vi.mock('../../lib/config.js', () => ({
  getConfigManager: () => ({ setValue: mocks.setValue }),
}));

vi.mock('../../lib/spinner.js', () => ({
  createSpinner: () => ({
    start: mocks.spinnerStart,
    succeed: mocks.spinnerSucceed,
    fail: mocks.spinnerFail,
  }),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: mocks.loggerInfo,
    success: mocks.loggerSuccess,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../lib/auto-config.js', () => ({ autoConfigWithPreview: vi.fn() }));
vi.mock('../../lib/prompts.js', () => ({ confirm: vi.fn() }));
vi.mock('../../lib/zip.js', () => ({ createDeploymentZip: vi.fn() }));
vi.mock('../../lib/anonymous-deployments.js', () => ({ AnonymousDeploymentsAPI: class {} }));

import { deploy } from './deploy.js';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listProjects.mockResolvedValue([{ id: 'project-1', name: 'mdboard', slug: 'mdboard' }]);
  mocks.getProject.mockResolvedValue({
    id: 'project-1',
    name: 'mdboard',
    slug: 'mdboard',
    services: [service],
  });
  mocks.listDeployments.mockResolvedValue([{ id: 'deployment-old' }]);
  mocks.updateServer.mockRejectedValue(new mocks.AmbiguousMutationError('Cloudflare 524'));
  mocks.getServer.mockResolvedValue({ ...service, status: 'provisioning' });
});

describe('deploy timeout reconciliation', () => {
  it('does not issue a duplicate redeploy after a timed-out update starts provisioning', async () => {
    await deploy({ path: '/tmp/mdboard', project: 'mdboard' });

    expect(mocks.updateServer).toHaveBeenCalledOnce();
    expect(mocks.redeployServer).not.toHaveBeenCalled();
    expect(mocks.startServer).not.toHaveBeenCalled();
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'The proxy timed out, but Autodisc confirmed the service update was accepted.',
    );
    expect(mocks.loggerSuccess).toHaveBeenCalledWith(expect.stringContaining('Deployment started: mdboard'));
  });
});
