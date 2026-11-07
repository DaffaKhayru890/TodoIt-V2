CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(80) NOT NULL,
	"resource_type" varchar(40) NOT NULL,
	"resource_id" uuid,
	"workspace_id" uuid,
	"request_id" varchar(80),
	"outcome" varchar(20) NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_windows" (
	"bucket_key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"worker_id" varchar(120) PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"pending_jobs" integer DEFAULT 0 NOT NULL,
	"processing_jobs" integer DEFAULT 0 NOT NULL,
	"failed_jobs" integer DEFAULT 0 NOT NULL
);
