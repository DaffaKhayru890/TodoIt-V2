import type { NewNotificationJob, NotificationJob } from '../entities/notification-job';

export interface RetryJobInput {
  readonly availableAt: Date;
  readonly errorCode: string;
  readonly workerId: string;
  readonly now: Date;
}

export interface NotificationJobQueue {
  enqueue(job: NewNotificationJob): Promise<void>;
  claimNextBatch(input: {
    workerId: string;
    limit: number;
    leaseSeconds: number;
    now: Date;
  }): Promise<NotificationJob[]>;
  complete(jobId: string, workerId: string, now: Date): Promise<boolean>;
  retry(jobId: string, input: RetryJobInput): Promise<boolean>;
  cancel(jobId: string, workerId: string | null, now: Date): Promise<boolean>;
  fail(jobId: string, workerId: string, errorCode: string, now: Date): Promise<boolean>;
  renewLease(jobId: string, workerId: string, leaseSeconds: number, now: Date): Promise<boolean>;
  releaseLeases(workerId: string, now: Date): Promise<number>;
  requeueFailed(jobId: string, now: Date): Promise<NotificationJob | null>;
  findById(jobId: string): Promise<NotificationJob | null>;
  countByStatus(): Promise<Record<string, number>>;
  cancelStale(now: Date, offsets: readonly number[]): Promise<number>;
}

export interface JobQueueStats {
  readonly pending: number;
  readonly processing: number;
  readonly failed: number;
  readonly completed: number;
}
