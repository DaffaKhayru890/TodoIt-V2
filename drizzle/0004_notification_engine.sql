CREATE TABLE "notification_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"idempotency_key" text NOT NULL,
	"recipient_user_id" uuid,
	"workspace_id" uuid,
	"todo_id" uuid,
	"reminder_id" uuid,
	"notification_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"payload" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer NOT NULL,
	"locked_by" varchar(100),
	"locked_at" timestamp with time zone,
	"lock_expires_at" timestamp with time zone,
	"last_error_code" varchar(100),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "notification_jobs_type_check" CHECK ("notification_jobs"."type" IN ('dispatch_reminder', 'dispatch_todo_due_soon', 'send_email')),
	CONSTRAINT "notification_jobs_status_check" CHECK ("notification_jobs"."status" IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
	CONSTRAINT "notification_jobs_attempts_check" CHECK ("notification_jobs"."attempts" >= 0),
	CONSTRAINT "notification_jobs_max_attempts_check" CHECK ("notification_jobs"."max_attempts" > 0),
	CONSTRAINT "notification_jobs_lease_check" CHECK ((
        ("notification_jobs"."status" = 'processing' AND "notification_jobs"."locked_by" IS NOT NULL AND "notification_jobs"."locked_at" IS NOT NULL AND "notification_jobs"."lock_expires_at" IS NOT NULL)
        OR ("notification_jobs"."status" <> 'processing' AND "notification_jobs"."locked_by" IS NULL AND "notification_jobs"."locked_at" IS NULL AND "notification_jobs"."lock_expires_at" IS NULL)
      )),
	CONSTRAINT "notification_jobs_completed_at_check" CHECK ((
        ("notification_jobs"."status" = 'completed' AND "notification_jobs"."completed_at" IS NOT NULL)
        OR ("notification_jobs"."status" <> 'completed' AND "notification_jobs"."completed_at" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"todo_id" uuid,
	"reminder_id" uuid,
	"type" varchar(40) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"idempotency_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" IN ('reminder_due', 'todo_due_soon'))
);
--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_jobs_idempotency_key_uidx" ON "notification_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_jobs_claim_idx" ON "notification_jobs" USING btree ("available_at","id") WHERE "notification_jobs"."status" IN ('pending', 'processing');--> statement-breakpoint
CREATE INDEX "notification_jobs_lock_expiry_idx" ON "notification_jobs" USING btree ("lock_expires_at") WHERE "notification_jobs"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "notification_jobs_type_status_available_idx" ON "notification_jobs" USING btree ("type","status","available_at");--> statement-breakpoint
CREATE INDEX "notification_jobs_recipient_idx" ON "notification_jobs" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "notification_jobs_todo_id_idx" ON "notification_jobs" USING btree ("todo_id");--> statement-breakpoint
CREATE INDEX "notification_jobs_reminder_id_idx" ON "notification_jobs" USING btree ("reminder_id");--> statement-breakpoint
CREATE INDEX "notification_jobs_notification_id_idx" ON "notification_jobs" USING btree ("notification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idempotency_key_uidx" ON "notifications" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_id_idx" ON "notifications" USING btree ("recipient_user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_recipient_read_at_idx" ON "notifications" USING btree ("recipient_user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_type_created_idx" ON "notifications" USING btree ("recipient_user_id","type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("recipient_user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_workspace_id_idx" ON "notifications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "notifications_todo_id_idx" ON "notifications" USING btree ("todo_id");