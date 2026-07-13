import { describe, expect, test } from 'bun:test';
import { applyLikeOptimistic, mergeFeedPosts } from './posts-utils';
import type { PostWithAuthor } from '@orbitchat/shared-types';

const samplePost = (id: string, createdAt: string): PostWithAuthor => ({
  id,
  authorId: 'author-1',
  content: 'hello',
  likeCount: 1,
  commentCount: 0,
  media: [],
  createdAt,
  updatedAt: createdAt,
  likedByMe: false,
  author: {
    id: 'author-1',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
  },
});

describe('mergeFeedPosts', () => {
  test('prefers incoming on duplicate ids', () => {
    const older = samplePost('p1', '2026-06-23T10:00:00.000Z');
    const newer = { ...older, content: 'updated', likeCount: 5 };
    const merged = mergeFeedPosts([older], [newer]);
    expect(merged.length).toBe(1);
    expect(merged[0]?.content).toBe('updated');
    expect(merged[0]?.likeCount).toBe(5);
  });
});

describe('applyLikeOptimistic', () => {
  test('toggles like state and count', () => {
    const posts = [samplePost('p1', '2026-06-23T10:00:00.000Z')];
    const liked = applyLikeOptimistic(posts, 'p1', true);
    expect(liked[0]?.likedByMe).toBe(true);
    expect(liked[0]?.likeCount).toBe(2);
  });
});
