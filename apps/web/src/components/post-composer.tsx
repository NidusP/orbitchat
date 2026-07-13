'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/errors';
import { createPost } from '@/lib/api/posts';
import { uploadFile } from '@/lib/api/uploads';
import type { PostWithAuthor } from '@orbitchat/shared-types';
import { useI18n } from '@/contexts/i18n-context';

const MAX_POST_IMAGES = 4;
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface PostComposerProps {
  onCreated: (post: PostWithAuthor) => void;
}

export function PostComposer({ onCreated }: PostComposerProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const [content, setContent] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  pendingImagesRef.current = pendingImages;

  useEffect(() => {
    return () => {
      for (const image of pendingImagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, []);

  const canSubmit = content.trim().length > 0 || pendingImages.length > 0;

  function handlePickImages() {
    fileInputRef.current?.click();
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const remainingSlots = MAX_POST_IMAGES - pendingImages.length;
    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    const nextImages = selectedFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingImages((current) => [...current, ...nextImages]);
    event.target.value = '';
  }

  function handleRemoveImage(imageId: string) {
    setPendingImages((current) => {
      const target = current.find((image) => image.id === imageId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((image) => image.id !== imageId);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const uploadIds: string[] = [];
      for (const image of pendingImages) {
        const uploaded = await uploadFile(image.file, 'post');
        uploadIds.push(uploaded.id);
      }

      const post = await createPost({
        content: content.trim(),
        ...(uploadIds.length > 0 ? { uploadIds } : {}),
      });

      onCreated(post);
      setContent('');
      setPendingImages((current) => {
        for (const image of current) {
          URL.revokeObjectURL(image.previewUrl);
        }
        return [];
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : pendingImages.length > 0
            ? t('postComposer.errors.upload')
            : t('postComposer.errors.publish')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form post-composer" onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="post-content">{t('postComposer.label')}</label>
        <textarea
          id="post-content"
          data-testid="post-composer-content"
          maxLength={2000}
          rows={3}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t('postComposer.placeholder')}
        />
      </div>

      {pendingImages.length > 0 && (
        <ul className="post-composer-previews" aria-label={t('postComposer.previewLabel')}>
          {pendingImages.map((image) => (
            <li key={image.id}>
              <img src={image.previewUrl} alt="" />
              <button
                type="button"
                className="post-composer-remove-image"
                aria-label={t('postComposer.removeImage')}
                onClick={() => handleRemoveImage(image.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="post-composer-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          hidden
          data-testid="post-composer-file-input"
          onChange={handleFilesSelected}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          data-testid="post-composer-add-images"
          disabled={isSubmitting || pendingImages.length >= MAX_POST_IMAGES}
          onClick={handlePickImages}
        >
          {t('postComposer.actions.addImages')}
        </button>
        <span className="text-muted post-composer-image-hint">
          {t('postComposer.imageHint', { count: pendingImages.length, max: MAX_POST_IMAGES })}
        </span>
        <button
          type="submit"
          className="btn btn-primary"
          data-testid="post-composer-submit"
          disabled={isSubmitting || !canSubmit}
        >
          {isSubmitting
            ? pendingImages.length > 0
              ? t('postComposer.actions.uploading')
              : t('postComposer.actions.publishing')
            : t('postComposer.actions.post')}
        </button>
      </div>
    </form>
  );
}
