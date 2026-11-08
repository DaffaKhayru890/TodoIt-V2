import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Input } from '@/components/ui/input/input';
import { Modal } from '@/components/ui/modal/modal';
import { Textarea } from '@/components/ui/textarea/textarea';
import { ApiError } from '@/core/errors/api-error';
import { useCreateWorkspace } from '../../hooks/use-create-workspace';
import type { Workspace } from '../../models/workspace.model';
import {
  createWorkspaceSchema,
  type CreateWorkspaceFormValues
} from '../../schemas/create-workspace.schema';
import { mapValidationDetails } from '../../utils/api-validation';
import { DiscardChanges } from '../discard-changes/DiscardChanges';

export interface CreateWorkspaceDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (workspace: Workspace) => void;
}

export function CreateWorkspaceDialog({ open, onClose, onSuccess }: CreateWorkspaceDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const createMutation = useCreateWorkspace();
  const isBusy = createMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<CreateWorkspaceFormValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: '',
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

  const onSubmit = async (values: CreateWorkspaceFormValues) => {
    setServerError(null);
    try {
      const created = await createMutation.mutateAsync({
        name: values.name,
        description: values.description?.trim() || null
      });
      closeNow();
      onSuccess?.(created);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = mapValidationDetails(error.details, ['name', 'description']);

        if (fieldErrors.name) {
          setError('name', { type: 'server', message: fieldErrors.name });
        }
        if (fieldErrors.description) {
          setError('description', { type: 'server', message: fieldErrors.description });
        }
        if (!fieldErrors.name && !fieldErrors.description) {
          setServerError(error.message);
        }
      } else {
        setServerError('Gagal membuat workspace. Periksa koneksi Anda.');
      }
    }
  };

  return (
    <Modal open={open} title="Buat Workspace Baru" onClose={requestClose}>
      {confirmDiscard ? (
        <DiscardChanges
          onKeepEditing={() => setConfirmDiscard(false)}
          onDiscard={closeNow}
          busy={isSubmitting || isBusy}
        />
      ) : (
        <form
          className="workspace-dialog-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Form buat workspace"
        >
          {serverError ? (
            <div className="workspace-dialog-form__error" role="alert">
              {serverError}
            </div>
          ) : null}

          <Input
            label="Nama Workspace"
            required
            placeholder="contoh: Proyek Tim, Rumah, Studi"
            error={errors.name?.message}
            disabled={isSubmitting || isBusy}
            {...register('name')}
          />

          <Textarea
            label="Deskripsi (opsional)"
            hint="Maksimal 500 karakter"
            rows={3}
            placeholder="Tuliskan tujuan atau keterangan workspace ini..."
            error={errors.description?.message}
            disabled={isSubmitting || isBusy}
            {...register('description')}
          />

          <div className="workspace-dialog-form__actions">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isBusy}
              onClick={requestClose}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting || isBusy}>
              Buat Workspace
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
