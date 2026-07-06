import type {
  Conversation,
  ConversationParticipant,
  Message,
} from '@orbitchat/shared-types';
import type { Conversation as DbConversation } from '../db/schema/conversations';
import type { Message as DbMessage } from '../db/schema/messages';

function toIsoString(date: Date): string {
  return date.toISOString();
}

export function toConversationParticipant(row: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}): ConversationParticipant {
  return {
    id: row.userId,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
}

export function toMessage(
  row: DbMessage,
  sender: ConversationParticipant
): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    sender,
    content: row.content,
    createdAt: toIsoString(row.createdAt),
    editedAt: row.editedAt ? toIsoString(row.editedAt) : null,
    deletedAt: row.deletedAt ? toIsoString(row.deletedAt) : null,
  };
}

export function toConversation(
  row: DbConversation,
  participants: ConversationParticipant[],
  lastMessage: Message | null,
  unreadCount: number
): Conversation {
  return {
    id: row.id,
    type: 'direct',
    participants,
    lastMessage,
    lastMessageAt: row.lastMessageAt ? toIsoString(row.lastMessageAt) : null,
    unreadCount,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
