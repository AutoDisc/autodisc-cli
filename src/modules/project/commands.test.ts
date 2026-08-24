import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  deleteProject: vi.fn(),
  setValue: vi.fn(),
  getValue: vi.fn(),
  success: vi.fn(),
}));

vi.mock('../../lib/hosting.js', () => {
  class AmbiguousMutationError extends Error {}
  return {
    AmbiguousMutationError,
    HostingAPI: class {
      listProjects = mocks.listProjects;
      deleteProject = mocks.deleteProject;
    },
    redactServerEnvironment: (service: unknown) => service,
  };
});

vi.mock('../../lib/config.js', () => ({
  getConfigManager: () => ({ getValue: mocks.getValue, setValue: mocks.setValue }),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), success: mocks.success },
}));

vi.mock('../../lib/prompts.js', () => ({ confirm: vi.fn() }));

import { AmbiguousMutationError } from '../../lib/hosting.js';
import { deleteProject } from './commands.js';

const managedProject = {
  id: 'project-1',
  name: 'mdboard',
  slug: 'mdboard',
  services: [{
    id: 'database-service-1',
    name: 'postgres',
    service_type: 'postgres',
    detected_stack: 'managed_database',
    status: 'running',
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listProjects.mockResolvedValue([managedProject]);
  mocks.deleteProject.mockResolvedValue(managedProject);
});

describe('project deletion safeguards', () => {
  it('refuses non-interactive deletion of managed data without the second force flag', async () => {
    await expect(deleteProject('mdboard', { yes: true })).rejects.toThrow(
      'Refusing non-interactive deletion without --force-managed-data',
    );
    expect(mocks.deleteProject).not.toHaveBeenCalled();
  });

  it('allows explicitly forced managed-data deletion', async () => {
    await deleteProject('mdboard', { yes: true, forceManagedData: true });

    expect(mocks.deleteProject).toHaveBeenCalledWith('project-1');
    expect(mocks.success).toHaveBeenCalledWith('Deleted project mdboard');
  });

  it('confirms an ambiguous deletion with a read instead of repeating it', async () => {
    mocks.deleteProject.mockRejectedValue(new AmbiguousMutationError('project deletion', 'timed out'));
    mocks.listProjects
      .mockResolvedValueOnce([managedProject])
      .mockResolvedValueOnce([]);

    await deleteProject('mdboard', { yes: true, forceManagedData: true });

    expect(mocks.deleteProject).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith(
      'Deleted project mdboard (confirmed after the response timed out)',
    );
  });
});
