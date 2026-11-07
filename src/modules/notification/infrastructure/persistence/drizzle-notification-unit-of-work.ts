import type { Database } from '../../../../shared/infrastructure/database/client';
import type { NotificationUnitOfWork } from '../../application/services/notification-dispatcher';
import { PostgresNotificationJobQueue } from '../queue/postgres-job-queue';
import { DrizzleDispatchContext } from './drizzle-dispatch-context';
import { DrizzleNotificationRepository } from './drizzle-notification.repository';

export class DrizzleNotificationUnitOfWork implements NotificationUnitOfWork {
  constructor(private readonly database: Database) {}

  async run<T>(
    work: (tx: {
      notifications: DrizzleNotificationRepository;
      jobs: PostgresNotificationJobQueue;
      context: DrizzleDispatchContext;
    }) => Promise<T>
  ): Promise<T> {
    return await this.database.transaction(async (tx) => {
      return await work({
        notifications: new DrizzleNotificationRepository(tx),
        jobs: new PostgresNotificationJobQueue(tx),
        context: new DrizzleDispatchContext(tx)
      });
    });
  }
}
