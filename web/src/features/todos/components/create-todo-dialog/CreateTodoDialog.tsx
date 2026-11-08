import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Modal } from '@/components/ui/modal/modal';
import { ApiError } from '@/core/errors/api-error';
import { DiscardChanges } from '@/features/workspaces/components/discard-changes/DiscardChanges';
import { useCreateTodo } from '../../hooks/use-create-todo';
import type { Todo } from '../../models/todo.model';
import { createTodoSchema, type CreateTodoFormValues } from '../../schemas/create-todo.schema';
import { mapTodoValidationDetails } from '../../utils/api-validation';
import { TodoFormFields } from '../todo-form-fields/TodoFormFields';

export interface CreateTodoDialogProps {
  readonly open: boolean;
  readonly workspaceId: string;
  readonly workspaceName?: string | undefined;
  readonly onClose: () => void;
  readonly onSuccess?: (todo: Todo) => void;
}

export function CreateTodoDialog({
  open,
  workspaceId,
  workspaceName,
  onClose,
  onSuccess
}: CreateTodoDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const createMutation = useCreateTodo();
  const isBusy = createMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<CreateTodoFormValues>({
    resolver: zodResolver(createTodoSchema),
    defaultValues: {
      title: '',
      description: ''
    }
  });

  const closeNow = () => {
    reset();
    setServerError(null);
    setConfirmDiscard(false);
    onClose();
  };

  const requestClose = () => {
    // Dialog tidak boleh ditutup sebelum mutation selesai.
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

  const onSubmit = async (values: CreateTodoFormValues) => {
    setServerError(null);

    try {
      const created = await createMutation.mutateAsync({
        workspaceId,
        input: {
          title: values.title,
          description: values.description?.trim() || null
        }
      });
      closeNow();
      onSuccess?.(created);
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
        setServerError('Gagal membuat tugas. Periksa koneksi Anda.');
      }
    }
  };

  return (
    <Modal open={open} title="Buat Tugas Baru" onClose={requestClose}>
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
          aria-label="Form buat tugas"
        >
          <div className="create-todo-dialog__context">
            <span className="create-todo-dialog__context-label">Workspace</span>
            <strong className="create-todo-dialog__context-value">
              {workspaceName || workspaceId}
            </strong>
            <span className="create-todo-dialog__context-note">
              Tugas akan dibuat di workspace ini.
            </span>
          </div>

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
            <Button type="submit" variant="primary" loading={isSubmitting || isBusy}>
              Buat Tugas
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
