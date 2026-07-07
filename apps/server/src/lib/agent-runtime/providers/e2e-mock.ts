import type { LlmChatInput, LlmChatResult, LlmProvider } from '../types';

const E2E_CREATE_POST_PREFIX = '[e2e:create_post]';
const E2E_FOLLOW_PREFIX = '[e2e:follow_user]';
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

export class E2eMockLlmProvider implements LlmProvider {
  async chat(input: LlmChatInput): Promise<LlmChatResult> {
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

    return {
      content: 'E2E mock assistant reply.',
      toolCalls: [],
    };
  }
}
