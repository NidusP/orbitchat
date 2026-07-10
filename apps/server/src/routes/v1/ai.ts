import { randomUUID } from 'node:crypto';
import { zValidator } from '@hono/zod-validator';
import type { AiSseEvent, AiSseEventType, AiSsePayloadByType } from '@orbitchat/shared-types';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { env } from '../../env';
import { AgentOrchestrator } from '../../lib/agent-runtime/orchestrator';
import { executeAgentTool } from '../../services/ai/tool-executor';
import { AiRunLimiter } from '../../lib/agent-runtime/limiter';
import { E2eMockLlmProvider } from '../../lib/agent-runtime/providers/e2e-mock';
import { OpenAiCompatibleProvider } from '../../lib/agent-runtime/providers/ollama';
import { AppError } from '../../lib/errors';
import { successResponse } from '../../lib/response';
import { parseUuidParam } from '../../lib/validation';
import { zodValidationHook } from '../../lib/zod-hook';
import { authMiddleware } from '../../middleware/auth';
import {
  aiCursorQuerySchema,
  createAiConversationSchema,
  createAiMessageSchema,
  createUserAgentMemorySchema,
  listUserAgentMemoriesQuerySchema,
} from '../../schemas/ai';
import {
  createAiConversation,
  createAiMessageAndRun,
  listAgents,
  listAiConversations,
  listAiMessages,
} from '../../services/ai/conversation-service';
import {
  createMemory,
  listMemoriesForUser,
  softDeleteMemory,
} from '../../services/ai/memory-service';
import {
  approveAiToolCall,
  listAiToolCalls,
  rejectAiToolCall,
} from '../../services/ai/tool-call-service';

export const aiRouter = new Hono();

const provider = env.LLM_E2E_MOCK
  ? new E2eMockLlmProvider()
  : new OpenAiCompatibleProvider(env.LLM_BASE_URL, env.LLM_TIMEOUT_MS, env.LLM_API_KEY);
const orchestrator = new AgentOrchestrator(provider, env.LLM_MODEL, executeAgentTool);
const limiter = new AiRunLimiter(env.AI_MAX_CONCURRENT_RUNS);

/** @internal Exposed for route tests only */
export const testAiRunLimiter = limiter;

function parseConversationId(rawId: string): string {
  return parseUuidParam(rawId, 'id', 'Invalid AI conversation id');
}

function parseToolCallId(rawId: string): string {
  return parseUuidParam(rawId, 'id', 'Invalid AI tool call id');
}

function parseMemoryId(rawId: string): string {
  return parseUuidParam(rawId, 'id', 'Invalid memory id');
}

function event<TType extends AiSseEventType>(
  type: TType,
  payload: AiSsePayloadByType[TType]
): AiSseEvent<TType> {
  return {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
}

async function writeSseEvent(
  stream: { writeSSE: (payload: { event: string; data: string }) => Promise<void> },
  type: AiSseEventType,
  payload: AiSsePayloadByType[AiSseEventType]
): Promise<void> {
  await stream.writeSSE({
    event: type,
    data: JSON.stringify(event(type, payload)),
  });
}

aiRouter.get('/agents', authMiddleware, async (c) => {
  const agents = await listAgents();
  return c.json(successResponse(agents), 200);
});

aiRouter.get(
  '/memories',
  authMiddleware,
  zValidator('query', listUserAgentMemoriesQuerySchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const query = c.req.valid('query');
    const memories = await listMemoriesForUser(auth.userId, query);
    return c.json(successResponse(memories), 200);
  }
);

aiRouter.post(
  '/memories',
  authMiddleware,
  zValidator('json', createUserAgentMemorySchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    const memory = await createMemory(auth.userId, input);
    return c.json(successResponse(memory), 201);
  }
);

aiRouter.delete('/memories/:id', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const memoryId = parseMemoryId(c.req.param('id'));
  await softDeleteMemory(memoryId, auth.userId);
  return c.json(successResponse({ success: true as const }), 200);
});

aiRouter.get(
  '/conversations',
  authMiddleware,
  zValidator('query', aiCursorQuerySchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const query = c.req.valid('query');
    const page = await listAiConversations(auth.userId, query);
    return c.json(successResponse(page), 200);
  }
);

aiRouter.post(
  '/conversations',
  authMiddleware,
  zValidator('json', createAiConversationSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    const conversation = await createAiConversation(auth.userId, input);
    return c.json(successResponse(conversation), 201);
  }
);

aiRouter.get(
  '/conversations/:id/messages',
  authMiddleware,
  zValidator('query', aiCursorQuerySchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const query = c.req.valid('query');
    const page = await listAiMessages(conversationId, auth.userId, query);
    return c.json(successResponse(page), 200);
  }
);

aiRouter.get(
  '/conversations/:id/tool-calls',
  authMiddleware,
  zValidator('query', aiCursorQuerySchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const query = c.req.valid('query');
    const page = await listAiToolCalls(conversationId, auth.userId, query);
    return c.json(successResponse(page), 200);
  }
);

aiRouter.post('/tool-calls/:id/approve', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const toolCallId = parseToolCallId(c.req.param('id'));
  const toolCall = await approveAiToolCall(toolCallId, auth.userId);
  return c.json(successResponse(toolCall), 200);
});

aiRouter.post('/tool-calls/:id/reject', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const toolCallId = parseToolCallId(c.req.param('id'));
  const toolCall = await rejectAiToolCall(toolCallId, auth.userId);
  return c.json(successResponse(toolCall), 200);
});

aiRouter.post(
  '/conversations/:id/messages',
  authMiddleware,
  zValidator('json', createAiMessageSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const body = c.req.valid('json');

    if (!limiter.tryAcquire()) {
      throw new AppError(
        'AI_BUSY',
        'Too many AI requests are running. Please try again soon.',
        429
      );
    }

    return streamSSE(c, async (stream) => {
      const streamingMessageId = randomUUID();

      try {
        await writeSseEvent(stream, 'run.started', { conversationId });

        const result = await createAiMessageAndRun({
          conversationId,
          userId: auth.userId,
          body,
          orchestrator,
          stream: {
            streamingMessageId,
            onDelta: async (delta) => {
              await writeSseEvent(stream, 'message.delta', {
                conversationId,
                messageId: streamingMessageId,
                delta,
              });
            },
            onToolStarted: async (toolName, input) => {
              await writeSseEvent(stream, 'tool.started', {
                conversationId,
                toolName,
                input,
              });
            },
            onToolCall: async (toolCall) => {
              await writeSseEvent(stream, 'tool.call', {
                conversationId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              });
            },
          },
        });

        await writeSseEvent(stream, 'message.done', {
          conversationId,
          message: result.assistantMessage,
        });
      } catch (error) {
        const appError =
          error instanceof AppError
            ? error
            : new AppError('INTERNAL_ERROR', 'Failed to run AI conversation', 500);
        await writeSseEvent(stream, 'error', {
          code: appError.code,
          message: appError.message,
          ...(appError.details !== undefined ? { details: appError.details } : {}),
        });
      } finally {
        limiter.release();
      }
    });
  }
);
