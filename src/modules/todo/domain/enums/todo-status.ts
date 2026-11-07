/**
 * Status lifecycle sebuah Todo. Nilai string ini adalah kontrak API dan juga
 * nilai yang disimpan pada kolom `todos.status`, sehingga jangan mengubah nilai
 * yang sudah ada tanpa migration data.
 */
export const TodoStatus = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export type TodoStatus = (typeof TodoStatus)[keyof typeof TodoStatus];

export const TODO_STATUSES: readonly TodoStatus[] = [
  TodoStatus.TODO,
  TodoStatus.IN_PROGRESS,
  TodoStatus.COMPLETED,
  TodoStatus.CANCELLED
];

export function isTodoStatus(value: string): value is TodoStatus {
  return (TODO_STATUSES as readonly string[]).includes(value);
}
