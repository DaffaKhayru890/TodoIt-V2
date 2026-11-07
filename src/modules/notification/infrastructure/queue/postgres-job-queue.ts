import { eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import {
  NotificationJob,
  type NewNotificationJob,
  type NotificationJobPayload
} from '../../domain/entities/notification-job';
import {
  NotificationJobStatus,
  type NotificationJobType
} from '../../domain/enums/notification-job-status';
import type {
  NotificationJobQueue,
  RetryJobInput
} from '../../domain/repositories/notification-job.repository';
import { notificationJobs } from '../persistence/notification-job.schema';

interface JobRow {
  id: string;
  type: string;
  status: string;
  idempotency_key: string;
  recipient_user_id: string | null;
  workspace_id: string | null;
  todo_id: string | null;
  reminder_id: string | null;
  notification_id: string | null;
  scheduled_at: Date;
  available_at: Date;
  payload: NotificationJobPayload | null;
  attempts: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: Date | null;
  lock_expires_at: Date | null;
  last_error_code: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

function mapJob(row: JobRow): NotificationJob {
  return NotificationJob.restore({
    id: row.id,
    type: row.type as NotificationJobType,
    status: row.status as NotificationJob['status'],
    idempotencyKey: row.idempotency_key,
    recipientUserId: row.recipient_user_id,
    workspaceId: row.workspace_id,
    todoId: row.todo_id,
    reminderId: row.reminder_id,
    notificationId: row.notification_id,
    scheduledAt: new Date(row.scheduled_at),
    availableAt: new Date(row.available_at),
    payload: row.payload ?? {},
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lockedBy: row.locked_by,
    lockedAt: row.locked_at ? new Date(row.locked_at) : null,
    lockExpiresAt: row.lock_expires_at ? new Date(row.lock_expires_at) : null,
    lastErrorCode: row.last_error_code,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null
  });
}

function clearLease(now: Date, extra: Record<string, unknown> = {}) {
  return {
    lockedBy: null,
    lockedAt: null,
    lockExpiresAt: null,
    updatedAt: now,
    ...extra
  };
}

export class PostgresNotificationJobQueue implements NotificationJobQueue {
  constructor(private readonly database: DatabaseExecutor) {}

  async enqueue(job: NewNotificationJob): Promise<void> {
    const created = NotificationJob.create(job);

    await this.database
      .insert(notificationJobs)
      .values({
        id: created.id,
        type: created.type,
        status: created.status,
        idempotencyKey: created.idempotencyKey,
        recipientUserId: created.snapshot.recipientUserId,
        workspaceId: created.snapshot.workspaceId,
        todoId: created.snapshot.todoId,
        reminderId: created.snapshot.reminderId,
        notificationId: created.snapshot.notificationId,
        scheduledAt: created.snapshot.scheduledAt,
        availableAt: created.snapshot.availableAt,
        payload: created.payload,
        attempts: 0,
        maxAttempts: created.maxAttempts,
        createdAt: created.snapshot.createdAt,
        updatedAt: created.snapshot.updatedAt
      })
      .onConflictDoNothing({ target: notificationJobs.idempotencyKey });
  }

  async claimNextBatch(input: {
    workerId: string;
    limit: number;
    leaseSeconds: number;
    now: Date;
  }): Promise<NotificationJob[]> {
    const lockUntil = new Date(input.now.getTime() + input.leaseSeconds * 1000);
    const result = await this.database.execute(sql`
      UPDATE notification_jobs AS job
      SET
        status = 'processing',
        locked_by = ${input.workerId},
        locked_at = ${input.now},
        lock_expires_at = ${lockUntil},
        attempts = job.attempts + 1,
        updated_at = ${input.now}
      WHERE job.id IN (
        SELECT candidate.id
        FROM notification_jobs AS candidate
        WHERE (
          candidate.status = 'pending' AND candidate.available_at <= ${input.now}
        ) OR (
          candidate.status = 'processing'
          AND candidate.lock_expires_at IS NOT NULL
          AND candidate.lock_expires_at <= ${input.now}
        )
        ORDER BY candidate.available_at ASC, candidate.id ASC
        LIMIT ${input.limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING job.*
    `);

    return result.rows.map((row) => mapJob(row as unknown as JobRow));
  }

  async complete(jobId: string, workerId: string, now: Date): Promise<boolean> {
    const rows = await this.database
      .update(notificationJobs)
      .set(clearLease(now, { status: NotificationJobStatus.COMPLETED, completedAt: now }))
      .where(
        sql`${notificationJobs.id} = ${jobId}
          AND ${notificationJobs.status} = 'processing'
          AND ${notificationJobs.lockedBy} = ${workerId}
          AND ${notificationJobs.lockExpiresAt} > ${now}`
      )
      .returning({ id: notificationJobs.id });

    return rows.length > 0;
  }

  async retry(jobId: string, input: RetryJobInput): Promise<boolean> {
    const rows = await this.database
      .update(notificationJobs)
      .set(
        clearLease(input.now, {
          status: NotificationJobStatus.PENDING,
          availableAt: input.availableAt,
          lastErrorCode: input.errorCode
        })
      )
      .where(
        sql`${notificationJobs.id} = ${jobId}
          AND ${notificationJobs.status} = 'processing'
          AND ${notificationJobs.lockedBy} = ${input.workerId}
          AND ${notificationJobs.lockExpiresAt} > ${input.now}`
      )
      .returning({ id: notificationJobs.id });

    return rows.length > 0;
  }

  async cancel(jobId: string, workerId: string | null, now: Date): Promise<boolean> {
    const owner =
      workerId === null
        ? sql`${notificationJobs.status} = 'pending'`
        : sql`${notificationJobs.status} = 'processing'
            AND ${notificationJobs.lockedBy} = ${workerId}
            AND ${notificationJobs.lockExpiresAt} > ${now}`;
    const rows = await this.database
      .update(notificationJobs)
      .set(clearLease(now, { status: NotificationJobStatus.CANCELLED }))
      .where(sql`${notificationJobs.id} = ${jobId} AND ${owner}`)
      .returning({ id: notificationJobs.id });

    return rows.length > 0;
  }

  async fail(jobId: string, workerId: string, errorCode: string, now: Date): Promise<boolean> {
    const rows = await this.database
      .update(notificationJobs)
      .set(clearLease(now, { status: NotificationJobStatus.FAILED, lastErrorCode: errorCode }))
      .where(
        sql`${notificationJobs.id} = ${jobId}
          AND ${notificationJobs.status} = 'processing'
          AND ${notificationJobs.lockedBy} = ${workerId}
          AND ${notificationJobs.lockExpiresAt} > ${now}`
      )
      .returning({ id: notificationJobs.id });

    return rows.length > 0;
  }

  async renewLease(jobId: string, workerId: string, leaseSeconds: number, now: Date): Promise<boolean> {
    const lockUntil = new Date(now.getTime() + leaseSeconds * 1000);
    const rows = await this.database
      .update(notificationJobs)
      .set({ lockExpiresAt: lockUntil, updatedAt: now })
      .where(
        sql`${notificationJobs.id} = ${jobId}
          AND ${notificationJobs.status} = 'processing'
          AND ${notificationJobs.lockedBy} = ${workerId}
          AND ${notificationJobs.lockExpiresAt} > ${now}`
      )
      .returning({ id: notificationJobs.id });

    return rows.length > 0;
  }

  async releaseLeases(workerId: string, now: Date): Promise<number> {
    const rows = await this.database
      .update(notificationJobs)
      .set({ lockExpiresAt: now, updatedAt: now })
      .where(
        sql`${notificationJobs.status} = 'processing' AND ${notificationJobs.lockedBy} = ${workerId}`
      )
      .returning({ id: notificationJobs.id });

    return rows.length;
  }

  async requeueFailed(jobId: string, now: Date): Promise<NotificationJob | null> {
    const rows = await this.database
      .update(notificationJobs)
      .set(
        clearLease(now, {
          status: NotificationJobStatus.PENDING,
          availableAt: now,
          attempts: 0,
          lastErrorCode: null
        })
      )
      .where(sql`${notificationJobs.id} = ${jobId} AND ${notificationJobs.status} = 'failed'`)
      .returning();

    return rows[0] ? mapJob(toSnake(rows[0])) : null;
  }

  async findById(jobId: string): Promise<NotificationJob | null> {
    const rows = await this.database
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.id, jobId))
      .limit(1);

    return rows[0] ? mapJob(toSnake(rows[0])) : null;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.database.execute(sql`
      SELECT status, count(*)::int AS total
      FROM notification_jobs
      GROUP BY status
    `);
    const counts: Record<string, number> = {};

    for (const row of rows.rows) {
      const record = row as { status?: string; total?: number };
      if (record.status) {
        counts[record.status] = Number(record.total ?? 0);
      }
    }

    return counts;
  }

  async cancelStale(now: Date, offsets: readonly number[]): Promise<number> {
    const offsetList = sql.join(
      offsets.map((offset) => sql`${offset}`),
      sql`, `
    );
    const dueSoon = await this.database.execute(sql`
      UPDATE notification_jobs AS job
      SET status = 'cancelled', updated_at = ${now}, locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
      WHERE job.status = 'pending'
        AND job.type = 'dispatch_todo_due_soon'
        AND NOT EXISTS (
          SELECT 1
          FROM todos AS todo
          JOIN workspaces AS workspace ON workspace.id = todo.workspace_id AND workspace.archived_at IS NULL
          JOIN workspace_members AS member
            ON member.workspace_id = todo.workspace_id AND member.user_id = todo.created_by
          WHERE todo.id = job.todo_id
            AND todo.deleted_at IS NULL
            AND todo.status IN ('todo', 'in_progress')
            AND todo.due_at IS NOT NULL
            AND todo.due_at > ${now}
            AND todo.due_at = (job.payload->>'dueAt')::timestamptz
            AND (job.payload->>'offsetMinutes')::int IN (${offsetList})
        )
    `);
    const reminders = await this.database.execute(sql`
      UPDATE notification_jobs AS job
      SET status = 'cancelled', updated_at = ${now}, locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
      WHERE job.status = 'pending'
        AND job.type = 'dispatch_reminder'
        AND NOT EXISTS (
          SELECT 1
          FROM reminders AS reminder
          JOIN todos AS todo ON todo.id = reminder.todo_id
          JOIN workspaces AS workspace ON workspace.id = todo.workspace_id AND workspace.archived_at IS NULL
          JOIN workspace_members AS member
            ON member.workspace_id = todo.workspace_id AND member.user_id = reminder.created_by
          WHERE reminder.id = job.reminder_id
            AND reminder.status = 'scheduled'
            AND todo.deleted_at IS NULL
            AND todo.status IN ('todo', 'in_progress')
            AND (
              (reminder.trigger_type = 'absolute' AND reminder.remind_at = (job.payload->>'effectiveAt')::timestamptz)
              OR (
                reminder.trigger_type = 'before_due'
                AND todo.due_at IS NOT NULL
                AND (todo.due_at - (reminder.offset_minutes * interval '1 minute')) = (job.payload->>'effectiveAt')::timestamptz
              )
            )
        )
    `);
    const email = await this.database.execute(sql`
      UPDATE notification_jobs AS job
      SET status = 'cancelled', updated_at = ${now}, locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
      WHERE job.status = 'pending'
        AND job.type = 'send_email'
        AND NOT EXISTS (
          SELECT 1
          FROM notification_preferences AS preference
          WHERE preference.user_id = job.recipient_user_id
            AND preference.email_enabled = true
        )
    `);

    return rowCount(dueSoon) + rowCount(reminders) + rowCount(email);
  }
}

function rowCount(result: { rowCount?: number | null }): number {
  return result.rowCount ?? 0;
}

function toSnake(row: typeof notificationJobs.$inferSelect): JobRow {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    idempotency_key: row.idempotencyKey,
    recipient_user_id: row.recipientUserId,
    workspace_id: row.workspaceId,
    todo_id: row.todoId,
    reminder_id: row.reminderId,
    notification_id: row.notificationId,
    scheduled_at: row.scheduledAt,
    available_at: row.availableAt,
    payload: (row.payload ?? {}) as NotificationJobPayload,
    attempts: row.attempts,
    max_attempts: row.maxAttempts,
    locked_by: row.lockedBy,
    locked_at: row.lockedAt,
    lock_expires_at: row.lockExpiresAt,
    last_error_code: row.lastErrorCode,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    completed_at: row.completedAt
  };
}
