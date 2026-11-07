import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { DatabaseClient } from '../../../../shared/infrastructure/database/client';
import { WorkspaceRole } from '../../domain/enums/workspace-role';
import type { Workspace } from '../../domain/entities/workspace';
import type { WorkspaceMember } from '../../domain/entities/workspace-member';
import type {
  ArchiveWorkspaceCommand,
  CreateWorkspaceCommand,
  ListWorkspacesInput,
  ListWorkspacesResult,
  UpdateWorkspaceCommand,
  WorkspaceRepository,
  WorkspaceWithRole
} from '../../domain/repositories/workspace-repository';
import { workspaceMembers, workspaces } from './workspace.schema';
import { toWorkspaceEntity, toWorkspaceMemberEntity } from '../mappers/workspace.mapper';

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly database: DatabaseClient) {}

  async createWorkspaceWithMembership(
    command: CreateWorkspaceCommand
  ): Promise<{ workspace: Workspace; membership: WorkspaceMember }> {
    return await this.database.db.transaction(async (tx) => {
      const workspaceRows = await tx
        .insert(workspaces)
        .values({
          name: command.name,
          description: command.description,
          createdBy: command.createdBy,
          createdAt: command.now,
          updatedAt: command.now
        })
        .returning();

      const workspaceRow = workspaceRows[0];
      if (!workspaceRow) {
        throw new Error('Gagal membuat workspace: baris tidak terbuat');
      }

      const memberRows = await tx
        .insert(workspaceMembers)
        .values({
          workspaceId: workspaceRow.id,
          userId: command.createdBy,
          role: WorkspaceRole.OWNER,
          joinedAt: command.now
        })
        .returning();

      const memberRow = memberRows[0];
      if (!memberRow) {
        throw new Error('Gagal membuat workspace membership: baris tidak terbuat');
      }

      return {
        workspace: toWorkspaceEntity(workspaceRow),
        membership: toWorkspaceMemberEntity(memberRow)
      };
    });
  }

  async findById(workspaceId: string): Promise<Workspace | null> {
    const rows = await this.database.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return toWorkspaceEntity(row);
  }

  async findMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const rows = await this.database.db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return toWorkspaceMemberEntity(row);
  }

  async findWorkspaceWithRole(workspaceId: string, userId: string): Promise<WorkspaceWithRole | null> {
    const rows = await this.database.db
      .select({
        workspace: workspaces,
        role: workspaceMembers.role
      })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(and(eq(workspaces.id, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      workspace: toWorkspaceEntity(row.workspace),
      role: row.role as WorkspaceRole
    };
  }

  async listWorkspacesByUser(input: ListWorkspacesInput): Promise<ListWorkspacesResult> {
    const conditions = and(
      eq(workspaceMembers.userId, input.userId),
      isNull(workspaces.archivedAt)
    );

    const [totalRows, rows] = await Promise.all([
      this.database.db
        .select({ value: count() })
        .from(workspaces)
        .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(conditions),
      this.database.db
        .select({
          workspace: workspaces,
          role: workspaceMembers.role
        })
        .from(workspaces)
        .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(conditions)
        .orderBy(desc(workspaces.createdAt))
        .limit(input.limit)
        .offset(input.offset)
    ]);

    const total = totalRows[0]?.value ?? 0;

    const items = rows.map((row) => ({
      workspace: toWorkspaceEntity(row.workspace),
      role: row.role as WorkspaceRole
    }));

    return {
      items,
      total
    };
  }

  async updateWorkspace(command: UpdateWorkspaceCommand): Promise<Workspace> {
    const updateValues: Partial<typeof workspaces.$inferInsert> = {
      updatedAt: command.now
    };

    if (command.name !== undefined) {
      updateValues.name = command.name;
    }

    if (command.description !== undefined) {
      updateValues.description = command.description;
    }

    const rows = await this.database.db
      .update(workspaces)
      .set(updateValues)
      .where(eq(workspaces.id, command.id))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error(`Gagal memperbarui workspace: ${command.id}`);
    }

    return toWorkspaceEntity(row);
  }

  async archiveWorkspace(command: ArchiveWorkspaceCommand): Promise<Workspace> {
    const rows = await this.database.db
      .update(workspaces)
      .set({
        archivedAt: command.now,
        updatedAt: command.now
      })
      .where(eq(workspaces.id, command.id))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error(`Gagal mengarsipkan workspace: ${command.id}`);
    }

    return toWorkspaceEntity(row);
  }
}
