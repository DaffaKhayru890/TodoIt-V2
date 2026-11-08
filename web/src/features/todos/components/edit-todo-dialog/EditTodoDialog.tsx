import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Modal } from '@/components/ui/modal/modal';
import { ApiError } from '@/core/errors/api-error';
import { DiscardChanges } from '@/features/workspaces/components/discard-changes/DiscardChanges';
import { useUpdateTodo } from '../../hooks/use-update-todo';
import type { Todo } from '../../models/todo.model';
import { updateTodoSchema, type UpdateTodoFormValues } from '../../schemas/update-todo.schema';
import { mapTodoValidationDetails } from '../../utils/api-validation';
import { TodoFormFields } from '../todo-form-fields/TodoFormFields';

export interface EditTodoDialogProps {
  readonly open: boolean;
  readonly todo: Todo;
  readonly onClose: () => void;
  readonly onSuccess?: (todo: Todo) => void;
}

export function EditTodoDialog({ open, todo, onClose, onSuccess }: EditTodoDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const updateMutation = useUpdateTodo();
  const isBusy = updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<UpdateTodoFormValues>({
    resolver: zodResolver(updateTodoSchema),
    defaultValues: {
      title: todo.title,
      description: todo.description ?? ''
    }
  });

  useEffect(() => {
    if (open) {
      reset({
        title: todo.title,
        description: todo.description ?? ''
      });
    }
  }, [open, todo, reset]);

  const closeNow = () => {
    reset();
    setServerError(null);
    setConfirmDiscard(false);
    onClose();
  };

  const requestClose = () => {
    if (isSubmitting || isBusy) {
      return;
    }

    if (confirmDiscard) {
      setConfirmDiscard(false);
      return;
    }

    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }

    closeNow();
  };

  const onSubmit = async (values: UpdateTodoFormValues) => {
    setServerError(null);

    const nextTitle = values.title.trim();
    const nextDescription = values.description?.trim() || null;
    const input: { title?: string; description?: string | null } = {};

    if (nextTitle !== todo.title) {
      input.title = nextTitle;
    }

    if (nextDescription !== todo.description) {
      input.description = nextDescription;
    }

    // Isian hanya berbeda karena spasi: tidak ada perubahan bermakna untuk
    // dikirim ke backend.
    if (input.title === undefined && input.description === undefined) {
      closeNow();
      return;
    }

    try {
      const updated = await updateMutation.mutateAsync({
        workspaceId: todo.workspaceId,
        todoId: todo.id,
        input: input
      });
      closeNow();
      onSuccess?.(updated);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = mapTodoValidationDetails(error.details, ['title', 'description']);

        if (fieldErrors.title) {
          setError('title', { type: 'server', message: fieldErrors.title });
        }
        if (fieldErrors.description) {
          setError('description', { type: 'server', message: fieldErrors.description });
        }
        if (!fieldErrors.title && !fieldErrors.description) {
          setServerError(error.message);
        }
      } else {
        setServerError('Gagal memperbarui tugas. Periksa koneksi Anda.');
      }
    }
  };

  return (
    <Modal open={open} title="Ubah Tugas" onClose={requestClose}>
      {confirmDiscard ? (
        <DiscardChanges
          onKeepEditing={() => setConfirmDiscard(false)}
          onDiscard={closeNow}
          busy={isSubmitting || isBusy}
        />
      ) : (
        <form
          className="todo-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Form ubah tugas"
        >
          <p className="edit-todo-dialog__note">
            Perubahan judul dan deskripsi akan langsung disimpan ke server.
          </p>

          {serverError ? (
            <div className="todo-form__error" role="alert">
              {serverError}
            </div>
          ) : null}

          <TodoFormFields register={register} errors={errors} disabled={isSubmitting || isBusy} />

          <div className="todo-form__actions">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isBusy}
              onClick={requestClose}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isDirty || isSubmitting || isBusy}
              loading={isSubmitting || isBusy}
            >
              Simpan Perubahan
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
