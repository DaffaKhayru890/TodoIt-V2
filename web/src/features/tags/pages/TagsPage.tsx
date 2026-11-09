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
import { TagBadge } from '../components/tag-badge/TagBadge';
import { DeleteTagDialog } from '../components/delete-tag-dialog/DeleteTagDialog';
import { TagDialog } from '../components/tag-dialog/TagDialog';
import { useTags } from '../hooks/use-tags';
import type { Tag } from '../models/tag.model';

function canManageTags(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function TagsPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const workspaceQuery = useWorkspace(workspaceId);
  const tagsQuery = useTags(workspaceId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useDocumentTitle('Tags');

  const manage = canManageTags(workspaceQuery.data?.role);

  if (tagsQuery.isLoading || workspaceQuery.isLoading) {
    return (
      <section className="tag-management" aria-busy="true" aria-label="Memuat tags">
        <Skeleton variant="text" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </section>
    );
  }

  if (tagsQuery.isError) {
    return (
      <section className="tag-management">
        <EmptyState
          title="Gagal memuat tag"
          description={
            tagsQuery.error instanceof ApiError
              ? tagsQuery.error.message
              : 'Terjadi kesalahan saat memuat daftar tag.'
          }
          action={
            <Button type="button" variant="primary" onClick={() => tagsQuery.refetch()}>
              Coba lagi
            </Button>
          }
        />
      </section>
    );
  }

  const tags = tagsQuery.data?.items ?? [];

  return (
    <section className="tag-management" aria-labelledby="tags-title">
      <header className="tag-management__header">
        <div>
          <h1 className="tag-management__title" id="tags-title">
            Tags
          </h1>
          <p className="tag-management__description">
            Kelola kategori tugas di workspace {workspaceQuery.data?.name ?? workspaceId}.
          </p>
        </div>
        {manage ? (
          <Button
            type="button"
            variant="primary"
            leadingIcon={<FiPlus aria-hidden="true" />}
            onClick={() => setCreateOpen(true)}
          >
            Buat Tag
          </Button>
        ) : (
          <Badge variant="neutral">Hanya owner/admin dapat mengelola tag</Badge>
        )}
      </header>

      {feedback ? (
        <div className="tag-management__feedback" role="status">
          {feedback}
        </div>
      ) : null}

      {tags.length === 0 ? (
        <EmptyState
          title="Belum ada tag"
          description="Buat tag untuk mengelompokkan tugas lintas kategori."
          action={
            manage ? (
              <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                Buat tag pertama
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="tag-management__list" aria-label="Daftar tag">
          {tags.map((tag) => (
            <li className="tag-management__item" key={tag.id}>
              <TagBadge name={tag.name} />
              {manage ? (
                <div className="tag-management__actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    aria-label={`Ubah tag ${tag.name}`}
                    onClick={() => setEditing(tag)}
                  >
                    <FiEdit2 aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    aria-label={`Hapus tag ${tag.name}`}
                    onClick={() => setDeleting(tag)}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <TagDialog
        open={createOpen}
        workspaceId={workspaceId}
        onClose={() => setCreateOpen(false)}
        onSuccess={(tag) => setFeedback(`Tag #${tag.name} berhasil dibuat.`)}
      />

      {editing ? (
        <TagDialog
          open
          workspaceId={workspaceId}
          tag={editing}
          onClose={() => setEditing(null)}
          onSuccess={(tag) => setFeedback(`Tag #${tag.name} berhasil diperbarui.`)}
        />
      ) : null}

      {deleting ? (
        <DeleteTagDialog
          open
          workspaceId={workspaceId}
          tag={deleting}
          onClose={() => setDeleting(null)}
          onSuccess={() => setFeedback('Tag berhasil dihapus.')}
        />
      ) : null}
    </section>
  );
}
