import path from 'path';
import chalk from 'chalk';
import { autoConfigWithPreview, formatConfigPreview, resolveAutoConfig } from '../../lib/auto-config.js';
import { hasDeployConfig, resolveDeployConfigPath, saveDeployConfig } from '../../lib/deploy-config.js';
import { confirm } from '../../lib/prompts.js';
import { logger } from '../../lib/logger.js';

export interface InitCommandOptions {
  path?: string;
  force?: boolean;
}

export async function initProject(options: InitCommandOptions) {
  const projectRoot = path.resolve(options.path ?? process.cwd());

  if (hasDeployConfig(projectRoot) && !options.force) {
    const existingPath = resolveDeployConfigPath(projectRoot);
    const overwrite = await confirm(
      `Configuration already exists at ${path.relative(projectRoot, existingPath)}. Overwrite it?`,
      false
    );

    if (!overwrite) {
      logger.info('Initialization cancelled.');
      return;
    }
  }

  const result = await resolveAutoConfig(projectRoot);
  if (!result) {
    return;
  }

  console.log('\n' + formatConfigPreview(result) + '\n');

  if (!result.config.runtime.start_command) {
    logger.error('Could not determine a start command for this project.');
    logger.info('Create autodisc.yml manually or re-run "autodisc init" with more project context.');
    return;
  }

  const shouldWrite = await confirm('Write autodisc.yml with this configuration?', true);
  if (!shouldWrite) {
    logger.info('Initialization cancelled.');
    return;
  }

  const configPath = saveDeployConfig(projectRoot, result.config);
  logger.success(`Configuration saved to ${chalk.cyan(path.relative(projectRoot, configPath))}`);

  logger.info('Next steps:');
  logger.info(`  1. Review ${path.relative(projectRoot, configPath)}`);
  logger.info('  2. Add any missing secrets with "autodisc env set KEY=value"');
  logger.info('  3. Run "autodisc deploy"');
}

export async function initAndDeploy(options: InitCommandOptions) {
  const projectRoot = path.resolve(options.path ?? process.cwd());

  if (!hasDeployConfig(projectRoot) || options.force) {
    await initProject(options);
  }

  return autoConfigWithPreview(projectRoot);
}
