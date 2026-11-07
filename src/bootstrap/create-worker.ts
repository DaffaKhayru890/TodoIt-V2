import { hostname } from 'node:os';
import type { AppConfig } from '../config/app-config';
import { createDatabaseClient, type DatabaseClient } from '../shared/infrastructure/database/client';
import { createSmtpTransport } from '../shared/infrastructure/email/smtp-transport';
import { createLogger, type Logger } from '../shared/infrastructure/logging/logger';
import { systemClock } from '../shared/domain/clock';
import { NotificationDispatcher } from '../modules/notification/application/services/notification-dispatcher';
import { NotificationJobRunner } from '../modules/notification/application/services/notification-job-runner';
import { NotificationReconciliation } from '../modules/notification/application/services/notification-reconciliation';
import { NotificationWorkerRuntime } from '../modules/notification/application/services/notification-worker';
import { SmtpNotificationEmailSender } from '../modules/notification/infrastructure/email/smtp-notification-email.sender';
import { DrizzleDispatchContext } from '../modules/notification/infrastructure/persistence/drizzle-dispatch-context';
import { DrizzleNotificationRepository } from '../modules/notification/infrastructure/persistence/drizzle-notification.repository';
import { DrizzleNotificationUnitOfWork } from '../modules/notification/infrastructure/persistence/drizzle-notification-unit-of-work';
import { PostgresNotificationJobQueue } from '../modules/notification/infrastructure/queue/postgres-job-queue';
import { PostgresScheduleSource } from '../modules/notification/infrastructure/scheduling/postgres-schedule.source';
import { DrizzleWorkerOperations } from '../shared/infrastructure/persistence/worker-operations';

export interface WorkerHandle {
  readonly runtime: NotificationWorkerRuntime;
  readonly database: DatabaseClient;
  readonly logger: Logger;
  readonly queue: PostgresNotificationJobQueue;
  readonly reconciliation: NotificationReconciliation;
  readonly operations: DrizzleWorkerOperations;
}

export function createWorker(config: AppConfig, workerId = `worker-${hostname()}-${process.pid}`): WorkerHandle {
  const logger = createLogger(config.logLevel, undefined, {
    service: config.appName,
    environment: config.environment
  });
  const database = createDatabaseClient(config.database, logger);
  const operations = new DrizzleWorkerOperations(database.db);
  const queue = new PostgresNotificationJobQueue(database.db);
  const reconciliation = new NotificationReconciliation(
    new PostgresScheduleSource(database.db),
    queue,
    systemClock,
    config.notification.dueSoonOffsetMinutes,
    config.notification.lookaheadDays,
    config.notification.maxAttempts
  );
  const dispatcher = new NotificationDispatcher(
    new DrizzleNotificationUnitOfWork(database.db),
    systemClock,
    config.notification.maxAttempts
  );
  const runner = new NotificationJobRunner(
    queue,
    dispatcher,
    new DrizzleNotificationRepository(database.db),
    new DrizzleDispatchContext(database.db),
    new SmtpNotificationEmailSender(
      createSmtpTransport(config.smtp),
      config.smtp.from,
      config.webAppUrl,
      logger.child({ component: 'notification-email' })
    ),
    systemClock,
    logger.child({ component: 'notification-worker' }),
    { next: () => Math.random() },
    {
      baseRetrySeconds: config.notification.baseRetrySeconds,
      maxRetrySeconds: config.notification.maxRetrySeconds
    }
  );
  const runtime = new NotificationWorkerRuntime(
    workerId,
    reconciliation,
    queue,
    runner,
    logger.child({ component: 'notification-worker' }),
    {
      pollIntervalMs: config.notification.pollIntervalMs,
      schedulerIntervalSeconds: config.notification.schedulerIntervalSeconds,
      concurrency: config.notification.concurrency,
      leaseSeconds: config.notification.leaseSeconds,
      graceMs: Math.min(config.security.shutdownGraceMs, config.notification.leaseSeconds * 1000)
    },
    (ms) => Bun.sleep(ms),
    async (counts) => {
      await operations.beat({
        workerId,
        pending: counts.pending ?? 0,
        processing: counts.processing ?? 0,
        failed: counts.failed ?? 0,
        now: systemClock.now()
      });
    }
  );

  return { runtime, database, logger, queue, reconciliation, operations };
}
