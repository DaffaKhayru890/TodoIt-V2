import type { WorkspaceMember } from '../../domain/entities/workspace-member';
import type { WorkspaceUserProfile } from '../ports/workspace-user-directory';

export interface MemberDto {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
  };
  readonly membership: {
    readonly role: string;
    readonly joinedAt: Date;
  };
}

export function toMemberDto(member: WorkspaceMember, profile: WorkspaceUserProfile): MemberDto {
  return {
    user: { id: profile.id, email: profile.email, displayName: profile.displayName },
    membership: { role: member.role, joinedAt: member.joinedAt }
  };
}
