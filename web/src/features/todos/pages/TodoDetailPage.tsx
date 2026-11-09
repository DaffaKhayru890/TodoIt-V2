import { useMemo, useState } from 'react';
import { FiArrowLeft, FiCheck, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router';
import { paths } from '@/app/router/route-paths';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';
import { Badge } from '@/components/ui/badge/badge';
import { Button } from '@/components/ui/button/button';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { ApiError } from '@/core/errors/api-error';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { LabelBadge } from '@/features/labels/components/label-badge/LabelBadge';
import { useTodoReminders } from '@/features/reminders/hooks/use-todo-reminders';
import { formatReminderOffset } from '@/features/reminders/models/reminder.model';
import { TagBadge } from '@/features/tags/components/tag-badge/TagBadge';
import { useWorkspace } from '@/features/workspaces/hooks/use-workspace';
import { DeleteTodoDialog } from '../components/delete-todo-dialog/DeleteTodoDialog';
import { EditTodoDialog } from '../components/edit-todo-dialog/EditTodoDialog';
import { PriorityBadge } from '../components/priority-badge/PriorityBadge';
import { useCompleteTodo } from '../hooks/use-complete-todo';
import { useReopenTodo } from '../hooks/use-reopen-todo';
import { useTodo } from '../hooks/use-todo';
import { getTodoStatusLabel, isTodoCompleted, type Todo } from '../models/todo.model';
import { formatDateTime } from '../utils/date-format';
import { getDueDateStatus } from '../utils/due-date';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date);
}

function classifyError(error: unknown): 'not-found' | 'forbidden' | 'error' {
  if (error instanceof ApiError) {
    if (
      error.status === 404 ||
      error.code === 'TODO_NOT_FOUND' ||
      error.code === 'WORKSPACE_ACCESS_DENIED'
    ) {
      return 'not-found';
    }

    if (error.status === 403 || error.code === 'WORKSPACE_PERMISSION_DENIED') {
      return 'forbidden';
    }
  }

  return 'error';
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Terjadi kesalahan saat memuat detail tugas.';
}

