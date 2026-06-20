import path from 'path';
import { loadAgentState, saveAgentState } from '../../lib/agent/state.js';
import { streamAgentChat } from '../../lib/agent/backend.js';
import { createEventPrinter } from '../../lib/agent/renderer.js';
import { input } from '../../lib/prompts.js';
import { logger } from '../../lib/logger.js';

interface ChatCommandOptions {
  path?: string;
  message?: string;
}

export async function runAgentChat(options: ChatCommandOptions) {
  const projectRoot = path.resolve(options.path ?? process.cwd());
  const state = loadAgentState(projectRoot);

  if (!state) {
    logger.warn('No existing agent session found. Run "autodisc agent:setup" first.');
    return;
  }

  let message = options.message;
  if (!message) {
    const response = await input('What would you like to ask the Autodisc agent?');
    message = response.trim();
    if (!message) {
      logger.warn('Aborted: no message provided.');
      return;
    }
  }

  const renderer = createEventPrinter();
  logger.info('Sending message to Autodisc agent...');
  const result = await streamAgentChat({
    conversationId: state.conversationId,
    workspaceId: state.workspaceId ?? undefined,
    projectId: state.projectId ?? undefined,
    message,
    onEvent: renderer.onEvent,
  });
  renderer.finish();

  saveAgentState(projectRoot, {
    ...state,
    workspaceId: result.workspaceId ?? state.workspaceId ?? null,
    lastMessage: message,
    updatedAt: new Date().toISOString(),
  });
}
