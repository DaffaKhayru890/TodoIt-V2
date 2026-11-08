import { useId, useState } from 'react';
import { Button } from '@/components/ui/button/button';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { ApiError } from '@/core/errors/api-error';
import { splitTodosByStatus, type Todo } from '../../models/todo.model';
import { TodoEmptyState } from '../todo-empty-state/TodoEmptyState';
import { TodoItem } from '../todo-item/TodoItem';

export interface TodoListProps {
  readonly workspaceId: string;
  readonly todos: readonly Todo[] | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error?: unknown;
  readonly hasMore?: boolean;
  readonly updatingTodoId?: string | null;
  readonly onRetry: () => void;
  readonly onCreate: () => void;
  readonly onEdit: (todo: Todo) => void;
  readonly onDelete: (todo: Todo) => void;
  readonly onToggleComplete: (todo: Todo) => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Terjadi kesalahan saat memuat daftar tugas. Silakan coba lagi.';
}

function TodoListSkeleton() {
  return (
    <div className="todo-list__skeleton" aria-busy="true" aria-label="Memuat daftar tugas">
      {[0, 1, 2].map((index) => (
        <div className="todo-list__skeleton-item" key={index}>
          <Skeleton variant="avatar" />
          <div className="todo-list__skeleton-lines">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TodoList({
  workspaceId,
  todos,
  isLoading,
  isError,
  error,
  hasMore = false,
  updatingTodoId,
  onRetry,
  onCreate,
  onEdit,
  onDelete,
  onToggleComplete
}: TodoListProps) {
  const activeHeadingId = useId();
  const completedHeadingId = useId();
  const completedPanelId = useId();
  const [completedOpen, setCompletedOpen] = useState(true);

  if (isLoading && !todos) {
    return <TodoListSkeleton />;
  }

  if (isError && !todos) {
    return (
      <div className="todo-list__error" role="alert">
        <h2 className="todo-list__error-title">Gagal memuat tugas</h2>
        <p className="todo-list__error-description">{getErrorMessage(error)}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Coba lagi
        </Button>
      </div>
    );
  }

  const items = todos ?? [];
  const { active, completed } = splitTodosByStatus(items);

  if (items.length === 0 && !isError) {
    return <TodoEmptyState onCreate={onCreate} />;
  }

  return (
    <div className="todo-list">
      {isError ? (
        <div className="todo-list__inline-error" role="alert">
          {getErrorMessage(error)}
          <Button type="button" variant="outline" size="small" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      <section className="todo-list__section" aria-labelledby={activeHeadingId}>
        <div className="todo-list__section-header">
          <h2 className="todo-list__heading" id={activeHeadingId}>
            Tugas Aktif
          </h2>
          <span className="todo-list__count">{active.length}</span>
        </div>

        {active.length === 0 ? (
          <p className="todo-list__active-empty">
            Tidak ada tugas aktif. Semua tugas sudah selesai.
          </p>
        ) : (
          <ul className="todo-list__items" aria-label="Daftar tugas aktif">
            {active.map((todo) => (
              <li key={todo.id}>
                <TodoItem
                  workspaceId={workspaceId}
                  todo={todo}
                  isUpdating={updatingTodoId === todo.id}
                  onToggleComplete={onToggleComplete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {completed.length > 0 ? (
        <section className="todo-list__section">
          <h2 className="todo-list__heading">
            <button
              type="button"
              className="todo-list__toggle"
              aria-expanded={completedOpen}
              aria-controls={completedPanelId}
              onClick={() => setCompletedOpen((value) => !value)}
            >
              <span id={completedHeadingId}>Tugas Selesai</span>
              <span className="todo-list__count">{completed.length}</span>
              <span className="todo-list__toggle-mark" aria-hidden="true">
                {completedOpen ? '−' : '+'}
              </span>
            </button>
          </h2>

          <div id={completedPanelId} hidden={!completedOpen}>
            <ul className="todo-list__items" aria-label="Daftar tugas selesai">
              {completed.map((todo) => (
                <li key={todo.id}>
                  <TodoItem
                    workspaceId={workspaceId}
                    todo={todo}
                    isUpdating={updatingTodoId === todo.id}
                    onToggleComplete={onToggleComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {hasMore ? (
        <p className="todo-list__pagination-note">
          Menampilkan tugas terbaru pada halaman pertama. Navigasi halaman berikutnya akan tersedia
          pada phase berikutnya.
        </p>
      ) : null}
    </div>
  );
}
