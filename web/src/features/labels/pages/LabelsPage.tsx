import { useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useParams } from 'react-router';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';
import { Badge } from '@/components/ui/badge/badge';
import { Button } from '@/components/ui/button/button';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { ApiError } from '@/core/errors/api-error';
import { useWorkspace } from '@/features/workspaces/hooks/use-workspace';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { LabelBadge } from '../components/label-badge/LabelBadge';
import { DeleteLabelDialog } from '../components/delete-label-dialog/DeleteLabelDialog';
import { LabelDialog } from '../components/label-dialog/LabelDialog';
import { useLabels } from '../hooks/use-labels';
import type { Label } from '../models/label.model';

function canManageLabels(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function LabelsPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const workspaceQuery = useWorkspace(workspaceId);
  const labelsQuery = useLabels(workspaceId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [deleting, setDeleting] = useState<Label | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useDocumentTitle('Labels');

  const manage = canManageLabels(workspaceQuery.data?.role);

  if (labelsQuery.isLoading || workspaceQuery.isLoading) {
    return (
      <section className="label-management" aria-busy="true" aria-label="Memuat labels">
        <Skeleton variant="text" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </section>
    );
  }

  if (labelsQuery.isError) {
    return (
      <section className="label-management">
        <EmptyState
          title="Gagal memuat label"
          description={
            labelsQuery.error instanceof ApiError
              ? labelsQuery.error.message
              : 'Terjadi kesalahan saat memuat daftar label.'
          }
          action={
            <Button type="button" variant="primary" onClick={() => labelsQuery.refetch()}>
              Coba lagi
            </Button>
          }
        />
      </section>
    );
  }

  const labels = labelsQuery.data?.items ?? [];

  return (
    <section className="label-management" aria-labelledby="labels-title">
      <header className="label-management__header">
        <div>
          <h1 className="label-management__title" id="labels-title">
            Labels
          </h1>
          <p className="label-management__description">
            Kelola label tugas di workspace {workspaceQuery.data?.name ?? workspaceId}.
          </p>
        </div>
        {manage ? (
          <Button
            type="button"
            variant="primary"
            leadingIcon={<FiPlus aria-hidden="true" />}
            onClick={() => setCreateOpen(true)}
          >
            Buat Label
          </Button>
        ) : (
          <Badge variant="neutral">Hanya owner/admin dapat mengelola label</Badge>
        )}
      </header>

      {feedback ? (
        <div className="label-management__feedback" role="status">
          {feedback}
        </div>
      ) : null}

      {labels.length === 0 ? (
        <EmptyState
          title="Belum ada label"
          description="Buat label untuk menandai jenis pekerjaan dengan warna yang mudah dikenali."
          action={
            manage ? (
              <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                Buat label pertama
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="label-management__list" aria-label="Daftar label">
          {labels.map((label) => (
            <li className="label-management__item" key={label.id}>
              <div className="label-management__info">
                <LabelBadge name={label.name} color={label.color} />
                {label.description ? (
                  <p className="label-management__item-description">{label.description}</p>
                ) : null}
              </div>
              {manage ? (
                <div className="label-management__actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    aria-label={`Ubah label ${label.name}`}
                    onClick={() => setEditing(label)}
                  >
                    <FiEdit2 aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    aria-label={`Hapus label ${label.name}`}
                    onClick={() => setDeleting(label)}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <LabelDialog
        open={createOpen}
        workspaceId={workspaceId}
        onClose={() => setCreateOpen(false)}
        onSuccess={(label) => setFeedback(`Label ${label.name} berhasil dibuat.`)}
      />

      {editing ? (
        <LabelDialog
          open
          workspaceId={workspaceId}
          label={editing}
          onClose={() => setEditing(null)}
          onSuccess={(label) => setFeedback(`Label ${label.name} berhasil diperbarui.`)}
        />
      ) : null}

      {deleting ? (
        <DeleteLabelDialog
          open
          workspaceId={workspaceId}
          label={deleting}
          onClose={() => setDeleting(null)}
          onSuccess={() => setFeedback('Label berhasil dihapus.')}
        />
      ) : null}
    </section>
  );
}
