import { FiArchive, FiEdit2 } from 'react-icons/fi';
import { Badge } from '@/components/ui/badge/badge';
import { Button } from '@/components/ui/button/button';
import type { Workspace } from '../../models/workspace.model';

export interface WorkspaceHeaderProps {
  readonly workspace: Workspace;
  readonly onEdit?: () => void;
  readonly onArchive?: () => void;
}

export function WorkspaceHeader({ workspace, onEdit, onArchive }: WorkspaceHeaderProps) {
  const isOwner = workspace.role === 'owner';

  const roleLabel =
    workspace.role === 'owner' ? 'Owner' : workspace.role === 'admin' ? 'Admin' : 'Anggota';

  const roleVariant =
    workspace.role === 'owner' ? 'primary' : workspace.role === 'admin' ? 'warning' : 'neutral';

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(workspace.createdAt);

  return (
    <header className="workspace-header" aria-label="Informasi workspace">
      <div className="workspace-header__top">
        <div className="workspace-header__identity">
          <span className="workspace-header__avatar" aria-hidden="true">
            {workspace.mark}
          </span>
          <div className="workspace-header__meta">
            <div className="workspace-header__title-row">
              <h1 className="workspace-header__title">{workspace.name}</h1>
              <Badge variant={roleVariant}>{roleLabel}</Badge>
            </div>
            <p className="workspace-header__description">
              {workspace.description || 'Tidak ada deskripsi'}
            </p>
          </div>
        </div>

        {isOwner ? (
          <div className="workspace-header__actions">
            <Button
              type="button"
              variant="outline"
              size="small"
              leadingIcon={<FiEdit2 aria-hidden="true" />}
              onClick={onEdit}
            >
              Ubah
            </Button>
            <Button
              type="button"
              variant="outline"
              size="small"
              leadingIcon={<FiArchive aria-hidden="true" />}
              onClick={onArchive}
            >
              Arsipkan
            </Button>
          </div>
        ) : null}
      </div>

      <div className="workspace-header__info">
        <span>
          Dibuat pada: <strong>{formattedDate}</strong>
        </span>
        <span>
          Peran Anda: <strong>{roleLabel}</strong>
        </span>
      </div>
    </header>
  );
}
