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
      name: 'get_my_profile',
      description:
        'Get the current user profile (username, display name, bio). Use when the user asks about their own profile.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_my_posts',
      description:
        'Semantic search over the current user posts. Use when the user asks whether they posted about a topic or wants to find posts by meaning (not chronological order).',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural-language search query',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            description: 'Maximum results to return (default 5)',
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
      name: 'search_help_docs',
      description:
        'Search Orbitchat help and product documentation. Use when the user asks how the product works or needs platform guidance.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural-language search query',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            description: 'Maximum results to return (default 5)',
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
      name: 'list_my_recent_posts',
      description:
        'List the current user recent posts in chronological order. Use for recent activity, not semantic topic search (use search_my_posts for that).',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Maximum posts to return (default 5)',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description:
        'Get a public user profile by username. Use when the user asks about another user.',
      parameters: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'Target username (without @)',
          },
        },
        required: ['username'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_user_recent_posts',
      description:
        'List recent public posts by username. Use when the user asks what someone else posted.',
      parameters: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'Target username (without @)',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Maximum posts to return (default 5)',
          },
        },
        required: ['username'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember_fact',
      description:
        'Save a fact about the user for future sessions. Creates a pending action requiring user approval.',
      parameters: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['preference', 'fact', 'nickname'],
            description: 'Category of the memory',
          },
          content: {
            type: 'string',
            minLength: 1,
            maxLength: 500,
            description: 'The fact to remember (1-500 characters)',
          },
        },
        required: ['kind', 'content'],
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
