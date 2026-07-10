import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { GroupInvite, GroupInvitePreview } from '@orbitchat/shared-types';
import { db } from '../db';
import { conversationMembers } from '../db/schema/conversation-members';
import { conversations } from '../db/schema/conversations';
import { groupInvites } from '../db/schema/group-invites';
import { AppError } from '../lib/errors';
import { loadGroupMembers } from '../lib/conversation-loaders';
import { assertConversationMember } from './conversation-service';

function randomCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function toInviteDto(row: typeof groupInvites.$inferSelect): GroupInvite {
  return {
    id: row.id,
    conversationId: row.conversationId,
    code: row.code,
    createdByUserId: row.createdByUserId,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    maxUses: row.maxUses,
    useCount: row.useCount,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getGroupConversation(conversationId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.type, 'group')),
  });
  if (!conversation) {
    throw new AppError('NOT_FOUND', 'Group conversation not found', 404);
  }
  return conversation;
}

async function assertInviteManager(conversationId: string, userId: string): Promise<void> {
  const member = await assertConversationMember(conversationId, userId);
  if (member.role !== 'owner' && member.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Only group owners and admins can manage invites', 403);
  }
}

export async function createGroupInvite(
  conversationId: string,
  actorUserId: string,
  input: { expiresInHours?: number; maxUses?: number }
): Promise<GroupInvite> {
  await getGroupConversation(conversationId);
  await assertInviteManager(conversationId, actorUserId);

  const expiresAt =
    input.expiresInHours && input.expiresInHours > 0
      ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    const [created] = await db
      .insert(groupInvites)
      .values({
        conversationId,
        code,
        createdByUserId: actorUserId,
        expiresAt,
        maxUses: input.maxUses ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      return toInviteDto(created);
    }
  }

  throw new AppError('INTERNAL_ERROR', 'Failed to create invite code', 500);
}

export async function listGroupInvites(
  conversationId: string,
  viewerUserId: string
): Promise<GroupInvite[]> {
  await getGroupConversation(conversationId);
  await assertInviteManager(conversationId, viewerUserId);

  const rows = await db.query.groupInvites.findMany({
    where: eq(groupInvites.conversationId, conversationId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return rows.map(toInviteDto);
}

export async function revokeGroupInvite(code: string, actorUserId: string): Promise<GroupInvite> {
  const invite = await db.query.groupInvites.findFirst({ where: eq(groupInvites.code, code) });
  if (!invite) {
    throw new AppError('NOT_FOUND', 'Invite not found', 404);
  }

  await assertInviteManager(invite.conversationId, actorUserId);

  if (invite.revokedAt) {
    throw new AppError('VALIDATION_ERROR', 'Invite has already been revoked', 400);
  }

  const [updated] = await db
    .update(groupInvites)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(groupInvites.id, invite.id), isNull(groupInvites.revokedAt)))
    .returning();

  if (!updated) {
    throw new AppError('VALIDATION_ERROR', 'Invite has already been revoked', 400);
  }

  return toInviteDto(updated);
}

function isInviteActive(invite: typeof groupInvites.$inferSelect): boolean {
  if (invite.revokedAt) {
    return false;
  }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return false;
  }
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return false;
  }
  return true;
}

export async function getInvitePreview(code: string, _userId: string): Promise<GroupInvitePreview> {
  const invite = await db.query.groupInvites.findFirst({ where: eq(groupInvites.code, code) });
  if (!invite) {
    throw new AppError('NOT_FOUND', 'Invite not found', 404);
  }

  const conversation = await getGroupConversation(invite.conversationId);
  const members = await loadGroupMembers(invite.conversationId);

  return {
    code: invite.code,
    conversationId: invite.conversationId,
    groupTitle: conversation.title ?? 'Group',
    memberCount: members.length,
    isActive: isInviteActive(invite),
    expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
    maxUses: invite.maxUses,
    useCount: invite.useCount,
  };
}

export async function acceptGroupInvite(code: string, userId: string): Promise<{ ok: true }> {
  const invite = await db.query.groupInvites.findFirst({ where: eq(groupInvites.code, code) });
  if (!invite) {
    throw new AppError('NOT_FOUND', 'Invite not found', 404);
  }
  if (!isInviteActive(invite)) {
    throw new AppError('VALIDATION_ERROR', 'Invite is expired or revoked', 400);
  }

  await getGroupConversation(invite.conversationId);

  const existing = await db.query.conversationMembers.findFirst({
    where: and(
      eq(conversationMembers.conversationId, invite.conversationId),
      eq(conversationMembers.userId, userId)
    ),
  });

  if (existing && existing.leftAt === null) {
    return { ok: true };
  }

  await db.transaction(async (tx) => {
    const [consumedInvite] = await tx
      .update(groupInvites)
      .set({
        useCount: sql`${groupInvites.useCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(groupInvites.id, invite.id),
          isNull(groupInvites.revokedAt),
          or(isNull(groupInvites.expiresAt), sql`${groupInvites.expiresAt} > now()`),
          or(isNull(groupInvites.maxUses), sql`${groupInvites.useCount} < ${groupInvites.maxUses}`)
        )
      )
      .returning();

    if (!consumedInvite) {
      throw new AppError('VALIDATION_ERROR', 'Invite is expired, revoked, or exhausted', 400);
    }

    if (existing) {
      await tx
        .update(conversationMembers)
        .set({ leftAt: null, role: 'member', joinedAt: new Date() })
        .where(eq(conversationMembers.id, existing.id));
    } else {
      await tx.insert(conversationMembers).values({
        conversationId: invite.conversationId,
        userId,
        role: 'member',
      });
    }
  });

  return { ok: true };
}
