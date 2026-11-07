import { Notification } from '../../src/modules/notification/domain/entities/notification';
import { NotificationJob, type NewNotificationJob } from '../../src/modules/notification/domain/entities/notification-job';
import { NotificationJobStatus } from '../../src/modules/notification/domain/enums/notification-job-status';
import type { NotificationPreference } from '../../src/modules/notification/domain/entities/notification-preference';
import type { NotificationListQuery, NotificationRepository } from '../../src/modules/notification/domain/repositories/notification.repository';
import type { NotificationJobQueue, RetryJobInput } from '../../src/modules/notification/domain/repositories/notification-job.repository';
import type { NotificationPreferenceRepository } from '../../src/modules/notification/domain/repositories/notification-preference.repository';
import type { DispatchContext, DispatchReminder, DispatchTodo, DispatchUser } from '../../src/modules/notification/application/ports/dispatch-context';
import type { DueSoonTodo, ScheduledReminder, ScheduleSource } from '../../src/modules/notification/application/ports/schedule-source';
import type { NotificationUnitOfWork } from '../../src/modules/notification/application/services/notification-dispatcher';

export class InMemoryNotificationRepository implements NotificationRepository {
  readonly items: Notification[] = [];

  async insert(notification: Notification): Promise<Notification> {
    const existing = this.items.find((item) => item.idempotencyKey === notification.idempotencyKey);
    if (existing) {
      return existing;
    }
    this.items.push(notification);
    return notification;
  }

  async findById(id: string): Promise<Notification | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<Notification | null> {
    return this.items.find((item) => item.idempotencyKey === key) ?? null;
  }

  async list(query: NotificationListQuery) {
    const filtered = this.items
      .filter((item) => item.recipientUserId === query.recipientUserId)
      .filter((item) => (query.readStatus === 'unread' ? item.readAt === null : true))
      .filter((item) => (query.readStatus === 'read' ? item.readAt !== null : true))
      .filter((item) => (query.type ? item.type === query.type : true))
      .filter((item) => {
        if (!query.cursor) return true;
        const created = item.createdAt.getTime();
        return created < query.cursor.createdAt.getTime() || (created === query.cursor.createdAt.getTime() && item.id < query.cursor.id);
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
    const page = filtered.slice(0, query.limit + 1);
    return { items: page.slice(0, query.limit), hasMore: page.length > query.limit };
  }

  async countUnread(recipientUserId: string): Promise<number> {
    return this.items.filter((item) => item.recipientUserId === recipientUserId && item.readAt === null).length;
  }

  async markRead(id: string, recipientUserId: string, readAt: Date): Promise<Notification | null> {
    const index = this.items.findIndex((item) => item.id === id && item.recipientUserId === recipientUserId);
    const current = this.items[index];
    if (!current) return null;
    const next = current.markRead(readAt);
    this.items[index] = next;
    return next;
  }

  async markAllRead(recipientUserId: string, readAt: Date): Promise<number> {
    let updated = 0;

    for (let index = 0; index < this.items.length; index += 1) {
      const item = this.items[index];

      if (item && item.recipientUserId === recipientUserId && item.readAt === null) {
        this.items[index] = item.markRead(readAt);
        updated += 1;
      }
    }

    return updated;
  }
}

export class InMemoryNotificationJobQueue implements NotificationJobQueue {
  readonly jobs: NotificationJob[] = [];
  private chain: Promise<unknown> = Promise.resolve();

  async enqueue(job: NewNotificationJob): Promise<void> {
    if (this.jobs.some((item) => item.idempotencyKey === job.idempotencyKey)) {
      return;
    }
    this.jobs.push(NotificationJob.create(job));
  }

  async claimNextBatch(input: { workerId: string; limit: number; leaseSeconds: number; now: Date }): Promise<NotificationJob[]> {
    const run = this.chain.then(() => {
      const ready = this.jobs.filter((job) => {
        const state = job.snapshot;
        const pending = state.status === NotificationJobStatus.PENDING && state.availableAt.getTime() <= input.now.getTime();
        const expired = state.status === NotificationJobStatus.PROCESSING && state.lockExpiresAt !== null && state.lockExpiresAt.getTime() <= input.now.getTime();
        return pending || expired;
      });
      const picked = ready.slice(0, input.limit);
      const claimed = picked.map((job) => {
        const state = job.snapshot;
        const next = NotificationJob.restore({
          ...state,
          status: NotificationJobStatus.PROCESSING,
          attempts: state.attempts + 1,
          lockedBy: input.workerId,
          lockedAt: input.now,
          lockExpiresAt: new Date(input.now.getTime() + input.leaseSeconds * 1000),
          updatedAt: input.now
        });
        this.jobs[this.jobs.findIndex((item) => item.id === job.id)] = next;
        return next;
      });
      return claimed;
    });
    this.chain = run.then(() => undefined, () => undefined);
    return await run;
  }

  async complete(jobId: string, workerId: string, now: Date): Promise<boolean> {
    return this.transition(jobId, workerId, now, (state) => ({
      ...state,
      status: NotificationJobStatus.COMPLETED,
      completedAt: now,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      updatedAt: now
    }));
  }

  async retry(jobId: string, input: RetryJobInput): Promise<boolean> {
    return this.transition(jobId, input.workerId, input.now, (state) => ({
      ...state,
      status: NotificationJobStatus.PENDING,
      availableAt: input.availableAt,
      lastErrorCode: input.errorCode,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      updatedAt: input.now
    }));
  }

  async cancel(jobId: string, workerId: string | null, now: Date): Promise<boolean> {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job) return false;
    if (workerId === null && job.status !== NotificationJobStatus.PENDING) return false;
    if (workerId !== null && !job.ownsLease(workerId, now)) return false;
    this.replace(jobId, {
      ...job.snapshot,
      status: NotificationJobStatus.CANCELLED,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      updatedAt: now
    });
    return true;
  }

  async fail(jobId: string, workerId: string, errorCode: string, now: Date): Promise<boolean> {
    return this.transition(jobId, workerId, now, (state) => ({
      ...state,
      status: NotificationJobStatus.FAILED,
      lastErrorCode: errorCode,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      updatedAt: now
    }));
  }

  async renewLease(jobId: string, workerId: string, leaseSeconds: number, now: Date): Promise<boolean> {
    return this.transition(jobId, workerId, now, (state) => ({
      ...state,
      lockExpiresAt: new Date(now.getTime() + leaseSeconds * 1000),
      updatedAt: now
    }));
  }

  async releaseLeases(workerId: string, now: Date): Promise<number> {
    let released = 0;
    for (const job of this.jobs) {
      if (job.status === NotificationJobStatus.PROCESSING && job.lockedBy === workerId) {
        this.replace(job.id, { ...job.snapshot, lockExpiresAt: now, updatedAt: now });
        released += 1;
      }
    }
    return released;
  }

  async requeueFailed(jobId: string, now: Date): Promise<NotificationJob | null> {
    const job = this.jobs.find((item) => item.id === jobId && item.status === NotificationJobStatus.FAILED);
    if (!job) return null;
    const next = NotificationJob.restore({
      ...job.snapshot,
      status: NotificationJobStatus.PENDING,
      availableAt: now,
      attempts: 0,
      lastErrorCode: null,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      updatedAt: now
    });
    this.replace(jobId, next.snapshot);
    return next;
  }

  async findById(jobId: string): Promise<NotificationJob | null> {
    return this.jobs.find((item) => item.id === jobId) ?? null;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const job of this.jobs) {
      counts[job.status] = (counts[job.status] ?? 0) + 1;
    }
    return counts;
  }

