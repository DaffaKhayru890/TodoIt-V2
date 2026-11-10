import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Input } from '@/components/ui/input/input';
import { Modal } from '@/components/ui/modal/modal';
import { Textarea } from '@/components/ui/textarea/textarea';
import { ApiError } from '@/core/errors/api-error';
import { mapTodoValidationDetails } from '@/features/todos/utils/api-validation';
import { useCreateLabel, useUpdateLabel } from '../../hooks/use-label-mutations';
import type { Label } from '../../models/label.model';
import {
  LABEL_COLOR_PRESETS,
  labelFormSchema,
  type LabelFormValues
} from '../../schemas/label.schema';

export interface LabelDialogProps {
  readonly open: boolean;
  readonly workspaceId: string;
  readonly label?: Label | null;
  readonly onClose: () => void;
  readonly onSuccess?: (label: Label) => void;
}

export function LabelDialog({ open, workspaceId, label, onClose, onSuccess }: LabelDialogProps) {
  const editing = Boolean(label);
  const createMutation = useCreateLabel();
  const updateMutation = useUpdateLabel();
  const isBusy = createMutation.isPending || updateMutation.isPending;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty }
  } = useForm<LabelFormValues>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: {
      name: label?.name ?? '',
      color: label?.color ?? LABEL_COLOR_PRESETS[0],
      description: label?.description ?? ''
    }
  });

  const color = watch('color');

  useEffect(() => {
    if (open) {
      reset({
        name: label?.name ?? '',
        color: label?.color ?? LABEL_COLOR_PRESETS[0],
        description: label?.description ?? ''
      });
    }
  }, [open, label, reset]);

  const closeNow = () => {
    setServerError(null);
    onClose();
  };

  const onSubmit = async (values: LabelFormValues) => {
    setServerError(null);

    try {
      const description = values.description?.trim() || null;
      const result = label
        ? await updateMutation.mutateAsync({
            workspaceId,
            labelId: label.id,
            input: {
              name: values.name,
              color: values.color,
              description
            }
          })
        : await createMutation.mutateAsync({
            workspaceId,
            input: {
              name: values.name,
              color: values.color,
              description
            }
          });

      closeNow();
      onSuccess?.(result);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = mapTodoValidationDetails(error.details, [
          'name',
          'color',
          'description'
        ]);

        if (fieldErrors.name) setError('name', { type: 'server', message: fieldErrors.name });
        if (fieldErrors.color) setError('color', { type: 'server', message: fieldErrors.color });
        if (fieldErrors.description) {
          setError('description', { type: 'server', message: fieldErrors.description });
        }
        if (!fieldErrors.name && !fieldErrors.color && !fieldErrors.description) {
          setServerError(error.message);
        }
      } else {
        setServerError('Gagal menyimpan label. Periksa koneksi Anda.');
      }
    }
  };

  return (
    <Modal open={open} title={editing ? 'Ubah Label' : 'Buat Label Baru'} onClose={closeNow}>
      <form className="label-dialog" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? (
          <div className="label-dialog__error" role="alert">
            {serverError}
          </div>
        ) : null}

        <Input
          label="Nama Label"
          required
          maxLength={50}
          placeholder="contoh: Design"
          error={errors.name?.message}
          disabled={isBusy}
          {...register('name')}
        />

        <fieldset className="label-dialog__color-field">
          <legend className="label-dialog__legend">Warna Label</legend>
          <div className="label-dialog__swatches">
            {LABEL_COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="label-dialog__swatch"
                style={{ backgroundColor: preset }}
                aria-label={`Pilih warna ${preset}`}
                aria-pressed={color.toUpperCase() === preset}
                onClick={() =>
                  setValue('color', preset, { shouldDirty: true, shouldValidate: true })
                }
              />
            ))}
            <input
              type="color"
              className="label-dialog__color-input"
              aria-label="Warna khusus"
              value={color}
              disabled={isBusy}
              onChange={(event) =>
                setValue('color', event.target.value, { shouldDirty: true, shouldValidate: true })
              }
            />
            <span className="label-dialog__color-value">{color.toUpperCase()}</span>
          </div>
          {errors.color ? (
            <p className="label-dialog__error-text" role="alert">
              {errors.color.message}
            </p>
          ) : null}
        </fieldset>

        <Textarea
          label="Deskripsi (opsional)"
          hint="Maksimal 300 karakter"
          maxLength={300}
          rows={3}
          placeholder="Jelaskan penggunaan label ini..."
          error={errors.description?.message}
          disabled={isBusy}
          {...register('description')}
        />

        <div className="label-dialog__actions">
          <Button type="button" variant="outline" onClick={closeNow} disabled={isBusy}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isBusy}
            disabled={isBusy || (editing && !isDirty)}
          >
            {editing ? 'Simpan Perubahan' : 'Buat Label'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
