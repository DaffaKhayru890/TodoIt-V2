import type { Clock } from '../../../../shared/domain/clock';
import { NotificationJobType } from '../../domain/enums/notification-job-status';
import type { NotificationJobQueue } from '../../domain/repositories/notification-job.repository';
import { dueSoonJobKey, reminderJobKey } from '../../domain/services/idempotency';
import type { ScheduleSource } from '../ports/schedule-source';

export class NotificationReconciliation {
  constructor(
    private readonly source: ScheduleSource,
    private readonly queue: NotificationJobQueue,
    private readonly clock: Clock,
    private readonly offsets: readonly number[],
    private readonly lookaheadDays: number,
    private readonly maxAttempts: number
  ) {}

  async run(): Promise<{ considered: number; cancelled: number }> {
    const now = this.clock.now();
    const maxOffset = this.offsets[this.offsets.length - 1] ?? 0;
    const horizon = new Date(now.getTime() + this.lookaheadDays * 86_400_000 + maxOffset * 60_000);
    const todos = await this.source.listDueSoonTodos({ now, horizon });
    const reminders = await this.source.listReminders({ now, horizon });
    let considered = 0;

    for (const todo of todos) {
      for (const offsetMinutes of this.offsets) {
        const scheduledAt = new Date(todo.dueAt.getTime() - offsetMinutes * 60_000);

        if (todo.dueAt.getTime() <= now.getTime()) {
          continue;
        }

        await this.queue.enqueue({
          id: crypto.randomUUID(),
          type: NotificationJobType.DISPATCH_TODO_DUE_SOON,
          idempotencyKey: dueSoonJobKey(todo.id, todo.dueAt, offsetMinutes),
          recipientUserId: todo.createdBy,
          workspaceId: todo.workspaceId,
          todoId: todo.id,
          reminderId: null,
          notificationId: null,
          scheduledAt,
          availableAt: scheduledAt.getTime() < now.getTime() ? now : scheduledAt,
          payload: { dueAt: todo.dueAt.toISOString(), offsetMinutes },
          maxAttempts: this.maxAttempts,
          now
        });
        considered += 1;
      }
    }

    for (const reminder of reminders) {
      await this.queue.enqueue({
        id: crypto.randomUUID(),
        type: NotificationJobType.DISPATCH_REMINDER,
        idempotencyKey: reminderJobKey(reminder.id, reminder.effectiveAt),
        recipientUserId: reminder.createdBy,
        workspaceId: reminder.workspaceId,
        todoId: reminder.todoId,
        reminderId: reminder.id,
        notificationId: null,
        scheduledAt: reminder.effectiveAt,
        availableAt: reminder.effectiveAt.getTime() < now.getTime() ? now : reminder.effectiveAt,
        payload: {
          effectiveAt: reminder.effectiveAt.toISOString(),
          triggerType: reminder.triggerType
        },
        maxAttempts: this.maxAttempts,
        now
      });
      considered += 1;
    }

    const cancelled = await this.queue.cancelStale(now, this.offsets);

    return { considered, cancelled };
  }
}
