import { pgEnum } from 'drizzle-orm/pg-core';

export const clientPlatformEnum = pgEnum('client_platform', [
  'web',
  'ios',
  'android',
  'desktop',
]);

export const conversationMemberRoleEnum = pgEnum('conversation_member_role', [
  'owner',
  'admin',
  'member',
]);

export const conversationTypeEnum = pgEnum('conversation_type', ['direct', 'group']);

export const aiMessageRoleEnum = pgEnum('ai_message_role', [
  'user',
  'assistant',
  'system',
  'tool',
]);

export const aiToolCallStatusEnum = pgEnum('ai_tool_call_status', [
  'pending',
  'approved',
  'rejected',
  'executed',
  'failed',
]);

export const userAgentMemoryKindEnum = pgEnum('user_agent_memory_kind', [
  'preference',
  'fact',
  'nickname',
]);

export const userAgentMemorySourceEnum = pgEnum('user_agent_memory_source', [
  'user_explicit',
  'tool',
  'admin',
]);

export const knowledgeChunkSourceTypeEnum = pgEnum('knowledge_chunk_source_type', [
  'post',
  'doc',
]);

export type DbClientPlatform = (typeof clientPlatformEnum.enumValues)[number];
export type DbConversationMemberRole = (typeof conversationMemberRoleEnum.enumValues)[number];
export type DbConversationType = (typeof conversationTypeEnum.enumValues)[number];
export type DbAiMessageRole = (typeof aiMessageRoleEnum.enumValues)[number];
export type DbAiToolCallStatus = (typeof aiToolCallStatusEnum.enumValues)[number];
export type DbUserAgentMemoryKind = (typeof userAgentMemoryKindEnum.enumValues)[number];
export type DbUserAgentMemorySource = (typeof userAgentMemorySourceEnum.enumValues)[number];
export type DbKnowledgeChunkSourceType = (typeof knowledgeChunkSourceTypeEnum.enumValues)[number];
