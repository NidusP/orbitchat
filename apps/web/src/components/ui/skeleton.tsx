import type { CSSProperties, HTMLAttributes } from 'react';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
};

export function Skeleton({ className, style, width, height, ...rest }: SkeletonProps) {
  const nextClassName = className ? `skeleton ${className}` : 'skeleton';

  return (
    <div
      className={nextClassName}
      style={{
        width,
        height,
        ...style,
      }}
      {...rest}
    />
  );
}

type PostCardSkeletonProps = {
  count?: number;
};

export function PostCardSkeleton({ count = 3 }: PostCardSkeletonProps) {
  return (
    <div className="post-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="post-card post-card-skeleton" key={`post-skeleton-${index}`}>
          <div className="post-card-header">
            <Skeleton width="48%" height={20} />
            <Skeleton width={68} height={16} />
          </div>
          <Skeleton width="100%" height={14} />
          <Skeleton width="86%" height={14} />
          <Skeleton width="52%" height={14} />
          <div className="post-card-footer">
            <Skeleton width={96} height={30} />
            <Skeleton width={112} height={30} />
          </div>
        </article>
      ))}
    </div>
  );
}

type ConversationListSkeletonProps = {
  count?: number;
};

export function ConversationListSkeleton({ count = 4 }: ConversationListSkeletonProps) {
  return (
    <ul className="conversation-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={`conversation-skeleton-${index}`}>
          <div className="conversation-list-item conversation-list-item-skeleton">
            <div className="conversation-list-main">
              <Skeleton width="46%" height={18} />
              <Skeleton width={64} height={14} />
            </div>
            <div className="conversation-list-preview-row">
              <Skeleton width="72%" height={14} />
              <Skeleton width={24} height={20} className="conversation-skeleton-badge" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
