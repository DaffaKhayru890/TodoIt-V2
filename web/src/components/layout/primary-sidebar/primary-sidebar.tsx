import { FiChevronsLeft, FiPlus, FiX } from 'react-icons/fi';
import { Link } from 'react-router';
import { paths } from '@/app/router/route-paths';
import {
  WorkspaceItem,
  type WorkspaceItemData
} from '@/components/layout/workspace-item/workspace-item';
import { Avatar } from '@/components/ui/avatar/avatar';
import { Dropdown, DropdownItem } from '@/components/ui/dropdown/dropdown';
import { IconButton } from '@/components/ui/icon-button/icon-button';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { joinClasses } from '@/core/utils/join-classes';

export interface PrimarySidebarProps {
  collapsed: boolean;
  workspaces?: readonly WorkspaceItemData[];
  /**
   * Nama pengguna untuk area profil. Autentikasi belum menjadi bagian Phase 3,
   * sehingga pemanggil dapat memberi nilai netral sampai data `/auth/me`
   * terintegrasi pada phase berikutnya.
   */
  userName?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onAddWorkspace?: () => void;
  showCollapse?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}

export function PrimarySidebar({
  collapsed,
  workspaces = [],
  userName = 'Pengguna',
  isLoading = false,
  isError = false,
  onRetry,
  onAddWorkspace,
  showCollapse,
  onToggleCollapse,
  onClose
}: PrimarySidebarProps) {
  return (
    <div className={joinClasses('primary-sidebar', collapsed && 'primary-sidebar--collapsed')}>
      <header className="primary-sidebar__header">
        <Link className="brand" to={paths.inbox}>
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <path d="M8 16.5 13 21.5 24 10.5" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
          </span>
          <span className={joinClasses('brand__name', collapsed && 'visually-hidden')}>TodoIt</span>
        </Link>
        {onClose ? (
          <IconButton label="Tutup workspace" onClick={onClose}>
            <FiX />
          </IconButton>
        ) : null}
        {showCollapse ? (
          <IconButton
            label={collapsed ? 'Bentangkan workspace' : 'Ciutkan workspace'}
            aria-expanded={!collapsed}
            aria-controls="primary-sidebar"
            onClick={onToggleCollapse}
            className={joinClasses('sidebar-toggle', collapsed && 'sidebar-toggle--collapsed')}
          >
            <span
              className={joinClasses('collapse-chevron', collapsed && 'collapse-chevron--rotated')}
            >
              <FiChevronsLeft />
            </span>
          </IconButton>
        ) : null}
      </header>

      <div className="primary-sidebar__scroll scroll-area">
        <h2 className={joinClasses('primary-sidebar__title', collapsed && 'visually-hidden')}>
          Workspace
        </h2>

        {isLoading ? (
          <div className="primary-sidebar__skeleton-list" aria-label="Memuat daftar workspace">
            <div className="primary-sidebar__skeleton-item">
              <Skeleton variant="avatar" />
              <Skeleton variant="text" />
            </div>
            <div className="primary-sidebar__skeleton-item">
              <Skeleton variant="avatar" />
              <Skeleton variant="text" />
            </div>
            <div className="primary-sidebar__skeleton-item">
              <Skeleton variant="avatar" />
              <Skeleton variant="text" />
            </div>
          </div>
        ) : (
          <>
            {isError ? (
              <div className="primary-sidebar__status primary-sidebar__status--error" role="alert">
                <span>Gagal memuat workspace.</span>
                {onRetry ? (
                  <button type="button" className="primary-sidebar__retry-btn" onClick={onRetry}>
                    Coba lagi
                  </button>
                ) : null}
              </div>
            ) : null}

            {workspaces.length === 0 ? (
              isError ? null : (
                <div className="primary-sidebar__empty">
                  <span>Belum ada workspace.</span>
                  <p>Mulai dengan membuat workspace pertama kamu.</p>
                </div>
              )
            ) : (
              <ul className="primary-sidebar__list">
                {workspaces.map((workspace) => (
                  <WorkspaceItem key={workspace.id} workspace={workspace} collapsed={collapsed} />
                ))}
              </ul>
            )}
          </>
        )}

        {onAddWorkspace ? (
          <button
            type="button"
            className="workspace-add"
            onClick={onAddWorkspace}
            aria-label="Tambah workspace"
          >
            <FiPlus aria-hidden="true" />
            <span className={joinClasses(collapsed && 'visually-hidden')}>Tambah workspace</span>
          </button>
        ) : (
          <Link className="workspace-add" to={paths.newWorkspace}>
            <FiPlus aria-hidden="true" />
            <span className={joinClasses(collapsed && 'visually-hidden')}>Tambah workspace</span>
          </Link>
        )}
      </div>

      <footer className="primary-sidebar__footer">
        <div className="profile">
          <Avatar name={userName} size="small" tone="secondary" />
          <span className={joinClasses('profile__name', collapsed && 'visually-hidden')}>
            {userName}
          </span>
        </div>
        <Dropdown label={collapsed ? 'Menu' : 'Menu pengguna'} placement="up">
          <DropdownItem to={paths.settings}>Pengaturan</DropdownItem>
        </Dropdown>
      </footer>
    </div>
  );
}
