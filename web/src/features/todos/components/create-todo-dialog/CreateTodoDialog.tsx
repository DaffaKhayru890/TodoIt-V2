import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Modal } from '@/components/ui/modal/modal';
import { ApiError } from '@/core/errors/api-error';
import { useAssignTodoLabel } from '@/features/labels/hooks/use-label-mutations';
import { LabelSelector } from '@/features/labels/components/label-selector/LabelSelector';
import { useLabels } from '@/features/labels/hooks/use-labels';
import { useCreateReminder } from '@/features/reminders/hooks/use-reminder-mutations';
import { ReminderSelector } from '@/features/reminders/components/reminder-selector/ReminderSelector';
import { useReplaceTodoTags } from '@/features/tags/hooks/use-tag-mutations';
import { TagSelector } from '@/features/tags/components/tag-selector/TagSelector';
import { useTags } from '@/features/tags/hooks/use-tags';
import { DiscardChanges } from '@/features/workspaces/components/discard-changes/DiscardChanges';
import { useCreateTodo } from '../../hooks/use-create-todo';
import type { Todo, TodoPriority } from '../../models/todo.model';
import { createTodoSchema, type CreateTodoFormValues } from '../../schemas/create-todo.schema';
import { mapTodoValidationDetails } from '../../utils/api-validation';
import { parseDateTimeInputValue } from '../../utils/date-format';
import { DueDateField } from '../due-date-field/DueDateField';
import { PrioritySelector } from '../priority-selector/PrioritySelector';
import { TodoFormFields } from '../todo-form-fields/TodoFormFields';

export interface CreateTodoDialogProps {
  readonly open: boolean;
  readonly workspaceId: string;
  readonly workspaceName?: string | undefined;
  readonly onClose: () => void;
  /**
   * `warning` terisi bila todo berhasil dibuat tetapi sebagian metadata
   * (tag/label/reminder) gagal disimpan.
   */
  readonly onSuccess?: (todo: Todo, warning?: string) => void;
}

const DEFAULT_VALUES: CreateTodoFormValues = {
  title: '',
  description: '',
  priority: 'low',
  dueAt: '',
  tagIds: [],
  labelId: null,
  reminderOffset: null
};

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
  const replaceTagsMutation = useReplaceTodoTags();
  const assignLabelMutation = useAssignTodoLabel();
  const createReminderMutation = useCreateReminder();
  const tagsQuery = useTags(workspaceId);
  const labelsQuery = useLabels(workspaceId);

  const isBusy =
    createMutation.isPending ||
    replaceTagsMutation.isPending ||
    assignLabelMutation.isPending ||
    createReminderMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<CreateTodoFormValues>({
    resolver: zodResolver(createTodoSchema),
    defaultValues: DEFAULT_VALUES
  });

  const priority = watch('priority');
  const dueAt = watch('dueAt');
  const tagIds = watch('tagIds');
  const labelId = watch('labelId');
  const reminderOffset = watch('reminderOffset');

  const closeNow = () => {
    reset(DEFAULT_VALUES);
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

    const dueDate = values.dueAt ? parseDateTimeInputValue(values.dueAt) : null;
    let created: Todo;

    try {
      created = await createMutation.mutateAsync({
        workspaceId,
        input: {
          title: values.title,
          description: values.description?.trim() || null,
          // `low` adalah default backend; hindari mengirim nilai yang tidak
          // dipilih eksplisit oleh pengguna.
          ...(values.priority !== 'low' ? { priority: values.priority } : {}),
          ...(dueDate ? { dueAt: dueDate } : {})
        }
      });
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

      return;
    }

    const failedMetadata: string[] = [];

    if (values.tagIds.length > 0) {
      try {
        await replaceTagsMutation.mutateAsync({
          workspaceId,
          todoId: created.id,
          tagIds: values.tagIds
        });
      } catch {
        failedMetadata.push('tag');
      }
    }

    if (values.labelId) {
      try {
        await assignLabelMutation.mutateAsync({
          workspaceId,
          todoId: created.id,
          labelId: values.labelId
        });
      } catch {
        failedMetadata.push('label');
      }
    }

    if (values.reminderOffset !== null && dueDate) {
      try {
        await createReminderMutation.mutateAsync({
          workspaceId,
          todoId: created.id,
          input: { triggerType: 'before_due', offsetMinutes: values.reminderOffset }
        });
      } catch {
        failedMetadata.push('pengingat');
      }
    }

    const warning =
      failedMetadata.length > 0
        ? `Tugas dibuat, tetapi metadata berikut gagal disimpan: ${failedMetadata.join(', ')}.`
        : undefined;

    closeNow();
    onSuccess?.(created, warning);
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

          <section className="todo-form__section" aria-labelledby="create-todo-basic">
            <h3 className="todo-form__section-title" id="create-todo-basic">
              Informasi Dasar
            </h3>
            <TodoFormFields register={register} errors={errors} disabled={isSubmitting || isBusy} />
          </section>

          <section className="todo-form__section" aria-labelledby="create-todo-organization">
            <h3 className="todo-form__section-title" id="create-todo-organization">
              Organisasi
            </h3>
            <TagSelector
              tags={tagsQuery.data?.items}
              selectedIds={tagIds}
              onChange={(ids) => setValue('tagIds', [...ids], { shouldDirty: true })}
              isLoading={tagsQuery.isLoading}
              isError={tagsQuery.isError}
              onRetry={() => {
                void tagsQuery.refetch();
              }}
              disabled={isSubmitting || isBusy}
            />
            <LabelSelector
              labels={labelsQuery.data?.items}
              selectedId={labelId}
              onChange={(id) => setValue('labelId', id, { shouldDirty: true })}
              isLoading={labelsQuery.isLoading}
              isError={labelsQuery.isError}
              onRetry={() => {
                void labelsQuery.refetch();
              }}
              disabled={isSubmitting || isBusy}
            />
          </section>

          <section className="todo-form__section" aria-labelledby="create-todo-priority">
            <h3 className="todo-form__section-title" id="create-todo-priority">
              Prioritas
            </h3>
            <PrioritySelector
              value={priority}
              onChange={(value: TodoPriority) =>
                setValue('priority', value, { shouldDirty: true, shouldValidate: true })
              }
              disabled={isSubmitting || isBusy}
              error={errors.priority?.message}
            />
          </section>

          <section className="todo-form__section" aria-labelledby="create-todo-scheduling">
            <h3 className="todo-form__section-title" id="create-todo-scheduling">
              Penjadwalan
            </h3>
            <DueDateField
              value={dueAt}
              onChange={(value) => {
                setValue('dueAt', value, { shouldDirty: true, shouldValidate: true });
                if (!value) {
                  setValue('reminderOffset', null, { shouldDirty: true });
                }
              }}
              disabled={isSubmitting || isBusy}
              error={errors.dueAt?.message}
            />
            <ReminderSelector
              value={reminderOffset}
              onChange={(offset) =>
                setValue('reminderOffset', offset, {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
              hasDueDate={Boolean(dueAt)}
              disabled={isSubmitting || isBusy}
              error={errors.reminderOffset?.message}
            />
          </section>

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
