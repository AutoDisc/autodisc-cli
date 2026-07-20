import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DeployConfig } from '../types.js';

const YAML_CONFIG_PATH = 'autodisc.yml';

function validateDeployConfig(config: DeployConfig, formatLabel: string): DeployConfig {
  if (!config.version || config.version !== '1') {
    throw new Error(`${formatLabel} must set version = "1"`);
  }
  if (!config.name) {
    throw new Error(`${formatLabel} missing "name"`);
  }
  if (!config.source?.type) {
    throw new Error(`${formatLabel} missing source.type`);
  }
  if (!config.deployment?.plan_type) {
    throw new Error(`${formatLabel} missing deployment.plan_type`);
  }
  if (!config.runtime?.start_command && config.source.type !== 'upload') {
    throw new Error(`${formatLabel} missing runtime.start_command`);
  }
  if (
    config.runtime.port !== undefined &&
    (!Number.isInteger(config.runtime.port) || config.runtime.port < 1 || config.runtime.port > 65_535)
  ) {
    throw new Error(`${formatLabel} runtime.port must be an integer between 1 and 65535`);
  }

  return config;
}

export function hasDeployConfig(projectRoot = process.cwd(), customPath?: string): boolean {
  if (customPath) {
    return fs.existsSync(path.resolve(projectRoot, customPath));
  }

  return fs.existsSync(path.resolve(projectRoot, YAML_CONFIG_PATH));
}

export function resolveDeployConfigPath(projectRoot = process.cwd(), customPath?: string) {
  if (customPath) {
    const resolved = path.resolve(projectRoot, customPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Deploy config not found at ${resolved}`);
    }
    return resolved;
  }

  const yamlPath = path.resolve(projectRoot, YAML_CONFIG_PATH);
  if (fs.existsSync(yamlPath)) {
    return yamlPath;
  }

  throw new Error(`Missing ${YAML_CONFIG_PATH}. Run "autodisc init" first.`);
}

export function loadDeployConfig(projectRoot = process.cwd(), customPath?: string): DeployConfig {
  const filePath = resolveDeployConfigPath(projectRoot, customPath);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = yaml.load(raw);

  if (!data || typeof data !== 'object') {
    throw new Error(`${path.basename(filePath)} is invalid or empty.`);
  }

  return validateDeployConfig(data as DeployConfig, YAML_CONFIG_PATH);
}

export function saveDeployConfig(projectRoot: string, config: DeployConfig): string {
  const configPath = path.join(projectRoot, YAML_CONFIG_PATH);
  const yamlContent = yaml.dump(config, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(configPath, yamlContent.endsWith('\n') ? yamlContent : `${yamlContent}\n`, 'utf-8');
  return configPath;
}
