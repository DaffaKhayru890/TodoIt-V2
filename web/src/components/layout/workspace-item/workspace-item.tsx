import { NavLink } from 'react-router';
import { paths } from '@/app/router/route-paths';
import { joinClasses } from '@/core/utils/join-classes';
import { deriveWorkspaceMark } from '@/features/workspaces/models/workspace.mapper';

export interface WorkspaceItemData {
  readonly id: string;
  readonly name: string;
  readonly mark?: string;
}

export function WorkspaceItem({
  workspace,
  collapsed
}: {
  workspace: WorkspaceItemData;
  collapsed: boolean;
}) {
  const mark = workspace.mark || deriveWorkspaceMark(workspace.name);

  return (
    <li>
      <NavLink
        to={paths.workspace(workspace.id)}
        title={workspace.name}
        data-testid={`workspace-item-${workspace.id}`}
        className={({ isActive }) =>
          joinClasses('workspace-item', isActive && 'workspace-item--active')
        }
      >
        <span className="workspace-item__mark" aria-hidden="true">
          {mark}
        </span>
        <span className={joinClasses('workspace-item__name', collapsed && 'visually-hidden')}>
          {workspace.name}
        </span>
      </NavLink>
    </li>
  );
}
