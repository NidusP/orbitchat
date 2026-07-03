import type { PostWithAuthor } from '@orbitchat/shared-types';

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) {
    return 'just now';
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString();
}

/** Merge poll results: incoming first page wins on id collision (ADR 12). */
export function mergeFeedPosts(
  current: PostWithAuthor[],
  incoming: PostWithAuthor[]
): PostWithAuthor[] {
  const map = new Map<string, PostWithAuthor>();
  for (const post of incoming) {
    map.set(post.id, post);
  }
  for (const post of current) {
    if (!map.has(post.id)) {
      map.set(post.id, post);
    }
  }

  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function applyLikeOptimistic(
  posts: PostWithAuthor[],
  postId: string,
  liked: boolean
): PostWithAuthor[] {
  return posts.map((post) => {
    if (post.id !== postId) {
      return post;
    }

    const delta = liked ? 1 : -1;
    return {
      ...post,
      likedByMe: liked,
      likeCount: Math.max(0, post.likeCount + delta),
    };
  });
}

export function applyLikeResult(
  posts: PostWithAuthor[],
  postId: string,
  liked: boolean,
  likeCount: number
): PostWithAuthor[] {
  return posts.map((post) =>
    post.id === postId ? { ...post, likedByMe: liked, likeCount } : post
  );
}
