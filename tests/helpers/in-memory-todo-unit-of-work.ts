import type {
  TodoTransactionContext,
  TodoUnitOfWork
} from '../../src/modules/todo/application/ports/todo-unit-of-work';
import type { InMemoryTodoRepository } from './in-memory-todo-repository';
import type { InMemoryTagRepository } from './in-memory-tag-repository';
import type { InMemoryLabelRepository } from './in-memory-label-repository';
import type { InMemoryReminderRepository } from './in-memory-reminder-repository';

/**
 * Unit of work in-memory. Tidak ada rollback nyata; seluruh repository berbagi
 * state yang sama sehingga use case dapat diuji tanpa PostgreSQL. Locking juga
 * tidak disimulasikan karena test konkurensi memakai database sungguhan.
 */
export class InMemoryTodoUnitOfWork implements TodoUnitOfWork {
  constructor(
    private readonly todos: InMemoryTodoRepository,
    private readonly tags: InMemoryTagRepository,
    private readonly labels: InMemoryLabelRepository,
    private readonly reminders: InMemoryReminderRepository
  ) {}

  async run<T>(work: (context: TodoTransactionContext) => Promise<T>): Promise<T> {
    return await work({
      todos: this.todos,
      tags: this.tags,
      labels: this.labels,
      reminders: this.reminders,
      lockActiveTodo: async (workspaceId, todoId) =>
        await this.todos.findActiveById(workspaceId, todoId)
    });
  }
}
