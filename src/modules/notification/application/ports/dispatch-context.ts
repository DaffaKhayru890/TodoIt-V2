export interface DispatchTodo {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly dueAt: Date | null;
  readonly deletedAt: Date | null;
  readonly workspaceId: string;
  readonly createdBy: string;
  readonly workspaceArchivedAt: Date | null;
}

export interface DispatchReminder {
  readonly id: string;
  readonly todoId: string;
  readonly status: string;
  readonly triggerType: 'absolute' | 'before_due';
  readonly remindAt: Date | null;
  readonly offsetMinutes: number | null;
  readonly createdBy: string;
}

export interface DispatchUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

export interface DispatchContext {
  findTodo(todoId: string): Promise<DispatchTodo | null>;
  findReminder(reminderId: string): Promise<DispatchReminder | null>;
  isMember(workspaceId: string, userId: string): Promise<boolean>;
  emailEnabled(userId: string): Promise<boolean>;
  findUser(userId: string): Promise<DispatchUser | null>;
}
