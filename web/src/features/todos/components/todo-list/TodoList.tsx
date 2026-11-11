import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button/button';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { ApiError } from '@/core/errors/api-error';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
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
  readonly isFetchingNextPage?: boolean;
  readonly isFetchNextPageError?: boolean;
  readonly loadedPageCount?: number;
  readonly updatingTodoId?: string | null;
  readonly now?: Date | undefined;
  readonly isFiltered?: boolean;
  readonly onClearFilters?: () => void;
  readonly onRetry: () => void;
  readonly onLoadMore?: () => void;
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
  isFetchingNextPage = false,
  isFetchNextPageError = false,
  loadedPageCount = 1,
  updatingTodoId,
  now,
  isFiltered = false,
  onClearFilters,
  onRetry,
  onLoadMore,
  onCreate,
  onEdit,
  onDelete,
  onToggleComplete
}: TodoListProps) {
  const activeHeadingId = useId();
  const completedHeadingId = useId();
  const completedPanelId = useId();
  const [completedOpen, setCompletedOpen] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useIntersectionObserver({
    targetRef: sentinelRef,
    enabled: hasMore && Boolean(onLoadMore) && !isFetchingNextPage && !isFetchNextPageError,
    onIntersect: () => {
      onLoadMore?.();
    }
  });

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
    if (isFiltered) {
      return (
        <div className="todo-list__filtered-empty">
          <h2 className="todo-list__filtered-title">Tidak ada tugas yang cocok</h2>
          <p className="todo-list__filtered-description">
            Tidak ada tugas pada data yang sudah dimuat yang sesuai dengan kombinasi filter aktif.
          </p>
          {onClearFilters ? (
            <Button type="button" variant="outline" onClick={onClearFilters}>
              Hapus semua filter
            </Button>
          ) : null}
        </div>
      );
    }

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
                  now={now}
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
                    now={now}
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

      <div className="todo-list__pagination">
        <p className="visually-hidden" aria-live="polite">
          {isFetchingNextPage ? 'Memuat tugas berikutnya.' : `${items.length} tugas ditampilkan.`}
        </p>

        {isFetchNextPageError ? (
          <div className="todo-list__pagination-error" role="alert">
            <span>Gagal memuat tugas berikutnya.</span>
            {onLoadMore ? (
              <Button type="button" variant="outline" size="small" onClick={onLoadMore}>
                Coba lagi
              </Button>
            ) : null}
          </div>
        ) : null}

        {isFetchingNextPage ? (
          <p className="todo-list__loading-more" aria-live="polite">
            Memuat tugas berikutnya…
          </p>
        ) : null}

        {hasMore && !isFetchingNextPage && !isFetchNextPageError ? (
          <>
            <div ref={sentinelRef} className="todo-list__sentinel" aria-hidden="true" />
            <Button
              type="button"
              variant="outline"
              size="small"
              fullWidth
              onClick={() => {
                onLoadMore?.();
              }}
            >
              Muat lebih banyak
            </Button>
          </>
        ) : null}

        {!hasMore && loadedPageCount > 1 ? (
          <p className="todo-list__end">Semua tugas sudah dimuat.</p>
        ) : null}
      </div>
    </div>
  );
}
