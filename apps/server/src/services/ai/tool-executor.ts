import {
  archiveFinishedGame,
  buildMatchHistorySummary,
  runTicTacToeAction,
  type TicTacToeAction,
  type TicTacToeToolResult,
} from '../../lib/agent-runtime/tic-tac-toe';
import {
  loadTicTacToeData,
  saveTicTacToeData,
} from '../../lib/agent-runtime/tic-tac-toe-repository';
import { searchUsers } from '../follow-service';
import type {
  AgentToolContext,
  AgentToolExecution,
  AgentToolExecutor,
} from '../../lib/agent-runtime/types';
import {
  createPendingCreatePostToolCall,
  createPendingFollowUserToolCall,
  createPendingSendDmToolCall,
  createPendingUnfollowUserToolCall,
} from './tool-call-service';

function readString(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function resolveUserByUsername(
  username: string
): Promise<{ id: string; username: string } | null> {
  const candidates = await searchUsers(username, { limit: 5 });
  const exact = candidates.items.find(
    (user) => user.username.toLowerCase() === username.toLowerCase()
  );
  return exact ?? candidates.items[0] ?? null;
}

function readAction(args: Record<string, unknown>): string | null {
  const value = args.action;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readPosition(args: Record<string, unknown>): number | undefined {
  const value = args.position;
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return undefined;
}

async function executePlayTicTacToe(
  args: Record<string, unknown>,
  context: AgentToolContext
): Promise<AgentToolExecution> {
  const actionRaw = readAction(args);
  if (!actionRaw || !['start', 'status', 'move'].includes(actionRaw)) {
    const output: TicTacToeToolResult = {
      status: 'error',
      action: 'status',
      error: 'action must be one of: start, status, move',
      game: null,
    };
    return {
      toolMessage: {
        role: 'tool',
        content: JSON.stringify(output),
      },
      toolCall: {
        toolName: 'play_tictactoe',
        input: args,
        output,
      },
    };
  }

  const action = actionRaw as TicTacToeAction;
  const data = await loadTicTacToeData(context.conversationId);

  if (action === 'start' && data.active?.phase === 'in_progress') {
    const output: TicTacToeToolResult = {
      status: 'error',
      action,
      error: 'A game is already in progress. Finish the current board before starting another.',
      game: null,
    };
    return {
      toolMessage: { role: 'tool', content: JSON.stringify(output) },
      toolCall: { toolName: 'play_tictactoe', input: args, output },
    };
  }

  const { result, nextState } = runTicTacToeAction(data.active, action, readPosition(args));

  if (result.status === 'ok' && action === 'start' && data.history.length > 0) {
    result.matchHistory = buildMatchHistorySummary(data.history);
  }

  data.active = nextState;
  if (nextState && nextState.phase !== 'in_progress') {
    archiveFinishedGame(data, nextState);
  }

  await saveTicTacToeData(context.conversationId, data);

  return {
    toolMessage: {
      role: 'tool',
      content: JSON.stringify(result),
    },
    toolCall: {
      toolName: 'play_tictactoe',
      input: args,
      output: result,
    },
  };
}

async function executeSearchContact(
  args: Record<string, unknown>
): Promise<AgentToolExecution> {
  const query = readString(args, 'query');
  if (!query) {
    return {
      toolMessage: {
        role: 'tool',
        content: 'search_contact failed: query is required.',
      },
      toolCall: {
        toolName: 'search_contact',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  const result = await searchUsers(query, { limit: 5 });
  const output = { items: result.items };

  return {
    toolMessage: {
      role: 'tool',
      content: `search_contact result for "${query}": ${JSON.stringify(output)}`,
    },
    toolCall: {
      toolName: 'search_contact',
      input: { query },
      output,
    },
  };
}

async function executeSendDm(
  args: Record<string, unknown>,
  context: AgentToolContext
): Promise<AgentToolExecution> {
  const targetUsername = readString(args, 'target_username') ?? readString(args, 'targetUsername');
  const content = readString(args, 'content');

  if (!targetUsername || !content) {
    return {
      toolMessage: {
        role: 'tool',
        content: 'send_dm failed: target_username and content are required.',
      },
      toolCall: {
        toolName: 'send_dm',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  const target = await resolveUserByUsername(targetUsername);
  if (!target) {
    return {
      toolMessage: {
        role: 'tool',
        content: `send_dm could not find target user "${targetUsername}".`,
      },
      toolCall: {
        toolName: 'send_dm',
        input: { target_username: targetUsername, content },
        output: { status: 'target_not_found' },
      },
    };
  }

  const toolCall = await createPendingSendDmToolCall({
    conversationId: context.conversationId,
    userId: context.userId,
    targetUserId: target.id,
    targetUsername: target.username,
    content,
  });

  return {
    toolMessage: {
      role: 'tool',
      content: `send_dm pending confirmation: ${JSON.stringify(toolCall)}`,
    },
    toolCall: {
      toolName: 'send_dm',
      input: toolCall.input,
      output: { toolCall },
    },
  };
}

async function executeCreatePost(
  args: Record<string, unknown>,
  context: AgentToolContext
): Promise<AgentToolExecution> {
  const content = readString(args, 'content');
  if (!content) {
    return {
      toolMessage: {
        role: 'tool',
        content: 'create_post failed: content is required.',
      },
      toolCall: {
        toolName: 'create_post',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  const toolCall = await createPendingCreatePostToolCall({
    conversationId: context.conversationId,
    userId: context.userId,
    content,
  });

  return {
    toolMessage: {
      role: 'tool',
      content: `create_post pending confirmation: ${JSON.stringify(toolCall)}`,
    },
    toolCall: {
      toolName: 'create_post',
      input: toolCall.input,
      output: { toolCall },
    },
  };
}

async function executeFollowUser(
  args: Record<string, unknown>,
  context: AgentToolContext,
  toolName: 'follow_user' | 'unfollow_user'
): Promise<AgentToolExecution> {
  const targetUsername = readString(args, 'target_username') ?? readString(args, 'targetUsername');
  if (!targetUsername) {
    return {
      toolMessage: {
        role: 'tool',
        content: `${toolName} failed: target_username is required.`,
      },
      toolCall: {
        toolName,
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  const target = await resolveUserByUsername(targetUsername);
  if (!target) {
    return {
      toolMessage: {
        role: 'tool',
        content: `${toolName} could not find target user "${targetUsername}".`,
      },
      toolCall: {
        toolName,
        input: { target_username: targetUsername },
        output: { status: 'target_not_found' },
      },
    };
  }

  const createPending =
    toolName === 'follow_user'
      ? createPendingFollowUserToolCall
      : createPendingUnfollowUserToolCall;

  const toolCall = await createPending({
    conversationId: context.conversationId,
    userId: context.userId,
    targetUserId: target.id,
    targetUsername: target.username,
  });

  return {
    toolMessage: {
      role: 'tool',
      content: `${toolName} pending confirmation: ${JSON.stringify(toolCall)}`,
    },
    toolCall: {
      toolName,
      input: toolCall.input,
      output: { toolCall },
    },
  };
}

export const executeAgentTool: AgentToolExecutor = async (toolName, args, context) => {
  switch (toolName) {
    case 'search_contact':
      return executeSearchContact(args);
    case 'send_dm':
      return executeSendDm(args, context);
    case 'create_post':
      return executeCreatePost(args, context);
    case 'follow_user':
      return executeFollowUser(args, context, 'follow_user');
    case 'unfollow_user':
      return executeFollowUser(args, context, 'unfollow_user');
    case 'play_tictactoe':
      return executePlayTicTacToe(args, context);
    default:
      return {
        toolMessage: {
          role: 'tool',
          content: `Unknown tool "${toolName}".`,
        },
        toolCall: {
          toolName,
          input: args,
          output: { status: 'unknown_tool' },
        },
      };
  }
};
