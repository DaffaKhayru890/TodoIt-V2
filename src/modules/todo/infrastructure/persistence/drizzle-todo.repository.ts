import {
  and,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  notInArray,
  or,
  type SQL
} from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import type { Todo } from '../../domain/entities/todo';
import type {
  SoftDeleteTodoCommand,
  TodoListQuery,
  TodoListResult,
  TodoRepository
} from '../../domain/repositories/todo.repository';
import { toTodoEntity } from '../mappers/todo.mapper';
import { todoTags } from './todo-tag.schema';
import { todos } from './todo.schema';

/**
 * ILIKE memakai backslash sebagai escape default PostgreSQL. Input client
 * di-escape agar '%' dan '_' diperlakukan sebagai karakter literal, bukan
 * wildcard tak terbatas.
 */
function toIlikePattern(search: string): string {
  const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`);

  return `%${escaped}%`;
}

export class DrizzleTodoRepository implements TodoRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async create(todo: Todo): Promise<Todo> {
    const snapshot = todo.toSnapshot();

    const rows = await this.database
      .insert(todos)
      .values({
        id: snapshot.id,
        workspaceId: snapshot.workspaceId,
        title: snapshot.title,
        description: snapshot.description,
        status: snapshot.status,
        priority: snapshot.priority,
        dueAt: snapshot.dueAt,
        completedAt: snapshot.completedAt,
        labelId: snapshot.labelId ?? null,
        createdBy: snapshot.createdBy,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        deletedAt: snapshot.deletedAt
      })
      .returning();

    const row = rows[0];

    if (!row) {
      throw new Error('Gagal membuat todo: baris tidak terbuat');
    }

    return toTodoEntity(row);
  }

  async findActiveById(workspaceId: string, todoId: string): Promise<Todo | null> {
    const rows = await this.database
      .select()
      .from(todos)
      .where(and(eq(todos.workspaceId, workspaceId), eq(todos.id, todoId), isNull(todos.deletedAt)))
      .limit(1);

    const row = rows[0];

    return row ? toTodoEntity(row) : null;
  }

  async update(todo: Todo): Promise<Todo | null> {
    const snapshot = todo.toSnapshot();

    const rows = await this.database
      .update(todos)
      .set({
        title: snapshot.title,
        description: snapshot.description,
        status: snapshot.status,
        priority: snapshot.priority,
        dueAt: snapshot.dueAt,
        completedAt: snapshot.completedAt,
        labelId: snapshot.labelId ?? null,
        updatedAt: snapshot.updatedAt
      })
      .where(
        and(
          eq(todos.workspaceId, snapshot.workspaceId),
          eq(todos.id, snapshot.id),
          isNull(todos.deletedAt)
        )
      )
      .returning();

    const row = rows[0];

    return row ? toTodoEntity(row) : null;
  }

  async softDelete(command: SoftDeleteTodoCommand): Promise<boolean> {
    const rows = await this.database
      .update(todos)
      .set({
        deletedAt: command.now,
        updatedAt: command.now
      })
      .where(
        and(
          eq(todos.workspaceId, command.workspaceId),
          eq(todos.id, command.todoId),
          isNull(todos.deletedAt)
        )
      )
      .returning({ id: todos.id });

    return rows.length > 0;
  }

  async list(query: TodoListQuery): Promise<TodoListResult> {
    const { criteria } = query;
    const conditions: SQL[] = [
      eq(todos.workspaceId, query.workspaceId),
      isNull(todos.deletedAt)
    ];

    if (criteria.status !== undefined) {
      conditions.push(eq(todos.status, criteria.status));
    }

    if (criteria.excludedStatuses !== undefined && criteria.excludedStatuses.length > 0) {
      conditions.push(notInArray(todos.status, [...criteria.excludedStatuses]));
    }

    if (criteria.priority !== undefined) {
      conditions.push(eq(todos.priority, criteria.priority));
    }

    if (criteria.dueAtFrom !== undefined) {
      conditions.push(gte(todos.dueAt, criteria.dueAtFrom));
    }

    if (criteria.dueAtTo !== undefined) {
      conditions.push(lte(todos.dueAt, criteria.dueAtTo));
    }

    if (criteria.dueAtBefore !== undefined) {
      conditions.push(lt(todos.dueAt, criteria.dueAtBefore));
    }

    if (criteria.createdFrom !== undefined) {
      conditions.push(gte(todos.createdAt, criteria.createdFrom));
    }

    if (criteria.createdTo !== undefined) {
      conditions.push(lte(todos.createdAt, criteria.createdTo));
    }

    if (criteria.search !== undefined && criteria.search.length > 0) {
      const pattern = toIlikePattern(criteria.search);
      const searchCondition = or(ilike(todos.title, pattern), ilike(todos.description, pattern));

      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (criteria.labelId !== undefined) {
      conditions.push(eq(todos.labelId, criteria.labelId));
    }

    if (criteria.tagIds !== undefined && criteria.tagIds.length > 0) {
      // EXISTS (bukan JOIN) agar Todo dengan banyak tag tidak terduplikasi
      // sebelum limit + 1 dihitung. Semantics: ANY dari tagIds.
      const tagCondition = exists(
        this.database
          .select({ todoId: todoTags.todoId })
          .from(todoTags)
          .where(
            and(
              eq(todoTags.todoId, todos.id),
              inArray(todoTags.tagId, [...criteria.tagIds])
            )
          )
      );

      conditions.push(tagCondition);
    }

    if (query.cursor !== null) {
      // Keyset: strictly "sebelum" pasangan (created_at, id) pada halaman lalu.
      const cursorCondition = or(
        lt(todos.createdAt, query.cursor.createdAt),
        and(eq(todos.createdAt, query.cursor.createdAt), lt(todos.id, query.cursor.id))
      );

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await this.database
      .select()
      .from(todos)
      .where(and(...conditions))
      .orderBy(desc(todos.createdAt), desc(todos.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: pageRows.map(toTodoEntity),
      hasMore
    };
  }
}
