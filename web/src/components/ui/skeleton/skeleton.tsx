import { joinClasses } from '@/core/utils/join-classes';

type SkeletonVariant = 'text' | 'card' | 'avatar' | 'list';

export function Skeleton({ variant = 'text' }: { variant?: SkeletonVariant }) {
  return <div className={joinClasses('skeleton', `skeleton--${variant}`)} aria-hidden="true" />;
}
