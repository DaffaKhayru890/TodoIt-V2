import { eq } from 'drizzle-orm';
import type { Database } from '../../../../shared/infrastructure/database/client';
import type { WorkspaceTransactionContext, WorkspaceUnitOfWork } from '../../application/ports/workspace-unit-of-work';
import { toInvitationEntity } from '../mappers/invitation.mapper';
import { toWorkspaceEntity } from '../mappers/workspace.mapper';
import { workspaceInvitations } from './invitation.schema';
import { DrizzleWorkspaceInvitationRepository } from './drizzle-invitation.repository';
import { DrizzleWorkspaceMemberRepository } from './drizzle-member.repository';
import { workspaces } from './workspace.schema';

export class DrizzleWorkspaceUnitOfWork implements WorkspaceUnitOfWork {
  constructor(private readonly database: Database) {}

  async run<T>(work: (context: WorkspaceTransactionContext) => Promise<T>): Promise<T> {
    return await this.database.transaction(async (tx) => {
      const context: WorkspaceTransactionContext = {
        invitations: new DrizzleWorkspaceInvitationRepository(tx),
        members: new DrizzleWorkspaceMemberRepository(tx),
        lockWorkspace: async (workspaceId) => {
          const rows = await tx
            .select()
            .from(workspaces)
            .where(eq(workspaces.id, workspaceId))
            .for('update')
            .limit(1);
          const row = rows[0];

          return row ? toWorkspaceEntity(row) : null;
        },
        lockInvitation: async (invitationId) => {
          const rows = await tx
            .select()
            .from(workspaceInvitations)
            .where(eq(workspaceInvitations.id, invitationId))
            .for('update')
            .limit(1);
          const row = rows[0];

          return row ? toInvitationEntity(row) : null;
        }
      };

      return await work(context);
    });
  }
}
