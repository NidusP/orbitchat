import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { AiToolCall } from '@orbitchat/shared-types';

const toolCallService = await import('./tool-call-service');
const followService = await import('../follow-service');
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
});