export function TodoDetailPage() {
  const { workspaceId = '', todoId = '' } = useParams<{
    workspaceId: string;
    todoId: string;
  }>();
  const navigate = useNavigate();

  const todoQuery = useTodo(workspaceId, todoId);
  const workspaceQuery = useWorkspace(workspaceId);
  const remindersQuery = useTodoReminders(workspaceId, todoId);
  const completeMutation = useCompleteTodo();
  const reopenMutation = useReopenTodo();

  // Clock stabil per mount untuk status tenggat yang deterministik.
  const now = useMemo(() => new Date(), []);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const todo = todoQuery.data;
  useDocumentTitle(todo?.title ?? 'Detail tugas');

  if (todoQuery.isLoading) {
    return (
      <div
        className="todo-detail todo-detail--loading"
        aria-busy="true"
        aria-label="Memuat detail tugas"
      >
        <Skeleton variant="text" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  const backToWorkspace = () => navigate(paths.workspace(workspaceId));

  if (todoQuery.isError || !todo) {
    const kind = classifyError(todoQuery.error);
    const title =
      kind === 'not-found'
        ? 'Tugas tidak ditemukan'
        : kind === 'forbidden'
          ? 'Akses ditolak'
          : 'Gagal memuat tugas';
    const description =
      kind === 'not-found'
        ? 'Tugas ini tidak ada, sudah dihapus, atau bukan bagian dari workspace yang Anda buka.'
        : kind === 'forbidden'
          ? 'Anda tidak memiliki hak untuk melihat tugas ini.'
          : getErrorMessage(todoQuery.error);

    return (
      <div className="todo-detail">
        <EmptyState
          title={title}
          description={description}
          action={
            kind === 'error' ? (
              <Button type="button" variant="primary" onClick={() => todoQuery.refetch()}>
                Coba lagi
              </Button>
            ) : (
              <Button type="button" variant="primary" onClick={backToWorkspace}>
                Kembali ke workspace
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (todo.workspaceId !== workspaceId) {
    return (
      <div className="todo-detail">
        <EmptyState
          title="Tugas tidak ditemukan"
          description="Tugas ini bukan bagian dari workspace yang Anda buka."
          action={
            <Button type="button" variant="primary" onClick={backToWorkspace}>
              Kembali ke workspace
            </Button>
          }
        />
      </div>
    );
  }

  const completed = isTodoCompleted(todo);
  const dueStatus = getDueDateStatus(todo.dueAt, now, completed);
  const scheduledReminders = remindersQuery.data?.items ?? [];

  const handleToggle = async () => {
    setActionError(null);
    setSuccessMessage(null);
    setIsToggling(true);

    try {
      if (completed) {
        await reopenMutation.mutateAsync({ workspaceId, todoId });
        setSuccessMessage('Tugas berhasil dibuka kembali.');
      } else {
        await completeMutation.mutateAsync({ workspaceId, todoId });
        setSuccessMessage('Tugas ditandai selesai.');
      }
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : 'Gagal memperbarui status tugas. Silakan coba lagi.'
      );
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="todo-detail">
      <Link className="todo-detail__back" to={paths.workspace(workspaceId)}>
        <FiArrowLeft aria-hidden="true" />
        Kembali ke workspace
      </Link>

      {successMessage ? (
        <div className="todo-detail__feedback todo-detail__feedback--success" role="status">
          {successMessage}
        </div>
      ) : null}

      {actionError ? (
        <div className="todo-detail__feedback todo-detail__feedback--error" role="alert">
          {actionError}
        </div>
      ) : null}

      <header className="todo-detail__header">
        <div className="todo-detail__heading-group">
          <div className="todo-detail__title-row">
            <h1 className="todo-detail__title">{todo.title}</h1>
            <Badge
              variant={completed ? 'success' : todo.status === 'cancelled' ? 'danger' : 'neutral'}
            >
              {getTodoStatusLabel(todo.status)}
            </Badge>
          </div>
          <p className="todo-detail__workspace">
            Workspace:{' '}
            <Link to={paths.workspace(workspaceId)}>
              {workspaceQuery.data?.name ?? workspaceId}
            </Link>
          </p>
        </div>

        <div className="todo-detail__actions">
          <Button
            type="button"
            variant={completed ? 'secondary' : 'primary'}
            leadingIcon={<FiCheck aria-hidden="true" />}
            loading={isToggling}
            disabled={isToggling}
            onClick={() => {
              void handleToggle();
            }}
          >
            {completed ? 'Buka Kembali' : 'Tandai Selesai'}
          </Button>
          <Button
            type="button"
            variant="outline"
            leadingIcon={<FiEdit2 aria-hidden="true" />}
            onClick={() => {
              setSuccessMessage(null);
              setActionError(null);
              setEditOpen(true);
            }}
          >
            Ubah
          </Button>
          <Button
            type="button"
            variant="danger"
            leadingIcon={<FiTrash2 aria-hidden="true" />}
            onClick={() => {
              setSuccessMessage(null);
              setActionError(null);
              setDeleteOpen(true);
            }}
          >
            Hapus
          </Button>
        </div>
      </header>

      <section className="todo-detail__panel" aria-labelledby="todo-description-title">
        <h2 className="todo-detail__panel-title" id="todo-description-title">
          Deskripsi
        </h2>
        <p className="todo-detail__description">
          {todo.description || 'Tidak ada deskripsi untuk tugas ini.'}
        </p>
      </section>

      <section className="todo-detail__panel" aria-labelledby="todo-organization-title">
        <h2 className="todo-detail__panel-title" id="todo-organization-title">
          Organisasi
        </h2>
        <dl className="todo-detail__meta-list">
          <div>
            <dt>Label</dt>
            <dd>
              {todo.label ? (
                <LabelBadge name={todo.label.name} color={todo.label.color} />
              ) : (
                'Tanpa label'
              )}
            </dd>
          </div>
          <div>
            <dt>Tag</dt>
            <dd>
              {todo.tags.length > 0 ? (
                <span className="todo-detail__badges">
                  {todo.tags.map((tag) => (
                    <TagBadge key={tag.id} name={tag.name} />
                  ))}
                </span>
              ) : (
                'Tanpa tag'
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="todo-detail__panel" aria-labelledby="todo-priority-title">
        <h2 className="todo-detail__panel-title" id="todo-priority-title">
          Prioritas
        </h2>
        <PriorityBadge priority={todo.priority} />
      </section>

      <section className="todo-detail__panel" aria-labelledby="todo-due-title">
        <h2 className="todo-detail__panel-title" id="todo-due-title">
          Tenggat Waktu
        </h2>
        {todo.dueAt ? (
          <p className="todo-detail__description">
            <strong>{formatDateTime(todo.dueAt)}</strong>{' '}
            <span
              className={
                dueStatus === 'overdue'
                  ? 'todo-detail__due todo-detail__due--overdue'
                  : dueStatus === 'today'
                    ? 'todo-detail__due todo-detail__due--today'
                    : 'todo-detail__due'
              }
            >
              {dueStatus === 'overdue'
                ? 'Terlambat'
                : dueStatus === 'today'
                  ? 'Jatuh tempo hari ini'
                  : dueStatus === 'completed'
                    ? 'Tugas selesai'
                    : 'Akan datang'}
            </span>
          </p>
        ) : (
          <p className="todo-detail__description">Tidak ada tenggat waktu.</p>
        )}
      </section>

      <section className="todo-detail__panel" aria-labelledby="todo-reminder-title">
        <h2 className="todo-detail__panel-title" id="todo-reminder-title">
          Pengingat
        </h2>
        {remindersQuery.isLoading ? (
          <p className="todo-detail__description">Memuat pengingat...</p>
        ) : null}
        {remindersQuery.isError ? (
          <p className="todo-detail__description" role="alert">
            Gagal memuat pengingat. Coba muat ulang halaman.
          </p>
        ) : null}
        {!remindersQuery.isLoading && !remindersQuery.isError && scheduledReminders.length === 0 ? (
          <p className="todo-detail__description">
            Tidak ada pengingat aktif. Pengingat hanya menyimpan jadwal; pengiriman notifikasi
            bergantung pada Notification Engine backend.
          </p>
        ) : null}
        {scheduledReminders.length > 0 ? (
          <ul className="todo-detail__reminders">
            {scheduledReminders.map((reminder) => (
              <li key={reminder.id}>
                {reminder.triggerType === 'before_due'
                  ? formatReminderOffset(reminder.offsetMinutes)
                  : 'Waktu absolut'}
                {reminder.effectiveAt ? ` · ${formatDateTime(reminder.effectiveAt)}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="todo-detail__panel" aria-labelledby="todo-status-title">
        <h2 className="todo-detail__panel-title" id="todo-status-title">
          Status Penyelesaian
        </h2>
        <p className="todo-detail__description">
          {completed
            ? 'Tugas ini sudah selesai.'
            : 'Tugas ini masih aktif dan belum ditandai selesai.'}
        </p>
        {completed && todo.completedAt ? (
          <p className="todo-detail__meta">
            Diselesaikan pada: <strong>{formatDate(todo.completedAt)}</strong>
          </p>
        ) : null}
      </section>

      <section className="todo-detail__panel" aria-labelledby="todo-meta-title">
        <h2 className="todo-detail__panel-title" id="todo-meta-title">
          Informasi
        </h2>
        <dl className="todo-detail__meta-list">
          <div>
            <dt>Dibuat pada</dt>
            <dd>{formatDate(todo.createdAt)}</dd>
          </div>
          <div>
            <dt>Terakhir diperbarui</dt>
            <dd>{formatDate(todo.updatedAt)}</dd>
          </div>
          <div>
            <dt>Workspace ID</dt>
            <dd className="todo-detail__mono">{todo.workspaceId}</dd>
          </div>
        </dl>
      </section>

      {editOpen ? (
        <EditTodoDialog
          open
          todo={todo}
          onClose={() => setEditOpen(false)}
          onSuccess={(updated: Todo, warning?: string) => {
            if (warning) {
              setActionError(warning);
              return;
            }

            setSuccessMessage(`Perubahan "${updated.title}" berhasil disimpan.`);
          }}
        />
      ) : null}

      {deleteOpen ? (
        <DeleteTodoDialog
          open
          todo={todo}
          onClose={() => setDeleteOpen(false)}
          onSuccess={() => {
            navigate(paths.workspace(workspaceId), { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}
