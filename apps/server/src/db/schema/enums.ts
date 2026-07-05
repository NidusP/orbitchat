import { pgEnum } from 'drizzle-orm/pg-core';

export const clientPlatformEnum = pgEnum('client_platform', [
  'web',
  'ios',
  'android',
  'desktop',
]);

export const conversationTypeEnum = pgEnum('conversation_type', ['direct']);

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

export type DbClientPlatform = (typeof clientPlatformEnum.enumValues)[number];
export type DbConversationType = (typeof conversationTypeEnum.enumValues)[number];
export type DbAiMessageRole = (typeof aiMessageRoleEnum.enumValues)[number];
export type DbAiToolCallStatus = (typeof aiToolCallStatusEnum.enumValues)[number];
