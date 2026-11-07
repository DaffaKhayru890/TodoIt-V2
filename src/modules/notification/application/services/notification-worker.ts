import type { Logger } from '../../../../shared/infrastructure/logging/logger';
import type { NotificationJobQueue } from '../../domain/repositories/notification-job.repository';
import type { NotificationJobRunner } from './notification-job-runner';
import type { NotificationReconciliation } from './notification-reconciliation';

export class NotificationWorkerRuntime {
  private stopping = false;
  private active = 0;

  constructor(
    private readonly workerId: string,
    private readonly reconciliation: NotificationReconciliation,
    private readonly queue: NotificationJobQueue,
    private readonly runner: NotificationJobRunner,
    private readonly logger: Logger,
    private readonly timing: {
      pollIntervalMs: number;
      schedulerIntervalSeconds: number;
      concurrency: number;
      leaseSeconds: number;
      graceMs: number;
    },
    private readonly sleep: (ms: number) => Promise<void>,
    private readonly heartbeat: ((counts: Record<string, number>) => Promise<void>) | null = null
  ) {}

  requestStop(): void {
    this.stopping = true;
  }

  async run(): Promise<void> {
    this.logger.info('worker started', { workerId: this.workerId });
    let nextSchedule = 0;

    while (!this.stopping) {
      const now = Date.now();

      if (now >= nextSchedule) {
        await this.scheduleOnce();
        nextSchedule = Date.now() + this.timing.schedulerIntervalSeconds * 1000;
      }

      try {
        const jobs = await this.queue.claimNextBatch({
          workerId: this.workerId,
          limit: this.timing.concurrency,
          leaseSeconds: this.timing.leaseSeconds,
          now: new Date()
        });

        if (jobs.length > 0) {
          this.logger.info('jobs claimed', { workerId: this.workerId, count: jobs.length });
        }

        await Promise.all(jobs.map((job) => this.track(job.id, () => this.runner.process(job, this.workerId, this.timing.leaseSeconds))));
      } catch (error) {
        this.logger.error('worker poll failed', {
          workerId: this.workerId,
          errorName: error instanceof Error ? error.name : 'Error'
        });
      }

      if (!this.stopping) {
        await this.sleep(this.timing.pollIntervalMs);
      }
    }

    const deadline = Date.now() + this.timing.graceMs;

    while (this.active > 0 && Date.now() < deadline) {
      await this.sleep(50);
    }

    const released = await this.queue.releaseLeases(this.workerId, new Date());
    this.logger.info('worker stopped', { workerId: this.workerId, releasedLeases: released });
  }

  private async scheduleOnce(): Promise<void> {
    this.logger.info('scheduler cycle started', { workerId: this.workerId });

    try {
      const result = await this.reconciliation.run();
      const counts = await this.queue.countByStatus();
      this.logger.info('scheduler cycle completed', {
        workerId: this.workerId,
        considered: result.considered,
        cancelled: result.cancelled,
        pending: counts.pending ?? 0,
        processing: counts.processing ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0
      });

      if (this.heartbeat) {
        await this.heartbeat(counts);
      }
    } catch (error) {
      this.logger.error('scheduler cycle failed', {
        workerId: this.workerId,
        errorName: error instanceof Error ? error.name : 'Error'
      });
    }
  }

  private async track(jobId: string, work: () => Promise<void>): Promise<void> {
    this.active += 1;

    try {
      await work();
    } catch (error) {
      this.logger.error('job processing failed', {
        jobId,
        workerId: this.workerId,
        errorName: error instanceof Error ? error.name : 'Error'
      });
    } finally {
      this.active -= 1;
    }
  }
}
