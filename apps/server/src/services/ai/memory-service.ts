import { and, desc, eq, isNull } from 'drizzle-orm';
import type {
  UserAgentMemory,
  UserAgentMemoryKind,
  UserAgentMemorySource,
} from '@orbitchat/shared-types';
import { db } from '../../db';
import { userAgentMemories } from '../../db/schema/user-agent-memories';
import { toUserAgentMemoryDto } from '../../lib/ai-mappers';
import { AppError } from '../../lib/errors';
import { isUndefinedTable } from '../../lib/postgres-errors';

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 50;

export interface CreateMemoryInput {
  kind: UserAgentMemoryKind;
  content: string;
  source?: UserAgentMemorySource;
  agentId?: string;
  conversationId?: string;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(1, limit), MAX_LIST_LIMIT);
}

export async function listMemoriesForUser(
  userId: string,
  options: { limit?: number } = {}
): Promise<UserAgentMemory[]> {
  const limit = clampLimit(options.limit);

  try {
    const rows = await db
      .select()
      .from(userAgentMemories)
      .where(and(eq(userAgentMemories.userId, userId), isNull(userAgentMemories.deletedAt)))
      .orderBy(desc(userAgentMemories.createdAt))
      .limit(limit);

    return rows.map(toUserAgentMemoryDto);
  } catch (error) {
    if (isUndefinedTable(error)) {
      return [];
    }
    throw error;
  }
}

export async function createMemory(
  userId: string,
  input: CreateMemoryInput
): Promise<UserAgentMemory> {
  const [created] = await db
    .insert(userAgentMemories)
    .values({
      userId,
      kind: input.kind,
      content: input.content.trim(),
      source: input.source ?? 'user_explicit',
      agentId: input.agentId ?? null,
      conversationId: input.conversationId ?? null,
    })
    .returning();

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create memory', 500);
  }

  return toUserAgentMemoryDto(created);
}

export async function softDeleteMemory(memoryId: string, userId: string): Promise<void> {
  const memory = await db.query.userAgentMemories.findFirst({
    where: eq(userAgentMemories.id, memoryId),
  });

  if (!memory || memory.userId !== userId || memory.deletedAt) {
    throw new AppError('NOT_FOUND', 'Memory not found', 404);
  }

  await db
    .update(userAgentMemories)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(userAgentMemories.id, memoryId), isNull(userAgentMemories.deletedAt)));
}
