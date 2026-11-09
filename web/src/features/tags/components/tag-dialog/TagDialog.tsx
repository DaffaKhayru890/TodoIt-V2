import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Input } from '@/components/ui/input/input';
import { Modal } from '@/components/ui/modal/modal';
import { ApiError } from '@/core/errors/api-error';
import { mapTodoValidationDetails } from '@/features/todos/utils/api-validation';
import { useCreateTag, useUpdateTag } from '../../hooks/use-tag-mutations';
import type { Tag } from '../../models/tag.model';
import { tagFormSchema, type TagFormValues } from '../../schemas/tag.schema';

export interface TagDialogProps {
  readonly open: boolean;
  readonly workspaceId: string;
  readonly tag?: Tag | null;
  readonly onClose: () => void;
  readonly onSuccess?: (tag: Tag) => void;
}

export function TagDialog({ open, workspaceId, tag, onClose, onSuccess }: TagDialogProps) {
  const editing = Boolean(tag);
  const createMutation = useCreateTag();
  const updateMutation = useUpdateTag();
  const isBusy = createMutation.isPending || updateMutation.isPending;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty }
  } = useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: { name: tag?.name ?? '' }
  });

  useEffect(() => {
    if (open) {
      reset({ name: tag?.name ?? '' });
    }
  }, [open, tag, reset]);

  const closeNow = () => {
    setServerError(null);
    reset({ name: tag?.name ?? '' });
    onClose();
  };

  const onSubmit = async (values: TagFormValues) => {
    setServerError(null);

    try {
      const result = tag
        ? await updateMutation.mutateAsync({
            workspaceId,
            tagId: tag.id,
            input: { name: values.name }
          })
        : await createMutation.mutateAsync({
            workspaceId,
            input: { name: values.name }
          });

      closeNow();
      onSuccess?.(result);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = mapTodoValidationDetails(error.details, ['name']);
        if (fieldErrors.name) {
          setError('name', { type: 'server', message: fieldErrors.name });
        } else {
          setServerError(error.message);
        }
      } else {
        setServerError('Gagal menyimpan tag. Periksa koneksi Anda.');
      }
    }
  };

  return (
    <Modal open={open} title={editing ? 'Ubah Tag' : 'Buat Tag Baru'} onClose={closeNow}>
      <form className="tag-dialog" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? (
          <div className="tag-dialog__error" role="alert">
            {serverError}
          </div>
        ) : null}

        <Input
          label="Nama Tag"
          required
          maxLength={50}
          placeholder="contoh: Backend"
          error={errors.name?.message}
          disabled={isBusy}
          {...register('name')}
        />

        <div className="tag-dialog__actions">
          <Button type="button" variant="outline" onClick={closeNow} disabled={isBusy}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isBusy}
            disabled={isBusy || (editing && !isDirty)}
          >
            {editing ? 'Simpan Perubahan' : 'Buat Tag'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
