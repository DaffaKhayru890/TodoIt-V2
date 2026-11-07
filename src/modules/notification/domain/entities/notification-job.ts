import { NotificationJobError } from '../errors/notification-error';
import {
  NotificationJobStatus,
  NotificationJobType,
  type NotificationJobStatus as JobStatus,
  type NotificationJobType as JobType
} from '../enums/notification-job-status';

export interface NotificationJobPayload {
  readonly dueAt?: string;
  readonly offsetMinutes?: number;
  readonly effectiveAt?: string;
  readonly triggerType?: 'absolute' | 'before_due';
  readonly notificationId?: string;
}

export interface NotificationJobSnapshot {
  readonly id: string;
  readonly type: JobType;
  readonly status: JobStatus;
  readonly idempotencyKey: string;
  readonly recipientUserId: string | null;
  readonly workspaceId: string | null;
  readonly todoId: string | null;
  readonly reminderId: string | null;
  readonly notificationId: string | null;
  readonly scheduledAt: Date;
  readonly availableAt: Date;
  readonly payload: NotificationJobPayload;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly lockedBy: string | null;
  readonly lockedAt: Date | null;
  readonly lockExpiresAt: Date | null;
  readonly lastErrorCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

export interface NewNotificationJob {
  readonly id: string;
  readonly type: JobType;
  readonly idempotencyKey: string;
  readonly recipientUserId: string | null;
  readonly workspaceId: string | null;
  readonly todoId: string | null;
  readonly reminderId: string | null;
  readonly notificationId: string | null;
  readonly scheduledAt: Date;
  readonly availableAt: Date;
  readonly payload: NotificationJobPayload;
  readonly maxAttempts: number;
  readonly now: Date;
}

const JOB_TYPES = new Set<string>(Object.values(NotificationJobType));

export class NotificationJob {
  private constructor(private readonly state: NotificationJobSnapshot) {}

  static create(input: NewNotificationJob): NotificationJob {
    if (!JOB_TYPES.has(input.type)) {
      throw new NotificationJobError('UNSUPPORTED_JOB', 'Jenis pekerjaan notifikasi tidak dikenal.');
    }

    if (input.idempotencyKey.trim().length === 0) {
      throw new NotificationJobError('INVALID_JOB', 'Kunci idempotensi pekerjaan wajib diisi.');
    }

    if (input.maxAttempts < 1) {
      throw new NotificationJobError('INVALID_JOB', 'maxAttempts harus lebih dari nol.');
    }

    return new NotificationJob({
      id: input.id,
      type: input.type,
      status: NotificationJobStatus.PENDING,
      idempotencyKey: input.idempotencyKey,
      recipientUserId: input.recipientUserId,
      workspaceId: input.workspaceId,
      todoId: input.todoId,
      reminderId: input.reminderId,
      notificationId: input.notificationId,
      scheduledAt: new Date(input.scheduledAt.getTime()),
      availableAt: new Date(input.availableAt.getTime()),
      payload: input.payload,
      attempts: 0,
      maxAttempts: input.maxAttempts,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      lastErrorCode: null,
      createdAt: new Date(input.now.getTime()),
      updatedAt: new Date(input.now.getTime()),
      completedAt: null
    });
  }

  static restore(snapshot: NotificationJobSnapshot): NotificationJob {
    return new NotificationJob(snapshot);
  }

  get snapshot(): NotificationJobSnapshot {
    return this.state;
  }

  get id(): string {
    return this.state.id;
  }

  get type(): JobType {
    return this.state.type;
  }

  get status(): JobStatus {
    return this.state.status;
  }

  get attempts(): number {
    return this.state.attempts;
  }

  get maxAttempts(): number {
    return this.state.maxAttempts;
  }

  get idempotencyKey(): string {
    return this.state.idempotencyKey;
  }

  get payload(): NotificationJobPayload {
    return this.state.payload;
  }

  get lockedBy(): string | null {
    return this.state.lockedBy;
  }

  ownsLease(workerId: string, now: Date): boolean {
    return (
      this.state.status === NotificationJobStatus.PROCESSING &&
      this.state.lockedBy === workerId &&
      this.state.lockExpiresAt !== null &&
      this.state.lockExpiresAt.getTime() > now.getTime()
    );
  }
}
