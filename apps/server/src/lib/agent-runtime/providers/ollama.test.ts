import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { OpenAiCompatibleProvider } from './ollama';

function createSseResponse(events: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = `${events.join('\n\n')}\n\n`;

  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
    {
      status,
      headers: { 'Content-Type': 'text/event-stream' },
    }
  );
}

describe('OpenAiCompatibleProvider', () => {
  afterEach(() => {
    mock.restore();
  });

  test('assembles streamed text content from SSE chunks', async () => {
    spyOn(globalThis, 'fetch').mockImplementation((async () =>
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":" world"}}]}',
        'data: [DONE]',
      ])
    ) as unknown as typeof fetch);

    const provider = new OpenAiCompatibleProvider('http://localhost:11434/v1', 5000);
    const deltas: string[] = [];
    const result = await provider.chatStream(
      {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hi' }],
      },
      {
        onDelta: (text) => {
          deltas.push(text);
        },
      }
    );

    expect(deltas).toEqual(['Hello', ' world']);
    expect(result.content).toBe('Hello world');
    expect(result.toolCalls).toEqual([]);
  });

  test('assembles streamed tool calls from SSE chunks', async () => {
    spyOn(globalThis, 'fetch').mockImplementation((async () =>
      createSseResponse([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"create_post","arguments":"{\\"content\\":"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"Hello\\"}"}}]}}]}',
        'data: [DONE]',
      ])
    ) as unknown as typeof fetch);

    const provider = new OpenAiCompatibleProvider('http://localhost:11434/v1', 5000);
    const result = await provider.chat({
      model: 'test-model',
      tools: true,
      messages: [{ role: 'user', content: 'Post hello' }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.id).toBe('call_1');
    expect(result.toolCalls[0]?.name).toBe('create_post');
    expect(result.toolCalls[0]?.arguments).toBe('{"content":"Hello"}');
  });

  test('sends Authorization header when apiKey is configured', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      createSseResponse(['data: {"choices":[{"delta":{"content":"OK"}}]}', 'data: [DONE]'])
    ) as unknown as typeof fetch);

    const provider = new OpenAiCompatibleProvider('http://localhost:11434/v1', 5000, 'secret-key');
    await provider.chat({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key',
        }),
      })
    );
  });

  test('throws when upstream returns non-ok status', async () => {
    spyOn(globalThis, 'fetch').mockImplementation((async () =>
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 })
    ) as unknown as typeof fetch);

    const provider = new OpenAiCompatibleProvider('http://localhost:11434/v1', 5000, 'bad-key');

    await expect(
      provider.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'LLM_REQUEST_FAILED',
        statusCode: 502,
      })
    );
  });
});
