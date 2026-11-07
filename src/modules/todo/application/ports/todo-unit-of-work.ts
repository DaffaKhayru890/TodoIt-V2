import type { Todo } from '../../domain/entities/todo';
import type { LabelRepository } from '../../domain/repositories/label.repository';
import type { ReminderRepository } from '../../domain/repositories/reminder.repository';
import type { TagRepository } from '../../domain/repositories/tag.repository';
import type { TodoRepository } from '../../domain/repositories/todo.repository';

/**
 * Konteks transaksi yang diterima application layer.
 *
 * Semua property berupa kontrak domain/application; tidak ada tipe Drizzle yang
 * bocor ke use case. Implementasi konkret merakit repository yang terikat pada
 * satu transaksi PostgreSQL.
 */
export interface TodoTransactionContext {
  readonly todos: TodoRepository;
  readonly tags: TagRepository;
  readonly labels: LabelRepository;
  readonly reminders: ReminderRepository;

  /**
   * Mengambil Todo aktif sekaligus mengunci barisnya (`SELECT ... FOR UPDATE`).
   * Dipakai untuk operasi yang harus aman terhadap request konkuren, misalnya
   * perubahan dueAt dan pembuatan reminder.
   */
  lockActiveTodo(workspaceId: string, todoId: string): Promise<Todo | null>;
}

/**
 * Port unit of work. Application layer menentukan batas transaksi tanpa
 * mengetahui mekanisme database yang dipakai.
 */
export interface TodoUnitOfWork {
  run<T>(work: (context: TodoTransactionContext) => Promise<T>): Promise<T>;
}
