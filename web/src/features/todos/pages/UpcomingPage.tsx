import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { paths } from '@/app/router/route-paths';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';
import { Button } from '@/components/ui/button/button';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { ApiError } from '@/core/errors/api-error';
import { useWorkspace } from '@/features/workspaces/hooks/use-workspace';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { DeleteTodoDialog } from '../components/delete-todo-dialog/DeleteTodoDialog';
import { EditTodoDialog } from '../components/edit-todo-dialog/EditTodoDialog';
import { ProductivityEmptyState } from '../components/productivity-empty-state/ProductivityEmptyState';
import { TodoItem } from '../components/todo-item/TodoItem';
import { useCompleteTodo } from '../hooks/use-complete-todo';
import { useReopenTodo } from '../hooks/use-reopen-todo';
import { useUpcomingTodos } from '../hooks/use-upcoming-todos';
import { isTodoCompleted, type Todo } from '../models/todo.model';
import { groupTodosByDueDate } from '../utils/due-date';

/** Batas maksimum backend: 30 hari kalender setelah hari ini. */
const UPCOMING_DAYS = 30;

function getTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function UpcomingPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const workspaceQuery = useWorkspace(workspaceId);
  const timezone = useMemo(() => getTimezone(), []);
  const now = useMemo(() => new Date(), []);
  const upcomingParams = timezone ? { days: UPCOMING_DAYS, timezone } : { days: UPCOMING_DAYS };
  const todosQuery = useUpcomingTodos(workspaceId, upcomingParams);
  const completeMutation = useCompleteTodo();
  const reopenMutation = useReopenTodo();

  const [editing, setEditing] = useState<Todo | null>(null);
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const [updatingTodoId, setUpdatingTodoId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useDocumentTitle('Upcoming');

  const handleToggleComplete = async (todo: Todo) => {
    if (updatingTodoId !== null) {
      return;
    }

    setSuccessMessage(null);
    setErrorMessage(null);
    setUpdatingTodoId(todo.id);

    try {
      if (isTodoCompleted(todo)) {
        await reopenMutation.mutateAsync({ workspaceId, todoId: todo.id });
        setSuccessMessage('Tugas berhasil dibuka kembali.');
      } else {
        await completeMutation.mutateAsync({ workspaceId, todoId: todo.id });
        setSuccessMessage('Tugas ditandai selesai.');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Gagal memperbarui status tugas. Silakan coba lagi.'
      );
    } finally {
      setUpdatingTodoId(null);
    }
  };

  const items = todosQuery.data?.items ?? [];
  const groups = groupTodosByDueDate(
    items.filter((todo) => todo.dueAt !== null),
    now
  );

  return (
    <section className="productivity-page" aria-labelledby="upcoming-title">
      <header className="productivity-page__header">
        <div className="productivity-page__heading">
          <h1 className="productivity-page__title" id="upcoming-title">
            Upcoming
          </h1>
          <p className="productivity-page__date">
            {UPCOMING_DAYS} hari ke depan menurut {timezone ?? 'zona waktu lokal'}
          </p>
          <p className="productivity-page__context">
            Workspace:{' '}
            <Link to={paths.workspace(workspaceId)}>
              {workspaceQuery.data?.name ?? workspaceId}
            </Link>
          </p>
        </div>
        <div className="productivity-page__counts" aria-label="Ringkasan tugas mendatang">
          <span className="productivity-page__count">
            <strong>{items.length}</strong> tugas
          </span>
        </div>
      </header>

      <p className="productivity-page__note">
        Tugas tanpa tenggat tidak dimasukkan ke Upcoming. Tugas terlambat dipisahkan:{' '}
        <Link to={`${paths.workspace(workspaceId)}?due=overdue`}>lihat tugas terlambat</Link>.
      </p>

      {successMessage ? (
        <div
          className="productivity-page__feedback productivity-page__feedback--success"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div
          className="productivity-page__feedback productivity-page__feedback--error"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      {todosQuery.isLoading ? (
        <div
          className="productivity-page__skeleton"
          aria-busy="true"
          aria-label="Memuat tugas mendatang"
        >
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : null}

      {todosQuery.isError ? (
        <EmptyState
          title="Gagal memuat tugas mendatang"
          description={
            todosQuery.error instanceof ApiError
              ? todosQuery.error.message
              : 'Terjadi kesalahan saat memuat Upcoming.'
          }
          action={
            <Button type="button" variant="primary" onClick={() => todosQuery.refetch()}>
              Coba lagi
            </Button>
          }
        />
      ) : null}

      {!todosQuery.isLoading && !todosQuery.isError && groups.length === 0 ? (
        <ProductivityEmptyState
          variant="upcoming"
          title="Nothing scheduled ahead."
          description="Tidak ada deadline mendatang untuk saat ini."
        />
      ) : null}

      {!todosQuery.isLoading && !todosQuery.isError && groups.length > 0 ? (
        <div className="productivity-page__sections">
          {groups.map((group) => (
            <section
              className="productivity-page__section"
              key={group.key}
              aria-labelledby={`upcoming-group-${group.key}`}
            >
              <div className="productivity-page__section-header">
                <h2 className="productivity-page__section-title" id={`upcoming-group-${group.key}`}>
                  {group.label}
                </h2>
                <span className="productivity-page__group-count">{group.todos.length}</span>
              </div>
              <ul className="productivity-page__list" aria-label={`Tugas ${group.label}`}>
                {group.todos.map((todo) => (
                  <li key={todo.id}>
                    <TodoItem
                      workspaceId={workspaceId}
                      todo={todo}
                      now={now}
                      isUpdating={updatingTodoId === todo.id}
                      onToggleComplete={(item) => {
                        void handleToggleComplete(item);
                      }}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {editing ? (
        <EditTodoDialog
          open
          todo={editing}
          onClose={() => setEditing(null)}
          onSuccess={(_todo, warning) => {
            if (warning) {
              setErrorMessage(warning);
              return;
            }

            setSuccessMessage('Perubahan tugas berhasil disimpan.');
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteTodoDialog
          open
          todo={deleting}
          onClose={() => setDeleting(null)}
          onSuccess={() => {
            setSuccessMessage('Tugas berhasil dihapus.');
          }}
        />
      ) : null}
    </section>
  );
}
