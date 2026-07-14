import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { successResponse } from '../../lib/response';
import { parseUuidParam } from '../../lib/validation';
import { zodValidationHook } from '../../lib/zod-hook';
import { authMiddleware } from '../../middleware/auth';
import {
  addGroupMembersSchema,
  createGroupInviteSchema,
  createConversationSchema,
  createMessageSchema,
  cursorQuerySchema,
  markConversationReadSchema,
  messageCursorQuerySchema,
  transferGroupOwnerSchema,
  updateMessageSchema,
  updateGroupConversationSchema,
  updateGroupMemberRoleSchema,
} from '../../schemas/conversations';
import {
  createGroupConversation,
  createOrGetDirectConversation,
  getConversationDto,
  listConversations,
} from '../../services/conversation-service';
import {
  addGroupMembers,
  leaveGroup,
  listGroupMembers,
  removeGroupMember,
  transferGroupOwner,
  updateGroupMemberRole,
  updateGroupMetadata,
} from '../../services/group-member-service';
import {
  acceptGroupInvite,
  createGroupInvite,
  getInvitePreview,
  listGroupInvites,
  revokeGroupInvite,
} from '../../services/group-invite-service';
import {
  createMessage,
  deleteMessage,
  listMessageEdits,
  listMessages,
  markConversationRead,
  updateMessage,
} from '../../services/message-service';

export const conversationsRouter = new Hono();

function parseConversationId(rawId: string): string {
  return parseUuidParam(rawId, 'id', 'Invalid conversation id');
}

function parseUserId(rawId: string): string {
  return parseUuidParam(rawId, 'userId', 'Invalid user id');
}

function parseMessageId(rawId: string): string {
  return parseUuidParam(rawId, 'messageId', 'Invalid message id');
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

    if ('type' in input && input.type === 'group') {
      const result = await createGroupConversation(auth.userId, input);
      return c.json(successResponse(result.conversation), 201);
    }

    const directInput = input as { participantUserId: string };
    const result = await createOrGetDirectConversation(auth.userId, directInput);
    return c.json(successResponse(result.conversation), result.created ? 201 : 200);
  }
);

conversationsRouter.get('/:id/messages/:messageId/edits', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const conversationId = parseConversationId(c.req.param('id'));
  const messageId = parseMessageId(c.req.param('messageId'));
  const edits = await listMessageEdits(conversationId, messageId, auth.userId);
  return c.json(successResponse(edits), 200);
});

conversationsRouter.patch(
  '/:id/messages/:messageId',
  authMiddleware,
  zValidator('json', updateMessageSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const messageId = parseMessageId(c.req.param('messageId'));
    const input = c.req.valid('json');
    const message = await updateMessage(conversationId, messageId, auth.userId, input);
    return c.json(successResponse(message), 200);
  }
);

conversationsRouter.delete('/:id/messages/:messageId', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const conversationId = parseConversationId(c.req.param('id'));
  const messageId = parseMessageId(c.req.param('messageId'));
  const result = await deleteMessage(conversationId, messageId, auth.userId);
  return c.json(successResponse(result), 200);
});

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

conversationsRouter.post(
  '/:id/invites',
  authMiddleware,
  zValidator('json', createGroupInviteSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const input = c.req.valid('json');
    const invite = await createGroupInvite(conversationId, auth.userId, input);
    return c.json(successResponse(invite), 201);
  }
);

conversationsRouter.get('/:id/invites', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const conversationId = parseConversationId(c.req.param('id'));
  const invites = await listGroupInvites(conversationId, auth.userId);
  return c.json(successResponse(invites), 200);
});

conversationsRouter.delete('/invites/:code', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const invite = await revokeGroupInvite(c.req.param('code'), auth.userId);
  return c.json(successResponse(invite), 200);
});

conversationsRouter.get('/invites/:code', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const preview = await getInvitePreview(c.req.param('code'), auth.userId);
  return c.json(successResponse(preview), 200);
});

conversationsRouter.post('/invites/:code/accept', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const result = await acceptGroupInvite(c.req.param('code'), auth.userId);
  return c.json(successResponse(result), 200);
});

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

conversationsRouter.patch(
  '/:id',
  authMiddleware,
  zValidator('json', updateGroupConversationSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const input = c.req.valid('json');
    const conversation = await updateGroupMetadata(conversationId, auth.userId, {
      title: input.title,
      announcement: input.announcement,
      avatarUploadId: input.avatarUploadId,
      expectedVersion: input.expectedVersion,
    });
    return c.json(successResponse(conversation), 200);
  }
);

conversationsRouter.get('/:id/members', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const conversationId = parseConversationId(c.req.param('id'));
  const members = await listGroupMembers(conversationId, auth.userId);
  return c.json(successResponse(members), 200);
});

conversationsRouter.post(
  '/:id/members',
  authMiddleware,
  zValidator('json', addGroupMembersSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const input = c.req.valid('json');
    const members = await addGroupMembers(conversationId, auth.userId, input.userIds);
    return c.json(successResponse(members), 200);
  }
);

conversationsRouter.delete('/:id/members/:userId', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const conversationId = parseConversationId(c.req.param('id'));
  const targetUserId = parseUserId(c.req.param('userId'));
  await removeGroupMember(conversationId, auth.userId, targetUserId);
  return c.json(successResponse({ ok: true }), 200);
});

conversationsRouter.patch(
  '/:id/members/:userId',
  authMiddleware,
  zValidator('json', updateGroupMemberRoleSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const targetUserId = parseUserId(c.req.param('userId'));
    const input = c.req.valid('json');
    const members = await updateGroupMemberRole(
      conversationId,
      auth.userId,
      targetUserId,
      input.role
    );
    return c.json(successResponse(members), 200);
  }
);

conversationsRouter.post('/:id/leave', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const conversationId = parseConversationId(c.req.param('id'));
  await leaveGroup(conversationId, auth.userId);
  return c.json(successResponse({ ok: true }), 200);
});

conversationsRouter.post(
  '/:id/transfer-owner',
  authMiddleware,
  zValidator('json', transferGroupOwnerSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const conversationId = parseConversationId(c.req.param('id'));
    const input = c.req.valid('json');
    const members = await transferGroupOwner(conversationId, auth.userId, input.newOwnerUserId);
    return c.json(successResponse(members), 200);
  }
);
