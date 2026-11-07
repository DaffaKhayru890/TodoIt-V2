import type { Clock } from '../../../../shared/domain/clock';
import { Notification } from '../../domain/entities/notification';
import { NotificationJobType } from '../../domain/enums/notification-job-status';
import { NotificationType } from '../../domain/enums/notification-type';
import type { NotificationJob } from '../../domain/entities/notification-job';
import type { NotificationJobQueue } from '../../domain/repositories/notification-job.repository';
import type { NotificationRepository } from '../../domain/repositories/notification.repository';
import {
  dueSoonNotificationKey,
  dueSoonPhrase,
  emailJobKey,
  reminderNotificationKey
} from '../../domain/services/idempotency';
import { computeReminderEffectiveAt } from '../../../todo/domain/entities/reminder';
import { ReminderTriggerType } from '../../../todo/domain/enums/reminder-trigger-type';
import { TodoStatus } from '../../../todo/domain/enums/todo-status';
import type { DispatchContext } from '../ports/dispatch-context';

const ACTIVE = new Set<string>([TodoStatus.TODO, TodoStatus.IN_PROGRESS]);

export interface NotificationUnitOfWork {
  run<T>(
    work: (tx: {
      notifications: NotificationRepository;
      jobs: NotificationJobQueue;
      context: DispatchContext;
    }) => Promise<T>
  ): Promise<T>;
}

export class NotificationDispatcher {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly clock: Clock,
    private readonly maxAttempts: number
  ) {}

  async dispatch(job: NotificationJob, workerId: string): Promise<'completed' | 'cancelled'> {
    return await this.uow.run(async (tx) => {
      const now = this.clock.now();
      const plan =
        job.type === NotificationJobType.DISPATCH_REMINDER
          ? await this.planReminder(tx.context, job, now)
          : await this.planDueSoon(tx.context, job, now);

      if (!plan) {
        await tx.jobs.cancel(job.id, workerId, now);
        return 'cancelled' as const;
      }

      const notification = await tx.notifications.insert(
        Notification.create({
          id: crypto.randomUUID(),
          recipientUserId: plan.recipientUserId,
          workspaceId: plan.workspaceId,
          todoId: plan.todoId,
          reminderId: plan.reminderId,
          type: plan.type,
          title: plan.title,
          body: plan.body,
          data: plan.data,
          idempotencyKey: plan.idempotencyKey,
          now
        })
      );

      if (await tx.context.emailEnabled(plan.recipientUserId)) {
        await tx.jobs.enqueue({
          id: crypto.randomUUID(),
          type: NotificationJobType.SEND_EMAIL,
          idempotencyKey: emailJobKey(notification.id),
          recipientUserId: plan.recipientUserId,
          workspaceId: plan.workspaceId,
          todoId: plan.todoId,
          reminderId: plan.reminderId,
          notificationId: notification.id,
          scheduledAt: now,
          availableAt: now,
          payload: { notificationId: notification.id },
          maxAttempts: this.maxAttempts,
          now
        });
      }

      await tx.jobs.complete(job.id, workerId, now);
      return 'completed' as const;
    });
  }

  private async planDueSoon(context: DispatchContext, job: NotificationJob, now: Date) {
    if (!job.snapshot.todoId) {
      return null;
    }

    const todo = await context.findTodo(job.snapshot.todoId);
    const dueAt = job.payload.dueAt;
    const offset = job.payload.offsetMinutes;

    if (
      !todo ||
      !dueAt ||
      offset === undefined ||
      todo.deletedAt ||
      todo.workspaceArchivedAt ||
      !ACTIVE.has(todo.status) ||
      !todo.dueAt ||
      todo.dueAt.toISOString() !== dueAt ||
      todo.dueAt.getTime() <= now.getTime()
    ) {
      return null;
    }

    const member = await context.isMember(todo.workspaceId, todo.createdBy);

    if (!member) {
      return null;
    }

    return {
      recipientUserId: todo.createdBy,
      workspaceId: todo.workspaceId,
      todoId: todo.id,
      reminderId: null,
      type: NotificationType.TODO_DUE_SOON,
      title: 'Upcoming Deadline',
      body: `Your task "${todo.title}" is due in ${dueSoonPhrase(offset)}.`,
      idempotencyKey: dueSoonNotificationKey(todo.id, todo.dueAt, offset),
      data: {
        todoId: todo.id,
        workspaceId: todo.workspaceId,
        dueAt,
        offsetMinutes: offset
      }
    };
  }

  private async planReminder(context: DispatchContext, job: NotificationJob, now: Date) {
    if (!job.snapshot.reminderId) {
      return null;
    }

    const reminder = await context.findReminder(job.snapshot.reminderId);

    if (!reminder || reminder.status !== 'scheduled') {
      return null;
    }

    const todo = await context.findTodo(reminder.todoId);

    if (
      !todo ||
      todo.deletedAt ||
      todo.workspaceArchivedAt ||
      !ACTIVE.has(todo.status)
    ) {
      return null;
    }

    const effectiveAt = computeReminderEffectiveAt(
      reminder.triggerType === 'absolute' ? ReminderTriggerType.ABSOLUTE : ReminderTriggerType.BEFORE_DUE,
      reminder.remindAt,
      reminder.offsetMinutes,
      todo.dueAt
    );

    if (!effectiveAt || job.payload.effectiveAt !== effectiveAt.toISOString() || effectiveAt.getTime() > now.getTime()) {
      return null;
    }

    const member = await context.isMember(todo.workspaceId, reminder.createdBy);

    if (!member) {
      return null;
    }

    return {
      recipientUserId: reminder.createdBy,
      workspaceId: todo.workspaceId,
      todoId: todo.id,
      reminderId: reminder.id,
      type: NotificationType.REMINDER_DUE,
      title: 'Todo Reminder',
      body: `Your task "${todo.title}" is scheduled for a reminder.`,
      idempotencyKey: reminderNotificationKey(reminder.id, effectiveAt),
      data: {
        todoId: todo.id,
        workspaceId: todo.workspaceId,
        reminderId: reminder.id,
        effectiveAt: effectiveAt.toISOString(),
        ...(todo.dueAt ? { dueAt: todo.dueAt.toISOString() } : {})
      }
    };
  }
}
