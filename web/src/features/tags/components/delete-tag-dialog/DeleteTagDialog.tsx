import { useState } from 'react';
import { Button } from '@/components/ui/button/button';
import { Modal } from '@/components/ui/modal/modal';
import { ApiError } from '@/core/errors/api-error';
import { useDeleteTag } from '../../hooks/use-tag-mutations';
import type { Tag } from '../../models/tag.model';

export interface DeleteTagDialogProps {
  readonly open: boolean;
  readonly workspaceId: string;
  readonly tag: Tag;
  readonly onClose: () => void;
  readonly onSuccess?: () => void;
}

export function DeleteTagDialog({
  open,
  workspaceId,
  tag,
  onClose,
  onSuccess
}: DeleteTagDialogProps) {
  const deleteMutation = useDeleteTag();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);

    try {
      await deleteMutation.mutateAsync({ workspaceId, tagId: tag.id });
      onClose();
      onSuccess?.();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Gagal menghapus tag. Periksa koneksi Anda.'
      );
    }
  };

  return (
    <Modal open={open} title="Hapus Tag" onClose={onClose}>
      <div className="delete-tag-dialog">
        <p className="delete-tag-dialog__question">
          Hapus tag <strong>#{tag.name}</strong>?
        </p>
        <p className="delete-tag-dialog__description">
          Tag dihapus permanen dan dilepas dari seluruh tugas di workspace ini. Tugas tetap ada.
        </p>

        {error ? (
          <div className="delete-tag-dialog__error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="delete-tag-dialog__actions">
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
            Hapus Tag
          </Button>
        </div>
      </div>
    </Modal>
  );
}
