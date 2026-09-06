import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { initProject } from './init.js';
import { autoConfigWithPreview } from '../../lib/auto-config.js';
import { loadDeployConfig } from '../../lib/deploy-config.js';

vi.mock('../../lib/prompts.js', () => ({ confirm: vi.fn(async () => true) }));
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = undefined;
});

it('writes and previews a Dockerfile config without overriding image CMD', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autodisc-docker-init-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'Dockerfile'), 'FROM python:3.12-slim\nCMD ["python", "api.py"]\n');
  await initProject({ path: root });
  const config = loadDeployConfig(root);
  expect(config.runtime.stack).toBe('dockerfile');
  expect(config.runtime.start_command).toBeUndefined();
  const preview = await autoConfigWithPreview(root);
  expect(preview?.runtime.stack).toBe('dockerfile');
  expect(process.exitCode).not.toBe(1);
});
