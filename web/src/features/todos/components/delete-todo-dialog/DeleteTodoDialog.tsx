import { useState } from 'react';
import { Button } from '@/components/ui/button/button';
import { Modal } from '@/components/ui/modal/modal';
import { ApiError } from '@/core/errors/api-error';
import { useDeleteTodo } from '../../hooks/use-delete-todo';
import type { Todo } from '../../models/todo.model';

export interface DeleteTodoDialogProps {
  readonly open: boolean;
  readonly todo: Todo;
  readonly onClose: () => void;
  readonly onSuccess?: () => void;
}

export function DeleteTodoDialog({ open, todo, onClose, onSuccess }: DeleteTodoDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const deleteMutation = useDeleteTodo();
  const isBusy = deleteMutation.isPending;

  const handleClose = () => {
    if (isBusy) {
      return;
    }

    setServerError(null);
    onClose();
  };

  const handleDelete = async () => {
    setServerError(null);

    try {
      await deleteMutation.mutateAsync({
        workspaceId: todo.workspaceId,
        todoId: todo.id
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message);
      } else {
        setServerError('Gagal menghapus tugas. Periksa koneksi Anda.');
      }
    }
  };

  return (
    <Modal open={open} title="Hapus Tugas" onClose={handleClose}>
      <div className="todo-form">
        {serverError ? (
          <div className="todo-form__error" role="alert">
            {serverError}
          </div>
        ) : null}

        <p className="delete-todo-dialog__question">Hapus tugas ini?</p>

        <p className="delete-todo-dialog__target">{todo.title}</p>

        <p className="delete-todo-dialog__warning">
          Tugas akan dihapus dari workspace dan tidak dapat dipulihkan melalui aplikasi.
        </p>

        <div className="todo-form__actions">
          <Button type="button" variant="outline" disabled={isBusy} onClick={handleClose}>
            Batal
          </Button>
          <Button type="button" variant="danger" loading={isBusy} onClick={handleDelete}>
            Hapus Tugas
          </Button>
        </div>
      </div>
    </Modal>
  );
}
