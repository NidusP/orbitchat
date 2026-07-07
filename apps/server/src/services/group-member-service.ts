import { and, eq } from 'drizzle-orm';
import type { GroupMember, GroupMemberRole } from '@orbitchat/shared-types';
import { db } from '../db';
import { conversationMembers } from '../db/schema/conversation-members';
import { conversations } from '../db/schema/conversations';
import { AppError } from '../lib/errors';
import { loadGroupMembers } from '../lib/conversation-loaders';
import { findUserById } from './user-service';
import {
  assertConversationMember,
  getConversationDto,
} from './conversation-service';
import {
  broadcastMemberJoined,
  broadcastMemberLeft,
} from '../realtime/chat-hub';

async function getActiveGroupConversation(conversationId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.type, 'group')),
  });

  if (!conversation) {
    throw new AppError('NOT_FOUND', 'Group conversation not found', 404);
  }

  return conversation;
}

async function getActiveMembership(conversationId: string, userId: string) {
  const membership = await assertConversationMember(conversationId, userId);
  if (!membership.role) {
    throw new AppError('FORBIDDEN', 'Invalid group membership', 403);
  }
  return membership;
}

function assertCanManageGroup(role: GroupMemberRole): void {
  if (role !== 'owner' && role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Only group owners and admins can perform this action', 403);
  }
}

export async function listGroupMembers(
  conversationId: string,
  viewerId: string
): Promise<GroupMember[]> {
  await getActiveGroupConversation(conversationId);
  await assertConversationMember(conversationId, viewerId);
  return loadGroupMembers(conversationId);
}

export async function addGroupMembers(
  conversationId: string,
  actorUserId: string,
  userIds: string[]
): Promise<GroupMember[]> {
  await getActiveGroupConversation(conversationId);
  const actor = await getActiveMembership(conversationId, actorUserId);
  assertCanManageGroup(actor.role!);

  const uniqueIds = [...new Set(userIds.filter((id) => id !== actorUserId))];
  if (uniqueIds.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'At least one user id is required', 400, {
      field: 'userIds',
    });
  }

  await Promise.all(uniqueIds.map((userId) => findUserById(userId)));

  const now = new Date();
  for (const userId of uniqueIds) {
    const existing = await db.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      ),
    });

    if (existing && existing.leftAt === null) {
      continue;
    }

    if (existing) {
      await db
        .update(conversationMembers)
        .set({ leftAt: null, role: 'member', joinedAt: now })
        .where(eq(conversationMembers.id, existing.id));
    } else {
      await db.insert(conversationMembers).values({
        conversationId,
        userId,
        role: 'member',
        joinedAt: now,
      });
    }
  }

  const members = await loadGroupMembers(conversationId);
  for (const member of members) {
    if (uniqueIds.includes(member.id)) {
      broadcastMemberJoined({ conversationId, member });
    }
  }

  return members;
}

export async function removeGroupMember(
  conversationId: string,
  actorUserId: string,
  targetUserId: string
): Promise<void> {
  await getActiveGroupConversation(conversationId);
  const actor = await getActiveMembership(conversationId, actorUserId);
  assertCanManageGroup(actor.role!);

  if (targetUserId === actorUserId) {
    throw new AppError('VALIDATION_ERROR', 'Use leave endpoint to remove yourself', 400);
  }

  const target = await getActiveMembership(conversationId, targetUserId);
  if (target.role === 'owner') {
    throw new AppError('FORBIDDEN', 'Cannot remove the group owner', 403);
  }
  if (actor.role === 'admin' && target.role === 'admin') {
    throw new AppError('FORBIDDEN', 'Admins cannot remove other admins', 403);
  }

  await db
    .update(conversationMembers)
    .set({ leftAt: new Date() })
    .where(eq(conversationMembers.id, target.id));

  broadcastMemberLeft({ conversationId, userId: targetUserId, reason: 'kicked' });
}

export async function leaveGroup(conversationId: string, userId: string): Promise<void> {
  await getActiveGroupConversation(conversationId);
  const membership = await getActiveMembership(conversationId, userId);

  if (membership.role === 'owner') {
    throw new AppError('VALIDATION_ERROR', 'Transfer group ownership before leaving', 400);
  }

  await db
    .update(conversationMembers)
    .set({ leftAt: new Date() })
    .where(eq(conversationMembers.id, membership.id));

  broadcastMemberLeft({ conversationId, userId, reason: 'left' });
}

export async function updateGroupTitle(
  conversationId: string,
  actorUserId: string,
  title: string
): Promise<Awaited<ReturnType<typeof getConversationDto>>> {
  await getActiveGroupConversation(conversationId);
  const actor = await getActiveMembership(conversationId, actorUserId);
  assertCanManageGroup(actor.role!);

  const now = new Date();
  await db
    .update(conversations)
    .set({ title, updatedAt: now })
    .where(eq(conversations.id, conversationId));

  return getConversationDto(conversationId, actorUserId);
}

export async function transferGroupOwner(
  conversationId: string,
  actorUserId: string,
  newOwnerUserId: string
): Promise<GroupMember[]> {
  await getActiveGroupConversation(conversationId);
  const actor = await getActiveMembership(conversationId, actorUserId);

  if (actor.role !== 'owner') {
    throw new AppError('FORBIDDEN', 'Only the group owner can transfer ownership', 403);
  }

  if (newOwnerUserId === actorUserId) {
    throw new AppError('VALIDATION_ERROR', 'Cannot transfer ownership to yourself', 400);
  }

  const newOwner = await getActiveMembership(conversationId, newOwnerUserId);

  await db.transaction(async (tx) => {
    await tx
      .update(conversationMembers)
      .set({ role: 'admin' })
      .where(eq(conversationMembers.id, actor.id));

    await tx
      .update(conversationMembers)
      .set({ role: 'owner' })
      .where(eq(conversationMembers.id, newOwner.id));
  });

  return loadGroupMembers(conversationId);
}

export async function updateGroupMemberRole(
  conversationId: string,
  actorUserId: string,
  targetUserId: string,
  role: 'admin' | 'member'
): Promise<GroupMember[]> {
  await getActiveGroupConversation(conversationId);
  const actor = await getActiveMembership(conversationId, actorUserId);

  if (actor.role !== 'owner') {
    throw new AppError('FORBIDDEN', 'Only the group owner can change member roles', 403);
  }

  if (targetUserId === actorUserId) {
    throw new AppError('VALIDATION_ERROR', 'Use transfer-owner to change ownership', 400);
  }

  const target = await getActiveMembership(conversationId, targetUserId);
  if (target.role === 'owner') {
    throw new AppError('FORBIDDEN', 'Cannot change the owner role directly', 403);
  }

  await db
    .update(conversationMembers)
    .set({ role })
    .where(eq(conversationMembers.id, target.id));

  return loadGroupMembers(conversationId);
}
