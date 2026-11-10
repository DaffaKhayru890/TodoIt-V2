import { useState } from 'react';
import { Button } from '@/components/ui/button/button';
import { Modal } from '@/components/ui/modal/modal';
import { ApiError } from '@/core/errors/api-error';
import { useDeleteLabel } from '../../hooks/use-label-mutations';
import type { Label } from '../../models/label.model';

export interface DeleteLabelDialogProps {
  readonly open: boolean;
  readonly workspaceId: string;
  readonly label: Label;
  readonly onClose: () => void;
  readonly onSuccess?: () => void;
}

export function DeleteLabelDialog({
  open,
  workspaceId,
  label,
  onClose,
  onSuccess
}: DeleteLabelDialogProps) {
  const deleteMutation = useDeleteLabel();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);

    try {
      await deleteMutation.mutateAsync({ workspaceId, labelId: label.id });
      onClose();
      onSuccess?.();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Gagal menghapus label. Periksa koneksi Anda.'
      );
    }
  };

  return (
    <Modal open={open} title="Hapus Label" onClose={onClose}>
      <div className="delete-label-dialog">
        <p className="delete-label-dialog__question">
          Hapus label <strong>{label.name}</strong>?
        </p>
        <p className="delete-label-dialog__description">
          Label dihapus permanen. Tugas yang memakai label ini tetap ada, tetapi labelnya dilepas.
        </p>

        {error ? (
          <div className="delete-label-dialog__error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="delete-label-dialog__actions">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={deleteMutation.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={deleteMutation.isPending}
            disabled={deleteMutation.isPending}
            onClick={() => {
              void handleDelete();
            }}
          >
            Hapus Label
          </Button>
        </div>
      </div>
    </Modal>
  );
}
