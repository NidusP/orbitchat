import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { successResponse } from '../../lib/response';
import { parseUuidParam } from '../../lib/validation';
import { zodValidationHook } from '../../lib/zod-hook';
import { authMiddleware } from '../../middleware/auth';
import {
  createConversationSchema,
  createMessageSchema,
  cursorQuerySchema,
  markConversationReadSchema,
  messageCursorQuerySchema,
} from '../../schemas/conversations';
import {
  createOrGetDirectConversation,
  getConversationDto,
  listConversations,
} from '../../services/conversation-service';
import {
  createMessage,
  listMessages,
  markConversationRead,
} from '../../services/message-service';

export const conversationsRouter = new Hono();

function parseConversationId(rawId: string): string {
  return parseUuidParam(rawId, 'id', 'Invalid conversation id');
}

conversationsRouter.get(
  '/',
  authMiddleware,
  zValidator('query', cursorQuerySchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const query = c.req.valid('query');
    const page = await listConversations(auth.userId, query);
    return c.json(successResponse(page), 200);
  }
);

conversationsRouter.post(
  '/',
  authMiddleware,
  zValidator('json', createConversationSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    const result = await createOrGetDirectConversation(auth.userId, input);
    return c.json(successResponse(result.conversation), result.created ? 201 : 200);
  }
);

conversationsRouter.get('/:id', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const conversationId = parseConversationId(c.req.param('id'));
  const conversation = await getConversationDto(conversationId, auth.userId);
  return c.json(successResponse(conversation), 200);
});

conversationsRouter.get(
  '/:id/messages',
  authMiddleware,
  zValidator('query', messageCursorQuerySchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const query = c.req.valid('query');
    const page = await listMessages(conversationId, auth.userId, query);
    return c.json(successResponse(page), 200);
  }
);

conversationsRouter.post(
  '/:id/messages',
  authMiddleware,
  zValidator('json', createMessageSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const input = c.req.valid('json');
    const message = await createMessage(conversationId, auth.userId, input);
    return c.json(successResponse(message), 201);
  }
);

conversationsRouter.patch(
  '/:id/read',
  authMiddleware,
  zValidator('json', markConversationReadSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const input = c.req.valid('json');
    const result = await markConversationRead(conversationId, auth.userId, input);
    return c.json(successResponse(result), 200);
  }
);
