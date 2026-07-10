import { TICTACTOE_AGENT_INSTRUCTIONS } from './tic-tac-toe';

export { TICTACTOE_AGENT_INSTRUCTIONS };

export function platformDataModule(): string {
  return `### Platform data (read-only, runs immediately)
- search_contact: find users
- get_my_profile: get the current user's profile
- list_my_recent_posts: list the current user's recent posts in chronological order
- search_my_posts: semantic search over the current user's posts; use for "did I post about X"
- search_help_docs: search Orbitchat help/product docs
- get_user_profile: get a user's public profile by username
- list_user_recent_posts: list a user's recent public posts by username
NEVER fabricate posts, follower counts, or profile data — you MUST use tools to query platform data.
Use these when the user asks about profiles or posts, or to find someone.`;
}

export function socialWriteModule(): string {
  return `### Social write actions (require user approval)
- send_dm: send a direct message
- create_post: publish a feed post
- follow_user / unfollow_user: change follow state
Use these when the user wants to send a message, post, or follow/unfollow. Extract target username and content from the user message.`;
}

export function gameModule(): string {
  return `### Games
- play_tictactoe: tic-tac-toe; user is X, you are O; call start/status/move (see game rules below)
Use when the user wants to play tic-tac-toe.

${TICTACTOE_AGENT_INSTRUCTIONS}`;
}

export function memoryModule(): string {
  return `### Memory
- remember_fact: save a fact about the user for future sessions (requires user approval)
Known facts about this user are injected automatically into your context when available — you do not need to call a tool to recall them.
Use remember_fact when the user asks you to remember a preference for future sessions.`;
}

export function composeToolHint(): string {
  return [
    'You have tools:',
    platformDataModule(),
    socialWriteModule(),
    gameModule(),
    memoryModule(),
  ].join('\n\n');
}
