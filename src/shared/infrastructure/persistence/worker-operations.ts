import { sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../database/client';

export class DrizzleWorkerOperations {
  constructor(private readonly database: DatabaseExecutor) {}

  async beat(input: {
    workerId: string;
    pending: number;
    processing: number;
    failed: number;
    now: Date;
  }): Promise<void> {
    await this.database.execute(sql`
      INSERT INTO worker_heartbeats (worker_id, last_seen_at, pending_jobs, processing_jobs, failed_jobs)
      VALUES (${input.workerId}, ${input.now}, ${input.pending}, ${input.processing}, ${input.failed})
      ON CONFLICT (worker_id) DO UPDATE
      SET last_seen_at = ${input.now},
          pending_jobs = ${input.pending},
          processing_jobs = ${input.processing},
          failed_jobs = ${input.failed}
    `);
  }

  async cleanupJobs(input: { completedBefore: Date; failedBefore: Date; dryRun: boolean }): Promise<{
    completed: number;
    failed: number;
  }> {
    if (input.dryRun) {
      const completed = await this.database.execute(sql`
        SELECT count(*)::int AS total FROM notification_jobs
        WHERE status = 'completed' AND completed_at < ${input.completedBefore}
      `);
      const failed = await this.database.execute(sql`
        SELECT count(*)::int AS total FROM notification_jobs
        WHERE status = 'failed' AND updated_at < ${input.failedBefore}
      `);
      return { completed: Number(completed.rows[0]?.total ?? 0), failed: Number(failed.rows[0]?.total ?? 0) };
    }

    const completed = await this.database.execute(sql`
      DELETE FROM notification_jobs
      WHERE status = 'completed' AND completed_at < ${input.completedBefore}
      RETURNING id
    `);
    const failed = await this.database.execute(sql`
      DELETE FROM notification_jobs
      WHERE status = 'failed' AND updated_at < ${input.failedBefore}
      RETURNING id
    `);

    return { completed: completed.rows.length, failed: failed.rows.length };
  }
}
