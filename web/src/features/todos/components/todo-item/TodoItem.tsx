import { FiMoreHorizontal } from 'react-icons/fi';
import { Link } from 'react-router';
import { paths } from '@/app/router/route-paths';
import { Badge } from '@/components/ui/badge/badge';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { Dropdown, DropdownItem } from '@/components/ui/dropdown/dropdown';
import { joinClasses } from '@/core/utils/join-classes';
import { getTodoStatusLabel, isTodoCompleted, type Todo } from '../../models/todo.model';

export interface TodoItemProps {
  readonly workspaceId: string;
  readonly todo: Todo;
  readonly onToggleComplete: (todo: Todo) => void;
  readonly onEdit: (todo: Todo) => void;
  readonly onDelete: (todo: Todo) => void;
  readonly isUpdating?: boolean;
}

export function TodoItem({
  workspaceId,
  todo,
  onToggleComplete,
  onEdit,
  onDelete,
  isUpdating = false
}: TodoItemProps) {
  const completed = isTodoCompleted(todo);
  const toggleLabel = completed
    ? `Buka kembali tugas ${todo.title}`
    : `Tandai tugas ${todo.title} sebagai selesai`;

  return (
    <article
      className={joinClasses('todo-item', completed && 'todo-item--completed')}
      aria-busy={isUpdating || undefined}
    >
      <div className="todo-item__checkbox">
        <Checkbox
          label={toggleLabel}
          hideLabel
          checked={completed}
          disabled={isUpdating}
          onChange={() => onToggleComplete(todo)}
        />
      </div>

      <Link
        className="todo-item__content"
        to={paths.todo(workspaceId, todo.id)}
        aria-label={`Buka detail tugas ${todo.title}`}
      >
        <h3 className="todo-item__title">{todo.title}</h3>

        {todo.description ? <p className="todo-item__description">{todo.description}</p> : null}

        {todo.status !== 'todo' ? (
          <span className="todo-item__status">
            <Badge variant={completed ? 'success' : 'neutral'}>
              {getTodoStatusLabel(todo.status)}
            </Badge>
          </span>
        ) : null}
      </Link>

      <div className="todo-item__actions">
        <Dropdown
          label={<FiMoreHorizontal aria-hidden="true" />}
          ariaLabel={`Aksi untuk ${todo.title}`}
          placement="down"
        >
          <DropdownItem onSelect={() => onEdit(todo)}>Ubah</DropdownItem>
          <DropdownItem onSelect={() => onDelete(todo)}>Hapus</DropdownItem>
        </Dropdown>
      </div>
    </article>
  );
}
