import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import { isUniqueViolation } from '../../../../shared/infrastructure/database/errors';
import type { WorkspaceMember } from '../../domain/entities/workspace-member';
import type { WorkspaceRole } from '../../domain/enums/workspace-role';
import { WorkspaceError } from '../../domain/errors/workspace-error';
import type {
  MemberListQuery,
  MemberListResult,
  WorkspaceMemberRepository
} from '../../domain/repositories/workspace-member.repository';
import { toWorkspaceMemberEntity } from '../mappers/workspace.mapper';
import { workspaceMembers } from './workspace.schema';

export class DrizzleWorkspaceMemberRepository implements WorkspaceMemberRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async find(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const rows = await this.database
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    const row = rows[0];

    return row ? toWorkspaceMemberEntity(row) : null;
  }

  async insert(member: WorkspaceMember): Promise<WorkspaceMember> {
    try {
      const rows = await this.database
        .insert(workspaceMembers)
        .values({
          id: member.id,
          workspaceId: member.workspaceId,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt
        })
        .returning();
      const row = rows[0];

      if (!row) {
        throw WorkspaceError.memberAlreadyExists();
      }

      return toWorkspaceMemberEntity(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw WorkspaceError.memberAlreadyExists();
      }

      throw error;
    }
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<WorkspaceMember | null> {
    try {
      const rows = await this.database
        .update(workspaceMembers)
        .set({ role })
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
        .returning();
      const row = rows[0];

      return row ? toWorkspaceMemberEntity(row) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw WorkspaceError.ownershipTransferFailed();
      }

      throw error;
    }
  }

  async delete(workspaceId: string, userId: string): Promise<boolean> {
    const rows = await this.database
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .returning({ id: workspaceMembers.id });

    return rows.length > 0;
  }

  async list(query: MemberListQuery): Promise<MemberListResult> {
    const conditions: SQL[] = [eq(workspaceMembers.workspaceId, query.workspaceId)];

    if (query.role !== undefined) {
      conditions.push(eq(workspaceMembers.role, query.role));
    }

    if (query.cursor !== null) {
      const cursorCondition = or(
        lt(workspaceMembers.joinedAt, query.cursor.joinedAt),
        and(
          eq(workspaceMembers.joinedAt, query.cursor.joinedAt),
          lt(workspaceMembers.userId, query.cursor.userId)
        )
      );

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await this.database
      .select()
      .from(workspaceMembers)
      .where(and(...conditions))
      .orderBy(desc(workspaceMembers.joinedAt), desc(workspaceMembers.userId))
      .limit(query.limit + 1);
    const hasMore = rows.length > query.limit;

    return {
      items: (hasMore ? rows.slice(0, query.limit) : rows).map(toWorkspaceMemberEntity),
      hasMore
    };
  }
}