  async cancelStale(): Promise<number> {
    return 0;
  }

  private transition(
    jobId: string,
    workerId: string,
    now: Date,
    next: (state: NotificationJob['snapshot']) => NotificationJob['snapshot']
  ): boolean {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job || !job.ownsLease(workerId, now)) return false;
    this.replace(jobId, next(job.snapshot));
    return true;
  }

  private replace(jobId: string, snapshot: NotificationJob['snapshot']): void {
    const index = this.jobs.findIndex((item) => item.id === jobId);
    if (index >= 0) {
      this.jobs[index] = NotificationJob.restore(snapshot);
    }
  }
}

export class InMemoryScheduleSource implements ScheduleSource {
  todos: DueSoonTodo[] = [];
  reminders: ScheduledReminder[] = [];

  async listDueSoonTodos(): Promise<readonly DueSoonTodo[]> {
    return this.todos;
  }

  async listReminders(): Promise<readonly ScheduledReminder[]> {
    return this.reminders;
  }
}

export class InMemoryDispatchContext implements DispatchContext {
  todos = new Map<string, DispatchTodo>();
  reminders = new Map<string, DispatchReminder>();
  members = new Set<string>();
  emails = new Set<string>();
  users = new Map<string, DispatchUser>();

  async findTodo(todoId: string): Promise<DispatchTodo | null> {
    return this.todos.get(todoId) ?? null;
  }

  async findReminder(reminderId: string): Promise<DispatchReminder | null> {
    return this.reminders.get(reminderId) ?? null;
  }

  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    return this.members.has(`${workspaceId}:${userId}`);
  }

  async emailEnabled(userId: string): Promise<boolean> {
    return this.emails.has(userId);
  }

  async findUser(userId: string): Promise<DispatchUser | null> {
    return this.users.get(userId) ?? null;
  }
}

export class InMemoryNotificationPreferences implements NotificationPreferenceRepository {
  readonly items = new Map<string, NotificationPreference>();

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    return this.items.get(userId) ?? null;
  }

  async upsert(preference: NotificationPreference): Promise<NotificationPreference> {
    this.items.set(preference.userId, preference);
    return preference;
  }
}

export class InMemoryNotificationUnitOfWork implements NotificationUnitOfWork {
  constructor(
    private readonly notifications: InMemoryNotificationRepository,
    private readonly jobs: InMemoryNotificationJobQueue,
    private readonly context: InMemoryDispatchContext
  ) {}

  async run<T>(work: (tx: { notifications: NotificationRepository; jobs: NotificationJobQueue; context: DispatchContext }) => Promise<T>): Promise<T> {
    return await work({ notifications: this.notifications, jobs: this.jobs, context: this.context });
  }
}
