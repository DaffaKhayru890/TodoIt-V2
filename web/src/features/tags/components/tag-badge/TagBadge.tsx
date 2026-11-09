import { FiX } from 'react-icons/fi';
import { joinClasses } from '@/core/utils/join-classes';

export interface TagBadgeProps {
  readonly name: string;
  readonly onRemove?: () => void;
  readonly removeLabel?: string;
  readonly className?: string;
}

export function TagBadge({ name, onRemove, removeLabel, className }: TagBadgeProps) {
  return (
    <span className={joinClasses('tag-badge', className)}>
      <span className="tag-badge__hash" aria-hidden="true">
        #
      </span>
      <span className="tag-badge__name">{name}</span>
      {onRemove ? (
        <button
          type="button"
          className="tag-badge__remove"
          aria-label={removeLabel ?? `Lepas tag ${name}`}
          onClick={onRemove}
        >
          <FiX aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
