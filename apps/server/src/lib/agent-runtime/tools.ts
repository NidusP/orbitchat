export interface OpenAiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const AGENT_TOOL_DEFINITIONS: OpenAiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_contact',
      description:
        'Search Orbitchat users by username or display name. Use when the user wants to find someone.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Username or display name fragment to search',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_dm',
      description:
        'Send a direct message to another user. Creates a pending action that requires user approval before delivery.',
      parameters: {
        type: 'object',
        properties: {
          target_username: {
            type: 'string',
            description: 'Target user username (without @)',
          },
          content: {
            type: 'string',
            description: 'Message body to send (plain text)',
          },
        },
        required: ['target_username', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_post',
      description:
        'Create a new post on the user feed. Creates a pending action that requires user approval before publishing.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Post body (plain text, 1-2000 characters)',
          },
        },
        required: ['content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'follow_user',
      description:
        'Follow another user. Creates a pending action that requires user approval before following.',
      parameters: {
        type: 'object',
        properties: {
          target_username: {
            type: 'string',
            description: 'Username to follow (without @)',
          },
        },
        required: ['target_username'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'play_tictactoe',
      description:
        'Play tic-tac-toe with the user. User is X (moves first), you are O. Use action "start" for a new game or rematch after a finished round, "status" to read the board, and "move" with position 1-9 on each turn. After the user moves, if the game continues you must call "move" again for your O turn. On "start", read matchHistory (if present) and comment naturally on past results.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['start', 'status', 'move'],
            description: 'start a new game, read status, or place a mark',
          },
          position: {
            type: 'integer',
            minimum: 1,
            maximum: 9,
            description: 'Board position 1-9 (required for action "move")',
          },
        },
        required: ['action'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'unfollow_user',
      description:
        'Unfollow another user. Creates a pending action that requires user approval before unfollowing.',
      parameters: {
        type: 'object',
        properties: {
          target_username: {
            type: 'string',
            description: 'Username to unfollow (without @)',
          },
        },
        required: ['target_username'],
        additionalProperties: false,
      },
    },
  },
];

export const AGENT_TOOL_NAMES = AGENT_TOOL_DEFINITIONS.map((tool) => tool.function.name);
