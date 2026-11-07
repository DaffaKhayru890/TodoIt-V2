import type { ReactNode } from 'react';
import { EmptyIllustration } from '@/components/feedback/empty-state/empty-illustration';
import { joinClasses } from '@/core/utils/join-classes';

export function EmptyState({
  title,
  description,
  illustration,
  action,
  secondaryAction,
  compact = false
}: {
  title: string;
  description: string;
  illustration?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={joinClasses('empty-state', compact && 'empty-state--compact')}>
      <div className="empty-state__art">{illustration ?? <EmptyIllustration />}</div>
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__description">{description}</p>
      {action || secondaryAction ? (
        <div className="empty-state__actions">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </section>
  );
}
