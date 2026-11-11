import type { Todo, TodoListResult } from '../models/todo.model';

/**
 * Menggabungkan seluruh halaman infinite query menjadi satu daftar.
 *
 * Identitas item adalah ID backend, bukan title. Item dari workspace lain
 * dibuang sebagai pertahanan terakhir agar cache tidak bocor antar-workspace.
 * Duplikat dapat muncul ketika data berubah di tengah proses pagination.
 */
export function flattenTodoPages(
  workspaceId: string,
  pages: readonly TodoListResult[] | undefined
): readonly Todo[] {
  const seen = new Set<string>();
  const items: Todo[] = [];

  for (const page of pages ?? []) {
    for (const todo of page.items) {
      if (todo.workspaceId !== workspaceId || seen.has(todo.id)) {
        continue;
      }

      seen.add(todo.id);
      items.push(todo);
    }
  }

  return items;
}
