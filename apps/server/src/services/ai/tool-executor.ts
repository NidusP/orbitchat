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
import { AppError } from '../../lib/errors';
import { getUserPosts } from '../feed-service';
import { searchUsers } from '../follow-service';
import { getProfileByUserId, getUserById } from '../user-service';
import type {
  AgentToolContext,
  AgentToolExecution,
  AgentToolExecutor,
} from '../../lib/agent-runtime/types';
import type { PostWithAuthor, Profile, User } from '@orbitchat/shared-types';
import { searchHelpDocs, searchMyPosts } from './rag-service';
import {
  createPendingCreatePostToolCall,
  createPendingFollowUserToolCall,
  createPendingRememberFactToolCall,
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

const POSTS_LIMIT_DEFAULT = 5;
const POSTS_LIMIT_MAX = 20;
const RAG_LIMIT_DEFAULT = 5;
const RAG_LIMIT_MAX = 10;
const POST_CONTENT_SNIPPET_LENGTH = 160;
const MEMORY_KINDS = new Set(['preference', 'fact', 'nickname']);
const MEMORY_CONTENT_MAX = 500;

function readPostsLimit(args: Record<string, unknown>): number {
  const value = args.limit;
  if (typeof value === 'number' && Number.isInteger(value)) {
    return Math.min(Math.max(1, value), POSTS_LIMIT_MAX);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Math.min(Math.max(1, Number.parseInt(value, 10)), POSTS_LIMIT_MAX);
  }
  return POSTS_LIMIT_DEFAULT;
}

function readRagLimit(args: Record<string, unknown>): number {
  const value = args.limit;
  if (typeof value === 'number' && Number.isInteger(value)) {
    return Math.min(Math.max(1, value), RAG_LIMIT_MAX);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Math.min(Math.max(1, Number.parseInt(value, 10)), RAG_LIMIT_MAX);
  }
  return RAG_LIMIT_DEFAULT;
}

function compactRagHits(
  items: Array<{ postId?: string; sourceId?: string; text: string; score: number }>
) {
  return items.map((item) => {
    const snippet =
      item.text.length > POST_CONTENT_SNIPPET_LENGTH
        ? `${item.text.slice(0, POST_CONTENT_SNIPPET_LENGTH)}…`
        : item.text;
    if (item.postId) {
      return { postId: item.postId, text: snippet, score: item.score };
    }
    return { sourceId: item.sourceId, text: snippet, score: item.score };
  });
}

function compactProfile(user: User, profile: Profile) {
  return {
    id: user.id,
    username: user.username,
    displayName: profile.displayName,
    bio: profile.bio,
  };
}

function compactPostSnippet(post: PostWithAuthor) {
  const content =
    post.content.length > POST_CONTENT_SNIPPET_LENGTH
      ? `${post.content.slice(0, POST_CONTENT_SNIPPET_LENGTH)}…`
      : post.content;
  return {
    id: post.id,
    content,
    createdAt: post.createdAt,
  };
}

function notFoundExecution(
  toolName: string,
  args: Record<string, unknown>,
  label: string
): AgentToolExecution {
  return {
    toolMessage: {
      role: 'tool',
      content: `${toolName} could not find user "${label}".`,
    },
    toolCall: {
      toolName,
      input: args,
      output: { status: 'not_found' },
    },
  };
}

async function executeGetMyProfile(context: AgentToolContext): Promise<AgentToolExecution> {
  const [user, profile] = await Promise.all([
    getUserById(context.userId),
    getProfileByUserId(context.userId),
  ]);
  const output = compactProfile(user, profile);

  return {
    toolMessage: {
      role: 'tool',
      content: JSON.stringify(output),
    },
    toolCall: {
      toolName: 'get_my_profile',
      input: {},
      output,
    },
  };
}

async function executeListMyRecentPosts(
  args: Record<string, unknown>,
  context: AgentToolContext
): Promise<AgentToolExecution> {
  const limit = readPostsLimit(args);
  const result = await getUserPosts(context.userId, context.userId, { limit });
  const output = {
    items: result.items.map(compactPostSnippet),
    nextCursor: result.nextCursor,
  };

  return {
    toolMessage: {
      role: 'tool',
      content: JSON.stringify(output),
    },
    toolCall: {
      toolName: 'list_my_recent_posts',
      input: { limit },
      output,
    },
  };
}

async function executeGetUserProfile(args: Record<string, unknown>): Promise<AgentToolExecution> {
  const username = readString(args, 'username');
  if (!username) {
    return {
      toolMessage: {
        role: 'tool',
        content: 'get_user_profile failed: username is required.',
      },
      toolCall: {
        toolName: 'get_user_profile',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  const target = await resolveUserByUsername(username);
  if (!target) {
    return notFoundExecution('get_user_profile', { username }, username);
  }

  try {
    const [user, profile] = await Promise.all([
      getUserById(target.id),
      getProfileByUserId(target.id),
    ]);
    const output = compactProfile(user, profile);

    return {
      toolMessage: {
        role: 'tool',
        content: JSON.stringify(output),
      },
      toolCall: {
        toolName: 'get_user_profile',
        input: { username },
        output,
      },
    };
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      return notFoundExecution('get_user_profile', { username }, username);
    }
    throw error;
  }
}

async function executeListUserRecentPosts(
  args: Record<string, unknown>,
  context: AgentToolContext
): Promise<AgentToolExecution> {
  const username = readString(args, 'username');
  if (!username) {
    return {
      toolMessage: {
        role: 'tool',
        content: 'list_user_recent_posts failed: username is required.',
      },
      toolCall: {
        toolName: 'list_user_recent_posts',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  const target = await resolveUserByUsername(username);
  if (!target) {
    return notFoundExecution('list_user_recent_posts', { username }, username);
  }

  const limit = readPostsLimit(args);

  try {
    const result = await getUserPosts(target.id, context.userId, { limit });
    const output = {
      username: target.username,
      items: result.items.map(compactPostSnippet),
      nextCursor: result.nextCursor,
    };

    return {
      toolMessage: {
        role: 'tool',
        content: JSON.stringify(output),
      },
      toolCall: {
        toolName: 'list_user_recent_posts',
        input: { username, limit },
        output,
      },
    };
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      return notFoundExecution('list_user_recent_posts', { username, limit }, username);
    }
    throw error;
  }
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

async function executeSearchMyPosts(
  args: Record<string, unknown>,
  context: AgentToolContext
): Promise<AgentToolExecution> {
  const query = readString(args, 'query');
  if (!query) {
    return {
      toolMessage: {
        role: 'tool',
        content: 'search_my_posts failed: query is required.',
      },
      toolCall: {
        toolName: 'search_my_posts',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  const limit = readRagLimit(args);
  const result = await searchMyPosts(context.userId, query, { limit });
  const output = { items: compactRagHits(result.items) };

  return {
    toolMessage: {
      role: 'tool',
      content: JSON.stringify(output),
    },
    toolCall: {
      toolName: 'search_my_posts',
      input: { query, limit },
      output,
    },
  };
}

async function executeSearchHelpDocs(
  args: Record<string, unknown>
): Promise<AgentToolExecution> {
  const query = readString(args, 'query');
  if (!query) {
    return {
      toolMessage: {
        role: 'tool',
        content: 'search_help_docs failed: query is required.',
      },
      toolCall: {
        toolName: 'search_help_docs',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  const limit = readRagLimit(args);
  const result = await searchHelpDocs(query, { limit });
  const output = { items: compactRagHits(result.items) };

  return {
    toolMessage: {
      role: 'tool',
      content: JSON.stringify(output),
    },
    toolCall: {
      toolName: 'search_help_docs',
      input: { query, limit },
      output,
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

async function executeRememberFact(
  args: Record<string, unknown>,
  context: AgentToolContext
): Promise<AgentToolExecution> {
  const kindRaw = readString(args, 'kind');
  const content = readString(args, 'content');

  if (!kindRaw || !content) {
    return {
      toolMessage: {
        role: 'tool',
        content: 'remember_fact failed: kind and content are required.',
      },
      toolCall: {
        toolName: 'remember_fact',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  if (!MEMORY_KINDS.has(kindRaw)) {
    return {
      toolMessage: {
        role: 'tool',
        content: 'remember_fact failed: kind must be preference, fact, or nickname.',
      },
      toolCall: {
        toolName: 'remember_fact',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  if (content.length > MEMORY_CONTENT_MAX) {
    return {
      toolMessage: {
        role: 'tool',
        content: `remember_fact failed: content must be at most ${MEMORY_CONTENT_MAX} characters.`,
      },
      toolCall: {
        toolName: 'remember_fact',
        input: args,
        output: { status: 'invalid_args' },
      },
    };
  }

  const kind = kindRaw as 'preference' | 'fact' | 'nickname';
  const toolCall = await createPendingRememberFactToolCall({
    conversationId: context.conversationId,
    userId: context.userId,
    kind,
    content,
  });

  return {
    toolMessage: {
      role: 'tool',
      content: `remember_fact pending confirmation: ${JSON.stringify(toolCall)}`,
    },
    toolCall: {
      toolName: 'remember_fact',
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
    case 'search_my_posts':
      return executeSearchMyPosts(args, context);
    case 'search_help_docs':
      return executeSearchHelpDocs(args);
    case 'search_contact':
      return executeSearchContact(args);
    case 'send_dm':
      return executeSendDm(args, context);
    case 'create_post':
      return executeCreatePost(args, context);
    case 'remember_fact':
      return executeRememberFact(args, context);
    case 'follow_user':
      return executeFollowUser(args, context, 'follow_user');
    case 'unfollow_user':
      return executeFollowUser(args, context, 'unfollow_user');
    case 'play_tictactoe':
      return executePlayTicTacToe(args, context);
    case 'get_my_profile':
      return executeGetMyProfile(context);
    case 'list_my_recent_posts':
      return executeListMyRecentPosts(args, context);
    case 'get_user_profile':
      return executeGetUserProfile(args);
    case 'list_user_recent_posts':
      return executeListUserRecentPosts(args, context);
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
