import type { ReactNode } from 'react';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';

export interface WorkspaceEmptyStateProps {
  readonly action?: ReactNode;
}

export function WorkspaceEmptyState({ action }: WorkspaceEmptyStateProps) {
  return (
    <div className="workspace-empty-container" data-testid="workspace-empty-boundary">
      <div className="workspace-empty-container__slot">
        <EmptyState
          title="Your workspace is ready!"
          description="Workspace ini masih kosong. Kamu dapat mulai mengorganisasi pekerjaan dan membuat todolist di sini."
          action={action}
        />
      </div>
    </div>
  );
}
