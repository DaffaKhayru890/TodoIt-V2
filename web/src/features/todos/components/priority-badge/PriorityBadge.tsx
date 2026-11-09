import { FiFlag } from 'react-icons/fi';
import { joinClasses } from '@/core/utils/join-classes';
import { getPriorityConfig } from '../../models/todo-priority';
import type { TodoPriority } from '../../models/todo.model';

export interface PriorityBadgeProps {
  readonly priority: TodoPriority;
  readonly className?: string;
}

/**
 * Prioritas tidak pernah dibedakan hanya lewat warna: label teks dan ikon
 * selalu tampil agar tetap terbaca oleh pengguna dan screen reader.
 */
export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = getPriorityConfig(priority);

  return (
    <span
      className={joinClasses('priority-badge', `priority-badge--${config.cssModifier}`, className)}
    >
      <FiFlag aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
