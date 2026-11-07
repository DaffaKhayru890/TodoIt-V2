export interface DueSoonTodo {
  readonly id: string;
  readonly workspaceId: string;
  readonly createdBy: string;
  readonly title: string;
  readonly dueAt: Date;
}

export interface ScheduledReminder {
  readonly id: string;
  readonly todoId: string;
  readonly workspaceId: string;
  readonly createdBy: string;
  readonly title: string;
  readonly triggerType: 'absolute' | 'before_due';
  readonly effectiveAt: Date;
  readonly dueAt: Date | null;
}

export interface ScheduleSource {
  listDueSoonTodos(input: { now: Date; horizon: Date }): Promise<readonly DueSoonTodo[]>;
  listReminders(input: { now: Date; horizon: Date }): Promise<readonly ScheduledReminder[]>;
}
