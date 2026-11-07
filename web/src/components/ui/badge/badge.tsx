import type { ReactNode } from 'react';
import { joinClasses } from '@/core/utils/join-classes';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export function Badge({
  variant = 'default',
  children
}: {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  return <span className={joinClasses('badge', `badge--${variant}`)}>{children}</span>;
}
