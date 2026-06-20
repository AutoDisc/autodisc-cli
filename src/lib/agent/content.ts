import type { AgentStreamEvent } from './backend.js';

export function extractAssistantContent(event?: AgentStreamEvent) {
  if (!event) return '';
  const message = event.message as { content?: string } | undefined;
  if (message?.content && typeof message.content === 'string') {
    return message.content;
  }
  if (typeof (event as Record<string, unknown>).content === 'string') {
    return (event as Record<string, unknown>).content as string;
  }
  return '';
}
