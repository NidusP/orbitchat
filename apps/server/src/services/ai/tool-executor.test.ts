import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { AiToolCall } from '@orbitchat/shared-types';

const toolCallService = await import('./tool-call-service');
const followService = await import('../follow-service');
const userService = await import('../user-service');
const feedService = await import('../feed-service');
const ragService = await import('./rag-service');
const ticTacToeRepository = await import('../../lib/agent-runtime/tic-tac-toe-repository');
const { executeAgentTool } = await import('./tool-executor');

const CONTEXT = {
  conversationId: '33333333-3333-4333-8333-333333333333',
  userId: '11111111-1111-4111-8111-111111111111',
};

const pendingToolCall: AiToolCall = {
  id: '44444444-4444-4444-8444-444444444444',
  conversationId: CONTEXT.conversationId,
  requestedByUserId: CONTEXT.userId,
  toolName: 'create_post',
  status: 'pending',
  input: { content: 'Hello feed' },
  output: null,
  error: null,
  createdAt: '2026-07-06T10:00:00.000Z',
  updatedAt: '2026-07-06T10:00:00.000Z',
  confirmedAt: null,
  executedAt: null,
};

describe('executeAgentTool', () => {
  beforeEach(() => {
    mock.restore();
    ticTacToeRepository.clearTicTacToeRepositoryForTests();
  });

  test('create_post creates a pending tool call', async () => {
    const createSpy = spyOn(toolCallService, 'createPendingCreatePostToolCall').mockImplementation(
      async () => pendingToolCall
    );

    const result = await executeAgentTool('create_post', { content: 'Hello feed' }, CONTEXT);

    expect(createSpy).toHaveBeenCalledWith({
      conversationId: CONTEXT.conversationId,
      userId: CONTEXT.userId,
      content: 'Hello feed',
    });
    expect(result.toolCall.toolName).toBe('create_post');
    expect(result.toolMessage.content).toContain('pending confirmation');
  });

  test('remember_fact creates a pending tool call', async () => {
    const createSpy = spyOn(toolCallService, 'createPendingRememberFactToolCall').mockImplementation(
      async () => ({
        ...pendingToolCall,
        toolName: 'remember_fact',
        input: { kind: 'nickname', content: 'Call me Orbit' },
      })
    );

    const result = await executeAgentTool(
      'remember_fact',
      { kind: 'nickname', content: 'Call me Orbit' },
      CONTEXT
    );

    expect(createSpy).toHaveBeenCalledWith({
      conversationId: CONTEXT.conversationId,
      userId: CONTEXT.userId,
      kind: 'nickname',
      content: 'Call me Orbit',
    });
    expect(result.toolCall.toolName).toBe('remember_fact');
    expect(result.toolMessage.content).toContain('pending confirmation');
  });

  test('follow_user resolves username and creates pending tool call', async () => {
    spyOn(followService, 'searchUsers').mockImplementation(async () => ({
      items: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          username: 'luna',
          displayName: 'Luna',
          avatarUrl: null,
        },
      ],
      nextCursor: null,
    }));
    const createSpy = spyOn(toolCallService, 'createPendingFollowUserToolCall').mockImplementation(
      async () => ({
        ...pendingToolCall,
        toolName: 'follow_user',
        input: { targetUserId: '22222222-2222-4222-8222-222222222222', targetUsername: 'luna' },
      })
    );

    const result = await executeAgentTool(
      'follow_user',
      { target_username: 'luna' },
      CONTEXT
    );

    expect(createSpy).toHaveBeenCalled();
    expect(result.toolCall.toolName).toBe('follow_user');
  });

  test('play_tictactoe starts a game and records user move', async () => {
    const started = await executeAgentTool('play_tictactoe', { action: 'start' }, CONTEXT);
    expect(started.toolCall.toolName).toBe('play_tictactoe');
    const startedOutput = started.toolCall.output as { status: string; game?: { currentPlayer: string } };
    expect(startedOutput.status).toBe('ok');
    expect(startedOutput.game?.currentPlayer).toBe('X');

    const moved = await executeAgentTool(
      'play_tictactoe',
      { action: 'move', position: 5 },
      CONTEXT
    );
    const movedOutput = moved.toolCall.output as {
      status: string;
      game?: { board: Array<string | null>; currentPlayer: string | null };
    };
    expect(movedOutput.status).toBe('ok');
    expect(movedOutput.game?.board[4]).toBe('X');
    expect(movedOutput.game?.currentPlayer).toBe('O');
  });

  test('play_tictactoe archives finished games and exposes history on rematch', async () => {
    await executeAgentTool('play_tictactoe', { action: 'start' }, CONTEXT);
    const xWinMoves = [1, 4, 2, 5, 3];
    for (const position of xWinMoves) {
      await executeAgentTool('play_tictactoe', { action: 'move', position }, CONTEXT);
    }

    const rematch = await executeAgentTool('play_tictactoe', { action: 'start' }, CONTEXT);
    const rematchOutput = rematch.toolCall.output as {
      status: string;
      matchHistory?: { totalGames: number; userWins: number };
    };
    expect(rematchOutput.status).toBe('ok');
    expect(rematchOutput.matchHistory?.totalGames).toBe(1);
    expect(rematchOutput.matchHistory?.userWins).toBe(1);
  });

  test('get_my_profile returns user and profile', async () => {
    spyOn(userService, 'getUserById').mockImplementation(async () => ({
      id: CONTEXT.userId,
      username: 'alice',
      email: 'alice@example.com',
      isActive: true,
      createdAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z',
    }));
    spyOn(userService, 'getProfileByUserId').mockImplementation(async () => ({
      id: '55555555-5555-4555-8555-555555555555',
      userId: CONTEXT.userId,
      displayName: 'Alice',
      bio: 'Hello world',
      avatarUrl: null,
      createdAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z',
    }));

    const result = await executeAgentTool('get_my_profile', {}, CONTEXT);

    expect(result.toolCall.toolName).toBe('get_my_profile');
    expect(result.toolCall.output).toEqual({
      id: CONTEXT.userId,
      username: 'alice',
      displayName: 'Alice',
      bio: 'Hello world',
    });
    expect(result.toolMessage.content).toContain('"username":"alice"');
  });

  test('list_my_recent_posts respects limit', async () => {
    const getUserPostsSpy = spyOn(feedService, 'getUserPosts').mockImplementation(async () => ({
      items: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          authorId: CONTEXT.userId,
          content: 'First post',
          likeCount: 0,
          commentCount: 0,
          createdAt: '2026-07-06T10:00:00.000Z',
          updatedAt: '2026-07-06T10:00:00.000Z',
          author: {
            id: CONTEXT.userId,
            username: 'alice',
            displayName: 'Alice',
            avatarUrl: null,
          },
          likedByMe: false,
        },
      ],
      nextCursor: null,
    }));

    const result = await executeAgentTool('list_my_recent_posts', { limit: 3 }, CONTEXT);

    expect(getUserPostsSpy).toHaveBeenCalledWith(CONTEXT.userId, CONTEXT.userId, { limit: 3 });
    expect(result.toolCall.toolName).toBe('list_my_recent_posts');
    const output = result.toolCall.output as { items: Array<{ content: string }> };
    expect(output.items).toHaveLength(1);
    expect(output.items[0]?.content).toBe('First post');
  });

  test('search_my_posts returns compact rag hits', async () => {
    const searchSpy = spyOn(ragService, 'searchMyPosts').mockImplementation(async () => ({
      items: [
        {
          postId: '77777777-7777-4777-8777-777777777777',
          text: 'My travel diary from Kyoto',
          score: 0.91,
        },
      ],
    }));

    const result = await executeAgentTool(
      'search_my_posts',
      { query: 'travel', limit: 3 },
      CONTEXT
    );

    expect(searchSpy).toHaveBeenCalledWith(CONTEXT.userId, 'travel', { limit: 3 });
    expect(result.toolCall.toolName).toBe('search_my_posts');
    const output = result.toolCall.output as {
      items: Array<{ postId: string; text: string; score: number }>;
    };
    expect(output.items).toHaveLength(1);
    expect(output.items[0]?.postId).toBe('77777777-7777-4777-8777-777777777777');
    expect(output.items[0]?.text).toContain('travel');
    expect(output.items[0]?.score).toBe(0.91);
    expect(result.toolMessage.content).toContain('"postId"');
  });

  test('search_help_docs returns compact rag hits', async () => {
    const searchSpy = spyOn(ragService, 'searchHelpDocs').mockImplementation(async () => ({
      items: [
        {
          sourceId: 'api-spec',
          text: 'All business REST lives on /api/v1/',
          score: 0.82,
        },
      ],
    }));

    const result = await executeAgentTool('search_help_docs', { query: 'api' }, CONTEXT);

    expect(searchSpy).toHaveBeenCalledWith('api', { limit: 5 });
    expect(result.toolCall.toolName).toBe('search_help_docs');
    const output = result.toolCall.output as {
      items: Array<{ sourceId: string; text: string; score: number }>;
    };
    expect(output.items[0]?.sourceId).toBe('api-spec');
    expect(result.toolMessage.content).toContain('"sourceId"');
  });

  test('search_my_posts requires query', async () => {
    const result = await executeAgentTool('search_my_posts', {}, CONTEXT);

    expect(result.toolCall.output).toEqual({ status: 'invalid_args' });
    expect(result.toolMessage.content).toContain('query is required');
  });

  test('get_user_profile returns not_found for unknown username', async () => {
    spyOn(followService, 'searchUsers').mockImplementation(async () => ({
      items: [],
      nextCursor: null,
    }));

    const result = await executeAgentTool('get_user_profile', { username: 'ghost' }, CONTEXT);

    expect(result.toolCall.toolName).toBe('get_user_profile');
    expect(result.toolCall.output).toEqual({ status: 'not_found' });
    expect(result.toolMessage.content).toContain('could not find user');
  });

  test('list_user_recent_posts resolves username and returns posts', async () => {
    spyOn(followService, 'searchUsers').mockImplementation(async () => ({
      items: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          username: 'luna',
          displayName: 'Luna',
          avatarUrl: null,
        },
      ],
      nextCursor: null,
    }));
    spyOn(feedService, 'getUserPosts').mockImplementation(async () => ({
      items: [
        {
          id: '88888888-8888-4888-8888-888888888888',
          authorId: '22222222-2222-4222-8222-222222222222',
          content: 'Luna post',
          likeCount: 0,
          commentCount: 0,
          createdAt: '2026-07-06T10:00:00.000Z',
          updatedAt: '2026-07-06T10:00:00.000Z',
          author: {
            id: '22222222-2222-4222-8222-222222222222',
            username: 'luna',
            displayName: 'Luna',
            avatarUrl: null,
          },
          likedByMe: false,
        },
      ],
      nextCursor: null,
    }));

    const result = await executeAgentTool(
      'list_user_recent_posts',
      { username: 'luna', limit: 2 },
      CONTEXT
    );

    expect(result.toolCall.toolName).toBe('list_user_recent_posts');
    const output = result.toolCall.output as { items: Array<{ content: string }> };
    expect(output.items[0]?.content).toBe('Luna post');
  });

  test('search_help_docs requires query', async () => {
    const result = await executeAgentTool('search_help_docs', {}, CONTEXT);

    expect(result.toolCall.output).toEqual({ status: 'invalid_args' });
    expect(result.toolMessage.content).toContain('query is required');
  });
});
