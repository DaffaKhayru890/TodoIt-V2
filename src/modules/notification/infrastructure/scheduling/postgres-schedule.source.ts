import { sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import type {
  DueSoonTodo,
  ScheduleSource,
  ScheduledReminder
} from '../../application/ports/schedule-source';

const PAGE = 200;
const MAX_PAGES = 10;

export class PostgresScheduleSource implements ScheduleSource {
  constructor(private readonly database: DatabaseExecutor) {}

  async listDueSoonTodos(input: { now: Date; horizon: Date }): Promise<readonly DueSoonTodo[]> {
    const items: DueSoonTodo[] = [];
    let cursorDue: Date | null = null;
    let cursorId: string | null = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const rows: { rows: ReadonlyArray<Record<string, unknown>> } = await this.database.execute(sql`
        SELECT todo.id, todo.workspace_id, todo.created_by, todo.title, todo.due_at
        FROM todos AS todo
        JOIN workspaces AS workspace ON workspace.id = todo.workspace_id AND workspace.archived_at IS NULL
        JOIN workspace_members AS member
          ON member.workspace_id = todo.workspace_id AND member.user_id = todo.created_by
        WHERE todo.deleted_at IS NULL
          AND todo.status IN ('todo', 'in_progress')
          AND todo.due_at IS NOT NULL
          AND todo.due_at > ${input.now}
          AND todo.due_at <= ${input.horizon}
          AND (
            ${cursorDue}::timestamptz IS NULL
            OR (todo.due_at, todo.id) > (${cursorDue}::timestamptz, ${cursorId}::uuid)
          )
        ORDER BY todo.due_at ASC, todo.id ASC
        LIMIT ${PAGE}
      `);
      const mapped: DueSoonTodo[] = rows.rows.map((row) => {
        const record = row as {
          id: string;
          workspace_id: string;
          created_by: string;
          title: string;
          due_at: Date;
        };

        return {
          id: record.id,
          workspaceId: record.workspace_id,
          createdBy: record.created_by,
          title: record.title,
          dueAt: new Date(record.due_at)
        };
      });
      items.push(...mapped);

      if (mapped.length < PAGE) {
        break;
      }

      const last = mapped[mapped.length - 1];
      cursorDue = last?.dueAt ?? null;
      cursorId = last?.id ?? null;
    }

    return items;
  }

  async listReminders(input: { now: Date; horizon: Date }): Promise<readonly ScheduledReminder[]> {
    const rows: { rows: ReadonlyArray<Record<string, unknown>> } = await this.database.execute(sql`
      SELECT
        reminder.id,
        reminder.todo_id,
        todo.workspace_id,
        reminder.created_by,
        todo.title,
        reminder.trigger_type,
        todo.due_at,
        CASE
          WHEN reminder.trigger_type = 'absolute' THEN reminder.remind_at
          ELSE todo.due_at - (reminder.offset_minutes * interval '1 minute')
        END AS effective_at
      FROM reminders AS reminder
      JOIN todos AS todo ON todo.id = reminder.todo_id
      JOIN workspaces AS workspace ON workspace.id = todo.workspace_id AND workspace.archived_at IS NULL
      JOIN workspace_members AS member
        ON member.workspace_id = todo.workspace_id AND member.user_id = reminder.created_by
      WHERE reminder.status = 'scheduled'
        AND todo.deleted_at IS NULL
        AND todo.status IN ('todo', 'in_progress')
        AND (
          (reminder.trigger_type = 'absolute' AND reminder.remind_at <= ${input.horizon})
          OR (
            reminder.trigger_type = 'before_due'
            AND todo.due_at IS NOT NULL
            AND (todo.due_at - (reminder.offset_minutes * interval '1 minute')) <= ${input.horizon}
          )
        )
      ORDER BY effective_at ASC, reminder.id ASC
      LIMIT ${PAGE * MAX_PAGES}
    `);

    return rows.rows.flatMap((row) => {
      const record = row as {
        id: string;
        todo_id: string;
        workspace_id: string;
        created_by: string;
        title: string;
        trigger_type: 'absolute' | 'before_due';
        due_at: Date | null;
        effective_at: Date | null;
      };

      if (!record.effective_at) {
        return [];
      }

      return [
        {
          id: record.id,
          todoId: record.todo_id,
          workspaceId: record.workspace_id,
          createdBy: record.created_by,
          title: record.title,
          triggerType: record.trigger_type,
          effectiveAt: new Date(record.effective_at),
          dueAt: record.due_at ? new Date(record.due_at) : null
        }
      ];
    });
  }
}
