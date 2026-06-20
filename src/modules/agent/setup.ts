import path from 'path';
import boxen from 'boxen';
import { analyzeProject, formatAnalysisForPrompt } from '../../lib/agent/analysis.js';
import { extractDeployYaml, saveDeployYaml, validateDeployYaml } from '../../lib/agent/config.js';
import { extractAssistantContent } from '../../lib/agent/content.js';
import { ensureAutodiscDir, loadAgentState, saveAgentState } from '../../lib/agent/state.js';
import { extractEnvVariablesFromText, mergeEnvVariables, saveEnvTemplate } from '../../lib/agent/env.js';
import { createAgentConversation, streamAgentChat } from '../../lib/agent/backend.js';
import { createEventPrinter } from '../../lib/agent/renderer.js';
import { createSpinner } from '../../lib/spinner.js';
import { confirm, input } from '../../lib/prompts.js';
import { logger } from '../../lib/logger.js';
import type { DeployConfig } from '../../types.js';

interface SetupCommandOptions {
  path?: string;
  message?: string;
}

const DEFAULT_PROMPT =
  'Please analyze this project and propose an optimal autodisc.yml configuration (stack, build/start commands, plan, and env vars).';

export async function runAgentSetup(options: SetupCommandOptions) {
  const projectRoot = path.resolve(options.path ?? process.cwd());
  ensureAutodiscDir(projectRoot);

  const spinner = createSpinner('Analyzing project');
  spinner.start();
  const analysis = analyzeProject(projectRoot);
  spinner.succeed();

  const analysisSummary = formatAnalysisForPrompt(analysis);
  const existingState = loadAgentState(projectRoot);

  if (analysis.envVariables.length) {
    logger.info(`Detected ${analysis.envVariables.length} environment variables: ${analysis.envVariables.slice(0, 8).join(', ')}${analysis.envVariables.length > 8 ? '…' : ''}`);
  }

  let message = options.message;
  if (!message) {
    const response = await input('Describe any special deployment requirements (optional):');
    message = response.trim();
  }

  let currentPrompt = `${message || DEFAULT_PROMPT}\n\nProject context:\n${analysisSummary}`;
  let conversationId = existingState?.conversationId;
  let projectId = existingState?.projectId ?? null;
  let workspaceId = existingState?.workspaceId ?? null;
  let lastUserPrompt = currentPrompt;
  let latestAssistantContent = '';

  if (!conversationId) {
    const conversation = await createAgentConversation({ title: path.basename(projectRoot) });
    conversationId = conversation.id;
    projectId = conversation.project_id ?? null;
    logger.success(`Started new agent conversation (${conversation.title})`);
  }

  const envAccumulator = new Set(analysis.envVariables);
  if (existingState?.envVariables) {
    existingState.envVariables.forEach((key) => envAccumulator.add(key));
  }

  while (true) {
    const renderer = createEventPrinter();
    logger.info('Connecting to Autodisc agent...');
    const result = await streamAgentChat({
      conversationId: conversationId!,
      workspaceId,
      projectId,
      message: currentPrompt,
      onEvent: renderer.onEvent,
    });
    renderer.finish();

    workspaceId = result.workspaceId ?? workspaceId;
    latestAssistantContent = extractAssistantContent(result.finalEvent);

    if (!latestAssistantContent) {
      logger.warn('Agent did not return a final response.');
    }

    await handleDeploySuggestion(projectRoot, latestAssistantContent);
    const suggestedEnv = latestAssistantContent ? extractEnvVariablesFromText(latestAssistantContent) : [];
    suggestedEnv.forEach((key) => envAccumulator.add(key));

    const askMore = await confirm('Ask the agent a follow-up question?', false);
    if (!askMore) {
      break;
    }
    const followUp = await input('What should I ask the agent next?');
    const trimmed = followUp.trim();
    if (!trimmed) {
      logger.warn('Empty prompt. Ending session.');
      break;
    }
    currentPrompt = trimmed;
    lastUserPrompt = currentPrompt;
  }

  const mergedEnv = mergeEnvVariables(Array.from(envAccumulator));

  if (mergedEnv.length) {
    logger.info(`Environment variables to configure (${mergedEnv.length}): ${mergedEnv.slice(0, 10).join(', ')}${mergedEnv.length > 10 ? '…' : ''}`);
    if (await confirm('Write these environment keys to .autodisc/.env.template?', true)) {
      const envPath = saveEnvTemplate(projectRoot, mergedEnv);
      if (envPath) {
        logger.success(`Saved env template: ${path.relative(projectRoot, envPath)}`);
      }
    }
  }

  saveAgentState(projectRoot, {
    conversationId: conversationId!,
    workspaceId,
    projectId,
    analysis,
    lastMessage: lastUserPrompt,
    envVariables: mergedEnv,
    updatedAt: new Date().toISOString(),
  });

  logger.success('Agent session complete. Use "autodisc agent:chat" for follow-ups.');
}

async function handleDeploySuggestion(projectRoot: string, content: string) {
  const deployYaml = extractDeployYaml(content);
  if (!deployYaml) {
    logger.warn('Agent response did not include an autodisc.yml snippet.');
    return;
  }

  try {
    const config = validateDeployYaml(deployYaml);
    displayConfigSummary(config);
    if (await confirm('Write this configuration to autodisc.yml?', true)) {
      const targetPath = saveDeployYaml(projectRoot, deployYaml);
      logger.success(`Saved autodisc.yml → ${path.relative(projectRoot, targetPath)}`);
    } else {
      logger.warn('Skipped writing autodisc.yml. You can re-run this command later.');
    }
  } catch (error) {
    logger.error(`Agent returned an invalid autodisc.yml: ${(error as Error).message}`);
  }
}

function displayConfigSummary(config: DeployConfig) {
  const lines: string[] = [];
  lines.push(`Name: ${config.name}`);
  lines.push(`Source: ${config.source.type}`);
  if (config.source.repo_full_name) lines.push(`Repo: ${config.source.repo_full_name}`);
  if (config.runtime?.stack) lines.push(`Stack: ${config.runtime.stack}`);
  if (config.runtime?.start_command) lines.push(`Start: ${config.runtime.start_command}`);
  if (config.runtime?.build_steps?.length) {
    lines.push('Build steps:');
    config.runtime.build_steps.forEach((step) => lines.push(`  - ${step}`));
  }
  lines.push(`Plan: ${config.deployment.plan_type}`);
  if (config.deployment.auto_restart !== undefined) {
    lines.push(`Auto-restart: ${config.deployment.auto_restart ? 'yes' : 'no'}`);
  }

  logger.info(
    boxen(lines.join('\n'), {
      padding: 1,
      borderColor: 'cyan',
      title: 'Suggested autodisc.yml',
    })
  );
}
