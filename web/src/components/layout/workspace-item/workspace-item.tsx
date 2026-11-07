import { NavLink } from 'react-router';
import type { WorkspaceFixture } from '@/app/navigation/workspace-fixtures';
import { paths } from '@/app/router/route-paths';
import { joinClasses } from '@/core/utils/join-classes';

export function WorkspaceItem({
  workspace,
  collapsed
}: {
  workspace: WorkspaceFixture;
  collapsed: boolean;
}) {
  return (
    <li>
      <NavLink
        to={paths.workspace(workspace.id)}
        className={({ isActive }) =>
          joinClasses('workspace-item', isActive && 'workspace-item--active')
        }
      >
        <span className="workspace-item__mark" aria-hidden="true">
          {workspace.mark}
        </span>
        <span className={joinClasses('workspace-item__name', collapsed && 'visually-hidden')}>
          {workspace.name}
        </span>
      </NavLink>
    </li>
  );
}
