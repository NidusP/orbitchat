import { describe, expect, test } from 'bun:test';
import { E2eMockLlmProvider } from './e2e-mock';

describe('E2eMockLlmProvider', () => {
  const provider = new E2eMockLlmProvider();

  test('returns search_my_posts tool call for e2e prefix', async () => {
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [{ role: 'user', content: '[e2e:search_posts] travel' }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('search_my_posts');
    expect(result.toolCalls[0]?.arguments).toContain('"query":"travel"');
  });

  test('returns search_help_docs tool call for e2e prefix', async () => {
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [{ role: 'user', content: '[e2e:search_help] api' }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('search_help_docs');
    expect(result.toolCalls[0]?.arguments).toContain('"query":"api"');
  });

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

  test('returns list_my_recent_posts tool call for e2e prefix', async () => {
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [{ role: 'user', content: '[e2e:my_posts] 5' }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('list_my_recent_posts');
    expect(result.toolCalls[0]?.arguments).toContain('"limit":5');
  });

  test('returns get_my_profile tool call for e2e prefix', async () => {
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [{ role: 'user', content: '[e2e:my_profile]' }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('get_my_profile');
  });

  test('returns remember_fact tool call for e2e prefix', async () => {
    const result = await provider.chat({
      model: 'e2e',
      tools: true,
      messages: [{ role: 'user', content: '[e2e:remember_fact] nickname:Call me Orbit' }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('remember_fact');
    expect(result.toolCalls[0]?.arguments).toContain('"kind":"nickname"');
    expect(result.toolCalls[0]?.arguments).toContain('Call me Orbit');
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

  test('emits content deltas during chatStream', async () => {
    const deltas: string[] = [];
    const result = await provider.chatStream(
      {
        model: 'e2e',
        messages: [{ role: 'user', content: 'hello' }],
      },
      {
        onDelta: (text) => {
          deltas.push(text);
        },
      }
    );

    expect(deltas.join('')).toBe('E2E mock assistant reply.');
    expect(result.content).toBe('E2E mock assistant reply.');
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
