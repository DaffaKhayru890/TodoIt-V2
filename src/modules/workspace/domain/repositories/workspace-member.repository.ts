import type { WorkspaceMember } from '../entities/workspace-member';
import type { WorkspaceRole } from '../enums/workspace-role';

export interface MemberCursorPosition {
  readonly joinedAt: Date;
  readonly userId: string;
}

export interface MemberListQuery {
  readonly workspaceId: string;
  readonly role?: WorkspaceRole;
  readonly cursor: MemberCursorPosition | null;
  readonly limit: number;
}

export interface MemberListResult {
  readonly items: readonly WorkspaceMember[];
  readonly hasMore: boolean;
}

export interface WorkspaceMemberRepository {
  find(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  insert(member: WorkspaceMember): Promise<WorkspaceMember>;
  updateRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMember | null>;
  delete(workspaceId: string, userId: string): Promise<boolean>;
  list(query: MemberListQuery): Promise<MemberListResult>;
}
