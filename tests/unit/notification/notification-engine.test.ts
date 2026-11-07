import { describe, expect, test } from 'bun:test';
import { FixedClock } from '../../../src/shared/domain/clock';
import { createLogger } from '../../../src/shared/infrastructure/logging/logger';
import { Notification } from '../../../src/modules/notification/domain/entities/notification';
import { NotificationError } from '../../../src/modules/notification/domain/errors/notification-error';
import { NotificationJobType } from '../../../src/modules/notification/domain/enums/notification-job-status';
import { decideRetry } from '../../../src/modules/notification/domain/services/retry-policy';
import { dueSoonJobKey, notificationMessageId } from '../../../src/modules/notification/domain/services/idempotency';
import { NotificationReconciliation } from '../../../src/modules/notification/application/services/notification-reconciliation';
import { NotificationDispatcher } from '../../../src/modules/notification/application/services/notification-dispatcher';
import { NotificationJobRunner } from '../../../src/modules/notification/application/services/notification-job-runner';
import { NotificationWorkerRuntime } from '../../../src/modules/notification/application/services/notification-worker';
import { NotificationDeliveryError } from '../../../src/modules/notification/application/ports/notification-email.sender';
import { renderNotificationEmail } from '../../../src/modules/notification/infrastructure/email/notification-email.template';
import {
  InMemoryDispatchContext,
  InMemoryNotificationJobQueue,
  InMemoryNotificationRepository,
  InMemoryNotificationUnitOfWork,
  InMemoryScheduleSource
} from '../../helpers/in-memory-notification';

const NOW = new Date('2026-11-07T02:00:00.000Z');

describe('notification domain', () => {
  test('notifikasi baru belum dibaca dan mark read idempoten', () => {
    const notification = Notification.create({
      id: crypto.randomUUID(),
      recipientUserId: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      todoId: crypto.randomUUID(),
      reminderId: null,
      type: 'todo_due_soon',
      title: 'Upcoming Deadline',
      body: 'Your task "Complete Backend API" is due in 1 hour.',
      data: { offsetMinutes: 60 },
      idempotencyKey: 'notification:test',
      now: NOW
    });
    expect(notification.readAt).toBeNull();
    const read = notification.markRead(NOW);
    expect(read.markRead(new Date(NOW.getTime() + 1000)).readAt?.toISOString()).toBe(NOW.toISOString());
    expect(() =>
      Notification.create({
        id: crypto.randomUUID(),
        recipientUserId: '',
        workspaceId: crypto.randomUUID(),
        todoId: null,
        reminderId: null,
        type: 'todo_due_soon',
        title: 'Judul',
        body: 'Isi',
        data: {},
        idempotencyKey: 'key',
        now: NOW
      })
    ).toThrow(NotificationError);
    expect(() =>
      Notification.create({
        id: crypto.randomUUID(),
        recipientUserId: crypto.randomUUID(),
        workspaceId: crypto.randomUUID(),
        todoId: null,
        reminderId: null,
        type: 'unknown',
        title: 'Judul',
        body: 'Isi',
        data: {},
        idempotencyKey: 'key',
        now: NOW
      })
    ).toThrow(NotificationError);
  });

  test('backoff eksponensial dan batas maksimum', () => {
    const jitter = { next: () => 0.5 };
    expect(
      decideRetry({ attempts: 1, maxAttempts: 8, baseRetrySeconds: 5, maxRetrySeconds: 3600, permanent: false, jitter }).delaySeconds
    ).toBe(5);
    expect(
      decideRetry({ attempts: 2, maxAttempts: 8, baseRetrySeconds: 5, maxRetrySeconds: 3600, permanent: false, jitter }).delaySeconds
    ).toBe(10);
    expect(
      decideRetry({ attempts: 8, maxAttempts: 8, baseRetrySeconds: 5, maxRetrySeconds: 3600, permanent: false, jitter }).retry
    ).toBe(false);
    expect(
      decideRetry({ attempts: 1, maxAttempts: 8, baseRetrySeconds: 5, maxRetrySeconds: 3600, permanent: true, jitter }).retry
    ).toBe(false);
    expect(
      decideRetry({ attempts: 20, maxAttempts: 30, baseRetrySeconds: 5, maxRetrySeconds: 30, permanent: false, jitter }).delaySeconds
    ).toBe(30);
  });
});

