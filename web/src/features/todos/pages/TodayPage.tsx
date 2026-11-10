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
import { useTodayTodos } from '../hooks/use-today-todos';
import { isTodoCompleted, splitTodosByStatus, type Todo } from '../models/todo.model';
import { formatLongDate } from '../utils/date-format';

function getTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function TodayPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const workspaceQuery = useWorkspace(workspaceId);
  const timezone = useMemo(() => getTimezone(), []);
  const now = useMemo(() => new Date(), []);
  const todayParams = timezone ? { includeCompleted: true, timezone } : { includeCompleted: true };
  const todosQuery = useTodayTodos(workspaceId, todayParams);
  const completeMutation = useCompleteTodo();
  const reopenMutation = useReopenTodo();

  const [editing, setEditing] = useState<Todo | null>(null);
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const [updatingTodoId, setUpdatingTodoId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useDocumentTitle('Today');

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
  const { active, completed } = splitTodosByStatus(items);

  return (
    <section className="productivity-page" aria-labelledby="today-title">
      <header className="productivity-page__header">
        <div className="productivity-page__heading">
          <h1 className="productivity-page__title" id="today-title">
            Today
          </h1>
          <p className="productivity-page__date">{formatLongDate(now)}</p>
          <p className="productivity-page__context">
            Workspace:{' '}
            <Link to={paths.workspace(workspaceId)}>
              {workspaceQuery.data?.name ?? workspaceId}
            </Link>
          </p>
        </div>
        <div className="productivity-page__counts" aria-label="Ringkasan tugas hari ini">
          <span className="productivity-page__count">
            <strong>{active.length}</strong> aktif
          </span>
          <span className="productivity-page__count">
            <strong>{completed.length}</strong> selesai
          </span>
        </div>
      </header>

      <p className="productivity-page__note">
        Daftar ini memakai tanggal kalender lokal perangkat Anda ({timezone ?? 'zona waktu lokal'}).
        Tugas yang terlambat tidak dimasukkan ke Today.
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
          aria-label="Memuat tugas hari ini"
        >
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : null}

      {todosQuery.isError ? (
        <EmptyState
          title="Gagal memuat tugas hari ini"
          description={
            todosQuery.error instanceof ApiError
              ? todosQuery.error.message
              : 'Terjadi kesalahan saat memuat Today.'
          }
          action={
            <Button type="button" variant="primary" onClick={() => todosQuery.refetch()}>
              Coba lagi
            </Button>
          }
        />
      ) : null}

      {!todosQuery.isLoading && !todosQuery.isError && items.length === 0 ? (
        <ProductivityEmptyState
          variant="today"
          title="You're all clear for today!"
          description="Tidak ada tugas yang jatuh tempo hari ini. Nikmati harimu atau mulai rencanakan besok."
        />
      ) : null}

      {!todosQuery.isLoading && !todosQuery.isError && items.length > 0 ? (
        <div className="productivity-page__sections">
          <section className="productivity-page__section" aria-labelledby="today-due-title">
            <h2 className="productivity-page__section-title" id="today-due-title">
              Jatuh Tempo Hari Ini
            </h2>
            {active.length === 0 ? (
              <p className="productivity-page__section-empty">
                Semua tugas yang jatuh tempo hari ini sudah selesai.
              </p>
            ) : (
              <ul className="productivity-page__list" aria-label="Tugas jatuh tempo hari ini">
                {active.map((todo) => (
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
            )}
          </section>

          {completed.length > 0 ? (
            <section className="productivity-page__section" aria-labelledby="today-completed-title">
              <h2 className="productivity-page__section-title" id="today-completed-title">
                Selesai Hari Ini
              </h2>
              <ul className="productivity-page__list" aria-label="Tugas selesai hari ini">
                {completed.map((todo) => (
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
          ) : null}
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
