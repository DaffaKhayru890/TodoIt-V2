import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { tags } from './tag.schema';
import { todos } from './todo.schema';

/**
 * Association many-to-many Todo-Tag.
 *
 * Composite primary key mencegah association duplikat dan sekaligus melayani
 * lookup berdasarkan todo_id (prefix kolom). Index tambahan (tag_id, todo_id)
 * dipakai untuk cascade delete Tag dan filter "Todo memiliki salah satu tag".
 *
 * Kedua foreign key memakai ON DELETE CASCADE: menghapus Tag atau Todo akan
 * menghapus association, tanpa pernah menghapus entitas sisi lainnya.
 *
 * Konsistensi workspace antara Todo dan Tag tidak dapat dijaga oleh composite
 * foreign key tanpa menambahkan workspace_id ke association; validasi dilakukan
 * application layer di dalam transaksi yang sama sebelum insert.
 */
export const todoTags = pgTable(
  'todo_tags',
  {
    todoId: uuid('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.todoId, table.tagId], name: 'todo_tags_pkey' }),
    index('todo_tags_tag_id_todo_id_idx').on(table.tagId, table.todoId)
  ]
);
