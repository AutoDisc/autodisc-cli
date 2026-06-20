import fs from 'fs';
import path from 'path';
import { ensureAutodiscDir } from './state.js';

const ENV_TEMPLATE_FILE = '.autodisc/.env.template';

export function extractEnvVariablesFromText(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/[A-Z][A-Z0-9_]{2,}/g);
  if (!matches) return [];
  const blacklist = new Set(['HTTP', 'HTTPS', 'CPU', 'RAM', 'GPU']);
  return Array.from(
    new Set(
      matches
        .filter((key) => !blacklist.has(key))
        .filter((key) => key.length <= 40)
    )
  );
}

export function sortEnvVariables(vars: string[]): string[] {
  return Array.from(new Set(vars)).sort((a, b) => a.localeCompare(b));
}

export function saveEnvTemplate(projectRoot: string, envVars: string[]) {
  if (!envVars.length) return null;
  ensureAutodiscDir(projectRoot);
  const target = path.join(projectRoot, ENV_TEMPLATE_FILE);
  const lines = envVars.map((key) => `${key}=`);
  fs.writeFileSync(target, `${lines.join('\n')}\n`, 'utf8');
  return target;
}

export function mergeEnvVariables(...sources: Array<string[] | undefined | null>) {
  const merged: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    merged.push(...source);
  }
  return sortEnvVariables(merged);
}
