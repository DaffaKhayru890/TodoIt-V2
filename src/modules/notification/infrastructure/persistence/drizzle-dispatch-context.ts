import { and, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import { users } from '../../../auth/infrastructure/persistence/auth.schema';
import { reminders } from '../../../todo/infrastructure/persistence/reminder.schema';
import { todos } from '../../../todo/infrastructure/persistence/todo.schema';
import { workspaceMembers, workspaces } from '../../../workspace/infrastructure/persistence/workspace.schema';
import type {
  DispatchContext,
  DispatchReminder,
  DispatchTodo,
  DispatchUser
} from '../../application/ports/dispatch-context';
import { notificationPreferences } from './notification-preference.schema';

export class DrizzleDispatchContext implements DispatchContext {
  constructor(private readonly database: DatabaseExecutor) {}

  async findTodo(todoId: string): Promise<DispatchTodo | null> {
    const rows = await this.database
      .select({
        id: todos.id,
        title: todos.title,
        status: todos.status,
        dueAt: todos.dueAt,
        deletedAt: todos.deletedAt,
        workspaceId: todos.workspaceId,
        createdBy: todos.createdBy,
        workspaceArchivedAt: workspaces.archivedAt
      })
      .from(todos)
      .innerJoin(workspaces, eq(workspaces.id, todos.workspaceId))
      .where(eq(todos.id, todoId))
      .limit(1);

    return rows[0] ?? null;
  }

  async findReminder(reminderId: string): Promise<DispatchReminder | null> {
    const rows = await this.database
      .select({
        id: reminders.id,
        todoId: reminders.todoId,
        status: reminders.status,
        triggerType: reminders.triggerType,
        remindAt: reminders.remindAt,
        offsetMinutes: reminders.offsetMinutes,
        createdBy: reminders.createdBy
      })
      .from(reminders)
      .where(eq(reminders.id, reminderId))
      .limit(1);
    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      ...row,
      triggerType: row.triggerType as DispatchReminder['triggerType']
    };
  }

  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const rows = await this.database
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);

    return rows.length > 0;
  }

  async emailEnabled(userId: string): Promise<boolean> {
    const rows = await this.database
      .select({ emailEnabled: notificationPreferences.emailEnabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return rows[0]?.emailEnabled === true;
  }

  async findUser(userId: string): Promise<DispatchUser | null> {
    const rows = await this.database
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return rows[0] ?? null;
  }
}
