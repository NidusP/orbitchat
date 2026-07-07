import { eq } from 'drizzle-orm';
import type { ChatWsType } from '@orbitchat/shared-types';
import { db } from '../db';
import { conversations } from '../db/schema/conversations';
import { AppError } from '../lib/errors';
import { loadParticipantSummaries } from '../lib/conversation-loaders';
import { assertConversationMember } from '../services/conversation-service';
import { broadcastTyping } from '../realtime/chat-hub';

const TYPING_EVENTS = new Set<ChatWsType>(['typing.started', 'typing.stopped']);

export function isTypingEvent(type: string): type is 'typing.started' | 'typing.stopped' {
  return TYPING_EVENTS.has(type as ChatWsType);
}

export async function handleTypingEvent(
  userId: string,
  conversationId: string,
  eventType: 'typing.started' | 'typing.stopped'
): Promise<void> {
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });

  if (!conversation) {
    throw new AppError('NOT_FOUND', 'Conversation not found', 404);
  }

  if (conversation.type !== 'direct') {
    throw new AppError('VALIDATION_ERROR', 'Typing is only available in direct chats', 400);
  }

  await assertConversationMember(conversationId, userId);

  const profiles = await loadParticipantSummaries([userId]);
  const profile = profiles.get(userId);
  const displayName = profile?.displayName ?? 'Someone';

  broadcastTyping(eventType, {
    conversationId,
    userId,
    displayName,
  });
}
