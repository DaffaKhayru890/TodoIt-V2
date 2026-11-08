import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Input } from '@/components/ui/input/input';
import { Modal } from '@/components/ui/modal/modal';
import { Textarea } from '@/components/ui/textarea/textarea';
import { ApiError } from '@/core/errors/api-error';
import { useUpdateWorkspace } from '../../hooks/use-update-workspace';
import type { Workspace } from '../../models/workspace.model';
import {
  updateWorkspaceSchema,
  type UpdateWorkspaceFormValues
} from '../../schemas/update-workspace.schema';
import { mapValidationDetails } from '../../utils/api-validation';
import { DiscardChanges } from '../discard-changes/DiscardChanges';

export interface EditWorkspaceDialogProps {
  readonly open: boolean;
  readonly workspace: Workspace;
  readonly onClose: () => void;
  readonly onSuccess?: (workspace: Workspace) => void;
}

export function EditWorkspaceDialog({
  open,
  workspace,
  onClose,
  onSuccess
}: EditWorkspaceDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const updateMutation = useUpdateWorkspace();
  const isOwner = workspace.role === 'owner';
  const isBusy = updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<UpdateWorkspaceFormValues>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: {
      name: workspace.name,
      description: workspace.description ?? ''
    }
  });

  useEffect(() => {
    if (open) {
      reset({
        name: workspace.name,
        description: workspace.description ?? ''
      });
    }
  }, [open, workspace, reset]);

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

  const onSubmit = async (values: UpdateWorkspaceFormValues) => {
    setServerError(null);
    try {
      const updated = await updateMutation.mutateAsync({
        workspaceId: workspace.id,
        input: {
          name: values.name,
          description: values.description?.trim() || null
        }
      });
      closeNow();
      onSuccess?.(updated);
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
        setServerError('Gagal memperbarui workspace. Periksa koneksi Anda.');
      }
    }
  };

  return (
    <Modal open={open} title="Ubah Workspace" onClose={requestClose}>
      {confirmDiscard ? (
        <DiscardChanges
          onKeepEditing={() => setConfirmDiscard(false)}
          onDiscard={closeNow}
          busy={isSubmitting || isBusy}
        />
      ) : !isOwner ? (
        <div className="workspace-dialog-form">
          <div className="workspace-dialog-form__error" role="alert">
            Hanya pemilik (owner) yang memiliki hak untuk mengubah pengaturan workspace ini.
          </div>
          <div className="workspace-dialog-form__actions">
            <Button type="button" variant="outline" onClick={closeNow}>
              Tutup
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="workspace-dialog-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Form ubah workspace"
        >
          {serverError ? (
            <div className="workspace-dialog-form__error" role="alert">
              {serverError}
            </div>
          ) : null}

          <Input
            label="Nama Workspace"
            required
            error={errors.name?.message}
            disabled={isSubmitting || isBusy}
            {...register('name')}
          />

          <Textarea
            label="Deskripsi (opsional)"
            hint="Maksimal 500 karakter"
            rows={3}
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
