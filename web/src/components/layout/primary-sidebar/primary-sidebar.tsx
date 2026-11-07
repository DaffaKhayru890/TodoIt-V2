import { FiChevronsLeft, FiPlus, FiX } from 'react-icons/fi';
import { Link } from 'react-router';
import type { WorkspaceFixture } from '@/app/navigation/workspace-fixtures';
import { userFixture } from '@/app/navigation/workspace-fixtures';
import { paths } from '@/app/router/route-paths';
import { WorkspaceItem } from '@/components/layout/workspace-item/workspace-item';
import { Avatar } from '@/components/ui/avatar/avatar';
import { Dropdown, DropdownItem } from '@/components/ui/dropdown/dropdown';
import { IconButton } from '@/components/ui/icon-button/icon-button';
import { joinClasses } from '@/core/utils/join-classes';

export function PrimarySidebar({
  collapsed,
  workspaces,
  showCollapse,
  onToggleCollapse,
  onClose
}: {
  collapsed: boolean;
  workspaces: readonly WorkspaceFixture[];
  showCollapse?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}) {
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
        <p className={joinClasses('primary-sidebar__caption', collapsed && 'visually-hidden')}>
          Data contoh
        </p>
        <h2 className={joinClasses('primary-sidebar__title', collapsed && 'visually-hidden')}>
          Workspace
        </h2>
        <ul className="primary-sidebar__list">
          {workspaces.map((workspace) => (
            <WorkspaceItem key={workspace.id} workspace={workspace} collapsed={collapsed} />
          ))}
        </ul>
        <Link className="workspace-add" to={paths.newWorkspace}>
          <FiPlus aria-hidden="true" />
          <span className={joinClasses(collapsed && 'visually-hidden')}>Tambah workspace</span>
        </Link>
      </div>
      <footer className="primary-sidebar__footer">
        <div className="profile">
          <Avatar name={userFixture.displayName} size="small" tone="secondary" />
          <span className={joinClasses('profile__name', collapsed && 'visually-hidden')}>
            {userFixture.displayName}
          </span>
        </div>
        <Dropdown label={collapsed ? 'Menu' : 'Menu pengguna'} placement="up">
          <DropdownItem to={paths.settings}>Pengaturan</DropdownItem>
        </Dropdown>
      </footer>
    </div>
  );
}
