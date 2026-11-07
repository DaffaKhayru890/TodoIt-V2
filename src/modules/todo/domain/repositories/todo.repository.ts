import type { Todo } from '../entities/todo';
import type { TodoPriority } from '../enums/todo-priority';
import type { TodoStatus } from '../enums/todo-status';

/** Posisi keyset: pasangan (createdAt, id) dari item terakhir halaman sebelumnya. */
export interface TodoCursorPosition {
  readonly createdAt: Date;
  readonly id: string;
}

/**
 * Kriteria query yang sudah dinormalisasi application layer.
 *
 * `dueAtFrom`/`dueAtTo` bersifat inclusive (dipakai filter API), sedangkan
 * `dueAtBefore` exclusive (dipakai Today/Upcoming/Overdue) agar tidak perlu
 * memanipulasi timestamp 23:59:59.999.
 */
export interface TodoQueryCriteria {
  readonly status?: TodoStatus;
  readonly priority?: TodoPriority;
  readonly dueAtFrom?: Date;
  readonly dueAtTo?: Date;
  readonly dueAtBefore?: Date;
  readonly createdFrom?: Date;
  readonly createdTo?: Date;
  readonly search?: string;
  readonly excludedStatuses?: readonly TodoStatus[];
  /** ANY semantics: Todo lolos bila memiliki setidaknya satu tag tersebut. */
  readonly tagIds?: readonly string[];
  readonly labelId?: string;
}

export interface TodoListQuery {
  readonly workspaceId: string;
  readonly criteria: TodoQueryCriteria;
  readonly cursor: TodoCursorPosition | null;
  /** Jumlah item per halaman; repository mengambil limit + 1 untuk hasMore. */
  readonly limit: number;
}

export interface TodoListResult {
  readonly items: readonly Todo[];
  readonly hasMore: boolean;
}

export interface SoftDeleteTodoCommand {
  readonly workspaceId: string;
  readonly todoId: string;
  readonly now: Date;
}

/**
 * Kontrak repository Todo. Setiap method WAJIB membatasi query pada
 * workspaceId yang diberikan; repository tidak pernah melakukan pengecekan
 * membership (itu tanggung jawab application policy).
 */
export interface TodoRepository {
  create(todo: Todo): Promise<Todo>;

  /** Hanya mengembalikan Todo aktif (deleted_at IS NULL) dalam workspace. */
  findActiveById(workspaceId: string, todoId: string): Promise<Todo | null>;

  /**
   * Memperbarui Todo aktif dalam workspace. Mengembalikan null bila baris tidak
   * ada atau sudah soft-deleted, sehingga use case dapat memetakan ke 404.
   */
  update(todo: Todo): Promise<Todo | null>;

  /**
   * Soft delete idempoten. Mengembalikan true bila baris aktif berhasil
   * ditandai; false bila sudah dihapus/tidak ada di workspace tersebut.
   */
  softDelete(command: SoftDeleteTodoCommand): Promise<boolean>;

  list(query: TodoListQuery): Promise<TodoListResult>;
}
