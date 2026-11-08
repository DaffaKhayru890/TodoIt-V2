import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';
import { Button } from '@/components/ui/button/button';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { ApiError } from '@/core/errors/api-error';
import { WorkspaceTodoSection } from '@/features/todos/components/workspace-todo-section/WorkspaceTodoSection';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { ArchiveWorkspaceDialog } from '../components/archive-workspace-dialog/ArchiveWorkspaceDialog';
import { EditWorkspaceDialog } from '../components/edit-workspace-dialog/EditWorkspaceDialog';
import { WorkspaceHeader } from '../components/workspace-header/WorkspaceHeader';
import { useWorkspace } from '../hooks/use-workspace';

export function WorkspacePage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { data: workspace, isLoading, isError, error, refetch } = useWorkspace(workspaceId);

  useDocumentTitle(workspace ? workspace.name : 'Workspace');

  if (isLoading) {
    return (
      <div className="workspace-page" aria-busy="true" aria-label="Memuat workspace">
        <div className="workspace-page__skeleton">
          <div className="workspace-page__skeleton-header">
            <div className="workspace-page__skeleton-avatar" />
            <div className="workspace-page__skeleton-lines">
              <Skeleton variant="text" />
              <Skeleton variant="text" />
            </div>
          </div>
          <div className="workspace-page__skeleton-body">
            <Skeleton variant="card" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !workspace) {
    let title = 'Gagal memuat workspace';
    let description = 'Terjadi kesalahan saat memuat data workspace.';
    let isNotFound = false;

    if (error instanceof ApiError) {
      if (
        error.status === 404 ||
        error.code === 'WORKSPACE_NOT_FOUND' ||
        error.code === 'WORKSPACE_ACCESS_DENIED'
      ) {
        title = 'Workspace tidak ditemukan';
        description =
          'Workspace yang Anda cari tidak ada atau Anda tidak memiliki akses ke workspace ini.';
        isNotFound = true;
      } else if (error.status === 403 || error.code === 'WORKSPACE_PERMISSION_DENIED') {
        title = 'Akses ditolak';
        description = 'Anda tidak memiliki hak untuk mengakses workspace ini.';
        isNotFound = true;
      } else {
        description = error.message;
      }
    }

    return (
      <div className="workspace-page">
        <EmptyState
          title={title}
          description={description}
          action={
            isNotFound ? (
              <Button type="button" variant="primary" onClick={() => navigate('/inbox')}>
                Kembali ke Inbox
              </Button>
            ) : (
              <Button type="button" variant="primary" onClick={() => refetch()}>
                Coba lagi
              </Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <WorkspaceHeader
        workspace={workspace}
        onEdit={() => setEditOpen(true)}
        onArchive={() => setArchiveOpen(true)}
      />

      <WorkspaceTodoSection
        key={workspace.id}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
      />

      <EditWorkspaceDialog
        open={editOpen}
        workspace={workspace}
        onClose={() => setEditOpen(false)}
      />

      <ArchiveWorkspaceDialog
        open={archiveOpen}
        workspace={workspace}
        onClose={() => setArchiveOpen(false)}
        onSuccess={() => {
          navigate('/inbox', { replace: true });
        }}
      />
    </div>
  );
}
