import { FiAlertTriangle, FiCalendar } from 'react-icons/fi';
import { LabelBadge } from '@/features/labels/components/label-badge/LabelBadge';
import { TagBadge } from '@/features/tags/components/tag-badge/TagBadge';
import { joinClasses } from '@/core/utils/join-classes';
import type { Todo } from '../../models/todo.model';
import { formatDate, formatDateTime } from '../../utils/date-format';
import { formatDueDateLabel, getDueDateStatus } from '../../utils/due-date';
import { PriorityBadge } from '../priority-badge/PriorityBadge';

export interface TodoMetadataProps {
  readonly todo: Todo;
  /** Clock injection agar status tenggat dapat diuji deterministik. */
  readonly now: Date;
  readonly className?: string;
}

export function TodoMetadata({ todo, now, className }: TodoMetadataProps) {
  const dueStatus = getDueDateStatus(todo.dueAt, now, todo.status === 'completed');

  return (
    <div className={joinClasses('todo-metadata', className)}>
      {todo.label ? (
        <span className="todo-metadata__group" aria-label="Label tugas">
          <LabelBadge name={todo.label.name} color={todo.label.color} />
        </span>
      ) : null}

      {todo.tags.length > 0 ? (
        <span className="todo-metadata__group" aria-label="Tag tugas">
          {todo.tags.map((tag) => (
            <TagBadge key={tag.id} name={tag.name} />
          ))}
        </span>
      ) : null}

      <PriorityBadge priority={todo.priority} />

      {todo.dueAt ? (
        <span className={joinClasses('todo-metadata__due', `todo-metadata__due--${dueStatus}`)}>
          {dueStatus === 'overdue' ? (
            <FiAlertTriangle aria-hidden="true" />
          ) : (
            <FiCalendar aria-hidden="true" />
          )}
          <span>
            {dueStatus === 'overdue'
              ? `Terlambat · ${formatDate(todo.dueAt)}`
              : `Tenggat: ${formatDueDateLabel(todo.dueAt, now)}`}
          </span>
          {dueStatus === 'today' ? (
            <span className="todo-metadata__due-time">({formatDateTime(todo.dueAt)})</span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
