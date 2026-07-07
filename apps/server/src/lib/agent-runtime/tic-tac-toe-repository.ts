import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { aiConversations } from '../../db/schema/ai-conversations';
import type { TicTacToePersistedData } from './tic-tac-toe';

const EMPTY_DATA: TicTacToePersistedData = { active: null, history: [] };
const memoryByConversationId = new Map<string, TicTacToePersistedData>();

function cloneData(data: TicTacToePersistedData): TicTacToePersistedData {
  return {
    active: data.active ? { ...data.active, board: [...data.active.board] } : null,
    history: data.history.map((record) => ({ ...record })),
  };
}

function isPersistedData(value: unknown): value is TicTacToePersistedData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'active' in value && 'history' in value;
}

export async function loadTicTacToeData(conversationId: string): Promise<TicTacToePersistedData> {
  const row = await db.query.aiConversations.findFirst({
    columns: { tictactoeData: true },
    where: eq(aiConversations.id, conversationId),
  });

  if (row?.tictactoeData && isPersistedData(row.tictactoeData)) {
    return cloneData(row.tictactoeData);
  }

  return cloneData(memoryByConversationId.get(conversationId) ?? EMPTY_DATA);
}

export async function saveTicTacToeData(
  conversationId: string,
  data: TicTacToePersistedData
): Promise<void> {
  const snapshot = cloneData(data);
  memoryByConversationId.set(conversationId, snapshot);

  await db
    .update(aiConversations)
    .set({
      tictactoeData: snapshot,
      updatedAt: new Date(),
    })
    .where(eq(aiConversations.id, conversationId));
}

export function clearTicTacToeRepositoryForTests(): void {
  memoryByConversationId.clear();
}
