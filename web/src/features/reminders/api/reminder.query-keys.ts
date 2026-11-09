import type { ListRemindersParams } from '../models/reminder.model';

/**
 * Reminder selalu berada di bawah workspace dan todo. Query key memuat
 * keduanya agar cache tidak bocor antar workspace/todo.
 */
export const reminderKeys = {
  all: ['reminders'] as const,

  todoLists: (workspaceId: string, todoId: string) =>
    [...reminderKeys.all, 'list', workspaceId, todoId] as const,

  todoList: (workspaceId: string, todoId: string, params?: ListRemindersParams) =>
    [...reminderKeys.todoLists(workspaceId, todoId), params ?? {}] as const,

  details: () => [...reminderKeys.all, 'detail'] as const,

  detail: (workspaceId: string, todoId: string, reminderId: string) =>
    [...reminderKeys.details(), workspaceId, todoId, reminderId] as const
};
