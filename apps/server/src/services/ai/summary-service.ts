import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { aiConversationSummaries } from '../../db/schema/ai-conversation-summaries';
import { aiMessages } from '../../db/schema/ai-messages';
import { env } from '../../env';
import { E2eMockLlmProvider } from '../../lib/agent-runtime/providers/e2e-mock';
import { OpenAiCompatibleProvider } from '../../lib/agent-runtime/providers/ollama';
import type { LlmMessage, LlmProvider } from '../../lib/agent-runtime/types';
import { isUndefinedTable } from '../../lib/postgres-errors';

const SUMMARY_TRIGGER_MESSAGE_COUNT = 30;
const RUNTIME_HISTORY_LIMIT = 20;

type UserAssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type ConversationSummary = {
  summary: string;
  upToMessageId: string;
};

function getDefaultLlmProvider(): LlmProvider {
  return env.LLM_E2E_MOCK
    ? new E2eMockLlmProvider()
    : new OpenAiCompatibleProvider(env.LLM_BASE_URL, env.LLM_TIMEOUT_MS, env.LLM_API_KEY);
}

async function loadUserAssistantMessages(conversationId: string): Promise<UserAssistantMessage[]> {
  const rows = await db
    .select({
      id: aiMessages.id,
      role: aiMessages.role,
      content: aiMessages.content,
    })
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.conversationId, conversationId),
        isNull(aiMessages.toolName),
        inArray(aiMessages.role, ['user', 'assistant'])
      )
    )
    .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id));

  return rows.filter(
    (row): row is UserAssistantMessage => row.role === 'user' || row.role === 'assistant'
  );
}

function formatMessagesForPrompt(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  return messages
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n');
}

export async function getConversationSummary(
  conversationId: string
): Promise<ConversationSummary | null> {
  try {
    const row = await db.query.aiConversationSummaries.findFirst({
      where: eq(aiConversationSummaries.conversationId, conversationId),
    });

    if (!row) {
      return null;
    }

    return {
      summary: row.summary,
      upToMessageId: row.upToMessageId,
    };
  } catch (error) {
    if (isUndefinedTable(error)) {
      return null;
    }
    throw error;
  }
}

export async function generateSummaryText(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  previousSummary?: string,
  llmProvider?: LlmProvider
): Promise<string> {
  if (messages.length === 0) {
    return previousSummary ?? '';
  }

  if (env.LLM_E2E_MOCK) {
    return `[e2e:summary] ${messages.length} messages`;
  }

  const provider = llmProvider ?? getDefaultLlmProvider();
  const transcript = formatMessagesForPrompt(messages);
  const previousBlock = previousSummary
    ? `Existing summary:\n${previousSummary}\n\nNew messages since last summary:\n`
    : 'Conversation messages to summarize:\n';

  const result = await provider.chat({
    model: env.LLM_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You summarize Orbitchat AI conversations. Write a concise summary in Chinese or English (match the conversation language). Preserve key facts, names, preferences, decisions, and any game state (e.g. tic-tac-toe). Do not invent details.',
      },
      {
        role: 'user',
        content: `${previousBlock}${transcript}`,
      },
    ],
    tools: false,
  });

  const summary = result.content?.trim();
  if (!summary) {
    return previousSummary ?? `[summary unavailable: ${messages.length} messages]`;
  }

  return summary;
}

export async function maybeRefreshConversationSummary(
  conversationId: string,
  llmProvider?: LlmProvider
): Promise<void> {
  try {
    const messages = await loadUserAssistantMessages(conversationId);
    if (messages.length <= SUMMARY_TRIGGER_MESSAGE_COUNT) {
      return;
    }

    const messagesToSummarize = messages.slice(0, -RUNTIME_HISTORY_LIMIT);
    if (messagesToSummarize.length === 0) {
      return;
    }

    const existing = await getConversationSummary(conversationId);
    let messagesForLlm: Array<{ role: 'user' | 'assistant'; content: string }>;
    let previousSummary: string | undefined;

    if (existing) {
      const upToIndex = messagesToSummarize.findIndex(
        (message) => message.id === existing.upToMessageId
      );
      const newMessages =
        upToIndex >= 0 ? messagesToSummarize.slice(upToIndex + 1) : messagesToSummarize;

      if (newMessages.length === 0) {
        return;
      }

      previousSummary = existing.summary;
      messagesForLlm = newMessages;
    } else {
      messagesForLlm = messagesToSummarize;
    }

    const summaryText = await generateSummaryText(messagesForLlm, previousSummary, llmProvider);
    const upToMessageId = messagesToSummarize[messagesToSummarize.length - 1]!.id;
    const now = new Date();

    await db
      .insert(aiConversationSummaries)
      .values({
        conversationId,
        summary: summaryText,
        upToMessageId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: aiConversationSummaries.conversationId,
        set: {
          summary: summaryText,
          upToMessageId,
          updatedAt: now,
        },
      });
  } catch (error) {
    if (isUndefinedTable(error)) {
      return;
    }
    throw error;
  }
}

export async function loadRuntimeContext(conversationId: string): Promise<{
  history: LlmMessage[];
  conversationSummary?: string;
}> {
  const [summary, rows] = await Promise.all([
    getConversationSummary(conversationId),
    db
      .select({
        role: aiMessages.role,
        content: aiMessages.content,
      })
      .from(aiMessages)
      .where(and(eq(aiMessages.conversationId, conversationId), isNull(aiMessages.toolName)))
      .orderBy(desc(aiMessages.createdAt), desc(aiMessages.id))
      .limit(RUNTIME_HISTORY_LIMIT),
  ]);

  const history: LlmMessage[] = rows
    .reverse()
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  return {
    history,
    conversationSummary: summary?.summary,
  };
}
