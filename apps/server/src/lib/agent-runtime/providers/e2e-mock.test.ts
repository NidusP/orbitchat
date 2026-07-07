import { describe, expect, test } from 'bun:test';
import { E2eMockLlmProvider } from './e2e-mock';

describe('E2eMockLlmProvider', () => {
  const provider = new E2eMockLlmProvider();

  test('returns create_post tool call for e2e prefix', async () => {
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [
        { role: 'system', content: 'test' },
        { role: 'user', content: '[e2e:create_post] Hello feed' },
      ],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('create_post');
    expect(result.toolCalls[0]?.arguments).toContain('Hello feed');
  });

  test('returns follow_user tool call for e2e prefix', async () => {
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [{ role: 'user', content: '[e2e:follow_user] luna' }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('follow_user');
    expect(result.toolCalls[0]?.arguments).toContain('luna');
  });

  test('returns play_tictactoe start for e2e prefix', async () => {
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [{ role: 'user', content: '[e2e:tictactoe]' }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('play_tictactoe');
    expect(result.toolCalls[0]?.arguments).toContain('"action":"start"');
  });

  test('follows user move with AI play_tictactoe move', async () => {
    const userMoveResult = JSON.stringify({
      status: 'ok',
      game: { phase: 'in_progress', currentPlayer: 'O' },
    });
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [
        { role: 'user', content: '[e2e:tictactoe:5]' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'call_user_move',
              name: 'play_tictactoe',
              arguments: '{"action":"move","position":5}',
            },
          ],
        },
        { role: 'tool', content: userMoveResult, toolCallId: 'call_user_move' },
      ],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('play_tictactoe');
    expect(result.toolCalls[0]?.arguments).toContain('"position":1');
  });

  test('does not repeat tool calls after tool results are added', async () => {
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [
        { role: 'user', content: '[e2e:create_post] Hello feed' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'call_1', name: 'create_post', arguments: '{"content":"Hello feed"}' },
          ],
        },
        { role: 'tool', content: 'create_post pending confirmation', toolCallId: 'call_1' },
      ],
    });

    expect(result.toolCalls).toHaveLength(0);
    expect(result.content).toContain('E2E mock');
  });
});
