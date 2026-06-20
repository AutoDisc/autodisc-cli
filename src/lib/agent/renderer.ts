import chalk from 'chalk';
import { logger } from '../logger.js';
import type { AgentStreamEvent } from './backend.js';

interface AgentRenderer {
  onEvent: (event: AgentStreamEvent) => void;
  finish: () => void;
}

export function createEventPrinter(): AgentRenderer {
  let wroteContent = false;
  let lastTokensUsed: number | undefined;
  let maxTokens: number | undefined;
  let finalModel: string | undefined;

  function writeContent(text?: unknown, color?: (text: string) => string) {
    if (!text || typeof text !== 'string') return;
    if (!text.trim()) return;
    if (!wroteContent) {
      process.stdout.write('\n');
      wroteContent = true;
    }
    process.stdout.write(color ? color(text) : text);
  }

  return {
    onEvent(event) {
      switch (event.type) {
        case 'thinking_start':
          logger.info('🤖 Thinking...');
          break;
        case 'reasoning_chunk':
          writeContent(event.text, chalk.magenta);
          break;
        case 'content_chunk':
          writeContent(event.text);
          break;
        case 'tool_call_start': {
          const name = typeof event.name === 'string' ? event.name : 'unknown tool';
          logger.info(`🛠 Running ${name}...`);
          break;
        }
        case 'tool_call_done': {
          const succeeded = event.success !== false;
          const name = typeof event.name === 'string' ? event.name : 'tool';
          const toolCall = (event['tool_call'] as Record<string, unknown> | undefined) ?? undefined;
          const toolResult = (toolCall?.result as Record<string, unknown> | undefined) ?? undefined;
          const errorMessage =
            typeof toolResult?.error === 'string'
              ? toolResult.error
              : toolResult && Object.keys(toolResult).length
                ? JSON.stringify(toolResult)
                : 'unknown error';
          if (succeeded) {
            logger.success(`🛠 ${name} completed.`);
          } else {
            logger.warn(`🛠 ${name} failed: ${errorMessage}`);
          }
          break;
        }
        case 'lsp_errors': {
          const file = typeof event.file === 'string' ? event.file : 'file';
          logger.warn(`Diagnostics reported in ${file}`);
          break;
        }
        case 'context_update': {
          if (typeof event.tokens_used === 'number') lastTokensUsed = event.tokens_used;
          if (typeof event.max_tokens === 'number') maxTokens = event.max_tokens;
          if (lastTokensUsed !== undefined && maxTokens !== undefined) {
            logger.info(`Context usage: ${lastTokensUsed}/${maxTokens}`);
          }
          break;
        }
        case 'compacted':
          logger.info('✂️ Context compacted to stay within limits.');
          break;
        case 'compacting':
          logger.info('✂️ Compacting context to free space...');
          break;
        case 'complete':
          if (typeof event.tokens_used === 'number') lastTokensUsed = event.tokens_used;
          if (typeof event.model_used === 'string') finalModel = event.model_used;
          break;
        case 'error':
          logger.error((event.message as string) ?? 'Agent error');
          break;
        default:
          break;
      }
    },
    finish() {
      if (wroteContent) {
        process.stdout.write('\n');
      }
      if (lastTokensUsed !== undefined) {
        logger.info(`Tokens used: ${lastTokensUsed}${finalModel ? ` • Model: ${finalModel}` : ''}`);
      }
    },
  };
}