describe('scheduler dan dispatcher', () => {
  test('menjadwalkan due-soon dan reminder tanpa duplikat', async () => {
    const source = new InMemoryScheduleSource();
    const queue = new InMemoryNotificationJobQueue();
    const clock = new FixedClock(NOW);
    const dueAt = new Date('2026-11-10T02:00:00.000Z');
    source.todos.push({
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      createdBy: '33333333-3333-4333-8333-333333333333',
      title: 'Complete Backend API',
      dueAt
    });
    source.reminders.push({
      id: '44444444-4444-4444-8444-444444444444',
      todoId: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      createdBy: '33333333-3333-4333-8333-333333333333',
      title: 'Learn PostgreSQL',
      triggerType: 'absolute',
      effectiveAt: new Date('2026-11-07T01:00:00.000Z'),
      dueAt
    });
    const reconciliation = new NotificationReconciliation(source, queue, clock, [60, 1440], 90, 8);
    await reconciliation.run();
    await reconciliation.run();
    expect(queue.jobs).toHaveLength(3);
    expect(queue.jobs.map((job) => job.idempotencyKey)).toContain(dueSoonJobKey(source.todos[0]!.id, dueAt, 60));
    expect(queue.jobs.map((job) => job.idempotencyKey)).toContain(dueSoonJobKey(source.todos[0]!.id, dueAt, 1440));
  });

  test('dispatcher membuat satu notifikasi dan email job, lalu menolak todo selesai', async () => {
    const notifications = new InMemoryNotificationRepository();
    const queue = new InMemoryNotificationJobQueue();
    const context = new InMemoryDispatchContext();
    const clock = new FixedClock(new Date('2026-11-10T01:30:00.000Z'));
    const dueAt = new Date('2026-11-10T02:00:00.000Z');
    const todoId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    context.todos.set(todoId, {
      id: todoId,
      title: 'Complete Backend API',
      status: 'todo',
      dueAt,
      deletedAt: null,
      workspaceId,
      createdBy: userId,
      workspaceArchivedAt: null
    });
    context.members.add(`${workspaceId}:${userId}`);
    context.emails.add(userId);
    await queue.enqueue({
      id: crypto.randomUUID(),
      type: NotificationJobType.DISPATCH_TODO_DUE_SOON,
      idempotencyKey: dueSoonJobKey(todoId, dueAt, 60),
      recipientUserId: userId,
      workspaceId,
      todoId,
      reminderId: null,
      notificationId: null,
      scheduledAt: new Date(dueAt.getTime() - 60 * 60_000),
      availableAt: clock.now(),
      payload: { dueAt: dueAt.toISOString(), offsetMinutes: 60 },
      maxAttempts: 8,
      now: clock.now()
    });
    const [job] = await queue.claimNextBatch({ workerId: 'worker-a', limit: 1, leaseSeconds: 60, now: clock.now() });
    const dispatcher = new NotificationDispatcher(new InMemoryNotificationUnitOfWork(notifications, queue, context), clock, 8);
    await dispatcher.dispatch(job!, 'worker-a');
    await dispatcher.dispatch(job!, 'worker-a');
    expect(notifications.items).toHaveLength(1);
    expect(notifications.items[0]?.body).toContain('due in 1 hour');
    expect(queue.jobs.filter((item) => item.type === NotificationJobType.SEND_EMAIL)).toHaveLength(1);
    context.todos.set(todoId, { ...context.todos.get(todoId)!, status: 'completed' });
    await queue.enqueue({
      id: crypto.randomUUID(),
      type: NotificationJobType.DISPATCH_TODO_DUE_SOON,
      idempotencyKey: 'lain',
      recipientUserId: userId,
      workspaceId,
      todoId,
      reminderId: null,
      notificationId: null,
      scheduledAt: clock.now(),
      availableAt: clock.now(),
      payload: { dueAt: dueAt.toISOString(), offsetMinutes: 60 },
      maxAttempts: 8,
      now: clock.now()
    });
    const [second] = await queue.claimNextBatch({ workerId: 'worker-a', limit: 1, leaseSeconds: 60, now: clock.now() });
    expect(await dispatcher.dispatch(second!, 'worker-a')).toBe('cancelled');
    expect(notifications.items).toHaveLength(1);
  });

  test('email gagal sementara di-retry dan notifikasi tetap ada', async () => {
    const notifications = new InMemoryNotificationRepository();
    const queue = new InMemoryNotificationJobQueue();
    const context = new InMemoryDispatchContext();
    const clock = new FixedClock(NOW);
    const notification = Notification.create({
      id: crypto.randomUUID(),
      recipientUserId: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      todoId: crypto.randomUUID(),
      reminderId: null,
      type: 'reminder_due',
      title: 'Todo Reminder',
      body: 'Your task "Learn PostgreSQL" is scheduled for a reminder.',
      data: {},
      idempotencyKey: 'notification:reminder',
      now: NOW
    });
    await notifications.insert(notification);
    context.users.set(notification.recipientUserId, {
      id: notification.recipientUserId,
      email: 'owner@example.com',
      displayName: 'Owner'
    });
    context.emails.add(notification.recipientUserId);
    await queue.enqueue({
      id: crypto.randomUUID(),
      type: NotificationJobType.SEND_EMAIL,
      idempotencyKey: `notification-email:${notification.id}`,
      recipientUserId: notification.recipientUserId,
      workspaceId: notification.workspaceId,
      todoId: notification.todoId,
      reminderId: null,
      notificationId: notification.id,
      scheduledAt: NOW,
      availableAt: NOW,
      payload: { notificationId: notification.id },
      maxAttempts: 8,
      now: NOW
    });
    const [job] = await queue.claimNextBatch({ workerId: 'worker-a', limit: 1, leaseSeconds: 60, now: NOW });
    const sender = {
      async send(): Promise<void> {
        throw new NotificationDeliveryError('SMTP_TEMPORARY', false, 'gagal');
      }
    };
    const runner = new NotificationJobRunner(
      queue,
      new NotificationDispatcher(new InMemoryNotificationUnitOfWork(notifications, queue, context), clock, 8),
      notifications,
      context,
      sender,
      clock,
      createLogger('silent'),
      { next: () => 0.5 },
      { baseRetrySeconds: 5, maxRetrySeconds: 3600 }
    );
    await runner.process(job!, 'worker-a', 60);
    expect(notifications.items).toHaveLength(1);
    expect(queue.jobs[0]?.status).toBe('pending');
    expect(queue.jobs[0]?.snapshot.lastErrorCode).toBe('SMTP_TEMPORARY');
    const rendered = renderNotificationEmail(
      {
        recipientEmail: 'owner@example.com',
        recipientName: 'Owner',
        title: notification.title,
        body: notification.body,
        todoId: notification.todoId,
        workspaceId: notification.workspaceId,
        notificationId: notification.id
      },
      'https://app.example.com'
    );
    expect(rendered.messageId).toBe(notificationMessageId(notification.id));
    expect(rendered.text).toContain('Learn PostgreSQL');
  });

  test('dua worker tidak mengklaim job yang sama dan lease kedaluwarsa bisa dipulihkan', async () => {
    const queue = new InMemoryNotificationJobQueue();
    await queue.enqueue({
      id: crypto.randomUUID(),
      type: NotificationJobType.SEND_EMAIL,
      idempotencyKey: 'notification-email:1',
      recipientUserId: null,
      workspaceId: null,
      todoId: null,
      reminderId: null,
      notificationId: null,
      scheduledAt: NOW,
      availableAt: NOW,
      payload: {},
      maxAttempts: 3,
      now: NOW
    });
    const [first, second] = await Promise.all([
      queue.claimNextBatch({ workerId: 'a', limit: 1, leaseSeconds: 60, now: NOW }),
      queue.claimNextBatch({ workerId: 'b', limit: 1, leaseSeconds: 60, now: NOW })
    ]);
    const claimed = [...first, ...second];
    expect(claimed).toHaveLength(1);
    const later = new Date(NOW.getTime() + 61_000);
    const recovered = await queue.claimNextBatch({ workerId: 'c', limit: 1, leaseSeconds: 60, now: later });
    expect(recovered[0]?.lockedBy).toBe('c');
    expect(recovered[0]?.attempts).toBe(2);
  });

  test('membatalkan reminder cancelled, dueAt berubah, anggota keluar, dan email yang dimatikan', async () => {
    const notifications = new InMemoryNotificationRepository();
    const queue = new InMemoryNotificationJobQueue();
    const context = new InMemoryDispatchContext();
    const clock = new FixedClock(NOW);
    const dispatcher = new NotificationDispatcher(new InMemoryNotificationUnitOfWork(notifications, queue, context), clock, 8);
    const workspaceId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const todoId = crypto.randomUUID();
    const reminderId = crypto.randomUUID();
    const dueAt = new Date('2026-11-10T02:00:00.000Z');
    context.todos.set(todoId, {
      id: todoId,
      title: 'Learn PostgreSQL',
      status: 'todo',
      dueAt,
      deletedAt: null,
      workspaceId,
      createdBy: userId,
      workspaceArchivedAt: null
    });
    context.reminders.set(reminderId, {
      id: reminderId,
      todoId,
      status: 'cancelled',
      triggerType: 'absolute',
      remindAt: NOW,
      offsetMinutes: null,
      createdBy: userId
    });
    context.members.add(`${workspaceId}:${userId}`);
    await queue.enqueue({
      id: crypto.randomUUID(),
      type: NotificationJobType.DISPATCH_REMINDER,
      idempotencyKey: 'reminder:stale',
      recipientUserId: userId,
      workspaceId,
      todoId,
      reminderId,
      notificationId: null,
      scheduledAt: NOW,
      availableAt: NOW,
      payload: { effectiveAt: NOW.toISOString(), triggerType: 'absolute' },
      maxAttempts: 8,
      now: NOW
    });
    const [reminderJob] = await queue.claimNextBatch({ workerId: 'worker-a', limit: 1, leaseSeconds: 60, now: NOW });
    expect(await dispatcher.dispatch(reminderJob!, 'worker-a')).toBe('cancelled');

    await queue.enqueue({
      id: crypto.randomUUID(),
      type: NotificationJobType.DISPATCH_TODO_DUE_SOON,
      idempotencyKey: 'due:changed',
      recipientUserId: userId,
      workspaceId,
      todoId,
      reminderId: null,
      notificationId: null,
      scheduledAt: NOW,
      availableAt: NOW,
      payload: { dueAt: new Date('2026-11-09T02:00:00.000Z').toISOString(), offsetMinutes: 60 },
      maxAttempts: 8,
      now: NOW
    });
    const [staleDue] = await queue.claimNextBatch({ workerId: 'worker-a', limit: 1, leaseSeconds: 60, now: NOW });
    expect(await dispatcher.dispatch(staleDue!, 'worker-a')).toBe('cancelled');

    context.members.delete(`${workspaceId}:${userId}`);
    await queue.enqueue({
      id: crypto.randomUUID(),
      type: NotificationJobType.DISPATCH_TODO_DUE_SOON,
      idempotencyKey: dueSoonJobKey(todoId, dueAt, 60),
      recipientUserId: userId,
      workspaceId,
      todoId,
      reminderId: null,
      notificationId: null,
      scheduledAt: new Date(dueAt.getTime() - 60 * 60_000),
      availableAt: NOW,
      payload: { dueAt: dueAt.toISOString(), offsetMinutes: 60 },
      maxAttempts: 8,
      now: NOW
    });
    const later = new Date('2026-11-10T01:30:00.000Z');
    clock.set(later);
    const [removed] = await queue.claimNextBatch({ workerId: 'worker-a', limit: 1, leaseSeconds: 60, now: later });
    expect(await dispatcher.dispatch(removed!, 'worker-a')).toBe('cancelled');
    expect(notifications.items).toHaveLength(0);

    const notification = Notification.create({
      id: crypto.randomUUID(),
      recipientUserId: userId,
      workspaceId,
      todoId,
      reminderId: null,
      type: 'todo_due_soon',
      title: 'Upcoming Deadline',
      body: 'due',
      data: {},
      idempotencyKey: 'notification:pref',
      now: later
    });
    await notifications.insert(notification);
    context.users.set(userId, { id: userId, email: 'owner@example.com', displayName: 'Owner' });
    await queue.enqueue({
      id: crypto.randomUUID(),
      type: NotificationJobType.SEND_EMAIL,
      idempotencyKey: `notification-email:${notification.id}`,
      recipientUserId: userId,
      workspaceId,
      todoId,
      reminderId: null,
      notificationId: notification.id,
      scheduledAt: later,
      availableAt: later,
      payload: { notificationId: notification.id },
      maxAttempts: 2,
      now: later
    });
    const [emailJob] = await queue.claimNextBatch({ workerId: 'worker-a', limit: 1, leaseSeconds: 60, now: later });
    const runner = new NotificationJobRunner(
      queue,
      dispatcher,
      notifications,
      context,
      {
        async send(): Promise<void> {
          throw new NotificationDeliveryError('SMTP_PERMANENT', true, 'ditolak');
        }
      },
      clock,
      createLogger('silent'),
      { next: () => 0 },
      { baseRetrySeconds: 5, maxRetrySeconds: 30 }
    );
    await runner.process(emailJob!, 'worker-a', 60);
    expect(queue.jobs.find((job) => job.id === emailJob!.id)?.status).toBe('cancelled');

    context.emails.add(userId);
    await queue.enqueue({
      id: crypto.randomUUID(),
      type: NotificationJobType.SEND_EMAIL,
      idempotencyKey: 'notification-email:permanent',
      recipientUserId: userId,
      workspaceId,
      todoId,
      reminderId: null,
      notificationId: notification.id,
      scheduledAt: later,
      availableAt: later,
      payload: { notificationId: notification.id },
      maxAttempts: 8,
      now: later
    });
    const [permanent] = await queue.claimNextBatch({ workerId: 'worker-a', limit: 1, leaseSeconds: 60, now: later });
    await runner.process(permanent!, 'worker-a', 60);
    const failed = queue.jobs.find((job) => job.id === permanent!.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.snapshot.lastErrorCode).toBe('SMTP_PERMANENT');
    const requeued = await queue.requeueFailed(permanent!.id, later);
    expect(requeued?.status).toBe('pending');
    expect(requeued?.attempts).toBe(0);
    expect(await queue.requeueFailed(permanent!.id, later)).toBeNull();
    expect(notifications.items).toHaveLength(1);
  });

  test('worker berhenti setelah satu siklus', async () => {
    const queue = new InMemoryNotificationJobQueue();
    const source = new InMemoryScheduleSource();
    const clock = new FixedClock(NOW);
    const reconciliation = new NotificationReconciliation(source, queue, clock, [60], 90, 8);
    const runtime = new NotificationWorkerRuntime(
      'worker-test',
      reconciliation,
      queue,
      new NotificationJobRunner(
        queue,
        new NotificationDispatcher(
          new InMemoryNotificationUnitOfWork(new InMemoryNotificationRepository(), queue, new InMemoryDispatchContext()),
          clock,
          8
        ),
        new InMemoryNotificationRepository(),
        new InMemoryDispatchContext(),
        { async send() {} },
        clock,
        createLogger('silent'),
        { next: () => 0 },
        { baseRetrySeconds: 5, maxRetrySeconds: 30 }
      ),
      createLogger('silent'),
      { pollIntervalMs: 1, schedulerIntervalSeconds: 60, concurrency: 1, leaseSeconds: 60, graceMs: 20 },
      async () => {
        runtime.requestStop();
      }
    );
    await runtime.run();
    expect(runtime).toBeDefined();
  });
});
