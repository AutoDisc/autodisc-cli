import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DeployConfig } from '../../types.js';

const DEPLOY_FILENAME = 'autodisc.yml';

export function extractDeployYaml(content?: string): string | null {
  if (!content) return null;
  const codeBlockRegex = /```(?:ya?ml)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const snippet = match[1].trim();
    if (looksLikeDeployConfig(snippet)) {
      return snippet;
    }
  }
  if (looksLikeDeployConfig(content.trim())) {
    return content.trim();
  }
  return null;
}

function looksLikeDeployConfig(text: string) {
  return /version\s*:\s*"?1/.test(text) && /source\s*:\s*/.test(text) && /deployment\s*:\s*/.test(text);
}

export function validateDeployYaml(raw: string): DeployConfig {
  const data = yaml.load(raw);
  if (!data || typeof data !== 'object') {
    throw new Error('autodisc.yml is empty or invalid YAML');
  }
  const config = data as DeployConfig;
  if (config.version !== '1') throw new Error('autodisc.yml must set version: "1"');
  if (!config.name) throw new Error('autodisc.yml missing "name"');
  if (!config.source?.type) throw new Error('autodisc.yml missing source.type');
  if (!config.deployment?.plan_type) throw new Error('autodisc.yml missing deployment.plan_type');
  if (!config.runtime?.start_command && config.source.type !== 'repo') {
    throw new Error('autodisc.yml missing runtime.start_command');
  }
  return config;
}

export function saveDeployYaml(projectRoot: string, raw: string) {
  const targetPath = path.join(projectRoot, DEPLOY_FILENAME);
  fs.writeFileSync(targetPath, ensureTrailingNewline(raw), 'utf8');
  return targetPath;
}

function ensureTrailingNewline(text: string) {
  return text.endsWith('\n') ? text : `${text}\n`;
}
