import type { Workspace } from '../../domain/entities/workspace';
import type { WorkspaceInvitation } from '../../domain/entities/workspace-invitation';
import type { WorkspaceInvitationRepository } from '../../domain/repositories/workspace-invitation.repository';
import type { WorkspaceMemberRepository } from '../../domain/repositories/workspace-member.repository';

export interface WorkspaceTransactionContext {
  readonly invitations: WorkspaceInvitationRepository;
  readonly members: WorkspaceMemberRepository;
  lockWorkspace(workspaceId: string): Promise<Workspace | null>;
  lockInvitation(invitationId: string): Promise<WorkspaceInvitation | null>;
}

export interface WorkspaceUnitOfWork {
  run<T>(work: (context: WorkspaceTransactionContext) => Promise<T>): Promise<T>;
}
