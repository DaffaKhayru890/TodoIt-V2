import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Modal } from '@/components/ui/modal/modal';
import { ApiError } from '@/core/errors/api-error';
import { LabelSelector } from '@/features/labels/components/label-selector/LabelSelector';
import { useLabels } from '@/features/labels/hooks/use-labels';
import { ReminderSelector } from '@/features/reminders/components/reminder-selector/ReminderSelector';
import {
  useCancelReminder,
  useCreateReminder,
  useUpdateReminder
} from '@/features/reminders/hooks/use-reminder-mutations';
import { useTodoReminders } from '@/features/reminders/hooks/use-todo-reminders';
import type { Reminder } from '@/features/reminders/models/reminder.model';
import { TagSelector } from '@/features/tags/components/tag-selector/TagSelector';
import { useReplaceTodoTags } from '@/features/tags/hooks/use-tag-mutations';
import { useTags } from '@/features/tags/hooks/use-tags';
import { DiscardChanges } from '@/features/workspaces/components/discard-changes/DiscardChanges';
import { useUpdateTodo } from '../../hooks/use-update-todo';
import type { Todo, TodoPriority } from '../../models/todo.model';
import { updateTodoSchema, type UpdateTodoFormValues } from '../../schemas/update-todo.schema';
import { mapTodoValidationDetails } from '../../utils/api-validation';
import { parseDateTimeInputValue, toDateTimeInputValue } from '../../utils/date-format';
import { DueDateField } from '../due-date-field/DueDateField';
import { PrioritySelector } from '../priority-selector/PrioritySelector';
import { TodoFormFields } from '../todo-form-fields/TodoFormFields';

export interface EditTodoDialogProps {
  readonly open: boolean;
  readonly todo: Todo;
  readonly onClose: () => void;
  /**
   * `warning` terisi bila perubahan inti tersimpan tetapi sebagian metadata
   * (tag/label/reminder) gagal disimpan.
   */
  readonly onSuccess?: (todo: Todo, warning?: string) => void;
}

