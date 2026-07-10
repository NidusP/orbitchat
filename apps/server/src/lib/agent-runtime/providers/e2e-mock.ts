import type { LlmChatInput, LlmChatResult, LlmProvider, LlmStreamHandlers } from '../types';

const E2E_SEARCH_POSTS_PREFIX = '[e2e:search_posts]';
const E2E_SEARCH_HELP_PREFIX = '[e2e:search_help]';
const E2E_CREATE_POST_PREFIX = '[e2e:create_post]';
const E2E_FOLLOW_PREFIX = '[e2e:follow_user]';
const E2E_MY_POSTS_PREFIX = '[e2e:my_posts]';
const E2E_MY_PROFILE_PREFIX = '[e2e:my_profile]';
const E2E_REMEMBER_FACT_PREFIX = '[e2e:remember_fact]';
const E2E_TICTACTOE_PREFIX = '[e2e:tictactoe';

function triggeringUserMessage(messages: LlmChatInput['messages']): string {
  const last = messages[messages.length - 1];
  if (last?.role !== 'user') {
    return '';
  }
  return last.content;
}

function awaitingAiTicTacToeMove(messages: LlmChatInput['messages']): boolean {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'tool') {
      try {
        const parsed = JSON.parse(message.content) as {
          game?: { currentPlayer?: string; phase?: string };
        };
        return (
          parsed.game?.phase === 'in_progress' && parsed.game.currentPlayer === 'O'
        );
      } catch {
        return false;
      }
    }
    if (message?.role === 'user') {
      return false;
    }
  }
  return false;
}

function resolveMockResult(input: LlmChatInput): LlmChatResult {
  if (input.tools && awaitingAiTicTacToeMove(input.messages)) {
    return {
      content: null,
      toolCalls: [
        {
          id: 'call_e2e_tictactoe_ai',
          name: 'play_tictactoe',
          arguments: JSON.stringify({ action: 'move', position: 1 }),
        },
      ],
    };
  }

  const userMessage = triggeringUserMessage(input.messages);

  if (input.tools && userMessage.startsWith(E2E_TICTACTOE_PREFIX)) {
    if (userMessage === '[e2e:tictactoe]' || userMessage.startsWith('[e2e:tictactoe] start')) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_e2e_tictactoe_start',
            name: 'play_tictactoe',
            arguments: JSON.stringify({ action: 'start' }),
          },
        ],
      };
    }

    const moveMatch = /\[e2e:tictactoe:(\d)\]/.exec(userMessage);
    if (moveMatch) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_e2e_tictactoe_move',
            name: 'play_tictactoe',
            arguments: JSON.stringify({
              action: 'move',
              position: Number.parseInt(moveMatch[1], 10),
            }),
          },
        ],
      };
    }
  }

  if (input.tools && userMessage.startsWith(E2E_SEARCH_POSTS_PREFIX)) {
    const query = userMessage.slice(E2E_SEARCH_POSTS_PREFIX.length).trim() || 'travel';
    return {
      content: null,
      toolCalls: [
        {
          id: 'call_e2e_search_posts',
          name: 'search_my_posts',
          arguments: JSON.stringify({ query }),
        },
      ],
    };
  }

  if (input.tools && userMessage.startsWith(E2E_SEARCH_HELP_PREFIX)) {
    const query = userMessage.slice(E2E_SEARCH_HELP_PREFIX.length).trim() || 'api';
    return {
      content: null,
      toolCalls: [
        {
          id: 'call_e2e_search_help',
          name: 'search_help_docs',
          arguments: JSON.stringify({ query }),
        },
      ],
    };
  }

  if (input.tools && userMessage.startsWith(E2E_CREATE_POST_PREFIX)) {
    const content = userMessage.slice(E2E_CREATE_POST_PREFIX.length).trim() || 'E2E post';
    return {
      content: null,
      toolCalls: [
        {
          id: 'call_e2e_create_post',
          name: 'create_post',
          arguments: JSON.stringify({ content }),
        },
      ],
    };
  }

  if (input.tools && userMessage.startsWith(E2E_FOLLOW_PREFIX)) {
    const targetUsername = userMessage.slice(E2E_FOLLOW_PREFIX.length).trim();
    if (!targetUsername) {
      return {
        content: 'E2E mock: follow_user requires a username after the prefix.',
        toolCalls: [],
      };
    }
    return {
      content: null,
      toolCalls: [
        {
          id: 'call_e2e_follow_user',
          name: 'follow_user',
          arguments: JSON.stringify({ target_username: targetUsername }),
        },
      ],
    };
  }

  if (input.tools && userMessage.startsWith(E2E_MY_POSTS_PREFIX)) {
    const limitRaw = userMessage.slice(E2E_MY_POSTS_PREFIX.length).trim();
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const args: Record<string, number> = {};
    if (limit !== undefined && Number.isInteger(limit) && limit >= 1 && limit <= 20) {
      args.limit = limit;
    }
    return {
      content: null,
      toolCalls: [
        {
          id: 'call_e2e_my_posts',
          name: 'list_my_recent_posts',
          arguments: JSON.stringify(args),
        },
      ],
    };
  }

  if (input.tools && userMessage.startsWith(E2E_MY_PROFILE_PREFIX)) {
    return {
      content: null,
      toolCalls: [
        {
          id: 'call_e2e_my_profile',
          name: 'get_my_profile',
          arguments: JSON.stringify({}),
        },
      ],
    };
  }

  if (input.tools && userMessage.startsWith(E2E_REMEMBER_FACT_PREFIX)) {
    const payload = userMessage.slice(E2E_REMEMBER_FACT_PREFIX.length).trim();
    const separatorIndex = payload.indexOf(':');
    const kindRaw = separatorIndex >= 0 ? payload.slice(0, separatorIndex).trim() : 'fact';
    const content =
      separatorIndex >= 0 ? payload.slice(separatorIndex + 1).trim() : payload.trim();
    const kind =
      kindRaw === 'preference' || kindRaw === 'fact' || kindRaw === 'nickname' ? kindRaw : 'fact';
    return {
      content: null,
      toolCalls: [
        {
          id: 'call_e2e_remember_fact',
          name: 'remember_fact',
          arguments: JSON.stringify({
            kind,
            content: content || 'E2E remembered fact',
          }),
        },
      ],
    };
  }

  return {
    content: 'E2E mock assistant reply.',
    toolCalls: [],
  };
}

function emitContentDeltas(content: string, handlers: LlmStreamHandlers): void {
  const chunkSize = 8;
  for (let index = 0; index < content.length; index += chunkSize) {
    handlers.onDelta(content.slice(index, index + chunkSize));
  }
}

export class E2eMockLlmProvider implements LlmProvider {
  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    return this.chatStream(input, { onDelta: () => {} });
  }

  async chatStream(input: LlmChatInput, handlers: LlmStreamHandlers): Promise<LlmChatResult> {
    const result = resolveMockResult(input);
    if (result.content) {
      emitContentDeltas(result.content, handlers);
    }
    return result;
  }
}
