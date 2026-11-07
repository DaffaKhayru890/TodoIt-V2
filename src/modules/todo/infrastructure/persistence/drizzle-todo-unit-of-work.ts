import { and, eq, isNull } from 'drizzle-orm';
import type {
  Database,
  DatabaseExecutor
} from '../../../../shared/infrastructure/database/client';
import type { TodoUnitOfWork, TodoTransactionContext } from '../../application/ports/todo-unit-of-work';
import { toTodoEntity } from '../mappers/todo.mapper';
import { DrizzleLabelRepository } from './drizzle-label.repository';
import { DrizzleReminderRepository } from './drizzle-reminder.repository';
import { DrizzleTagRepository } from './drizzle-tag.repository';
import { DrizzleTodoRepository } from './drizzle-todo.repository';
import { todos as todosTable } from './todo.schema';

/**
 * Implementasi unit of work berbasis transaksi PostgreSQL.
 *
 * Application layer hanya menerima `TodoTransactionContext` berisi kontrak
 * repository. Tipe Drizzle dan mekanisme BEGIN/COMMIT tidak pernah bocor ke
 * use case.
 */
export class DrizzleTodoUnitOfWork implements TodoUnitOfWork {
  constructor(private readonly database: Database) {}

  async run<T>(work: (context: TodoTransactionContext) => Promise<T>): Promise<T> {
    return await this.database.transaction(async (tx) => {
      const executor: DatabaseExecutor = tx;

      const context: TodoTransactionContext = {
        todos: new DrizzleTodoRepository(executor),
        tags: new DrizzleTagRepository(executor),
        labels: new DrizzleLabelRepository(executor),
        reminders: new DrizzleReminderRepository(executor),
        lockActiveTodo: async (workspaceId, todoId) => {
          const rows = await tx
            .select()
            .from(todosTable)
            .where(
              and(
                eq(todosTable.workspaceId, workspaceId),
                eq(todosTable.id, todoId),
                isNull(todosTable.deletedAt)
              )
            )
            .for('update')
            .limit(1);

          const row = rows[0];

          return row ? toTodoEntity(row) : null;
        }
      };

      return await work(context);
    });
  }
}
