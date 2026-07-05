import type { Agent, AiConversation, AiMessage, AiToolCall } from '@orbitchat/shared-types';
import type { Agent as DbAgent } from '../db/schema/agents';
import type { AiConversation as DbAiConversation } from '../db/schema/ai-conversations';
import type { AiMessage as DbAiMessage } from '../db/schema/ai-messages';
import type { AiToolCall as DbAiToolCall } from '../db/schema/ai-tool-calls';

function toIsoString(date: Date): string {
  return date.toISOString();
}

export function toAgentDto(agent: DbAgent): Agent {
  return {
    id: agent.id,
    slug: agent.slug,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    isBuiltin: agent.isBuiltin,
    createdAt: toIsoString(agent.createdAt),
    updatedAt: toIsoString(agent.updatedAt),
  };
}

export function toAiConversationDto(conversation: DbAiConversation): AiConversation {
  return {
    id: conversation.id,
    userId: conversation.userId,
    agentId: conversation.agentId,
    title: conversation.title,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    createdAt: toIsoString(conversation.createdAt),
    updatedAt: toIsoString(conversation.updatedAt),
  };
}

export function toAiMessageDto(message: DbAiMessage): AiMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    toolName: message.toolName,
    createdAt: toIsoString(message.createdAt),
  };
}

export function toAiToolCallDto(toolCall: DbAiToolCall): AiToolCall {
  return {
    id: toolCall.id,
    conversationId: toolCall.conversationId,
    requestedByUserId: toolCall.requestedByUserId,
    toolName: toolCall.toolName,
    status: toolCall.status,
    input: toolCall.input,
    output: toolCall.output,
    error: toolCall.error,
    createdAt: toIsoString(toolCall.createdAt),
    updatedAt: toIsoString(toolCall.updatedAt),
    confirmedAt: toolCall.confirmedAt?.toISOString() ?? null,
    executedAt: toolCall.executedAt?.toISOString() ?? null,
  };
}
