import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id'),
  action: varchar('action', { length: 80 }).notNull(),
  resourceType: varchar('resource_type', { length: 40 }).notNull(),
  resourceId: uuid('resource_id'),
  workspaceId: uuid('workspace_id'),
  requestId: varchar('request_id', { length: 80 }),
  outcome: varchar('outcome', { length: 20 }).notNull(),
  metadata: jsonb('metadata'),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const rateLimitWindows = pgTable('rate_limit_windows', {
  bucketKey: text('bucket_key').primaryKey(),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true, mode: 'date' }).notNull(),
  requestCount: integer('request_count').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const workerHeartbeats = pgTable('worker_heartbeats', {
  workerId: varchar('worker_id', { length: 120 }).primaryKey(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }).notNull(),
  pendingJobs: integer('pending_jobs').notNull().default(0),
  processingJobs: integer('processing_jobs').notNull().default(0),
  failedJobs: integer('failed_jobs').notNull().default(0)
});
