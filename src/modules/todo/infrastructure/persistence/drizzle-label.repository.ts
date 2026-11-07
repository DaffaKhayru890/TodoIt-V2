import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  or,
  type SQL
} from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import { isUniqueViolation } from '../../../../shared/infrastructure/database/errors';
import type { Label } from '../../domain/entities/label';
import { TodoError } from '../../domain/errors/todo-error';
import type {
  LabelListQuery,
  LabelListResult,
  LabelRepository
} from '../../domain/repositories/label.repository';
import { toLabelEntity } from '../mappers/label.mapper';
import { labels } from './label.schema';

function toIlikePattern(search: string): string {
  const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`);

  return `%${escaped}%`;
}

export class DrizzleLabelRepository implements LabelRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async create(label: Label): Promise<Label> {
    const snapshot = label.toSnapshot();

    const rows = await this.database
      .insert(labels)
      .values({
        id: snapshot.id,
        workspaceId: snapshot.workspaceId,
        name: snapshot.name,
        normalizedName: snapshot.normalizedName,
        color: snapshot.color,
        description: snapshot.description,
        createdBy: snapshot.createdBy,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt
      })
      .onConflictDoNothing()
      .returning();

    const row = rows[0];

    if (!row) {
      throw TodoError.labelAlreadyExists();
    }

    return toLabelEntity(row);
  }

  async findById(workspaceId: string, labelId: string): Promise<Label | null> {
    const rows = await this.database
      .select()
      .from(labels)
      .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, labelId)))
      .limit(1);

    const row = rows[0];

    return row ? toLabelEntity(row) : null;
  }

  async findByIds(
    workspaceId: string,
    labelIds: readonly string[]
  ): Promise<readonly Label[]> {
    if (labelIds.length === 0) {
      return [];
    }

    const rows = await this.database
      .select()
      .from(labels)
      .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, [...labelIds])))
      .orderBy(asc(labels.name), asc(labels.id));

    return rows.map(toLabelEntity);
  }

  async findByName(workspaceId: string, normalizedName: string): Promise<Label | null> {
    const rows = await this.database
      .select()
      .from(labels)
      .where(
        and(eq(labels.workspaceId, workspaceId), eq(labels.normalizedName, normalizedName))
      )
      .limit(1);

    const row = rows[0];

    return row ? toLabelEntity(row) : null;
  }

  async update(label: Label): Promise<Label | null> {
    const snapshot = label.toSnapshot();

    try {
      const rows = await this.database
        .update(labels)
        .set({
          name: snapshot.name,
          normalizedName: snapshot.normalizedName,
          color: snapshot.color,
          description: snapshot.description,
          updatedAt: snapshot.updatedAt
        })
        .where(and(eq(labels.workspaceId, snapshot.workspaceId), eq(labels.id, snapshot.id)))
        .returning();

      const row = rows[0];

      return row ? toLabelEntity(row) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw TodoError.labelAlreadyExists();
      }

      throw error;
    }
  }

  async delete(workspaceId: string, labelId: string): Promise<boolean> {
    const rows = await this.database
      .delete(labels)
      .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, labelId)))
      .returning({ id: labels.id });

    return rows.length > 0;
  }

  async list(query: LabelListQuery): Promise<LabelListResult> {
    const conditions: SQL[] = [eq(labels.workspaceId, query.workspaceId)];

    if (query.search !== undefined && query.search.length > 0) {
      conditions.push(ilike(labels.name, toIlikePattern(query.search)));
    }

    if (query.cursor !== null) {
      const cursorCondition = or(
        lt(labels.createdAt, query.cursor.createdAt),
        and(eq(labels.createdAt, query.cursor.createdAt), lt(labels.id, query.cursor.id))
      );

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await this.database
      .select()
      .from(labels)
      .where(and(...conditions))
      .orderBy(desc(labels.createdAt), desc(labels.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    return { items: pageRows.map(toLabelEntity), hasMore };
  }
}
