import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { Button } from '@/components/ui/button/button';
import { ApiError } from '@/core/errors/api-error';
import { useCompleteTodo } from '../../hooks/use-complete-todo';
import { useReopenTodo } from '../../hooks/use-reopen-todo';
import { useWorkspaceTodos } from '../../hooks/use-workspace-todos';
import { isTodoCompleted, type Todo } from '../../models/todo.model';
import { CreateTodoDialog } from '../create-todo-dialog/CreateTodoDialog';
import { DeleteTodoDialog } from '../delete-todo-dialog/DeleteTodoDialog';
import { EditTodoDialog } from '../edit-todo-dialog/EditTodoDialog';
import { TodoList } from '../todo-list/TodoList';

export interface WorkspaceTodoSectionProps {
  readonly workspaceId: string;
  readonly workspaceName: string;
}

function getMutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Menghubungkan workspace context dengan fitur Todo. WorkspacePage hanya
 * merender komponen ini; seluruh state query, dialog, dan feedback Todo tetap
 * berada di feature todos.
 */
export function WorkspaceTodoSection({ workspaceId, workspaceName }: WorkspaceTodoSectionProps) {
  const todosQuery = useWorkspaceTodos(workspaceId);
  const completeMutation = useCompleteTodo();
  const reopenMutation = useReopenTodo();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const [updatingTodoId, setUpdatingTodoId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearFeedback = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleToggleComplete = async (todo: Todo) => {
    if (updatingTodoId !== null) {
      return;
    }

    clearFeedback();
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
        getMutationErrorMessage(error, 'Gagal memperbarui status tugas. Silakan coba lagi.')
      );
    } finally {
      setUpdatingTodoId(null);
    }
  };

  return (
    <section className="todo-workspace" aria-label="Daftar tugas workspace">
      <header className="todo-workspace__header">
        <div className="todo-workspace__heading-group">
          <h2 className="todo-workspace__title">Tugas</h2>
          <p className="todo-workspace__description">
            Kelola pekerjaan di workspace ini. Tugas aktif dan selesai dipisahkan otomatis.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          leadingIcon={<FiPlus aria-hidden="true" />}
          onClick={() => {
            clearFeedback();
            setCreateOpen(true);
          }}
        >
          Buat Tugas
        </Button>
      </header>

      {successMessage ? (
        <div className="todo-workspace__feedback todo-workspace__feedback--success" role="status">
          <span>{successMessage}</span>
          <button
            type="button"
            className="todo-workspace__feedback-close"
            aria-label="Tutup notifikasi"
            onClick={() => setSuccessMessage(null)}
          >
            Tutup
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="todo-workspace__feedback todo-workspace__feedback--error" role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="todo-workspace__feedback-close"
            aria-label="Tutup pesan kesalahan"
            onClick={() => setErrorMessage(null)}
          >
            Tutup
          </button>
        </div>
      ) : null}

      <TodoList
        workspaceId={workspaceId}
        todos={todosQuery.data?.items}
        isLoading={todosQuery.isLoading}
        isError={todosQuery.isError}
        error={todosQuery.error}
        hasMore={todosQuery.data?.pagination.hasMore ?? false}
        updatingTodoId={updatingTodoId}
        onRetry={() => {
          void todosQuery.refetch();
        }}
        onCreate={() => {
          clearFeedback();
          setCreateOpen(true);
        }}
        onEdit={(todo) => {
          clearFeedback();
          setEditing(todo);
        }}
        onDelete={(todo) => {
          clearFeedback();
          setDeleting(todo);
        }}
        onToggleComplete={(todo) => {
          void handleToggleComplete(todo);
        }}
      />

      <CreateTodoDialog
        open={createOpen}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setSuccessMessage('Tugas berhasil dibuat.');
        }}
      />

      {editing ? (
        <EditTodoDialog
          open
          todo={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
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
