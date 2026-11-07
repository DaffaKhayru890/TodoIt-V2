import { lt } from 'drizzle-orm';
import type { AuditRecorder, NewAuditEvent } from '../../application/audit-recorder';
import type { DatabaseExecutor } from '../database/client';
import { auditEvents } from './operations.schema';

export class DrizzleAuditRecorder implements AuditRecorder {
  constructor(private readonly database: DatabaseExecutor) {}

  async record(event: NewAuditEvent): Promise<void> {
    await this.database.insert(auditEvents).values({
      actorUserId: event.actorUserId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      workspaceId: event.workspaceId,
      requestId: event.requestId,
      outcome: event.outcome,
      metadata: event.metadata,
      occurredAt: event.occurredAt
    });
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const removed = await this.database.delete(auditEvents).where(lt(auditEvents.occurredAt, cutoff)).returning({ id: auditEvents.id });
    return removed.length;
  }
}
