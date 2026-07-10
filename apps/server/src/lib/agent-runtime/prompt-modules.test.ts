import { describe, expect, test } from 'bun:test';
import {
  composeToolHint,
  gameModule,
  memoryModule,
  platformDataModule,
  socialWriteModule,
  TICTACTOE_AGENT_INSTRUCTIONS,
} from './prompt-modules';

describe('prompt-modules', () => {
  test('platformDataModule lists read-only profile and post tools', () => {
    const section = platformDataModule();
    expect(section).toContain('### Platform data');
    expect(section).toContain('get_my_profile');
    expect(section).toContain('list_my_recent_posts');
    expect(section).toContain('search_my_posts');
    expect(section).toContain('search_help_docs');
    expect(section).toContain('get_user_profile');
    expect(section).toContain('list_user_recent_posts');
    expect(section).toContain('NEVER fabricate posts, follower counts, or profile data');
  });

  test('socialWriteModule marks write tools as requiring approval', () => {
    const section = socialWriteModule();
    expect(section).toContain('### Social write actions');
    expect(section).toContain('send_dm');
    expect(section).toContain('create_post');
    expect(section).toContain('follow_user / unfollow_user');
    expect(section).toContain('require user approval');
  });

  test('gameModule includes tic-tac-toe tool and rules', () => {
    const section = gameModule();
    expect(section).toContain('### Games');
    expect(section).toContain('play_tictactoe');
    expect(section).toContain(TICTACTOE_AGENT_INSTRUCTIONS);
  });

  test('memoryModule covers automatic injection and remember_fact approval', () => {
    const section = memoryModule();
    expect(section).toContain('### Memory');
    expect(section).toContain('remember_fact');
    expect(section).toContain('injected automatically');
    expect(section).toContain('requires user approval');
  });

  test('composeToolHint joins all modular sections', () => {
    const hint = composeToolHint();
    expect(hint).toContain('You have tools:');
    expect(hint).toContain('### Platform data');
    expect(hint).toContain('### Social write actions');
    expect(hint).toContain('### Games');
    expect(hint).toContain('### Memory');
    expect(hint).toContain('search_contact');
    expect(hint).toContain('play_tictactoe');
    expect(hint).toContain('remember_fact');
  });
});
