import { useState } from 'react';
import { Button } from '@/components/ui/button/button';
import { Modal } from '@/components/ui/modal/modal';
import { ApiError } from '@/core/errors/api-error';
import { useArchiveWorkspace } from '../../hooks/use-archive-workspace';
import type { Workspace } from '../../models/workspace.model';

export interface ArchiveWorkspaceDialogProps {
  readonly open: boolean;
  readonly workspace: Workspace;
  readonly onClose: () => void;
  readonly onSuccess?: () => void;
}

export function ArchiveWorkspaceDialog({
  open,
  workspace,
  onClose,
  onSuccess
}: ArchiveWorkspaceDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const archiveMutation = useArchiveWorkspace();
  const isOwner = workspace.role === 'owner';

  const handleClose = () => {
    if (archiveMutation.isPending) {
      return;
    }

    setServerError(null);
    onClose();
  };

  const handleArchive = async () => {
    setServerError(null);
    try {
      await archiveMutation.mutateAsync(workspace.id);
      onSuccess?.();
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message);
      } else {
        setServerError('Gagal mengarsipkan workspace. Silakan coba lagi.');
      }
    }
  };

  return (
    <Modal open={open} title="Arsipkan Workspace" onClose={handleClose}>
      <div className="workspace-dialog-form">
        {!isOwner ? (
          <>
            <div className="workspace-dialog-form__error" role="alert">
              Hanya pemilik (owner) yang memiliki hak untuk mengarsipkan workspace ini.
            </div>
            <div className="workspace-dialog-form__actions">
              <Button type="button" variant="outline" onClick={handleClose}>
                Tutup
              </Button>
            </div>
          </>
        ) : (
          <>
            {serverError ? (
              <div className="workspace-dialog-form__error" role="alert">
                {serverError}
              </div>
            ) : null}

            <p>
              Apakah Anda yakin ingin mengarsipkan workspace <strong>{workspace.name}</strong>?
            </p>
            <p className="field__hint">
              Workspace yang diarsipkan tidak akan muncul lagi di daftar workspace aktif Anda.
              Tindakan ini hanya dapat dilakukan oleh pemilik workspace.
            </p>

            <div className="workspace-dialog-form__actions">
              <Button
                type="button"
                variant="outline"
                disabled={archiveMutation.isPending}
                onClick={handleClose}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={archiveMutation.isPending}
                onClick={handleArchive}
              >
                Ya, Arsipkan
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
