import {
  and,
  asc,
  count,
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
import type { Tag } from '../../domain/entities/tag';
import { TodoError } from '../../domain/errors/todo-error';
import type {
  AddTodoTagCommand,
  ReplaceTodoTagsCommand,
  TagListQuery,
  TagListResult,
  TagRepository
} from '../../domain/repositories/tag.repository';
import { toTagEntity } from '../mappers/tag.mapper';
import { tags } from './tag.schema';
import { todoTags } from './todo-tag.schema';

function toIlikePattern(search: string): string {
  const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`);

  return `%${escaped}%`;
}

export class DrizzleTagRepository implements TagRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async create(tag: Tag): Promise<Tag> {
    const snapshot = tag.toSnapshot();

    const rows = await this.database
      .insert(tags)
      .values({
        id: snapshot.id,
        workspaceId: snapshot.workspaceId,
        name: snapshot.name,
        normalizedName: snapshot.normalizedName,
        createdBy: snapshot.createdBy,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt
      })
      // Cegah race condition: dua create bersamaan dengan normalized name sama
      // hanya menghasilkan satu baris.
      .onConflictDoNothing()
      .returning();

    const row = rows[0];

    if (!row) {
      throw TodoError.tagAlreadyExists();
    }

    return toTagEntity(row);
  }

  async findById(workspaceId: string, tagId: string): Promise<Tag | null> {
    const rows = await this.database
      .select()
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), eq(tags.id, tagId)))
      .limit(1);

    const row = rows[0];

    return row ? toTagEntity(row) : null;
  }

  async findByIds(workspaceId: string, tagIds: readonly string[]): Promise<readonly Tag[]> {
    if (tagIds.length === 0) {
      return [];
    }

    const rows = await this.database
      .select()
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), inArray(tags.id, [...tagIds])))
      .orderBy(asc(tags.name), asc(tags.id));

    return rows.map(toTagEntity);
  }

  async findByName(workspaceId: string, normalizedName: string): Promise<Tag | null> {
    const rows = await this.database
      .select()
      .from(tags)
      .where(
        and(eq(tags.workspaceId, workspaceId), eq(tags.normalizedName, normalizedName))
      )
      .limit(1);

    const row = rows[0];

    return row ? toTagEntity(row) : null;
  }

  async update(tag: Tag): Promise<Tag | null> {
    const snapshot = tag.toSnapshot();

    try {
      const rows = await this.database
        .update(tags)
        .set({
          name: snapshot.name,
          normalizedName: snapshot.normalizedName,
          updatedAt: snapshot.updatedAt
        })
        .where(and(eq(tags.workspaceId, snapshot.workspaceId), eq(tags.id, snapshot.id)))
        .returning();

      const row = rows[0];

      return row ? toTagEntity(row) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw TodoError.tagAlreadyExists();
      }

      throw error;
    }
  }

  async delete(workspaceId: string, tagId: string): Promise<boolean> {
    const rows = await this.database
      .delete(tags)
      .where(and(eq(tags.workspaceId, workspaceId), eq(tags.id, tagId)))
      .returning({ id: tags.id });

    return rows.length > 0;
  }

  async list(query: TagListQuery): Promise<TagListResult> {
    const conditions: SQL[] = [eq(tags.workspaceId, query.workspaceId)];

    if (query.search !== undefined && query.search.length > 0) {
      conditions.push(ilike(tags.name, toIlikePattern(query.search)));
    }

    if (query.cursor !== null) {
      const cursorCondition = or(
        lt(tags.createdAt, query.cursor.createdAt),
        and(eq(tags.createdAt, query.cursor.createdAt), lt(tags.id, query.cursor.id))
      );

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await this.database
      .select()
      .from(tags)
      .where(and(...conditions))
      .orderBy(desc(tags.createdAt), desc(tags.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    return { items: pageRows.map(toTagEntity), hasMore };
  }

  async findByTodoIds(
    todoIds: readonly string[]
  ): Promise<ReadonlyMap<string, readonly Tag[]>> {
    const result = new Map<string, Tag[]>();

    if (todoIds.length === 0) {
      return result;
    }

    const rows = await this.database
      .select({ todoId: todoTags.todoId, tag: tags })
      .from(todoTags)
      .innerJoin(tags, eq(todoTags.tagId, tags.id))
      .where(inArray(todoTags.todoId, [...todoIds]))
      .orderBy(asc(tags.name), asc(tags.id));

    for (const row of rows) {
      const entity = toTagEntity(row.tag);
      const existing = result.get(row.todoId);

      if (existing) {
        existing.push(entity);
      } else {
        result.set(row.todoId, [entity]);
      }
    }

    return result;
  }

  async findTodoTagIds(todoId: string): Promise<readonly string[]> {
    const rows = await this.database
      .select({ tagId: todoTags.tagId })
      .from(todoTags)
      .where(eq(todoTags.todoId, todoId));

    return rows.map((row) => row.tagId);
  }

  async countTodoTags(todoId: string): Promise<number> {
    const rows = await this.database
      .select({ total: count() })
      .from(todoTags)
      .where(eq(todoTags.todoId, todoId));

    return Number(rows[0]?.total ?? 0);
  }

  async replaceTodoTags(command: ReplaceTodoTagsCommand): Promise<void> {
    // Dipanggil di dalam unit of work sehingga delete + insert atomik.
    await this.database.delete(todoTags).where(eq(todoTags.todoId, command.todoId));

    if (command.tagIds.length === 0) {
      return;
    }

    await this.database.insert(todoTags).values(
      command.tagIds.map((tagId) => ({
        todoId: command.todoId,
        tagId,
        createdAt: command.now
      }))
    );
  }

  async addTodoTag(command: AddTodoTagCommand): Promise<boolean> {
    const rows = await this.database
      .insert(todoTags)
      .values({
        todoId: command.todoId,
        tagId: command.tagId,
        createdAt: command.now
      })
      .onConflictDoNothing()
      .returning({ todoId: todoTags.todoId });

    return rows.length > 0;
  }

  async removeTodoTag(todoId: string, tagId: string): Promise<boolean> {
    const rows = await this.database
      .delete(todoTags)
      .where(and(eq(todoTags.todoId, todoId), eq(todoTags.tagId, tagId)))
      .returning({ todoId: todoTags.todoId });

    return rows.length > 0;
  }
}
