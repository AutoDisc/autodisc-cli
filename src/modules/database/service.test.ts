import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class AmbiguousMutationError extends Error {}
  return {
    AmbiguousMutationError,
    listProjects: vi.fn(),
    getProject: vi.fn(),
    listProjectDatabases: vi.fn(),
    createProjectDatabase: vi.fn(),
    getManagedDatabase: vi.fn(),
    bindManagedDatabase: vi.fn(),
    redeployServer: vi.fn(),
    getServer: vi.fn(),
    databaseAction: vi.fn(),
    deleteManagedDatabase: vi.fn(),
    spinnerStart: vi.fn(),
    spinnerSucceed: vi.fn(),
    spinnerFail: vi.fn(),
    loggerInfo: vi.fn(),
    loggerSuccess: vi.fn(),
  };
});

vi.mock('../../lib/hosting.js', () => ({
  AmbiguousMutationError: mocks.AmbiguousMutationError,
  HostingAPI: class {
    listProjects = mocks.listProjects;
    getProject = mocks.getProject;
    listProjectDatabases = mocks.listProjectDatabases;
    createProjectDatabase = mocks.createProjectDatabase;
    getManagedDatabase = mocks.getManagedDatabase;
    bindManagedDatabase = mocks.bindManagedDatabase;
    redeployServer = mocks.redeployServer;
    getServer = mocks.getServer;
    databaseAction = mocks.databaseAction;
    deleteManagedDatabase = mocks.deleteManagedDatabase;
  },
}));

vi.mock('../../lib/config.js', () => ({
  getConfigManager: () => ({ getValue: () => 'project-1' }),
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

import { addDatabase, listDatabases } from './service.js';

const project = {
  id: 'project-1',
  user_id: 'user-1',
  name: 'mdboard',
  slug: 'mdboard',
  default_environment_id: 'environment-1',
  services: [{
    id: 'service-api',
    user_id: 'user-1',
    project_id: 'project-1',
    environment_id: 'environment-1',
    name: 'api',
    source_type: 'repo' as const,
    plan_type: 'builder' as const,
    status: 'error' as const,
    service_type: 'app' as const,
  }],
};

const database = {
  id: 'database-1',
  project_id: 'project-1',
  environment_id: 'environment-1',
  service_id: 'service-database',
  name: 'postgres',
  engine: 'postgres' as const,
  version: '17',
  status: 'running',
  status_reason: null,
  private_networking: { state: 'available', hostname: 'db-1234567890abcdef1234', port: 5432 },
  public_tcp: { state: 'unavailable', reason: 'not_supported' },
  connection: {
    host: 'db-1234567890abcdef1234',
    port: 5432,
    database: 'autodisc',
    username: 'autodisc',
    password: 'super-secret',
    url: 'postgresql://autodisc:super-secret@db-1234567890abcdef1234:5432/autodisc',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listProjects.mockResolvedValue([project]);
  mocks.getProject.mockResolvedValue(project);
  mocks.listProjectDatabases.mockResolvedValue([]);
  mocks.createProjectDatabase.mockResolvedValue(database);
  mocks.getManagedDatabase.mockResolvedValue(database);
  mocks.bindManagedDatabase.mockResolvedValue({
    id: 'variable-1',
    environment_id: 'environment-1',
    service_id: 'service-api',
    key: 'DATABASE_URL',
    secret: true,
    source: 'managed_database',
    source_resource_id: 'database-1',
  });
  mocks.redeployServer.mockResolvedValue({ ...project.services[0], status: 'provisioning' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('managed database workflow', () => {
  it('creates, binds, then redeploys the dependent service in order', async () => {
    await addDatabase('postgres', { project: 'mdboard', bind: 'api' });

    expect(mocks.createProjectDatabase).toHaveBeenCalledWith(
      'project-1',
      { type: 'postgres', name: 'postgres' },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(mocks.bindManagedDatabase).toHaveBeenCalledWith('database-1', 'service-api', undefined);
    expect(mocks.redeployServer).toHaveBeenCalledWith('service-api');
    expect(mocks.createProjectDatabase.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.bindManagedDatabase.mock.invocationCallOrder[0]);
    expect(mocks.bindManagedDatabase.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.redeployServer.mock.invocationCallOrder[0]);
  });

  it('recovers a database accepted before a Cloudflare timeout', async () => {
    mocks.createProjectDatabase.mockRejectedValue(new mocks.AmbiguousMutationError('Cloudflare 524'));
    mocks.listProjectDatabases
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([database]);

    await addDatabase('postgres', { project: 'mdboard' });

    expect(mocks.createProjectDatabase).toHaveBeenCalledOnce();
    expect(mocks.spinnerSucceed).toHaveBeenCalledWith(
      'Database creation accepted; provisioning is continuing',
    );
  });

  it('redacts credentials from machine-readable database output', async () => {
    mocks.listProjectDatabases.mockResolvedValue([database]);
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await listDatabases({ project: 'mdboard', json: true });

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).not.toContain('super-secret');
    expect(serialized).toContain('"password": "[hidden]"');
    expect(serialized).toContain('"url": "[hidden]"');
  });
});
