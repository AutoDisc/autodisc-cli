import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectConfig } from './auto-config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autodisc-auto-config-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('detectConfig', () => {
  it('generates Builder deploy configs for lightweight Python bots', () => {
    fs.writeFileSync(path.join(tempDir, 'bot.py'), 'print("ready")\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'discord.py\n', 'utf8');

    const result = detectConfig(tempDir);

    expect(result.config.name).toMatch(/^autodisc-auto-config-test-/);
    expect(result.config.runtime.stack).toBe('python');
    expect(result.config.runtime.start_command).toBe('python bot.py');
    expect(result.config.runtime.build_steps).toEqual(['pip install -r requirements.txt']);
    expect(result.config.deployment).toEqual({
      plan_type: 'builder',
      auto_restart: true,
    });
  });
});
