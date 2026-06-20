import axios from 'axios';
import type { ConversationResponse } from '../../types.js';
import { createHttpClient, extractAxiosError } from '../http.js';

const http = createHttpClient();

export async function createAgentConversation(options?: { title?: string; projectId?: string | null }) {
  try {
    const { data } = await http.post<ConversationResponse>('/studio/conversations', {
      title: options?.title,
      project_id: options?.projectId ?? undefined,
    });
    return data;
  } catch (error) {
    throw new Error(extractAxiosError(error));
  }
}

export type AgentStreamEvent = {
  type: string;
  [key: string]: unknown;
};

export interface AgentChatResult {
  finalEvent?: AgentStreamEvent;
  workspaceId?: string | null;
  tokensUsed?: number;
  modelUsed?: string;
}

export interface AgentChatOptions {
  conversationId: string;
  message: string;
  workspaceId?: string | null;
  projectId?: string | null;
  onEvent?: (event: AgentStreamEvent) => void;
}

export async function streamAgentChat(options: AgentChatOptions): Promise<AgentChatResult> {
  const payload = {
    conversation_id: options.conversationId,
    message: options.message,
    workspace_id: options.workspaceId,
    project_id: options.projectId,
    stream: true,
  };

  try {
    const response = await http.post('/studio/chat', payload, {
      responseType: 'stream',
      headers: {
        Accept: 'text/event-stream',
      },
    });

    const stream = response.data as NodeJS.ReadableStream;
    let buffer = '';
    let finalEvent: AgentStreamEvent | undefined;
    let workspaceId: string | null | undefined;
    let tokensUsed: number | undefined;
    let modelUsed: string | undefined;

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          let event: AgentStreamEvent;
          try {
            event = JSON.parse(dataStr);
          } catch {
            continue;
          }
          options.onEvent?.(event);
          if (event.type === 'error') {
            return reject(new Error((event.message as string) || 'Agent error'));
          }
          if (event.type === 'complete') {
            finalEvent = event;
            workspaceId = (event.workspace_id as string | null | undefined) ?? workspaceId;
            tokensUsed = (event.tokens_used as number | undefined) ?? tokensUsed;
            modelUsed = (event.model_used as string | undefined) ?? modelUsed;
          }
          if (event.type === 'context_update' && event.workspace_id) {
            workspaceId = event.workspace_id as string;
          }
        }
      });
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve());
    });

    return {
      finalEvent,
      workspaceId,
      tokensUsed,
      modelUsed,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
      try {
        const errorText = await readStreamText(error.response.data as NodeJS.ReadableStream);
        throw new Error(errorText || extractAxiosError(error));
      } catch {
        throw new Error(extractAxiosError(error));
      }
    }
    throw new Error(extractAxiosError(error));
  }
}

async function readStreamText(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString();
}
