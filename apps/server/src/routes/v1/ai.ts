import { zValidator } from '@hono/zod-validator';
import type { AiSseEvent, AiSseEventType, AiSsePayloadByType } from '@orbitchat/shared-types';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { env } from '../../env';
import { AgentOrchestrator } from '../../lib/agent-runtime/orchestrator';
import { AiRunLimiter } from '../../lib/agent-runtime/limiter';
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
} from '../../schemas/ai';
import {
  createAiConversation,
  createAiMessageAndRun,
  listAgents,
  listAiConversations,
  listAiMessages,
} from '../../services/ai/conversation-service';
import {
  approveAiToolCall,
  listAiToolCalls,
  rejectAiToolCall,
} from '../../services/ai/tool-call-service';

export const aiRouter = new Hono();

const provider = new OpenAiCompatibleProvider(env.LLM_BASE_URL, env.LLM_TIMEOUT_MS);
const orchestrator = new AgentOrchestrator(provider, env.LLM_MODEL);
const limiter = new AiRunLimiter(env.AI_MAX_CONCURRENT_RUNS);

function parseConversationId(rawId: string): string {
  return parseUuidParam(rawId, 'id', 'Invalid AI conversation id');
}

function parseToolCallId(rawId: string): string {
  return parseUuidParam(rawId, 'id', 'Invalid AI tool call id');
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

function chunkText(content: string, size = 80): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < content.length; index += size) {
    chunks.push(content.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [''];
}

aiRouter.get('/agents', authMiddleware, async (c) => {
  const agents = await listAgents();
  return c.json(successResponse(agents), 200);
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

    return streamSSE(c, async (stream) => {
      try {
        const result = await limiter.run(() =>
          createAiMessageAndRun({
            conversationId,
            userId: auth.userId,
            body,
            orchestrator,
          })
        );

        for (const toolCall of result.toolCalls) {
          await stream.writeSSE({
            event: 'tool.call',
            data: JSON.stringify(
              event('tool.call', {
                conversationId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              })
            ),
          });
        }

        for (const delta of chunkText(result.assistantMessage.content)) {
          await stream.writeSSE({
            event: 'message.delta',
            data: JSON.stringify(
              event('message.delta', {
                conversationId,
                messageId: result.assistantMessage.id,
                delta,
              })
            ),
          });
        }

        await stream.writeSSE({
          event: 'message.done',
          data: JSON.stringify(
            event('message.done', {
              conversationId,
              message: result.assistantMessage,
            })
          ),
        });
      } catch (error) {
        const appError =
          error instanceof AppError
            ? error
            : new AppError('INTERNAL_ERROR', 'Failed to run AI conversation', 500);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify(
            event('error', {
              code: appError.code,
              message: appError.message,
            })
          ),
        });
      }
    });
  }
);
