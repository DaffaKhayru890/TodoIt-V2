import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { loadAppConfig } from '../../src/config/app-config';
import { createDatabaseClient, type DatabaseClient } from '../../src/shared/infrastructure/database/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { DrizzleAuthRepository } from '../../src/modules/auth/infrastructure/persistence/drizzle-auth.repository';
import { DrizzleWorkspaceRepository } from '../../src/modules/workspace/infrastructure/persistence/drizzle-workspace.repository';
import { PostgresNotificationJobQueue } from '../../src/modules/notification/infrastructure/queue/postgres-job-queue';
import { DrizzleNotificationRepository } from '../../src/modules/notification/infrastructure/persistence/drizzle-notification.repository';
import { DrizzleNotificationPreferenceRepository } from '../../src/modules/notification/infrastructure/persistence/drizzle-notification-preference.repository';
import { Notification } from '../../src/modules/notification/domain/entities/notification';
import { NotificationJobType } from '../../src/modules/notification/domain/enums/notification-job-status';
import { toEmail } from '../../src/modules/auth/domain/value-objects/email';

const config = loadAppConfig();
let client: DatabaseClient;

beforeAll(() => {
  client = createDatabaseClient(config.database, createLogger('silent'));
});

afterAll(async () => {
  await client.close();
});

describe('notification database', () => {
  test('claim SKIP LOCKED, idempotensi, preferensi, dan requeue', async () => {
    const auth = new DrizzleAuthRepository(client);
    const workspaces = new DrizzleWorkspaceRepository(client);
    const user = await auth.createNewUser({
      email: toEmail(`notify_${crypto.randomUUID()}@example.com`),
      displayName: 'Notify',
      passwordHash: 'hash',
      now: new Date()
    });
    const { workspace } = await workspaces.createWorkspaceWithMembership({
      name: `Notify ${crypto.randomUUID().slice(0, 6)}`,
      description: null,
      createdBy: user.id,
      now: new Date()
    });
    const queue = new PostgresNotificationJobQueue(client.db);
    const now = new Date();
    const key = `todo-due-soon:${crypto.randomUUID()}:${now.toISOString()}:60`;
    const job = {
      id: crypto.randomUUID(),
      type: NotificationJobType.DISPATCH_TODO_DUE_SOON,
      idempotencyKey: key,
      recipientUserId: user.id,
      workspaceId: workspace.id,
      todoId: null,
      reminderId: null,
      notificationId: null,
      scheduledAt: new Date(0),
      availableAt: new Date(0),
      payload: { dueAt: now.toISOString(), offsetMinutes: 60 },
      maxAttempts: 3,
      now
    };
    await queue.enqueue(job);
    await queue.enqueue({ ...job, id: crypto.randomUUID() });
    const rows = await client.db.execute(sql`SELECT count(*)::int AS total FROM notification_jobs WHERE idempotency_key = ${key}`);
    expect(Number(rows.rows[0]?.total)).toBe(1);

    const [left, right] = await Promise.all([
      queue.claimNextBatch({ workerId: 'left', limit: 1, leaseSeconds: 30, now }),
      queue.claimNextBatch({ workerId: 'right', limit: 1, leaseSeconds: 30, now })
    ]);
    const claimed = [...left, ...right].filter((job) => job.idempotencyKey === key);
    expect(claimed).toHaveLength(1);
    const failed = await queue.fail(claimed[0]!.id, claimed[0]!.lockedBy ?? '', 'SMTP_TEMPORARY', new Date(now.getTime() + 1000));
    expect(failed).toBe(true);
    const requeued = await queue.requeueFailed(claimed[0]!.id, new Date(now.getTime() + 2000));
    expect(requeued?.status).toBe('pending');
    await expect(queue.requeueFailed(claimed[0]!.id, now)).resolves.toBeNull();

    const notifications = new DrizzleNotificationRepository(client.db);
    const created = await notifications.insert(
      Notification.create({
        id: crypto.randomUUID(),
        recipientUserId: user.id,
        workspaceId: workspace.id,
        todoId: null,
        reminderId: null,
        type: 'todo_due_soon',
        title: 'Upcoming Deadline',
        body: 'due',
        data: { workspaceId: workspace.id },
        idempotencyKey: `notification:${key}`,
        now
      })
    );
    const duplicate = await notifications.insert(
      Notification.create({
        id: crypto.randomUUID(),
        recipientUserId: user.id,
        workspaceId: workspace.id,
        todoId: null,
        reminderId: null,
        type: 'todo_due_soon',
        title: 'Upcoming Deadline',
        body: 'due',
        data: {},
        idempotencyKey: created.idempotencyKey,
        now
      })
    );
    expect(duplicate.id).toBe(created.id);
    const preferences = new DrizzleNotificationPreferenceRepository(client.db);
    const saved = await preferences.upsert({ userId: user.id, emailEnabled: true, updatedAt: now });
    expect(saved.emailEnabled).toBe(true);
    const plan = await client.db.execute(sql`
      EXPLAIN SELECT count(*) FROM notifications WHERE recipient_user_id = ${user.id} AND read_at IS NULL
    `);
    const text = plan.rows.map((row) => Object.values(row).join(' ')).join('\n');
    expect(text.toLowerCase()).toContain('notification');
  });
});
