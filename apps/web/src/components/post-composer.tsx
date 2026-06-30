'use client';

import { FormEvent, useState } from 'react';
import { ApiError } from '@/lib/api/errors';
import { createPost } from '@/lib/api/posts';
import type { PostWithAuthor } from '@orbitchat/shared-types';

interface PostComposerProps {
  onCreated: (post: PostWithAuthor) => void;
}

export function PostComposer({ onCreated }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const post = await createPost({ content: content.trim() });
      onCreated(post);
      setContent('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish post.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form post-composer" onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="post-content">What&apos;s happening?</label>
        <textarea
          id="post-content"
          data-testid="post-composer-content"
          maxLength={2000}
          rows={3}
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Share something…"
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        data-testid="post-composer-submit"
        disabled={isSubmitting || content.trim() === ''}
      >
        {isSubmitting ? 'Publishing…' : 'Post'}
      </button>
    </form>
  );
}
