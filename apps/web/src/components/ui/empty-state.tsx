import Link from 'next/link';
import type { ReactNode } from 'react';

type EmptyStateActionProps =
  | {
      actionLabel?: undefined;
      href?: never;
      onAction?: never;
    }
  | {
      actionLabel: string;
      href: string;
      onAction?: never;
    }
  | {
      actionLabel: string;
      onAction: () => void;
      href?: never;
    };

type EmptyStateProps = {
  title: string;
  description: string;
  className?: string;
  children?: ReactNode;
} & EmptyStateActionProps;

export function EmptyState({
  title,
  description,
  actionLabel,
  href,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  const rootClassName = className ? `card empty-state ${className}` : 'card empty-state';

  return (
    <section className={rootClassName}>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-description">{description}</p>

      {(actionLabel || children) && (
        <div className="empty-state-actions">
          {actionLabel && href && (
            <Link href={href} className="btn btn-primary">
              {actionLabel}
            </Link>
          )}

          {actionLabel && onAction && (
            <button type="button" className="btn btn-primary" onClick={onAction}>
              {actionLabel}
            </button>
          )}

          {children}
        </div>
      )}
    </section>
  );
}
