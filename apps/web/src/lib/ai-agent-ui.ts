import type { AiMessage } from '@orbitchat/shared-types';
import { sortAiMessages } from '@/lib/api/ai';

export const CITATION_TOOL_NAMES = new Set([
  'search_my_posts',
  'search_help_docs',
  'list_my_recent_posts',
]);

export const TRANSIENT_AI_ERROR_CODES = new Set(['AI_BUSY', 'LLM_UNAVAILABLE', 'LLM_EMPTY_RESPONSE']);

export interface AiCitation {
  id: string;
  label: string;
  title?: string;
}

export function isCitationTool(toolName: string): boolean {
  return CITATION_TOOL_NAMES.has(toolName);
}

export function sliceResourceId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

export function countToolOutputItems(output: unknown): number {
  if (typeof output !== 'object' || output === null || !('items' in output)) {
    return 0;
  }
  const items = (output as { items: unknown }).items;
  return Array.isArray(items) ? items.length : 0;
}

export function parseToolOutputFromContent(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

export function parseCitationsFromToolOutput(toolName: string, output: unknown): AiCitation[] {
  if (typeof output !== 'object' || output === null || !('items' in output)) {
    return [];
  }

  const items = (output as { items: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }

  const citations: AiCitation[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    if (toolName === 'search_my_posts' && 'postId' in item && typeof item.postId === 'string') {
      const key = `post:${item.postId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      citations.push({
        id: key,
        label: `依据：帖子 ${sliceResourceId(item.postId)}`,
        title: 'text' in item && typeof item.text === 'string' ? item.text : undefined,
      });
      continue;
    }

    if (toolName === 'search_help_docs' && 'sourceId' in item && typeof item.sourceId === 'string') {
      const key = `doc:${item.sourceId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      citations.push({
        id: key,
        label: `依据：${item.sourceId} 文档`,
        title: 'text' in item && typeof item.text === 'string' ? item.text : undefined,
      });
      continue;
    }

    if (toolName === 'list_my_recent_posts' && 'id' in item && typeof item.id === 'string') {
      const key = `post:${item.id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      citations.push({
        id: key,
        label: `依据：帖子 ${sliceResourceId(item.id)}`,
        title: 'content' in item && typeof item.content === 'string' ? item.content : undefined,
      });
    }
  }

  return citations;
}

export function buildCitationsByAssistantMessage(messages: AiMessage[]): Map<string, AiCitation[]> {
  const citationsByAssistantId = new Map<string, AiCitation[]>();
  let pendingCitations: AiCitation[] = [];
  const seenCitationIds = new Set<string>();

  for (const message of sortAiMessages(messages)) {
    if (message.role === 'user') {
      pendingCitations = [];
      seenCitationIds.clear();
      continue;
    }

    if (message.role === 'tool' && message.toolName && isCitationTool(message.toolName)) {
      const output = parseToolOutputFromContent(message.content);
      if (output) {
        for (const citation of parseCitationsFromToolOutput(message.toolName, output)) {
          if (seenCitationIds.has(citation.id)) {
            continue;
          }
          seenCitationIds.add(citation.id);
          pendingCitations.push(citation);
        }
      }
      continue;
    }

    if (message.role === 'assistant' && pendingCitations.length > 0) {
      citationsByAssistantId.set(message.id, [...pendingCitations]);
      pendingCitations = [];
      seenCitationIds.clear();
    }
  }

  return citationsByAssistantId;
}

export function formatAiError(code: string, fallbackMessage: string): string {
  const friendlyMessages: Record<string, string> = {
    AI_BUSY: '小轨正忙，请稍后再试。',
    LLM_UNAVAILABLE: '模型服务暂不可用，请检查本地模型是否已启动。',
    LLM_EMPTY_RESPONSE: '模型返回了空回复，请重试。',
    AI_STREAM_FAILED: '连接中断，请重新发送消息。',
  };

  const message = friendlyMessages[code] ?? fallbackMessage;
  if (TRANSIENT_AI_ERROR_CODES.has(code)) {
    return `${message} 你可以稍后重试发送。`;
  }

  return message;
}

export function formatToolMessageContent(toolName: string | null, content: string): string {
  if (!toolName || !isCitationTool(toolName)) {
    return content;
  }

  const output = parseToolOutputFromContent(content);
  if (!output) {
    return content;
  }

  const count = countToolOutputItems(output);
  switch (toolName) {
    case 'search_my_posts':
      return `搜索你的帖子：找到 ${count} 条结果`;
    case 'search_help_docs':
      return `搜索帮助文档：找到 ${count} 条结果`;
    case 'list_my_recent_posts':
      return `最近帖子：共 ${count} 条`;
    default:
      return content;
  }
}
