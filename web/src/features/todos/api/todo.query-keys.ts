import type {
  OverdueTodosParams,
  TodoListParams,
  TodayTodosParams,
  UpcomingTodosParams
} from '../models/todo.model';

/**
 * Bagian key yang tidak dikirim ke backend tetapi harus mereset pagination
 * ketika berubah. Sorting diterapkan client-side, sehingga tanpa scope ini
 * halaman lama dengan urutan berbeda akan tercampur dengan halaman baru.
 */
export interface TodoInfiniteScope {
  readonly params?: TodoListParams;
  readonly sort?: {
    readonly field: string;
    readonly direction: string;
  };
}

/**
 * Query key factory Todo.
 *
 * Semua list dan detail membawa workspaceId. Ini mencegah cache Workspace A
 * dipakai atau diinvalidasi oleh mutation Workspace B. Parameter filter ikut
 * masuk key karena setiap kombinasi filter menghasilkan dataset berbeda.
 */
export const todoKeys = {
  all: ['todos'] as const,

  lists: () => [...todoKeys.all, 'list'] as const,

  workspaceLists: (workspaceId: string) => [...todoKeys.lists(), 'workspace', workspaceId] as const,

  workspace: (workspaceId: string, params?: TodoListParams) =>
    [...todoKeys.workspaceLists(workspaceId), params ?? {}] as const,

  workspaceInfinite: (workspaceId: string, scope: TodoInfiniteScope = {}) =>
    [...todoKeys.workspaceLists(workspaceId), 'infinite', scope] as const,

  views: (workspaceId: string) => [...todoKeys.workspaceLists(workspaceId), 'view'] as const,

  today: (workspaceId: string, params?: TodayTodosParams) =>
    [...todoKeys.views(workspaceId), 'today', params ?? {}] as const,

  upcoming: (workspaceId: string, params?: UpcomingTodosParams) =>
    [...todoKeys.views(workspaceId), 'upcoming', params ?? {}] as const,

  overdue: (workspaceId: string, params?: OverdueTodosParams) =>
    [...todoKeys.views(workspaceId), 'overdue', params ?? {}] as const,

  details: () => [...todoKeys.all, 'detail'] as const,

  detail: (workspaceId: string, todoId: string) =>
    [...todoKeys.details(), workspaceId, todoId] as const
};