function buildDefaultValues(todo: Todo): UpdateTodoFormValues {
  return {
    title: todo.title,
    description: todo.description ?? '',
    priority: todo.priority,
    dueAt: todo.dueAt ? toDateTimeInputValue(todo.dueAt) : '',
    tagIds: todo.tags.map((tag) => tag.id),
    labelId: todo.label?.id ?? null,
    reminderOffset: null
  };
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function scheduledBeforeDue(reminders: readonly Reminder[] | undefined): Reminder | null {
  return (
    reminders?.find(
      (reminder) => reminder.status === 'scheduled' && reminder.triggerType === 'before_due'
    ) ?? null
  );
}

export function EditTodoDialog({ open, todo, onClose, onSuccess }: EditTodoDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const updateMutation = useUpdateTodo();
  const replaceTagsMutation = useReplaceTodoTags();
  const createReminderMutation = useCreateReminder();
  const updateReminderMutation = useUpdateReminder();
  const cancelReminderMutation = useCancelReminder();
  const tagsQuery = useTags(todo.workspaceId);
  const labelsQuery = useLabels(todo.workspaceId);
  const remindersQuery = useTodoReminders(todo.workspaceId, todo.id);

  const isBusy =
    updateMutation.isPending ||
    replaceTagsMutation.isPending ||
    createReminderMutation.isPending ||
    updateReminderMutation.isPending ||
    cancelReminderMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<UpdateTodoFormValues>({
    resolver: zodResolver(updateTodoSchema),
    defaultValues: buildDefaultValues(todo)
  });

  const priority = watch('priority');
  const dueAt = watch('dueAt');
  const tagIds = watch('tagIds');
  const labelId = watch('labelId');
  const reminderOffset = watch('reminderOffset');

  useEffect(() => {
    if (open) {
      setServerError(null);
      reset(buildDefaultValues(todo));
    }
  }, [open, todo, reset]);

  // Prefill offset dari reminder scheduled yang sudah ada di backend.
  useEffect(() => {
    if (!open || !remindersQuery.data) {
      return;
    }

    const current = scheduledBeforeDue(remindersQuery.data.items);
    setValue('reminderOffset', current?.offsetMinutes ?? null);
  }, [open, remindersQuery.data, setValue]);

  const closeNow = () => {
    reset(buildDefaultValues(todo));
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
    const nextDueAt = values.dueAt ? parseDateTimeInputValue(values.dueAt) : null;
    const currentDueAt = todo.dueAt ? todo.dueAt.getTime() : null;
    const dueChanged = currentDueAt !== (nextDueAt ? nextDueAt.getTime() : null);

    const input: {
      title?: string;
      description?: string | null;
      priority?: TodoPriority;
      dueAt?: Date | null;
      labelId?: string | null;
    } = {};

    if (nextTitle !== todo.title) {
      input.title = nextTitle;
    }

    if (nextDescription !== todo.description) {
      input.description = nextDescription;
    }

    if (values.priority !== todo.priority) {
      input.priority = values.priority;
    }

    if (dueChanged) {
      input.dueAt = nextDueAt;
    }

    const currentLabelId = todo.label?.id ?? null;

    if (values.labelId !== currentLabelId) {
      input.labelId = values.labelId;
    }

    const hasCoreChange = Object.keys(input).length > 0;
    let updated = todo;

    if (hasCoreChange) {
      try {
        updated = await updateMutation.mutateAsync({
          workspaceId: todo.workspaceId,
          todoId: todo.id,
          input
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
          setServerError('Gagal memperbarui tugas. Periksa koneksi Anda.');
        }

        return;
      }
    }

    const failedMetadata: string[] = [];

    if (!sameIdSet(values.tagIds, todo.tags.map((tag) => tag.id))) {
      try {
        await replaceTagsMutation.mutateAsync({
          workspaceId: todo.workspaceId,
          todoId: todo.id,
          tagIds: values.tagIds
        });
      } catch {
        failedMetadata.push('tag');
      }
    }

    const currentReminder = scheduledBeforeDue(remindersQuery.data?.items);
    const currentOffset = currentReminder?.offsetMinutes ?? null;
    const nextOffset = values.reminderOffset;

    try {
      if (nextOffset === null) {
        if (currentReminder) {
          await cancelReminderMutation.mutateAsync({
            workspaceId: todo.workspaceId,
            todoId: todo.id,
            reminderId: currentReminder.id
          });
        }
      } else if (nextDueAt) {
        if (currentReminder) {
          if (nextOffset !== currentOffset || dueChanged) {
            await updateReminderMutation.mutateAsync({
              workspaceId: todo.workspaceId,
              todoId: todo.id,
              reminderId: currentReminder.id,
              input: { offsetMinutes: nextOffset }
            });
          }
        } else {
          await createReminderMutation.mutateAsync({
            workspaceId: todo.workspaceId,
            todoId: todo.id,
            input: { triggerType: 'before_due', offsetMinutes: nextOffset }
          });
        }
      }
    } catch {
      failedMetadata.push('pengingat');
    }

    const warning =
      failedMetadata.length > 0
        ? `Perubahan inti tersimpan, tetapi metadata berikut gagal disimpan: ${failedMetadata.join(', ')}.`
        : undefined;

    closeNow();
    onSuccess?.(updated, warning);
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
            Perubahan disimpan ke server. Field yang tidak berubah tidak dikirim ulang.
          </p>

          {serverError ? (
            <div className="todo-form__error" role="alert">
              {serverError}
            </div>
          ) : null}

          <section className="todo-form__section" aria-labelledby="edit-todo-basic">
            <h3 className="todo-form__section-title" id="edit-todo-basic">
              Informasi Dasar
            </h3>
            <TodoFormFields
              register={register}
              errors={errors}
              disabled={isSubmitting || isBusy}
            />
          </section>

          <section className="todo-form__section" aria-labelledby="edit-todo-organization">
            <h3 className="todo-form__section-title" id="edit-todo-organization">
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

          <section className="todo-form__section" aria-labelledby="edit-todo-priority">
            <h3 className="todo-form__section-title" id="edit-todo-priority">
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

          <section className="todo-form__section" aria-labelledby="edit-todo-scheduling">
            <h3 className="todo-form__section-title" id="edit-todo-scheduling">
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
            {remindersQuery.isError ? (
              <p className="edit-todo-dialog__note" role="alert">
                Gagal memuat pengingat yang tersimpan. Perubahan pengingat mungkin ditolak server.
              </p>
            ) : null}
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
