import type { Clock } from '../../../../shared/domain/clock';
import type { Logger } from '../../../../shared/infrastructure/logging/logger';
import { NotificationJobType } from '../../domain/enums/notification-job-status';
import type { NotificationJob } from '../../domain/entities/notification-job';
import type { NotificationJobQueue } from '../../domain/repositories/notification-job.repository';
import type { NotificationRepository } from '../../domain/repositories/notification.repository';
import { decideRetry, type RetryJitterSource } from '../../domain/services/retry-policy';
import { NotificationDeliveryError, type NotificationEmailSender } from '../ports/notification-email.sender';
import type { DispatchContext } from '../ports/dispatch-context';
import type { NotificationDispatcher } from './notification-dispatcher';

export class NotificationJobRunner {
  constructor(
    private readonly queue: NotificationJobQueue,
    private readonly dispatcher: NotificationDispatcher,
    private readonly notifications: NotificationRepository,
    private readonly context: DispatchContext,
    private readonly email: NotificationEmailSender,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly jitter: RetryJitterSource,
    private readonly retry: {
      baseRetrySeconds: number;
      maxRetrySeconds: number;
    }
  ) {}

  async process(job: NotificationJob, workerId: string, leaseSeconds: number): Promise<void> {
    const heartbeat = setInterval(() => {
      void this.queue.renewLease(job.id, workerId, leaseSeconds, this.clock.now());
    }, Math.max(1000, (leaseSeconds * 1000) / 3));

    try {
      if (job.type === NotificationJobType.SEND_EMAIL) {
        await this.sendEmail(job, workerId);
        return;
      }

      if (job.type === NotificationJobType.DISPATCH_REMINDER || job.type === NotificationJobType.DISPATCH_TODO_DUE_SOON) {
        const outcome = await this.dispatcher.dispatch(job, workerId);
        this.logger.info(outcome === 'cancelled' ? 'job cancelled' : 'job completed', {
          jobId: job.id,
          jobType: job.type,
          workerId,
          attempt: job.attempts
        });
        return;
      }

      await this.fail(job, workerId, 'UNSUPPORTED_JOB', true);
    } catch (error) {
      const permanent = error instanceof NotificationDeliveryError ? error.permanent : false;
      const code = error instanceof NotificationDeliveryError ? error.code : 'TRANSIENT_FAILURE';
      await this.fail(job, workerId, code, permanent);
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async sendEmail(job: NotificationJob, workerId: string): Promise<void> {
    const now = this.clock.now();
    const notificationId = job.payload.notificationId ?? job.snapshot.notificationId;

    if (!notificationId) {
      await this.fail(job, workerId, 'NOTIFICATION_MISSING', true);
      return;
    }

    const notification = await this.notifications.findById(notificationId);
    const user = notification ? await this.context.findUser(notification.recipientUserId) : null;
    const enabled = notification ? await this.context.emailEnabled(notification.recipientUserId) : false;

    if (!notification || !user) {
      await this.fail(job, workerId, 'NOTIFICATION_MISSING', true);
      return;
    }

    if (!enabled) {
      await this.queue.cancel(job.id, workerId, now);
      this.logger.info('job cancelled', { jobId: job.id, jobType: job.type, workerId });
      return;
    }

    if (!user.email.includes('@')) {
      await this.fail(job, workerId, 'INVALID_RECIPIENT', true);
      return;
    }

    await this.email.send({
      recipientEmail: user.email,
      recipientName: user.displayName,
      title: notification.title,
      body: notification.body,
      todoId: notification.todoId,
      workspaceId: notification.workspaceId,
      notificationId: notification.id
    });
    const completed = await this.queue.complete(job.id, workerId, this.clock.now());

    if (!completed) {
      this.logger.warn('job completion skipped', { jobId: job.id, workerId });
      return;
    }

    this.logger.info('job completed', { jobId: job.id, jobType: job.type, workerId, attempt: job.attempts });
  }

  private async fail(job: NotificationJob, workerId: string, code: string, permanent: boolean): Promise<void> {
    const now = this.clock.now();
    const decision = decideRetry({
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      baseRetrySeconds: this.retry.baseRetrySeconds,
      maxRetrySeconds: this.retry.maxRetrySeconds,
      permanent,
      jitter: this.jitter
    });

    if (!decision.retry) {
      await this.queue.fail(job.id, workerId, code, now);
      this.logger.warn('job failed', { jobId: job.id, jobType: job.type, workerId, attempt: job.attempts });
      return;
    }

    await this.queue.retry(job.id, {
      availableAt: new Date(now.getTime() + decision.delaySeconds * 1000),
      errorCode: code,
      workerId,
      now
    });
    this.logger.info('job retried', { jobId: job.id, jobType: job.type, workerId, attempt: job.attempts });
  }
}
